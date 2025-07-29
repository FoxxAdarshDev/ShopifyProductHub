// Enhanced Product Status Service
// Manages product status with database-first approach and intelligent caching

import { storage } from '../storage';
import { contentStatusCache } from './contentStatusCache';
import { shopifyService } from './shopify';
import type { InsertProductStatus } from '@shared/schema';

interface ContentStatusResult {
  hasShopifyContent: boolean;
  hasNewLayout: boolean;
  hasDraftContent: boolean;
  contentCount: number;
  isOurTemplateStructure: boolean;
}

class ProductStatusService {
  // Detect if HTML content contains our new layout structure
  private detectNewLayoutFromHTML(html: string): { isNewLayout: boolean; contentCount: number } {
    if (!html || html.trim() === '') {
      return { isNewLayout: false, contentCount: 0 };
    }

    // Check for our template structure markers
    const hasContainerClass = html.includes('class="container"');
    const hasDataSkuAttributes = html.includes('data-sku=');
    
    // Check for specific tab structures
    const hasTabStructure = 
      html.includes('id="description"') || 
      html.includes('id="features"') || 
      html.includes('id="applications"') ||
      html.includes('id="specifications"') ||
      html.includes('data-section="documentation"') ||
      html.includes('data-section="videos"');

    const isNewLayout = hasContainerClass && hasDataSkuAttributes && hasTabStructure;

    // Count content sections if it's our template
    let contentCount = 0;
    if (isNewLayout) {
      if (html.includes('id="description"')) contentCount++;
      if (html.includes('id="features"')) contentCount++;
      if (html.includes('id="applications"')) contentCount++;
      if (html.includes('id="specifications"')) contentCount++;
      if (html.includes('data-section="documentation"')) contentCount++;
      if (html.includes('data-section="videos"')) contentCount++;
      if (html.includes('data-section="safety-guidelines"')) contentCount++;
      if (html.includes('data-section="sterilization-method"')) contentCount++;
      if (html.includes('data-section="compatible-container"')) contentCount++;
      if (html.includes('data-section="sku-nomenclature"')) contentCount++;
    }

    return { isNewLayout, contentCount };
  }

  // Get comprehensive status for a single product (database-first)
  async getProductContentStatus(productId: string): Promise<ContentStatusResult> {
    try {
      // 1. First check database cache
      const dbStatus = await storage.getProductStatus(productId);
      if (dbStatus && this.isRecentStatus(dbStatus.lastShopifyCheck)) {
        console.log(`Using database status for product ${productId}`);
        return {
          hasShopifyContent: dbStatus.hasShopifyContent || false,
          hasNewLayout: dbStatus.hasNewLayout || false,
          hasDraftContent: dbStatus.hasDraftContent || false,
          contentCount: parseInt(dbStatus.contentCount || '0'),
          isOurTemplateStructure: dbStatus.isOurTemplateStructure || false
        };
      }

      // 2. Check memory cache
      const cached = contentStatusCache.get(productId);
      if (cached) {
        console.log(`Using memory cache for product ${productId}`);
        return {
          hasShopifyContent: cached.hasShopifyContent,
          hasNewLayout: cached.hasNewLayout,
          hasDraftContent: cached.hasDraftContent,
          contentCount: cached.contentCount,
          isOurTemplateStructure: true // Memory cache implies checked structure
        };
      }

      // 3. Check local database for content and drafts
      const localProduct = await storage.getProductByShopifyId(productId);
      let hasLocalContent = false;
      let localContentCount = 0;
      
      if (localProduct) {
        const content = await storage.getProductContent(localProduct.id);
        hasLocalContent = content.length > 0;
        localContentCount = content.length;
      }

      // 4. Check for draft content
      const draftContent = await storage.getDraftContentByProduct(productId);
      const hasDraftContent = draftContent.length > 0;

      // 5. Only check Shopify if we need to determine layout structure
      let hasShopifyContent = false;
      let isOurTemplateStructure = false;
      let shopifyContentCount = 0;

      try {
        const shopifyProduct = await shopifyService.getProductById(productId);
        hasShopifyContent = !!(shopifyProduct?.body_html && shopifyProduct.body_html.trim() !== '');
        
        if (hasShopifyContent && shopifyProduct?.body_html) {
          const layoutDetection = this.detectNewLayoutFromHTML(shopifyProduct.body_html);
          isOurTemplateStructure = layoutDetection.isNewLayout;
          shopifyContentCount = layoutDetection.contentCount;
        }
      } catch (shopifyError: any) {
        if (shopifyError.message.includes('429')) {
          console.warn(`Rate limited for product ${productId}, using database data only`);
          // Use database data when rate limited
          hasShopifyContent = dbStatus?.hasShopifyContent || false;
          isOurTemplateStructure = dbStatus?.isOurTemplateStructure || false;
          shopifyContentCount = parseInt(dbStatus?.contentCount || '0');
        } else {
          console.error(`Shopify error for product ${productId}:`, shopifyError);
        }
      }

      // 6. Determine final status
      const hasNewLayout = hasLocalContent || isOurTemplateStructure;
      const contentCount = Math.max(localContentCount, shopifyContentCount);
      
      // Hide draft mode if content is published to Shopify with our template
      const finalHasDraftContent = hasDraftContent && !isOurTemplateStructure;

      const result: ContentStatusResult = {
        hasShopifyContent,
        hasNewLayout,
        hasDraftContent: finalHasDraftContent,
        contentCount,
        isOurTemplateStructure
      };

      // 7. Update database status cache
      await storage.updateProductStatus(productId, {
        hasNewLayout,
        hasDraftContent: finalHasDraftContent,
        hasShopifyContent,
        contentCount: contentCount.toString(),
        isOurTemplateStructure,
        lastShopifyCheck: new Date()
      });

      // 8. Update memory cache
      contentStatusCache.set(productId, {
        hasShopifyContent: result.hasShopifyContent,
        hasNewLayout: result.hasNewLayout,
        hasDraftContent: result.hasDraftContent,
        contentCount: result.contentCount
      });

      return result;
      
    } catch (error) {
      console.error(`Error getting product status for ${productId}:`, error);
      // Return safe defaults on error
      return {
        hasShopifyContent: false,
        hasNewLayout: false,
        hasDraftContent: false,
        contentCount: 0,
        isOurTemplateStructure: false
      };
    }
  }

  // Check if status is recent (within 30 minutes)
  private isRecentStatus(lastCheck: Date | null): boolean {
    if (!lastCheck) return false;
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    return lastCheck > thirtyMinutesAgo;
  }

  // Get status for multiple products with intelligent batching
  async getBatchProductStatus(productIds: string[]): Promise<Record<string, ContentStatusResult>> {
    console.log(`Getting batch status for ${productIds.length} products`);
    const results: Record<string, ContentStatusResult> = {};
    
    // Process in smaller batches to avoid overwhelming Shopify API
    const batchSize = 3; // Reduced batch size for better rate limiting
    const batches = [];
    
    for (let i = 0; i < productIds.length; i += batchSize) {
      batches.push(productIds.slice(i, i + batchSize));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Processing status batch ${batchIndex + 1}/${batches.length} with ${batch.length} products`);
      
      // Add delay between batches
      if (batchIndex > 0) {
        await this.delay(1000); // 1 second delay between batches
      }
      
      // Process batch items with delays
      for (let i = 0; i < batch.length; i++) {
        const productId = batch[i];
        
        if (i > 0) {
          await this.delay(300); // 300ms delay between individual requests
        }
        
        results[productId] = await this.getProductContentStatus(productId);
      }
    }

    console.log(`Completed batch status check for ${productIds.length} products`);
    return results;
  }

  // Update product status when content is saved/updated
  async updateProductStatusOnSave(productId: string, hasContentSaved: boolean): Promise<void> {
    await storage.updateProductStatus(productId, {
      hasNewLayout: hasContentSaved,
      hasDraftContent: false, // Clear draft mode when content is saved
      isOurTemplateStructure: hasContentSaved,
      lastShopifyCheck: new Date()
    });

    // Invalidate caches
    contentStatusCache.invalidate(productId);
  }

  // Clear draft status when content is published to Shopify
  async clearDraftStatusOnPublish(productId: string): Promise<void> {
    await storage.updateProductStatus(productId, {
      hasDraftContent: false,
      hasShopifyContent: true,
      isOurTemplateStructure: true,
      lastShopifyCheck: new Date()
    });

    // Invalidate caches
    contentStatusCache.invalidate(productId);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const productStatusService = new ProductStatusService();