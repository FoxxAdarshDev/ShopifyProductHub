import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { shopifyService } from "./services/shopify";
import { htmlGenerator } from "./services/htmlGenerator";
import { extractContentFromHtml } from "./services/contentExtractor";
import { insertProductSchema, insertProductContentSchema, insertContentTemplateSchema, insertLogoSchema, insertDraftContentSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Product lookup by SKU
  app.get("/api/products/lookup/:sku", async (req, res) => {
    try {
      const { sku } = req.params;
      
      // First check our database
      let product = await storage.getProductBySku(sku);
      
      // If not found, try fuzzy matching in database (for cases like "66P-700437-FLS" vs "66P-700437-FLS-1")
      if (!product) {
        console.log(`Trying fuzzy database search with partial SKU: "${sku}"`);
        const fuzzyResults = await storage.searchProductsBySku(sku);
        if (fuzzyResults.length > 0) {
          product = fuzzyResults[0]; // Take the first match
          console.log(`Found fuzzy match in database: ${product.sku}`);
        }
      }
      
      // If not found, try to fetch from Shopify
      if (!product) {
        try {
          console.log(`Product not found in local database, searching Shopify for SKU: ${sku}`);
          const shopifyProduct = await shopifyService.getProductBySku(sku);
          if (shopifyProduct) {
            console.log(`Found product in Shopify, creating local copy: ${shopifyProduct.title}`);
            // Find the specific variant with this SKU
            const matchingVariant = shopifyProduct.variants.find(v => v.sku === sku);
            product = await storage.createProduct({
              shopifyId: shopifyProduct.id.toString(),
              sku: matchingVariant?.sku || sku,
              title: shopifyProduct.title,
              description: shopifyProduct.body_html || ""
            });
          } else {
            console.log(`Product not found in Shopify either for SKU: ${sku}`);
          }
        } catch (shopifyError) {
          console.error("Shopify API error:", shopifyError);
          // Continue without Shopify data - user can manually add product info
        }
      }

      if (!product) {
        return res.status(404).json({ 
          message: "Product not found",
          sku: sku,
          suggestion: "You can create this product manually using the form below."
        });
      }

      // Get existing content
      const content = await storage.getProductContent(product.id);
      
      res.json({ product, content });
    } catch (error) {
      console.error("Product lookup error:", error);
      res.status(500).json({ message: "Failed to lookup product" });
    }
  });

  // Get all products with pagination
  app.get("/api/products/all", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      console.log(`Fetching products page ${page} with limit ${limit}`);
      
      const products = await shopifyService.getAllProducts(page, limit);
      const hasMore = products.length === limit;
      
      res.json({
        products,
        hasMore,
        page,
        totalFetched: products.length
      });
    } catch (error) {
      console.error("Error fetching all products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Global search across all products
  app.get("/api/products/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.trim().length < 2) {
        return res.json({ products: [] });
      }

      console.log(`Searching all products for: "${query}"`);
      
      const products = await shopifyService.searchAllProducts(query.trim());
      
      res.json({
        products,
        totalFound: products.length,
        query: query.trim()
      });
    } catch (error) {
      console.error("Error searching products:", error);
      res.status(500).json({ message: "Failed to search products" });
    }
  });

  // Get single product from Shopify by ID
  app.get("/api/products/shopify/:productId", async (req, res) => {
    try {
      const { productId } = req.params;
      console.log(`Fetching Shopify product: ${productId}`);
      
      const product = await shopifyService.getProductById(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Error fetching Shopify product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Manual product creation
  app.post("/api/products", async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.json(product);
    } catch (error) {
      console.error("Product creation error:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  // Save product content
  app.post("/api/products/:productId/content", async (req, res) => {
    try {
      const { productId } = req.params;
      const contentData = req.body;

      // Validate each content item
      const savedContent = [];
      for (const item of contentData) {
        const validatedContent = insertProductContentSchema.parse({
          productId,
          tabType: item.tabType,
          content: item.content,
          isActive: item.isActive ?? true
        });

        // Check if content already exists for this tab type
        const existing = await storage.getProductContentByType(productId, item.tabType);
        
        let content;
        if (existing) {
          content = await storage.updateProductContent(existing.id, validatedContent);
        } else {
          content = await storage.createProductContent(validatedContent);
        }
        savedContent.push(content);
      }

      res.json(savedContent);
    } catch (error) {
      console.error("Save content error:", error);
      res.status(500).json({ message: "Failed to save content" });
    }
  });

  // Update Shopify product
  app.post("/api/products/:productId/update-shopify", async (req, res) => {
    try {
      const { productId } = req.params;
      
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const content = await storage.getProductContent(productId);
      const generatedHtml = htmlGenerator.generateProductHtml(content);

      // Update Shopify product description
      await shopifyService.updateProductDescription(product.shopifyId, generatedHtml);

      // Update local product record
      await storage.updateProduct(productId, { description: generatedHtml });

      res.json({ message: "Product updated successfully" });
    } catch (error) {
      console.error("Shopify update error:", error);
      res.status(500).json({ message: "Failed to update Shopify product" });
    }
  });

  // Content templates
  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await storage.getContentTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Get templates error:", error);
      res.status(500).json({ message: "Failed to get templates" });
    }
  });

  app.post("/api/templates", async (req, res) => {
    try {
      const validatedTemplate = insertContentTemplateSchema.parse(req.body);
      const template = await storage.createContentTemplate(validatedTemplate);
      res.json(template);
    } catch (error) {
      console.error("Create template error:", error);
      res.status(500).json({ message: "Failed to create template" });
    }
  });

  // Logo library
  app.get("/api/logos", async (req, res) => {
    try {
      const logos = await storage.getLogos();
      res.json(logos);
    } catch (error) {
      console.error("Get logos error:", error);
      res.status(500).json({ message: "Failed to get logos" });
    }
  });

  app.post("/api/logos", async (req, res) => {
    try {
      const validatedLogo = insertLogoSchema.parse(req.body);
      const logo = await storage.createLogo(validatedLogo);
      res.json(logo);
    } catch (error) {
      console.error("Create logo error:", error);
      res.status(500).json({ message: "Failed to create logo" });
    }
  });

  app.delete("/api/logos/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteLogo(id);
      res.json({ message: "Logo deleted successfully" });
    } catch (error) {
      console.error("Delete logo error:", error);
      res.status(500).json({ message: "Failed to delete logo" });
    }
  });

  // Check product content status for multiple products with detailed info
  app.post("/api/products/content-status", async (req, res) => {
    try {
      const { productIds } = req.body;
      if (!Array.isArray(productIds)) {
        return res.status(400).json({ message: "productIds must be an array" });
      }

      const contentStatus: Record<string, {
        hasShopifyContent: boolean;
        hasNewLayout: boolean;
        contentCount: number;
      }> = {};
      
      for (const productId of productIds) {
        try {
          // Check Shopify for existing content
          const shopifyProduct = await shopifyService.getProductById(productId.toString());
          const hasShopifyContent = !!(shopifyProduct?.body_html && shopifyProduct.body_html.trim() !== '');
          
          // Check local database for new layout content
          const localProduct = await storage.getProductByShopifyId(productId.toString());
          let hasNewLayout = false;
          let contentCount = 0;
          
          if (localProduct) {
            const content = await storage.getProductContent(localProduct.id);
            hasNewLayout = content.length > 0;
            contentCount = content.length;
          }

          contentStatus[productId] = {
            hasShopifyContent,
            hasNewLayout,
            contentCount
          };
        } catch (error) {
          console.error(`Error checking status for product ${productId}:`, error);
          contentStatus[productId] = {
            hasShopifyContent: false,
            hasNewLayout: false,
            contentCount: 0
          };
        }
      }

      res.json(contentStatus);
    } catch (error) {
      console.error("Content status check error:", error);
      res.status(500).json({ message: "Failed to check content status" });
    }
  });

  // File upload to Shopify
  app.post("/api/shopify/upload-file", async (req, res) => {
    try {
      const { file, filename, contentType } = req.body;
      
      if (!file || !filename) {
        return res.status(400).json({ message: "File data and filename are required" });
      }

      const fileUrl = await shopifyService.uploadFile(file, filename, contentType);
      res.json({ url: fileUrl });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ message: "Failed to upload file to Shopify" });
    }
  });

  // Get Shopify collection by handle
  app.get("/api/shopify/collections/:handle", async (req, res) => {
    try {
      const { handle } = req.params;
      const collection = await shopifyService.getCollectionByHandle(handle);
      
      if (!collection) {
        return res.status(404).json({ message: "Collection not found" });
      }
      
      res.json({ collection });
    } catch (error) {
      console.error("Collection fetch error:", error);
      res.status(500).json({ message: "Failed to fetch collection" });
    }
  });

  // Get Shopify product by handle
  app.get("/api/shopify/products/handle/:handle", async (req, res) => {
    try {
      const { handle } = req.params;
      const product = await shopifyService.getProductByHandle(handle);
      
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("Product fetch error:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Preview HTML generation
  app.post("/api/preview", async (req, res) => {
    try {
      const { content, productSku } = req.body;
      const html = htmlGenerator.generateProductHtml(content, productSku);
      res.json({ html });
    } catch (error) {
      console.error("Preview generation error:", error);
      res.status(500).json({ message: "Failed to generate preview" });
    }
  });

  // ==== DRAFT CONTENT MANAGEMENT ROUTES ====

  // Get all draft content for a product
  app.get("/api/draft-content/:shopifyProductId", async (req, res) => {
    try {
      const { shopifyProductId } = req.params;
      const draftContent = await storage.getDraftContentByProduct(shopifyProductId);
      res.json({ draftContent });
    } catch (error) {
      console.error("Draft content fetch error:", error);
      res.status(500).json({ message: "Failed to fetch draft content" });
    }
  });

  // Save draft content for a specific tab type
  app.post("/api/draft-content", async (req, res) => {
    try {
      // Ensure the product exists in our database first
      const { shopifyProductId, tabType, content } = req.body;
      
      // Validate required fields
      if (!shopifyProductId || !tabType || !content) {
        return res.status(400).json({ message: "Missing required fields: shopifyProductId, tabType, content" });
      }

      // Check if product exists in our database, if not create it
      let localProduct = await storage.getProductByShopifyId(shopifyProductId.toString());
      
      if (!localProduct) {
        // Fetch product from Shopify and save it locally
        try {
          const shopifyProduct = await shopifyService.getProductById(shopifyProductId.toString());
          if (shopifyProduct) {
            const productData = {
              shopifyId: shopifyProductId.toString(),
              sku: shopifyProduct.handle || `product-${shopifyProductId}`,
              title: shopifyProduct.title || 'Unknown Product',
              description: shopifyProduct.body_html || null
            };
            localProduct = await storage.createProduct(productData);
            console.log(`Created local product record for Shopify ID: ${shopifyProductId}`);
          }
        } catch (shopifyError) {
          console.error('Failed to fetch product from Shopify:', shopifyError);
          // Create minimal product record for draft storage
          const productData = {
            shopifyId: shopifyProductId.toString(),
            sku: `product-${shopifyProductId}`,
            title: 'Product (Draft)',
            description: null
          };
          localProduct = await storage.createProduct(productData);
          console.log(`Created minimal local product record for Shopify ID: ${shopifyProductId}`);
        }
      }

      const draftData = {
        shopifyProductId: shopifyProductId.toString(),
        tabType,
        content
      };
      
      // Check if draft already exists for this product and tab type
      const existing = await storage.getDraftContentByProductAndType(draftData.shopifyProductId, draftData.tabType);
      
      let result;
      if (existing) {
        result = await storage.updateDraftContent(existing.id, draftData);
        console.log(`Updated draft content for ${shopifyProductId} - ${tabType}`);
      } else {
        result = await storage.saveDraftContent(draftData);
        console.log(`Created draft content for ${shopifyProductId} - ${tabType}`);
      }
      
      res.json(result);
    } catch (error) {
      console.error("Failed to save draft content:", error);
      res.status(500).json({ message: "Failed to save draft content" });
    }
  });

  // Delete draft content for a product (after successful Shopify save)
  app.delete("/api/draft-content/:shopifyProductId", async (req, res) => {
    try {
      const { shopifyProductId } = req.params;
      await storage.deleteDraftContentByProduct(shopifyProductId);
      res.json({ message: "Draft content deleted successfully" });
    } catch (error) {
      console.error("Draft content delete error:", error);
      res.status(500).json({ message: "Failed to delete draft content" });
    }
  });

  // Extract existing content from Shopify product description
  app.get("/api/extract-content/:shopifyProductId", async (req, res) => {
    try {
      const { shopifyProductId } = req.params;
      
      // Get the product from Shopify
      const shopifyProduct = await shopifyService.getProductById(shopifyProductId);
      if (!shopifyProduct || !shopifyProduct.body_html) {
        return res.json({ extractedContent: {} });
      }

      // Basic content extraction from HTML description
      const extractedContent = extractContentFromHtml(shopifyProduct.body_html);
      res.json({ extractedContent });
    } catch (error) {
      console.error("Content extraction error:", error);
      res.status(500).json({ message: "Failed to extract content" });
    }
  });

  // Simple content extraction function
  function extractContentFromHtml(html: string): Record<string, any> {
    const extracted: Record<string, any> = {};
    
    try {
      // Look for our custom tab sections
      const sections = [
        'compatible-container',
        'description', 
        'features',
        'applications',
        'specifications',
        'videos',
        'documentation',
        'safety-guidelines'
      ];
      
      sections.forEach(section => {
        const regex = new RegExp(`<div[^>]*data-tab="${section}"[^>]*>([\\s\\S]*?)</div>`, 'gi');
        const match = regex.exec(html);
        
        if (match) {
          // Basic extraction - could be enhanced with more sophisticated parsing
          extracted[section] = {
            title: section.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            rawHtml: match[1]
          };
        }
      });
      
    } catch (error) {
      console.error('Error parsing HTML:', error);
    }
    
    return extracted;
  }

  const httpServer = createServer(app);
  return httpServer;
}
