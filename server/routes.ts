import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { shopifyService } from "./services/shopify";
import { htmlGenerator } from "./services/htmlGenerator";
import { insertProductSchema, insertProductContentSchema, insertContentTemplateSchema, insertLogoSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Product lookup by SKU
  app.get("/api/products/lookup/:sku", async (req, res) => {
    try {
      const { sku } = req.params;
      
      // First check our database
      let product = await storage.getProductBySku(sku);
      
      // If not found, try to fetch from Shopify
      if (!product) {
        try {
          const shopifyProduct = await shopifyService.getProductBySku(sku);
          if (shopifyProduct) {
            product = await storage.createProduct({
              shopifyId: shopifyProduct.id.toString(),
              sku: shopifyProduct.variants[0]?.sku || sku,
              title: shopifyProduct.title,
              description: shopifyProduct.body_html || ""
            });
          }
        } catch (shopifyError) {
          console.warn("Shopify API error:", shopifyError);
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

  // Preview HTML generation
  app.post("/api/preview", async (req, res) => {
    try {
      const { content } = req.body;
      const html = htmlGenerator.generateProductHtml(content);
      res.json({ html });
    } catch (error) {
      console.error("Preview generation error:", error);
      res.status(500).json({ message: "Failed to generate preview" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
