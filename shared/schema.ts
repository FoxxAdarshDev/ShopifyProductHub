import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shopifyId: varchar("shopify_id").notNull().unique(),
  sku: text("sku").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contentTemplates = pgTable("content_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tabType: text("tab_type").notNull(), // description, features, applications, specifications, etc.
  content: jsonb("content").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const productContent = pgTable("product_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  tabType: text("tab_type").notNull(),
  content: jsonb("content").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const logoLibrary = pgTable("logo_library", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  url: text("url").notNull(),
  altText: text("alt_text").notNull(),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Draft content storage - temporary storage for unsaved content
export const draftContent = pgTable("draft_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shopifyProductId: varchar("shopify_product_id").notNull(), // Using Shopify product ID directly
  tabType: text("tab_type").notNull(),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product status tracking - persistent status for products with content
export const productStatus = pgTable("product_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shopifyProductId: varchar("shopify_product_id").notNull().unique(),
  hasNewLayout: boolean("has_new_layout").default(false),
  hasDraftContent: boolean("has_draft_content").default(false),
  hasShopifyContent: boolean("has_shopify_content").default(false),
  contentCount: text("content_count").default("0"), // Store as text to allow complex counting
  isOurTemplateStructure: boolean("is_our_template_structure").default(false),
  lastShopifyCheck: timestamp("last_shopify_check"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const productContentRelations = relations(productContent, ({ one }) => ({
  product: one(products, {
    fields: [productContent.productId],
    references: [products.id],
  }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  content: many(productContent),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContentTemplateSchema = createInsertSchema(contentTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductContentSchema = createInsertSchema(productContent).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLogoSchema = createInsertSchema(logoLibrary).omit({
  id: true,
  createdAt: true,
});

export const insertDraftContentSchema = createInsertSchema(draftContent).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductStatusSchema = createInsertSchema(productStatus).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export type InsertContentTemplate = z.infer<typeof insertContentTemplateSchema>;
export type ContentTemplate = typeof contentTemplates.$inferSelect;

export type InsertProductContent = z.infer<typeof insertProductContentSchema>;
export type ProductContent = typeof productContent.$inferSelect;

export type InsertLogo = z.infer<typeof insertLogoSchema>;
export type Logo = typeof logoLibrary.$inferSelect;

export type InsertDraftContent = z.infer<typeof insertDraftContentSchema>;
export type DraftContent = typeof draftContent.$inferSelect;

export type InsertProductStatus = z.infer<typeof insertProductStatusSchema>;
export type ProductStatus = typeof productStatus.$inferSelect;
