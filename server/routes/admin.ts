// Admin routes for maintenance tasks
import { Request, Response } from 'express';
import { productStatusService } from '../services/productStatusService';
import { storage } from '../storage';
import { backgroundProcessor } from '../services/backgroundProcessor';

// Force refresh status for products that might have new layout content
export async function refreshSuspectProducts(req: Request, res: Response) {
  try {
    console.log('🔄 Starting refresh of suspect products with potential new layout content');
    
    // Get products that have draft content but might have published content in Shopify
    const suspectProducts = await storage.getAllProductsWithDraftContent();
    console.log(`Found ${suspectProducts.length} products with draft content to check`);
    
    if (suspectProducts.length === 0) {
      return res.json({ message: 'No products need status refresh', updated: 0 });
    }

    let updatedCount = 0;
    const batchSize = 3;
    const delayBetweenBatches = 2000; // 2 seconds

    // Process in small batches to avoid rate limiting
    for (let i = 0; i < suspectProducts.length; i += batchSize) {
      const batch = suspectProducts.slice(i, i + batchSize);
      console.log(`Processing refresh batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(suspectProducts.length/batchSize)}`);
      
      for (const product of batch) {
        try {
          // Force fresh check by invalidating cache
          await storage.invalidateProductStatusCache(product.shopifyProductId);
          
          // Get fresh status - this will trigger Shopify check
          const status = await productStatusService.getProductContentStatus(product.shopifyProductId);
          
          if (status.hasNewLayout || status.hasShopifyContent) {
            updatedCount++;
            console.log(`✅ Updated status for product ${product.shopifyProductId}: hasNewLayout=${status.hasNewLayout}, contentCount=${status.contentCount}`);
          }
        } catch (error) {
          console.error(`❌ Error refreshing product ${product.shopifyProductId}:`, error);
        }
      }
      
      // Delay between batches
      if (i + batchSize < suspectProducts.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    console.log(`🎉 Completed refresh: ${updatedCount} products updated out of ${suspectProducts.length} checked`);
    
    res.json({
      message: 'Product status refresh completed',
      checked: suspectProducts.length,
      updated: updatedCount
    });
  } catch (error) {
    console.error('Error in refreshSuspectProducts:', error);
    res.status(500).json({ error: 'Failed to refresh product status' });
  }
}

// Start background processing for all products
export async function startBackgroundProcessing(req: Request, res: Response) {
  try {
    backgroundProcessor.startSystematicRefresh();
    res.json({
      message: 'Background processing started',
      status: backgroundProcessor.getStatus()
    });
  } catch (error) {
    console.error('Error starting background processing:', error);
    res.status(500).json({ error: 'Failed to start background processing' });
  }
}

// Get background processing status
export async function getBackgroundProcessingStatus(req: Request, res: Response) {
  try {
    const status = backgroundProcessor.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting background processing status:', error);
    res.status(500).json({ error: 'Failed to get processing status' });
  }
}

// Stop background processing
export async function stopBackgroundProcessing(req: Request, res: Response) {
  try {
    await backgroundProcessor.stopProcessing();
    res.json({
      message: 'Background processing stopped',
      status: backgroundProcessor.getStatus()
    });
  } catch (error) {
    console.error('Error stopping background processing:', error);
    res.status(500).json({ error: 'Failed to stop background processing' });
  }
}

// Force refresh all products by invalidating all cache
export async function forceRefreshAllProducts(req: Request, res: Response) {
  try {
    console.log('🔄 Force refreshing all products by invalidating cache');
    const updatedCount = await storage.invalidateAllProductStatusCache();
    
    res.json({
      message: 'All product status cache invalidated',
      updatedCount,
      note: 'Products will be re-checked on next access'
    });
  } catch (error) {
    console.error('Error in forceRefreshAllProducts:', error);
    res.status(500).json({ error: 'Failed to force refresh all products' });
  }
}