// Frontend cache for product status to minimize API calls
import { useState, useEffect } from 'react';

interface ProductStatus {
  hasShopifyContent: boolean;
  hasNewLayout: boolean;
  hasDraftContent: boolean;
  contentCount: number;
  lastUpdated?: string;
}

interface ProductStatusCache {
  [productId: string]: ProductStatus;
}

const CACHE_KEY = 'productStatusCache';
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes

// Load cache from localStorage
const loadCacheFromStorage = (): ProductStatusCache => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      // Check if cache is expired
      if (data.timestamp && Date.now() - data.timestamp < CACHE_EXPIRY) {
        return data.cache || {};
      }
    }
  } catch (error) {
    console.warn('Failed to load product status cache:', error);
  }
  return {};
};

// Save cache to localStorage
const saveCacheToStorage = (cache: ProductStatusCache) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      cache,
      timestamp: Date.now()
    }));
  } catch (error) {
    console.warn('Failed to save product status cache:', error);
  }
};

export const useProductStatusCache = () => {
  const [cache, setCache] = useState<ProductStatusCache>(loadCacheFromStorage);

  // Save to localStorage whenever cache changes
  useEffect(() => {
    saveCacheToStorage(cache);
  }, [cache]);

  const updateCache = (statusData: ProductStatusCache) => {
    setCache(prev => ({ ...prev, ...statusData }));
  };

  const getStatus = (productId: string): ProductStatus | null => {
    return cache[productId] || null;
  };

  const hasStatus = (productId: string): boolean => {
    return !!cache[productId];
  };

  const clearCache = () => {
    setCache({});
    localStorage.removeItem(CACHE_KEY);
  };

  const getStats = () => {
    const statuses = Object.values(cache);
    return {
      total: statuses.length,
      newLayout: statuses.filter(s => s.hasNewLayout).length,
      draftMode: statuses.filter(s => s.hasDraftContent).length,
      shopifyContent: statuses.filter(s => s.hasShopifyContent).length,
      noContent: statuses.filter(s => !s.hasShopifyContent && !s.hasNewLayout).length
    };
  };

  return {
    cache,
    updateCache,
    getStatus,
    hasStatus,
    clearCache,
    getStats
  };
};