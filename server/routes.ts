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
      console.log(`🔄 Update Shopify request for product: ${productId}`);
      
      // First try to find product by database ID, then by Shopify ID
      let product = await storage.getProduct(productId);
      console.log(`📝 Product lookup by database ID: ${product ? 'FOUND' : 'NOT FOUND'}`);
      
      if (!product) {
        // Try to find by Shopify ID (in case frontend passes Shopify ID)
        console.log(`🔍 Product not found by database ID, trying Shopify ID: ${productId}`);
        product = await storage.getProductByShopifyId(productId);
        console.log(`📝 Product lookup by Shopify ID: ${product ? 'FOUND' : 'NOT FOUND'}`);
        if (!product) {
          console.log(`❌ Product not found by either ID: ${productId}`);
          return res.status(404).json({ message: "Product not found" });
        }
        console.log(`✅ Found product by Shopify ID: ${product.title} (DB ID: ${product.id})`);
      }

      // Get both stored content and draft content for the product
      let content = await storage.getProductContent(product.id);
      
      // If no stored content, try to get draft content by Shopify ID
      if (!content || content.length === 0) {
        console.log('No stored content found, checking draft content...');
        const draftContent = await storage.getDraftContentByProduct(productId);
        if (draftContent && draftContent.length > 0) {
          console.log(`Found ${draftContent.length} draft content items, converting to content format`);
          // Convert draft content to the format expected by HTML generator
          content = draftContent.map((draft: any) => ({
            id: draft.id,
            productId: product.id,
            tabType: draft.tabType,
            content: draft.content,
            isActive: true,
            createdAt: draft.createdAt || new Date(),
            updatedAt: draft.updatedAt || new Date()
          }));
        }
      }
      
      if (!content || content.length === 0) {
        return res.status(400).json({ message: "No content found to update" });
      }
      
      // Get all variant SKUs for enhanced data attributes
      let allVariantSkus: string[] = [];
      try {
        const shopifyProduct = await shopifyService.getProductById(product.shopifyId);
        if (shopifyProduct && shopifyProduct.variants) {
          allVariantSkus = shopifyProduct.variants
            .map((v: any) => v.sku)
            .filter((sku: string) => sku && sku.trim() !== '');
        }
      } catch (error) {
        console.warn('Failed to fetch variant SKUs for update:', error);
      }
      
      const generatedHtml = htmlGenerator.generateProductHtml(content, product.sku, allVariantSkus);

      // Update Shopify product description
      await shopifyService.updateProductDescription(product.shopifyId, generatedHtml);

      // Update local product record
      await storage.updateProduct(product.id, { description: generatedHtml });

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
        hasDraftContent: boolean;
        contentCount: number;
      }> = {};
      
      for (const productId of productIds) {
        try {
          // Check Shopify for existing content
          const shopifyProduct = await shopifyService.getProductById(productId.toString());
          const hasShopifyContent = !!(shopifyProduct?.body_html && shopifyProduct.body_html.trim() !== '');
          
          // Check if Shopify content matches our template structure (for New Layout detection)
          let isOurTemplateStructure = false;
          if (hasShopifyContent && shopifyProduct?.body_html) {
            // Check for our template structure markers
            const html = shopifyProduct.body_html;
            const hasContainerClass = html.includes('class="container"');
            const hasTabStructure = html.includes('id="description"') || html.includes('id="features"') || html.includes('id="applications"');
            const hasDataSkuAttributes = html.includes('data-sku=');
            
            isOurTemplateStructure = hasContainerClass && hasTabStructure && hasDataSkuAttributes;
          }
          
          // Check local database for new layout content and draft content
          const localProduct = await storage.getProductByShopifyId(productId.toString());
          let hasNewLayout = false;
          let hasDraftContent = false;
          let contentCount = 0;
          
          if (localProduct) {
            const content = await storage.getProductContent(localProduct.id);
            hasNewLayout = content.length > 0;
            contentCount = content.length;
            
            // Check for draft content
            const draftContent = await storage.getDraftContentByProduct(productId.toString());
            hasDraftContent = draftContent.length > 0;
          }
          
          // If content is already saved to Shopify (detected our template), don't show draft mode
          if (isOurTemplateStructure) {
            hasDraftContent = false; // Hide draft mode when content is published to Shopify
          }
          
          // If we detected our template structure in Shopify but no local content, mark it as New Layout
          if (isOurTemplateStructure && !hasNewLayout) {
            hasNewLayout = true;
            // Estimate content count from Shopify HTML structure
            const html = shopifyProduct?.body_html || '';
            let estimatedCount = 0;
            if (html.includes('id="description"')) estimatedCount++;
            if (html.includes('id="features"')) estimatedCount++;
            if (html.includes('id="applications"')) estimatedCount++;
            if (html.includes('id="specifications"')) estimatedCount++;
            if (html.includes('data-section="documentation"')) estimatedCount++;
            if (html.includes('data-section="videos"')) estimatedCount++;
            if (html.includes('data-section="safety-guidelines"')) estimatedCount++;
            if (html.includes('data-section="sterilization-method"')) estimatedCount++;
            if (html.includes('data-section="compatible-container"')) estimatedCount++;
            contentCount = Math.max(contentCount, estimatedCount);
          }

          contentStatus[productId] = {
            hasShopifyContent,
            hasNewLayout,
            hasDraftContent,
            contentCount
          };
        } catch (error) {
          console.error(`Error checking status for product ${productId}:`, error);
          contentStatus[productId] = {
            hasShopifyContent: false,
            hasNewLayout: false,
            hasDraftContent: false,
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
      let { content, productSku, shopifyProductId, productId } = req.body;
      
      // If content is not provided directly, load from draft content
      if (!content && productId) {
        console.log('Loading draft content for preview generation:', productId);
        const draftResult = await storage.getDraftContentByProduct(productId.toString());
        if (draftResult && draftResult.length > 0) {
          // Transform draft content to the expected format
          content = draftResult.map((draft: any) => ({
            tabType: draft.tabType,
            content: draft.content,
            isActive: true
          }));
          console.log('Transformed draft content:', content.length, 'items');
        }
      }
      
      // Ensure content is an array
      if (!Array.isArray(content)) {
        console.error('Content is not an array:', typeof content, content);
        return res.status(400).json({ message: "Content must be an array" });
      }
      
      // Get all variant SKUs if shopifyProductId is provided
      let allVariantSkus: string[] = [];
      if (shopifyProductId) {
        try {
          const shopifyProduct = await shopifyService.getProductById(shopifyProductId.toString());
          if (shopifyProduct && shopifyProduct.variants) {
            allVariantSkus = shopifyProduct.variants
              .map((v: any) => v.sku)
              .filter((sku: string) => sku && sku.trim() !== '');
          }
        } catch (error) {
          console.warn('Failed to fetch variant SKUs:', error);
        }
      }
      
      const html = htmlGenerator.generateProductHtml(content, productSku, allVariantSkus);
      res.json({ html });
    } catch (error) {
      console.error("Preview generation error:", error);
      res.status(500).json({ message: "Failed to generate preview" });
    }
  });

  // Extract content from existing HTML (reverse engineering)
  app.post("/api/extract-content", async (req, res) => {
    try {
      console.log('🔍 Extract content route called');
      const { html, shopifyProductId } = req.body;
      console.log('Request body:', { htmlLength: html?.length, shopifyProductId });
      
      if (!html) {
        console.log('❌ No HTML provided');
        return res.status(400).json({ message: "HTML content is required" });
      }
      
      console.log('🚀 Calling extractContentFromHtml function...');
      console.log('📋 HTML input check:', { 
        hasDescription: html.includes('id="description"'), 
        hasFeatures: html.includes('id="features"'),
        hasPTag: html.includes('<p>'),
        hasLiTag: html.includes('<li>')
      });
      
      // Extract structured content from HTML
      const extractedContent = extractContentFromHtml(html);
      console.log('✅ Extraction result:', { contentKeys: Object.keys(extractedContent), fullResult: extractedContent });
      
      // Test simple regex patterns
      console.log('🧪 Regex test:');
      const testP = html.match(/<p[^>]*>(.*?)<\/p>/g);
      console.log('- Paragraph matches:', testP ? testP.length : 0);
      const testLi = html.match(/<li[^>]*>(.*?)<\/li>/g);
      console.log('- List item matches:', testLi ? testLi.length : 0);
      
      // If shopifyProductId is provided, save as draft content
      if (shopifyProductId && Object.keys(extractedContent).length > 0) {
        try {
          for (const [tabType, content] of Object.entries(extractedContent)) {
            if (content && typeof content === 'object') {
              // Save each tab as draft content
              await storage.saveDraftContent({
                shopifyProductId: shopifyProductId.toString(),
                tabType,
                content
              });
            }
          }
          console.log(`✅ Saved extracted content as drafts for product ${shopifyProductId}`);
        } catch (draftError) {
          console.warn('Failed to save extracted content as drafts:', draftError);
        }
      }
      
      res.json({ 
        extractedContent,
        foundSections: Object.keys(extractedContent),
        message: Object.keys(extractedContent).length > 0 
          ? `Successfully extracted ${Object.keys(extractedContent).length} content sections`
          : "No matching content structure found in the provided HTML"
      });
    } catch (error) {
      console.error("Content extraction error:", error);
      res.status(500).json({ message: "Failed to extract content from HTML" });
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

      // Check if this is our template structure
      const html = shopifyProduct.body_html;
      const hasContainerClass = html.includes('class="container"');
      const hasTabStructure = html.includes('id="description"') || html.includes('id="features"') || html.includes('id="applications"');
      const hasDataSkuAttributes = html.includes('data-sku=');
      
      const isOurTemplateStructure = hasContainerClass && hasTabStructure && hasDataSkuAttributes;
      
      if (isOurTemplateStructure) {
        console.log(`🎯 Detected our template structure for product ${shopifyProductId}, extracting content...`);
        // Enhanced content extraction from HTML description
        const extractedContent = extractContentFromHtml(shopifyProduct.body_html);
        
        // Auto-save as draft content if extraction was successful
        if (Object.keys(extractedContent).length > 0) {
          console.log(`💾 Auto-saving extracted content as drafts for product ${shopifyProductId}`);
          try {
            for (const [tabType, content] of Object.entries(extractedContent)) {
              if (content && typeof content === 'object') {
                // Save each tab as draft content
                await storage.saveDraftContent({
                  shopifyProductId: shopifyProductId.toString(),
                  tabType,
                  content
                });
              }
            }
          } catch (draftError) {
            console.warn('Failed to auto-save extracted content as drafts:', draftError);
          }
        }
        
        res.json({ 
          extractedContent,
          isOurTemplate: true,
          foundSections: Object.keys(extractedContent)
        });
      } else {
        // Basic content extraction from HTML description for non-template content
        const extractedContent = extractContentFromHtml(shopifyProduct.body_html);
        res.json({ 
          extractedContent,
          isOurTemplate: false
        });
      }
    } catch (error) {
      console.error("Content extraction error:", error);
      res.status(500).json({ message: "Failed to extract content" });
    }
  });



  const httpServer = createServer(app);
  return httpServer;
}
