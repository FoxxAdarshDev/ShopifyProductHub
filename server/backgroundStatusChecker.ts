import { shopifyService } from "./services/shopify";
import { productStatusService } from "./services/productStatusService";

// HTML detection function
function detectNewLayoutFromHTML(html: string): boolean {
  if (!html) return false;
  
  // Check for data-sku attribute - primary indicator
  if (html.includes('data-sku=')) return true;
  
  // Check for container class with tab structure
  if (html.includes('class="container"') && html.includes('tab-content')) return true;
  
  // Check for specific tab IDs
  const tabIds = ['halo-description', 'halo-features', 'halo-applications', 'halo-specifications'];
  return tabIds.some(id => html.includes(`id="${id}"`));
}

interface BackgroundStatus {
  isRunning: boolean;
  totalProducts: number;
  checkedProducts: number;
  currentProductId: string | null;
  startTime: Date | null;
  completedTime: Date | null;
  errors: string[];
}

class BackgroundStatusChecker {
  private status: BackgroundStatus = {
    isRunning: false,
    totalProducts: 0,
    checkedProducts: 0,
    currentProductId: null,
    startTime: null,
    completedTime: null,
    errors: []
  };
  
  private shopifyService = shopifyService;
  private productStatusService = productStatusService;
  private abortController: AbortController | null = null;

  async startBackgroundCheck(): Promise<void> {
    if (this.status.isRunning) {
      console.log("🔄 Background status check already running");
      return;
    }

    this.status = {
      isRunning: true,
      totalProducts: 0,
      checkedProducts: 0,
      currentProductId: null,
      startTime: new Date(),
      completedTime: null,
      errors: []
    };

    this.abortController = new AbortController();

    try {
      // Get all accessible product IDs from Shopify store
      console.log("🔍 Fetching all accessible product IDs from Shopify store...");
      const allProductIds = await this.getAllShopifyProductIds();
      
      // Also get the total count for reference
      const totalCount = await this.shopifyService.getProductCount();
      this.status.totalProducts = allProductIds.length;
      
      console.log(`🔍 Starting background status check for ${this.status.totalProducts} accessible products (${totalCount} total in store - some may be private/draft)`);

      // Process products in batches of 5 for much faster processing
      const BATCH_SIZE = 5;
      for (let i = 0; i < allProductIds.length; i += BATCH_SIZE) {
        if (this.abortController.signal.aborted) {
          console.log("🛑 Background check aborted");
          break;
        }

        const batch = allProductIds.slice(i, i + BATCH_SIZE);
        const batchStart = i + 1;
        const batchEnd = Math.min(i + BATCH_SIZE, allProductIds.length);
        
        this.status.currentProductId = batch.map(id => id.toString()).join(', ');
        this.status.checkedProducts = i;

        try {
          console.log(`🔍 Background check batch: ${batchStart}-${batchEnd}/${this.status.totalProducts} - Products [${batch.join(', ')}]`);
          
          // Check status for this batch of products
          await this.checkProductBatchStatus(batch);
          
          this.status.checkedProducts = batchEnd;
          
          // Delay between batches to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          const errorMsg = `Batch ${batchStart}-${batchEnd}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.status.errors.push(errorMsg);
          console.error(`❌ Background check error for batch ${batchStart}-${batchEnd}:`, error);
          
          // Longer delay after error
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      this.status.checkedProducts = allProductIds.length;
      this.status.completedTime = new Date();
      console.log(`✅ Background status check completed: ${this.status.checkedProducts}/${this.status.totalProducts} products`);
      
    } catch (error) {
      const errorMsg = `Background check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.status.errors.push(errorMsg);
      console.error("❌ Background status check failed:", error);
    } finally {
      this.status.isRunning = false;
      this.status.currentProductId = null;
      this.abortController = null;
    }
  }

  stopBackgroundCheck(): void {
    if (this.abortController) {
      this.abortController.abort();
      console.log("🛑 Background status check stopped");
    }
  }

  getStatus(): BackgroundStatus {
    return { ...this.status };
  }

  getProgress(): number {
    if (this.status.totalProducts === 0) return 0;
    return Math.round((this.status.checkedProducts / this.status.totalProducts) * 100);
  }

  private async getAllShopifyProductIds(): Promise<number[]> {
    try {
      console.log("🔍 Fetching all products from Shopify using comprehensive method...");
      const products = await this.shopifyService.getAllProductsComprehensive();
      const productIds = products.map(product => product.id);
      console.log(`✅ Found ${productIds.length} products in Shopify store`);
      return productIds;
    } catch (error) {
      console.error("❌ Error fetching all products:", error);
      return [];
    }
  }

  private async checkProductBatchStatus(productIds: number[]): Promise<void> {
    try {
      console.log(`📦 Processing batch of ${productIds.length} products...`);
      
      // Get all products in this batch from Shopify
      const batchPromises = productIds.map(async (productId) => {
        try {
          const product = await this.shopifyService.getProductById(productId.toString());
          return { productId, product };
        } catch (error) {
          console.warn(`⚠️ Failed to get product ${productId}:`, error);
          return { productId, product: null };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // Get current status for all products in batch
      const statusResult = await this.productStatusService.getBatchProductStatus(
        productIds.map(id => id.toString())
      );
      
      // Process each product in the batch
      const updates: Array<{ productId: string; hasNewLayout: boolean; hasShopifyContent: boolean; hasDraftContent: boolean; contentCount: string }> = [];
      
      for (const { productId, product } of batchResults) {
        if (!product) continue;
        
        // Check if HTML has new layout structure  
        const hasNewLayout = detectNewLayoutFromHTML(product.body_html || '');
        
        // Get current status
        const status = statusResult[productId.toString()] || { 
          hasDraftContent: false, 
          hasNewLayout: false, 
          hasShopifyContent: false, 
          contentCount: '0' 
        };
        
        // Update the status with fresh Shopify data
        const hasShopifyContent = (product.body_html && product.body_html.length > 100) || false;
        
        // Prepare update data
        updates.push({
          productId: productId.toString(),
          hasNewLayout,
          hasShopifyContent, 
          hasDraftContent: status.hasDraftContent,
          contentCount: hasNewLayout ? '1' : (hasShopifyContent ? '1' : '0')
        });
        
        console.log(`📊 Product ${productId}: Layout=${hasNewLayout}, Shopify Content=${hasShopifyContent}, Draft=${status.hasDraftContent}`);
      }
      
      // Batch update the database with all status changes
      if (updates.length > 0) {
        await this.batchUpdateProductStatus(updates);
        console.log(`✅ Updated status for ${updates.length} products in database`);
      }
      
    } catch (error) {
      console.error(`❌ Error checking product batch:`, error);
      throw error;
    }
  }

  private async batchUpdateProductStatus(updates: Array<{ productId: string; hasNewLayout: boolean; hasShopifyContent: boolean; hasDraftContent: boolean; contentCount: string }>): Promise<void> {
    try {
      // Import storage here to avoid circular dependency
      const { storage } = await import('./storage.js');
      
      for (const update of updates) {
        await storage.updateProductStatus(update.productId, {
          hasNewLayout: update.hasNewLayout,
          hasShopifyContent: update.hasShopifyContent,
          hasDraftContent: update.hasDraftContent,
          contentCount: update.contentCount,
          lastShopifyCheck: new Date(),
          isOurTemplateStructure: update.hasNewLayout
        });
      }
    } catch (error) {
      console.error('❌ Error updating product status in database:', error);
      // Don't throw - continue processing even if database update fails
    }
  }
}

// Singleton instance
export const backgroundStatusChecker = new BackgroundStatusChecker();