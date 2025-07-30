import { db } from "./db";
import { products } from "../shared/schema";
import { ProductStatusService } from "./services/ProductStatusService";

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
  
  private productStatusService = new ProductStatusService();
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
      // Get all product IDs from database
      const allProducts = await db.select({ id: products.id }).from(products);
      this.status.totalProducts = allProducts.length;
      
      console.log(`🔍 Starting background status check for ${this.status.totalProducts} products`);

      // Process each product individually with delays to avoid rate limiting
      for (let i = 0; i < allProducts.length; i++) {
        if (this.abortController.signal.aborted) {
          console.log("🛑 Background check aborted");
          break;
        }

        const product = allProducts[i];
        this.status.currentProductId = product.id.toString();
        this.status.checkedProducts = i;

        try {
          console.log(`🔍 Background check: ${i + 1}/${this.status.totalProducts} - Product ${product.id}`);
          
          // Check status for this product
          await this.productStatusService.getContentStatus([product.id.toString()]);
          
          // Small delay between checks to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          const errorMsg = `Product ${product.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.status.errors.push(errorMsg);
          console.error(`❌ Background check error for product ${product.id}:`, error);
          
          // Longer delay after error
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      this.status.checkedProducts = allProducts.length;
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
}

// Singleton instance
export const backgroundStatusChecker = new BackgroundStatusChecker();