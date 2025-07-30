import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useProductStatusCache } from "@/hooks/useProductStatusCache";
import { useStatusCounts } from "@/hooks/useStatusCounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Package, ChevronRight, Loader2, Filter, ShoppingCart } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";

// Debounce hook for search
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

interface ShopifyVariant {
  id: number;
  sku: string;
  price: string;
  title: string;
  inventory_quantity?: number;
}

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  handle: string;
  variants: ShopifyVariant[];
}

interface ContentStatus {
  hasShopifyContent: boolean;
  hasNewLayout: boolean;
  hasDraftContent: boolean;
  contentCount: number;
}

export default function AllProductsNew() {
  const [searchTerm, setSearchTerm] = useState("");
  const [contentStatus, setContentStatus] = useState<Record<string, ContentStatus>>({});
  const [contentFilter, setContentFilter] = useState<'all' | 'shopify' | 'new-layout' | 'draft-mode' | 'none'>('all');
  const { toast } = useToast();
  const { cache, updateCache, getStats } = useProductStatusCache();
  const { data: statusCounts } = useStatusCounts();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Get store count for display
  const { data: countData } = useQuery({
    queryKey: ["/api/products/count"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/products/count`);
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // Cache count for 10 minutes
  });

  // Infinite query for product batches using cursor-based pagination
  const {
    data: productPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch
  } = useInfiniteQuery({
    queryKey: ["/api/products/infinite", contentFilter],
    queryFn: async ({ pageParam }) => {
      const url = pageParam 
        ? `/api/products/batch?since_id=${pageParam}&limit=20`
        : `/api/products/batch?limit=20`;
      
      console.log(`🔄 Frontend fetching: ${url}`);
      console.log(`🎯 Page param for this request: ${pageParam || 'initial'}`);
      const response = await apiRequest("GET", url);
      const data = await response.json();
      console.log(`📦 Frontend received: ${data.products?.length || 0} products, hasMore: ${data.hasMore}, nextCursor: ${data.nextCursor}`);
      return data;
    },
    getNextPageParam: (lastPage) => {
      console.log(`🔍 getNextPageParam: hasMore=${lastPage.hasMore}, nextCursor=${lastPage.nextCursor}`);
      return lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined;
    },
    initialPageParam: undefined as string | undefined,
    staleTime: 0, // Don't cache - always fetch fresh data
    gcTime: 5 * 60 * 1000, // Keep data for 5 minutes in memory but always refetch
  });

  // Search query for when user is searching  
  const { data: searchData, isLoading: searchLoading, error: searchError } = useQuery({
    queryKey: ["/api/products/search", debouncedSearchTerm],
    queryFn: async () => {
      if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
        return { products: [], totalFound: 0 };
      }
      console.log(`🔍 Frontend searching for: "${debouncedSearchTerm}"`);
      const response = await apiRequest("GET", `/api/products/search?q=${encodeURIComponent(debouncedSearchTerm)}`);
      const data = await response.json();
      console.log(`📋 Frontend search results:`, data);
      return data;
    },
    enabled: debouncedSearchTerm.length >= 2,
    staleTime: 30 * 1000, // Cache search results for 30 seconds
  });

  // Flatten all products from infinite query and remove duplicates
  const allProducts = useMemo(() => {
    if (!productPages) return [];
    
    const products = productPages.pages.flatMap(page => page.products) || [];
    
    // Remove duplicates by product ID
    const uniqueProducts = products.filter((product, index, array) => {
      return array.findIndex(p => p.id === product.id) === index;
    });
    
    console.log(`🧹 Deduplication: ${products.length} total → ${uniqueProducts.length} unique products`);
    if (productPages.pages.length > 0) {
      console.log(`📊 Pages in infinite query: ${productPages.pages.length}`);
      productPages.pages.forEach((page, index) => {
        console.log(`  Page ${index + 1}: ${page.products?.length || 0} products, cursor: ${page.nextCursor || 'none'}`);
      });
    }
    return uniqueProducts;
  }, [productPages]);

  // Determine which products to show
  const isSearching = debouncedSearchTerm.length >= 2;
  const displayProducts = isSearching ? (searchData?.products || []) : allProducts;
  
  // Debug logging
  if (isSearching && searchData) {
    console.log(`📊 Search mode: query="${debouncedSearchTerm}", found=${searchData.products?.length || 0} products`);
  } else if (!isSearching) {
    console.log(`📊 Browse mode: showing ${allProducts.length} products from infinite query`);
  }

  // Content status checking function
  const checkContentStatus = useCallback(async (productIds: number[]) => {
    if (productIds.length === 0) return;
    
    try {
      const response = await apiRequest("POST", "/api/products/content-status", {
        productIds: productIds.map(id => id.toString())
      });
      const statusData = await response.json();
      
      // Update local content status
      setContentStatus(prev => ({ ...prev, ...statusData }));
      
      // Update cache
      updateCache(statusData);
    } catch (error) {
      console.error("Failed to check content status:", error);
    }
  }, [updateCache]);

  // Check content status for displayed products
  useEffect(() => {
    if (displayProducts.length > 0) {
      const productIds = displayProducts.map((p: ShopifyProduct) => p.id);
      checkContentStatus(productIds);
    }
  }, [displayProducts, checkContentStatus]);

  // Initialize cached status data
  useEffect(() => {
    const cachedStatus: Record<string, ContentStatus> = {};
    Object.keys(cache).forEach(productId => {
      const status = cache[productId];
      cachedStatus[productId] = {
        hasShopifyContent: status.hasShopifyContent,
        hasNewLayout: status.hasNewLayout,
        hasDraftContent: status.hasDraftContent,
        contentCount: status.contentCount
      };
    });
    setContentStatus(cachedStatus);
  }, [cache]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    if (debouncedSearchTerm.length >= 2) return; // Don't auto-load during search

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          console.log(`🚀 Intersection observer triggered: fetching next page`);
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, debouncedSearchTerm]);

  // Error handling
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Get content status badge
  const getContentStatusBadge = (productId: number) => {
    const status = contentStatus[productId.toString()];
    if (!status) return null;

    if (status.hasNewLayout) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">New Layout</Badge>;
    }
    if (status.hasDraftContent) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">Draft Mode</Badge>;
    }
    if (status.hasShopifyContent) {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300">Shopify Content</Badge>;
    }
    return <Badge variant="outline" className="text-gray-600">Content: Not Added</Badge>;
  };

  // Get stats for display
  const stats = getStats();
  const totalProducts = countData?.totalInStore || 0;
  const totalSkus = countData?.totalSkuCount || 0;
  const loadedCount = displayProducts.length;
  
  // Calculate loaded SKU count from displayed products
  const loadedSkuCount = displayProducts.reduce((acc: number, product: ShopifyProduct) => {
    return acc + (product.variants?.length || 0);
  }, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">All Products</h1>
            <div className="text-gray-600 dark:text-gray-400 mt-1 space-y-1">
              <p>
                {debouncedSearchTerm.length >= 2 
                  ? `Showing ${loadedCount} search results for "${debouncedSearchTerm}"`
                  : `Showing ${loadedCount} of ${totalProducts} products in store`
                }
              </p>
              {debouncedSearchTerm.length < 2 && (
                <p className="text-sm">
                  SKUs: {loadedSkuCount} of ~{totalSkus} total variants displayed
                </p>
              )}
            </div>
          </div>
          
          {/* Status Summary */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-blue-50">
              Shopify Content: {stats.shopifyContent}
            </Badge>
            <Badge variant="outline" className="bg-green-50">
              New Layout: {stats.newLayout}
            </Badge>
            <Badge variant="outline" className="bg-yellow-50">
              Draft Mode: {stats.draftMode}
            </Badge>
            <Badge variant="outline" className="bg-gray-50">
              No Content: {stats.noContent}
            </Badge>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by product name, SKU, or Product ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={contentFilter} onValueChange={(value: typeof contentFilter) => setContentFilter(value)}>
            <SelectTrigger className="w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="shopify">Shopify Content ({stats.shopifyContent})</SelectItem>
              <SelectItem value="new-layout">New Layout ({stats.newLayout})</SelectItem>
              <SelectItem value="draft-mode">Draft Mode ({stats.draftMode})</SelectItem>
              <SelectItem value="none">No Content ({stats.noContent})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading products...</span>
          </div>
        )}

        {/* Search Loading */}
        {searchLoading && debouncedSearchTerm.length >= 2 && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Searching...</span>
          </div>
        )}

        {/* Products Grid */}
        {displayProducts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayProducts.map((product: ShopifyProduct) => (
              <Card key={product.id} className="hover:shadow-lg transition-shadow duration-200">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-lg leading-tight line-clamp-2">
                      {product.title}
                    </CardTitle>
                    {getContentStatusBadge(product.id)}
                  </div>
                  <p className="text-sm text-gray-600">Product ID: {product.id}</p>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Variants Section */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Variants ({product.variants?.length || 0})
                    </h4>
                    
                    {product.variants && product.variants.length > 0 ? (
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {product.variants.map((variant) => (
                          <div 
                            key={variant.id} 
                            className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 truncate">
                                {variant.sku || `Variant ${variant.id}`}
                              </div>
                              {variant.title && variant.title !== 'Default Title' && (
                                <div className="text-gray-600 text-xs truncate">
                                  {variant.title}
                                </div>
                              )}
                            </div>
                            <div className="text-right ml-2">
                              <div className="font-semibold text-gray-900">
                                ${parseFloat(variant.price || '0').toFixed(2)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic bg-gray-50 p-2 rounded">
                        No variants available
                      </div>
                    )}
                  </div>

                  {/* Quick Variant Selector */}
                  {product.variants && product.variants.length > 1 && (
                    <div>
                      <h5 className="text-xs font-medium text-gray-600 mb-1">Quick select variant:</h5>
                      <div className="flex flex-wrap gap-1">
                        {product.variants.slice(0, 3).map((variant) => (
                          <Badge 
                            key={variant.id}
                            variant="outline" 
                            className="text-xs cursor-pointer hover:bg-gray-100"
                          >
                            {variant.sku || variant.title}
                          </Badge>
                        ))}
                        {product.variants.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{product.variants.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <Link href={`/product/${product.id}`}>
                    <Button className="w-full" variant="default">
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Select Product
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* No Products Found */}
        {!isLoading && !searchLoading && displayProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600">
              {debouncedSearchTerm.length >= 2 
                ? `No products match your search "${debouncedSearchTerm}"`
                : "No products available with the selected filter"
              }
            </p>
            {/* Debug info for searches */}
            {debouncedSearchTerm.length >= 2 && searchData && (
              <div className="mt-4 text-xs text-gray-500">
                <p>Search returned: {searchData.totalFound || 0} results</p>
                {searchError && <p className="text-red-500">Search error: {searchError.message}</p>}
              </div>
            )}
          </div>
        )}

        {/* Infinite Scroll Loader */}
        {!searchLoading && debouncedSearchTerm.length < 2 && (
          <div ref={loadMoreRef} className="flex justify-center py-6">
            {isFetchingNextPage ? (
              <div className="flex items-center">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading more products...</span>
              </div>
            ) : hasNextPage ? (
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    console.log(`🔄 Manual load more clicked: hasNextPage=${hasNextPage}, isFetchingNextPage=${isFetchingNextPage}`);
                    fetchNextPage();
                  }} 
                  variant="outline"
                  className="px-8"
                >
                  Load More Products
                </Button>
                <Button 
                  onClick={() => {
                    console.log(`🔄 Reset pagination cache and refetch`);
                    refetch();
                  }} 
                  variant="secondary"
                  className="px-4"
                >
                  Reset
                </Button>
              </div>
            ) : allProducts.length > 0 ? (
              <p className="text-gray-500 text-sm">
                All products loaded ({allProducts.length} total)
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}