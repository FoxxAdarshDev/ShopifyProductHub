import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useProductStatusCache } from "@/hooks/useProductStatusCache";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Package, ChevronRight, Loader2, FileEdit } from "lucide-react";
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

export default function DraftModeProducts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [allProducts, setAllProducts] = useState<ShopifyProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [contentStatus, setContentStatus] = useState<Record<string, ContentStatus>>({});
  const { toast } = useToast();
  const { cache, updateCache, getStatus, getStats } = useProductStatusCache();

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Comprehensive fetch of all products
  const { data, isLoading: queryLoading, error } = useQuery({
    queryKey: ["/api/products/all/comprehensive"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/products/all?comprehensive=true&limit=12500`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000 // 10 minutes (gcTime replaces cacheTime in v5)
  });

  useEffect(() => {
    setIsLoading(queryLoading);
  }, [queryLoading]);

  useEffect(() => {
    if (data && data.products) {
      console.log(`DraftModeProducts: Loaded ${data.products.length} products`);
      setAllProducts(data.products);
      // Check content status for all products
      const productIds = data.products.map((p: ShopifyProduct) => p.id);
      console.log(`DraftModeProducts: Checking content status for ${productIds.length} products`);
      checkContentStatus(productIds);
    }
  }, [data]);

  const checkContentStatus = async (productIds: number[]) => {
    if (!productIds || productIds.length === 0) return;
    
    try {
      console.log(`DraftModeProducts: Making content status request for ${productIds.length} products`);
      const response = await fetch("/api/products/content-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`DraftModeProducts: Content status API error: ${response.status} - ${errorText}`);
        return;
      }
      
      const statusData = await response.json();
      console.log(`DraftModeProducts: Received status data for ${Object.keys(statusData).length} products`);
      
      // Convert backend response format to frontend format for cache
      const cacheData: Record<string, any> = {};
      Object.keys(statusData).forEach(productId => {
        const status = statusData[productId];
        cacheData[productId] = {
          hasShopifyContent: status.hasShopifyContent,
          hasNewLayout: status.hasNewLayout,
          hasDraftContent: status.hasDraftContent,
          contentCount: status.contentCount,
          lastUpdated: new Date().toISOString()
        };
      });
      
      setContentStatus(statusData);
      
      // Update cache with converted data
      updateCache(cacheData);
      console.log(`DraftModeProducts: Updated cache with ${Object.keys(cacheData).length} products`);
    } catch (error) {
      console.error("DraftModeProducts: Error checking content status:", error);
    }
  };

  // Filter products based on search term and draft mode status
  useEffect(() => {
    if (!allProducts.length) return;

    let filtered = allProducts.filter(product => {
      // Try cache first, fallback to contentStatus
      const cachedStatus = getStatus(product.id.toString());
      const status = cachedStatus || contentStatus[product.id];
      return status && status.hasDraftContent;
    });

    if (debouncedSearchTerm && debouncedSearchTerm.length >= 2) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(product => {
        const titleMatch = product.title.toLowerCase().includes(searchLower);
        const idMatch = product.id.toString().includes(searchLower);
        const skuMatch = product.variants.some(variant => 
          variant.sku && variant.sku.toLowerCase().includes(searchLower)
        );
        return titleMatch || idMatch || skuMatch;
      });
    }

    console.log(`DraftModeProducts: Filtered ${filtered.length} products with draft content from ${allProducts.length} total products`);
    setFilteredProducts(filtered);
  }, [allProducts, contentStatus, debouncedSearchTerm, cache]);

  const draftCount = filteredProducts.length;
  const totalDraftInStore = allProducts.filter(product => {
    const status = contentStatus[product.id];
    return status && status.hasDraftContent;
  }).length;

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-red-500">
          Failed to load products. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FileEdit className="h-6 w-6" />
            Draft Mode Products
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Products with unsaved draft content
          </p>
        </div>
        
        {!isLoading && (
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100">
              Draft Mode: {totalDraftInStore}
            </Badge>
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by product title, SKU, or product ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Results Header */}
      <div className="mb-4">
        {isLoading ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Searching all products...
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {draftCount} of {totalDraftInStore} draft mode products
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
        )}
      </div>

      {/* Products Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2"></div>
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              </CardContent>
            </Card>
          ))
        ) : filteredProducts.length > 0 ? (
          filteredProducts.map((product) => {
            const status = contentStatus[product.id] || {};
            const primarySku = product.variants[0]?.sku || 'No SKU';

            return (
              <Card key={product.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">
                    {product.title}
                  </CardTitle>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900 dark:text-orange-100">
                      Draft Mode
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    <div>Product ID: {product.id}</div>
                    <div>SKU: {primarySku}</div>
                    {product.variants.length > 1 && (
                      <div>+{product.variants.length - 1} more variants</div>
                    )}
                  </div>
                  
                  <Link href={`/products/${product.id}`}>
                    <Button size="sm" className="w-full">
                      <Package className="h-3 w-3 mr-1" />
                      Edit Content
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })
        ) : searchTerm ? (
          <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
            No draft mode products found matching "{searchTerm}"
          </div>
        ) : (
          <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
            No products with draft content found
          </div>
        )}
      </div>
    </div>
  );
}