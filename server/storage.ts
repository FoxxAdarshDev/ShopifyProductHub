import { 
  products, 
  contentTemplates, 
  productContent, 
  logoLibrary,
  draftContent,
  productStatus,
  type Product, 
  type InsertProduct,
  type ContentTemplate,
  type InsertContentTemplate,
  type ProductContent,
  type InsertProductContent,
  type Logo,
  type InsertLogo,
  type DraftContent,
  type InsertDraftContent,
  type ProductStatus,
  type InsertProductStatus
} from "@shared/schema";
import { db } from "./db";
import { eq, and, like, or, lt, isNull } from "drizzle-orm";

export interface IStorage {
  // Products
  getProduct(id: string): Promise<Product | undefined>;
  getProductBySku(sku: string): Promise<Product | undefined>;
  getProductByShopifyId(shopifyId: string): Promise<Product | undefined>;
  searchProductsBySku(partialSku: string): Promise<Product[]>;
  getAllProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product>;

  // Product Content
  getProductContent(productId: string): Promise<ProductContent[]>;
  getProductContentByType(productId: string, tabType: string): Promise<ProductContent | undefined>;
  createProductContent(content: InsertProductContent): Promise<ProductContent>;
  updateProductContent(id: string, content: Partial<InsertProductContent>): Promise<ProductContent>;
  deleteProductContent(id: string): Promise<void>;

  // Content Templates
  getContentTemplates(): Promise<ContentTemplate[]>;
  getContentTemplatesByType(tabType: string): Promise<ContentTemplate[]>;
  createContentTemplate(template: InsertContentTemplate): Promise<ContentTemplate>;
  updateContentTemplate(id: string, template: Partial<InsertContentTemplate>): Promise<ContentTemplate>;
  deleteContentTemplate(id: string): Promise<void>;

  // Logo Library
  getLogos(): Promise<Logo[]>;
  createLogo(logo: InsertLogo): Promise<Logo>;
  deleteLogo(id: string): Promise<void>;

  // Draft Content Management
  getDraftContentByProduct(shopifyProductId: string): Promise<DraftContent[]>;
  getDraftContentByProductAndType(shopifyProductId: string, tabType: string): Promise<DraftContent | undefined>;
  saveDraftContent(content: InsertDraftContent): Promise<DraftContent>;
  updateDraftContent(id: string, content: Partial<InsertDraftContent>): Promise<DraftContent>;
  deleteDraftContentByProduct(shopifyProductId: string): Promise<void>;
  deleteDraftContentByProductAndType(shopifyProductId: string, tabType: string): Promise<void>;

  // Product Status Management
  getProductStatus(shopifyProductId: string): Promise<ProductStatus | undefined>;
  createProductStatus(status: InsertProductStatus): Promise<ProductStatus>;
  updateProductStatus(shopifyProductId: string, status: Partial<InsertProductStatus>): Promise<ProductStatus>;
  deleteProductStatus(shopifyProductId: string): Promise<void>;
  getAllProductStatuses(): Promise<ProductStatus[]>;
  getProductStatusCounts(): Promise<{
    total: number;
    shopifyContent: number;
    newLayout: number;
    draftMode: number;
    noContent: number;
  }>;
  getNewLayoutProducts(): Promise<ProductStatus[]>;
  getDraftModeProducts(): Promise<ProductStatus[]>;
}

export class DatabaseStorage implements IStorage {
  // Products
  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getProductBySku(sku: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.sku, sku));
    return product || undefined;
  }

  async getProductByShopifyId(shopifyId: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.shopifyId, shopifyId));
    return product || undefined;
  }

  async searchProductsBySku(partialSku: string): Promise<Product[]> {
    return await db.select().from(products).where(like(products.sku, `${partialSku}%`));
  }

  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db
      .insert(products)
      .values(insertProduct)
      .returning();
    return product;
  }

  async updateProduct(id: string, updateData: Partial<InsertProduct>): Promise<Product> {
    const [product] = await db
      .update(products)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  // Product Content
  async getProductContent(productId: string): Promise<ProductContent[]> {
    return await db.select().from(productContent).where(eq(productContent.productId, productId));
  }

  async getProductContentByType(productId: string, tabType: string): Promise<ProductContent | undefined> {
    const [content] = await db
      .select()
      .from(productContent)
      .where(and(eq(productContent.productId, productId), eq(productContent.tabType, tabType)));
    return content || undefined;
  }

  async createProductContent(insertContent: InsertProductContent): Promise<ProductContent> {
    const [content] = await db
      .insert(productContent)
      .values(insertContent)
      .returning();
    return content;
  }

  async updateProductContent(id: string, updateData: Partial<InsertProductContent>): Promise<ProductContent> {
    const [content] = await db
      .update(productContent)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(productContent.id, id))
      .returning();
    return content;
  }

  async deleteProductContent(id: string): Promise<void> {
    await db.delete(productContent).where(eq(productContent.id, id));
  }

  // Content Templates
  async getContentTemplates(): Promise<ContentTemplate[]> {
    return await db.select().from(contentTemplates);
  }

  async getContentTemplatesByType(tabType: string): Promise<ContentTemplate[]> {
    return await db.select().from(contentTemplates).where(eq(contentTemplates.tabType, tabType));
  }

  async createContentTemplate(insertTemplate: InsertContentTemplate): Promise<ContentTemplate> {
    const [template] = await db
      .insert(contentTemplates)
      .values(insertTemplate)
      .returning();
    return template;
  }

  async updateContentTemplate(id: string, updateData: Partial<InsertContentTemplate>): Promise<ContentTemplate> {
    const [template] = await db
      .update(contentTemplates)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(contentTemplates.id, id))
      .returning();
    return template;
  }

  async deleteContentTemplate(id: string): Promise<void> {
    await db.delete(contentTemplates).where(eq(contentTemplates.id, id));
  }

  // Logo Library
  async getLogos(): Promise<Logo[]> {
    return await db.select().from(logoLibrary);
  }

  async createLogo(insertLogo: InsertLogo): Promise<Logo> {
    const [logo] = await db
      .insert(logoLibrary)
      .values(insertLogo)
      .returning();
    return logo;
  }

  async deleteLogo(id: string): Promise<void> {
    await db.delete(logoLibrary).where(eq(logoLibrary.id, id));
  }

  // Draft Content Management
  async getDraftContentByProduct(shopifyProductId: string): Promise<DraftContent[]> {
    return await db.select().from(draftContent).where(eq(draftContent.shopifyProductId, shopifyProductId));
  }

  async getDraftContentByProductAndType(shopifyProductId: string, tabType: string): Promise<DraftContent | undefined> {
    const [content] = await db
      .select()
      .from(draftContent)
      .where(and(eq(draftContent.shopifyProductId, shopifyProductId), eq(draftContent.tabType, tabType)));
    return content || undefined;
  }

  async saveDraftContent(insertContent: InsertDraftContent): Promise<DraftContent> {
    // First try to update existing draft content
    const existing = await this.getDraftContentByProductAndType(insertContent.shopifyProductId, insertContent.tabType);
    
    if (existing) {
      return await this.updateDraftContent(existing.id, insertContent);
    } else {
      const [content] = await db
        .insert(draftContent)
        .values(insertContent)
        .returning();
      return content;
    }
  }

  async updateDraftContent(id: string, updateData: Partial<InsertDraftContent>): Promise<DraftContent> {
    const [content] = await db
      .update(draftContent)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(draftContent.id, id))
      .returning();
    return content;
  }

  async deleteDraftContentByProduct(shopifyProductId: string): Promise<void> {
    await db.delete(draftContent).where(eq(draftContent.shopifyProductId, shopifyProductId));
  }

  async deleteDraftContentByProductAndType(shopifyProductId: string, tabType: string): Promise<void> {
    await db.delete(draftContent).where(and(
      eq(draftContent.shopifyProductId, shopifyProductId),
      eq(draftContent.tabType, tabType)
    ));
  }

  // Product Status Management
  async getProductStatus(shopifyProductId: string): Promise<ProductStatus | undefined> {
    const [status] = await db.select().from(productStatus).where(eq(productStatus.shopifyProductId, shopifyProductId));
    return status || undefined;
  }

  async createProductStatus(insertStatus: InsertProductStatus): Promise<ProductStatus> {
    const [status] = await db
      .insert(productStatus)
      .values(insertStatus)
      .returning();
    return status;
  }

  async updateProductStatus(shopifyProductId: string, updateData: Partial<InsertProductStatus>): Promise<ProductStatus> {
    try {
      // Use upsert to handle both insert and update cases
      const [status] = await db
        .insert(productStatus)
        .values({
          shopifyProductId,
          hasNewLayout: false,
          hasDraftContent: false,
          hasShopifyContent: false,
          contentCount: '0',  
          isOurTemplateStructure: false,
          lastShopifyCheck: new Date(),
          ...updateData,
          lastUpdated: new Date()
        })
        .onConflictDoUpdate({
          target: productStatus.shopifyProductId,
          set: {
            ...updateData,
            lastUpdated: new Date()
          }
        })
        .returning();
      
      return status;
    } catch (error) {
      console.error(`Error updating product status for ${shopifyProductId}:`, error);
      // If insert fails, try direct update
      const existing = await this.getProductStatus(shopifyProductId);
      if (existing) {
        const [status] = await db
          .update(productStatus)
          .set({ ...updateData, lastUpdated: new Date() })
          .where(eq(productStatus.shopifyProductId, shopifyProductId))
          .returning();
        return status;
      }
      throw error;
    }
  }

  async deleteProductStatus(shopifyProductId: string): Promise<void> {
    await db.delete(productStatus).where(eq(productStatus.shopifyProductId, shopifyProductId));
  }

  async getAllProductStatuses(): Promise<ProductStatus[]> {
    return await db.select().from(productStatus);
  }

  async getAllProductsWithDraftContent(): Promise<{ shopifyProductId: string }[]> {
    const results = await db
      .select({ shopifyProductId: productStatus.shopifyProductId })
      .from(productStatus)
      .where(eq(productStatus.hasDraftContent, true));
    return results;
  }

  async invalidateProductStatusCache(shopifyProductId: string): Promise<void> {
    // Force refresh by setting last check to old date
    await db
      .update(productStatus)
      .set({ lastShopifyCheck: new Date('2020-01-01') })
      .where(eq(productStatus.shopifyProductId, shopifyProductId));
  }

  async getProductsWithOldStatus(): Promise<{ shopifyProductId: string }[]> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const results = await db
      .select({ shopifyProductId: productStatus.shopifyProductId })
      .from(productStatus)
      .where(
        or(
          lt(productStatus.lastShopifyCheck, oneDayAgo),
          isNull(productStatus.lastShopifyCheck)
        )
      );
    return results;
  }

  async invalidateAllProductStatusCache(): Promise<number> {
    // Force refresh for all products by setting last check to old date
    const result = await db
      .update(productStatus)
      .set({ lastShopifyCheck: new Date('2020-01-01') });
    return result.rowCount || 0;
  }

  async getProductStatusCounts(): Promise<{
    total: number;
    shopifyContent: number;
    newLayout: number;
    draftMode: number;
    noContent: number;
  }> {
    try {
      const statusData = await db.select().from(productStatus);
      
      const counts = {
        total: statusData.length,
        shopifyContent: statusData.filter(s => s.hasShopifyContent).length,
        newLayout: statusData.filter(s => s.hasNewLayout).length,
        draftMode: statusData.filter(s => s.hasDraftContent).length,
        noContent: statusData.filter(s => !s.hasShopifyContent && !s.hasNewLayout).length
      };
      
      console.log('Database status counts:', counts);
      return counts;
    } catch (error) {
      console.error('Error getting product status counts:', error);
      return {
        total: 0,
        shopifyContent: 0,
        newLayout: 0,
        draftMode: 0,
        noContent: 0
      };
    }
  }

  // Get products with New Layout status
  async getNewLayoutProducts() {
    return db.select().from(productStatus).where(eq(productStatus.hasNewLayout, true));
  }

  // Get products with Draft Mode status  
  async getDraftModeProducts() {
    return db.select().from(productStatus).where(eq(productStatus.hasDraftContent, true));
  }
}

export const storage = new DatabaseStorage();
