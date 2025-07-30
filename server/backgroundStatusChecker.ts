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
      // Get all product IDs directly from Shopify store
      console.log("🔍 Fetching all product IDs from Shopify store...");
      const allProductIds = await this.getAllShopifyProductIds();
      this.status.totalProducts = allProductIds.length;
      
      console.log(`🔍 Starting background status check for ${this.status.totalProducts} Shopify products`);

      // Process each product individually with delays to avoid rate limiting
      for (let i = 0; i < allProductIds.length; i++) {
        if (this.abortController.signal.aborted) {
          console.log("🛑 Background check aborted");
          break;
        }

        const productId = allProductIds[i];
        this.status.currentProductId = productId.toString();
        this.status.checkedProducts = i;

        try {
          console.log(`🔍 Background check: ${i + 1}/${this.status.totalProducts} - Product ${productId}`);
          
          // Check status for this product directly from Shopify + database
          await this.checkSingleProductStatus(productId);
          
          // Small delay between checks to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 300));
          
        } catch (error) {
          const errorMsg = `Product ${productId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.status.errors.push(errorMsg);
          console.error(`❌ Background check error for product ${productId}:`, error);
          
          // Longer delay after error
          await new Promise(resolve => setTimeout(resolve, 1000));
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

  private async checkSingleProductStatus(productId: number): Promise<void> {
    try {
      // Get product from Shopify using queue system
      const product = await this.shopifyService.getProductById(productId.toString());
      if (!product) return;

      // Check if HTML has new layout structure  
      const hasNewLayout = detectNewLayoutFromHTML(product.body_html || '');
      
      // Get current status using the productStatusService
      const statusResult = await this.productStatusService.getBatchProductStatus([productId.toString()]);
      const status = statusResult[productId.toString()] || { hasDraftContent: false, hasNewLayout: false, hasShopifyContent: false, contentCount: 0 };
      
      // Update the status with fresh Shopify data
      const hasShopifyContent = (product.body_html && product.body_html.length > 100) || false;
      
      console.log(`📊 Product ${productId}: Layout=${hasNewLayout}, Shopify Content=${hasShopifyContent}, Draft=${status.hasDraftContent}`);
      
    } catch (error) {
      console.error(`❌ Error checking product ${productId}:`, error);
      throw error;
    }
  }
}

// Singleton instance
export const backgroundStatusChecker = new BackgroundStatusChecker();