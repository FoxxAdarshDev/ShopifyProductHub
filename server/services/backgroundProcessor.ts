// Background processor for systematic product status updates
import { storage } from '../storage';
import { productStatusService } from './productStatusService';

interface ProcessingState {
  isRunning: boolean;
  totalProducts: number;
  processedCount: number;
  updatedCount: number;
  currentBatch: number;
  startTime: Date | null;
  lastUpdate: Date | null;
}

class BackgroundProcessor {
  private state: ProcessingState = {
    isRunning: false,
    totalProducts: 0,
    processedCount: 0,
    updatedCount: 0,
    currentBatch: 0,
    startTime: null,
    lastUpdate: null
  };

  private batchSize = 5; // Small batches to avoid rate limiting
  private delayBetweenProducts = 1000; // 1 second between products
  private delayBetweenBatches = 3000; // 3 seconds between batches

  getStatus(): ProcessingState {
    return { ...this.state };
  }

  async startSystematicRefresh(): Promise<void> {
    if (this.state.isRunning) {
      console.log('Background processor already running');
      return;
    }

    console.log('🚀 Starting systematic product status refresh');
    this.state.isRunning = true;
    this.state.startTime = new Date();
    this.state.processedCount = 0;
    this.state.updatedCount = 0;
    this.state.currentBatch = 0;

    try {
      // Get all products that need checking (old or missing status)
      const productsToCheck = await this.getProductsNeedingRefresh();
      this.state.totalProducts = productsToCheck.length;
      
      console.log(`Found ${this.state.totalProducts} products needing status refresh`);

      // Process in batches
      for (let i = 0; i < productsToCheck.length; i += this.batchSize) {
        if (!this.state.isRunning) break; // Allow stopping

        const batch = productsToCheck.slice(i, i + this.batchSize);
        this.state.currentBatch = Math.floor(i / this.batchSize) + 1;
        const totalBatches = Math.ceil(productsToCheck.length / this.batchSize);

        console.log(`🔄 Processing batch ${this.state.currentBatch}/${totalBatches} (${batch.length} products)`);

        // Process each product in the batch with delays
        for (const productId of batch) {
          if (!this.state.isRunning) break;

          try {
            // Force fresh check by invalidating cache
            await storage.invalidateProductStatusCache(productId);
            
            // Get fresh status
            const status = await productStatusService.getProductContentStatus(productId);
            
            if (status.hasNewLayout || status.hasShopifyContent) {
              this.state.updatedCount++;
              console.log(`✅ Updated product ${productId}: hasNewLayout=${status.hasNewLayout}, contentCount=${status.contentCount}`);
            }

            this.state.processedCount++;
            this.state.lastUpdate = new Date();

            // Delay between products to avoid rate limiting
            if (this.state.processedCount < this.state.totalProducts) {
              await this.delay(this.delayBetweenProducts);
            }
          } catch (error) {
            console.error(`❌ Error processing product ${productId}:`, error);
            this.state.processedCount++;
          }
        }

        // Delay between batches
        if (i + this.batchSize < productsToCheck.length) {
          await this.delay(this.delayBetweenBatches);
        }
      }

      console.log(`🎉 Background processing completed: ${this.state.updatedCount} products updated out of ${this.state.processedCount} processed`);
    } catch (error) {
      console.error('Background processor error:', error);
    } finally {
      this.state.isRunning = false;
    }
  }

  async stopProcessing(): Promise<void> {
    console.log('🛑 Stopping background processor');
    this.state.isRunning = false;
  }

  private async getProductsNeedingRefresh(): Promise<string[]> {
    // Get all products with draft content (suspect of having new layout)
    const draftProducts = await storage.getAllProductsWithDraftContent();
    
    // Get all products with old or missing status checks (older than 1 day)
    const oldStatusProducts = await storage.getProductsWithOldStatus();
    
    // Combine and deduplicate
    const allProductIds = new Set([
      ...draftProducts.map(p => p.shopifyProductId),
      ...oldStatusProducts.map(p => p.shopifyProductId)
    ]);

    return Array.from(allProductIds);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const backgroundProcessor = new BackgroundProcessor();