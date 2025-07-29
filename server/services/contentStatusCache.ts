// Content Status Cache Service
// Stores and retrieves content status to avoid repeated API calls

interface ContentStatus {
  hasShopifyContent: boolean;
  hasNewLayout: boolean;
  hasDraftContent: boolean;
  contentCount: number;
  lastUpdated: number;
}

class ContentStatusCache {
  private cache: Map<string, ContentStatus> = new Map();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes

  set(productId: string, status: Omit<ContentStatus, 'lastUpdated'>): void {
    this.cache.set(productId, {
      ...status,
      lastUpdated: Date.now()
    });
  }

  get(productId: string): ContentStatus | null {
    const cached = this.cache.get(productId);
    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.lastUpdated > this.cacheExpiry) {
      this.cache.delete(productId);
      return null;
    }

    return cached;
  }

  has(productId: string): boolean {
    return this.get(productId) !== null;
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { total: number; fresh: number } {
    const now = Date.now();
    let fresh = 0;
    
    this.cache.forEach((status) => {
      if (now - status.lastUpdated <= this.cacheExpiry) {
        fresh++;
      }
    });

    return {
      total: this.cache.size,
      fresh
    };
  }

  // Invalidate cache for a specific product when it's updated
  invalidate(productId: string): void {
    this.cache.delete(productId);
  }
}

export const contentStatusCache = new ContentStatusCache();
export type { ContentStatus };