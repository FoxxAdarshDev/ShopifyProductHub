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

// Force refresh all products to detect new layout templates
export async function forceRefreshLayoutDetection(req: Request, res: Response) {
  try {
    console.log(`🔄 Starting forced layout detection refresh for ALL products`);
    
    const { shopifyService } = await import('../services/shopify.js');
    
    // Get ALL products in the store
    const allProducts = await shopifyService.getAllProductsComprehensive();
    console.log(`Found ${allProducts.length} total products to check`);
    
    let updatedCount = 0;
    let newLayoutFound = 0;
    
    // Process in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < allProducts.length; i += batchSize) {
      const batch = allProducts.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allProducts.length / batchSize)} (${batch.length} products)`);
      
      const promises = batch.map(async (product: any) => {
        try {
          // Force fresh check by temporarily bypassing cache
          const status = await productStatusService.getProductContentStatus(product.id.toString());
          updatedCount++;
          
          if (status.hasNewLayout) {
            newLayoutFound++;
            console.log(`✅ New Layout detected: ${product.title} (ID: ${product.id})`);
          }
          
          return { productId: product.id, status };
        } catch (error) {
          console.warn(`Failed to check product ${product.id}:`, error);
          return null;
        }
      });
      
      await Promise.all(promises);
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < allProducts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`🎉 Layout detection refresh complete: ${updatedCount} products checked, ${newLayoutFound} new layouts found`);
    
    res.json({
      message: "Layout detection refresh completed",
      totalProducts: allProducts.length,
      productsChecked: updatedCount,
      newLayoutsFound: newLayoutFound
    });
  } catch (error) {
    console.error("Force refresh layout detection error:", error);
    res.status(500).json({ message: "Failed to refresh layout detection" });
  }
}

// Get immediate status counts from database
export async function getStatusCountsNow(req: Request, res: Response) {
  try {
    console.log('📊 Getting immediate status counts from database');
    
    // Get all product status records
    const allStatuses = await storage.getAllProductStatuses();
    console.log(`Found ${allStatuses.length} products with status records`);
    
    // Count each category
    let newLayoutCount = 0;
    let draftModeCount = 0;
    let shopifyContentCount = 0;
    let noContentCount = 0;
    
    for (const status of allStatuses) {
      if (status.hasNewLayout || status.isOurTemplateStructure) {
        newLayoutCount++;
      } else if (status.hasDraftContent) {
        draftModeCount++;
      } else if (status.hasShopifyContent) {
        shopifyContentCount++;
      } else {
        noContentCount++;
      }
    }
    
    // Get total product count
    const allProducts = await storage.getAllProducts();
    const totalProducts = allProducts.length;
    
    // Calculate products without any status record (they are No Content)
    const productsWithoutStatus = totalProducts - allStatuses.length;
    noContentCount += productsWithoutStatus;
    
    const result = {
      total: totalProducts,
      shopifyContent: shopifyContentCount,
      newLayout: newLayoutCount,
      draftMode: draftModeCount,
      noContent: noContentCount,
      details: {
        statusRecords: allStatuses.length,
        productsWithoutStatus,
        breakdown: 'New Layout (our template), Draft Mode (local unsaved), Shopify Content (standard), No Content (empty)'
      }
    };
    
    console.log('📊 Current database status counts:', result);
    
    res.json(result);
  } catch (error) {
    console.error('Error getting status counts:', error);
    res.status(500).json({ error: 'Failed to get status counts' });
  }
}