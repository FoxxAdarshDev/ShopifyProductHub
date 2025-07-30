import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { shopifyService } from "./services/shopify";
import { htmlGenerator } from "./services/htmlGenerator";
import { extractContentFromHtml } from "./services/contentExtractor";
import { insertProductSchema, insertProductContentSchema, insertContentTemplateSchema, insertLogoSchema, insertDraftContentSchema } from "@shared/schema";
import { z } from "zod";
import { 
  refreshSuspectProducts, 
  startBackgroundProcessing, 
  getBackgroundProcessingStatus, 
  stopBackgroundProcessing, 
  forceRefreshAllProducts,
  forceRefreshLayoutDetection,
  getStatusCountsNow
} from "./routes/admin";

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

  // Get all products with pagination and filtering
  app.get("/api/products/all", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const comprehensive = req.query.comprehensive === 'true';
      const filter = req.query.filter as string; // 'all', 'shopify', 'new-layout', 'draft-mode', 'none'
      
      console.log(`Fetching products page ${page} with limit ${limit}, comprehensive: ${comprehensive}, filter: ${filter}`);
      
      if (comprehensive || filter) {
        // Fetch ALL products for comprehensive mode or when filtering
        const allProducts = await shopifyService.getAllProductsComprehensive();
        console.log(`Fetched ${allProducts.length} total products for comprehensive/filter mode`);
        
        let filteredProducts = allProducts;
        
        // Apply server-side filtering if specified
        if (filter && filter !== 'all') {
          console.log(`Applying server-side filter: ${filter}`);
          const { productStatusService } = await import('./services/productStatusService.js');
          
          // Get status for all products for filtering
          const productStatuses = new Map();
          for (const product of allProducts) {
            try {
              const status = await productStatusService.getProductContentStatus(product.id.toString());
              productStatuses.set(product.id, status);
            } catch (error) {
              console.warn(`Failed to get status for product ${product.id}:`, error);
            }
          }
          
          // Filter products based on their content status
          filteredProducts = allProducts.filter(product => {
            const status = productStatuses.get(product.id);
            if (!status) return filter === 'none';
            
            switch (filter) {
              case 'shopify':
                return status.hasShopifyContent;
              case 'new-layout':
                return status.hasNewLayout;
              case 'draft-mode':
                return status.hasDraftContent;
              case 'none':
                return !status.hasShopifyContent && !status.hasNewLayout;
              default:
                return true;
            }
          });
          
          console.log(`Filtered ${allProducts.length} products to ${filteredProducts.length} for filter: ${filter}`);
        }
        
        // Apply pagination to the filtered results
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
        const hasMore = endIndex < filteredProducts.length;
        
        res.json({
          products: paginatedProducts,
          hasMore,
          page,
          totalFetched: paginatedProducts.length,
          totalAvailable: filteredProducts.length,
          totalInStore: allProducts.length,
          comprehensive: true,
          filter: filter || 'all'
        });
      } else {
        // Standard pagination - fast loading for instant display
        const products = await shopifyService.getAllProducts(page, limit);
        const hasMore = products.length === limit;
        
        console.log(`Standard pagination: page ${page}, fetched ${products.length} products, hasMore: ${hasMore}`);
        
        res.json({
          products,
          hasMore,
          page,
          totalFetched: products.length,
          comprehensive: false,
          filter: 'all'
        });
      }
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

      // Clear draft content after successful Shopify update
      await storage.deleteDraftContentByProduct(product.shopifyId);
      console.log(`🧹 Cleared draft content for product ${product.shopifyId} after Shopify update`);

      // Update product status to reflect that content is now published
      const { productStatusService } = await import('./services/productStatusService.js');
      await productStatusService.clearDraftStatusOnPublish(product.shopifyId);
      console.log(`📊 Updated product status - cleared draft mode for product ${product.shopifyId}`);

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

  // Fast count endpoint for immediate UI display
  app.get("/api/products/status-counts", async (req, res) => {
    try {
      // Get counts directly from database for immediate display
      const counts = await storage.getProductStatusCounts();
      res.json(counts);
    } catch (error) {
      console.error("Error getting status counts:", error);
      res.status(500).json({ error: "Failed to get status counts" });
    }
  });

  // Check product content status for multiple products with database-first approach
  app.post("/api/products/content-status", async (req, res) => {
    try {
      const { productIds } = req.body;
      if (!Array.isArray(productIds)) {
        return res.status(400).json({ message: "productIds must be an array" });
      }

      console.log(`Processing content status for ${productIds.length} products using database-first approach`);
      
      // Use the new product status service with intelligent caching and rate limiting
      const { productStatusService } = await import('./services/productStatusService.js');
      const contentStatus = await productStatusService.getBatchProductStatus(productIds);

      // Convert to expected format
      const responseData: Record<string, {
        hasShopifyContent: boolean;
        hasNewLayout: boolean;
        hasDraftContent: boolean;
        contentCount: number;
      }> = {};

      for (const [productId, status] of Object.entries(contentStatus)) {
        responseData[productId] = {
          hasShopifyContent: status.hasShopifyContent,
          hasNewLayout: status.hasNewLayout,
          hasDraftContent: status.hasDraftContent,
          contentCount: status.contentCount
        };
      }

      res.json(responseData);
    } catch (error) {
      console.error("Content status error:", error);
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

  // Admin routes
  app.post("/api/admin/refresh-suspect-products", refreshSuspectProducts);
  app.post("/api/admin/start-background-processing", startBackgroundProcessing);
  app.get("/api/admin/background-processing-status", getBackgroundProcessingStatus);
  app.post("/api/admin/stop-background-processing", stopBackgroundProcessing);
  app.post("/api/admin/force-refresh-all-products", forceRefreshAllProducts);
  app.post("/api/admin/force-refresh-layout-detection", forceRefreshLayoutDetection);
  app.get("/api/admin/status-counts-now", getStatusCountsNow);

  const httpServer = createServer(app);
  return httpServer;
}
