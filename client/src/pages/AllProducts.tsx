import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Package, ChevronRight, Loader2, Filter } from "lucide-react";
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

export default function AllProducts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [allProducts, setAllProducts] = useState<ShopifyProduct[]>([]);
  const [searchResults, setSearchResults] = useState<ShopifyProduct[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalFetched, setTotalFetched] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [contentStatus, setContentStatus] = useState<Record<string, ContentStatus>>({});
  const [contentFilter, setContentFilter] = useState<'all' | 'shopify' | 'new-layout' | 'draft-mode' | 'none'>('all');
  const { toast } = useToast();

  const productsPerPage = 20;
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Query for initial products (paginated)
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/products/all", currentPage],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/products/all?page=${currentPage}&limit=${productsPerPage}`);
      return response.json();
    }
  });

  // Query for comprehensive status data (all products)
  const { data: comprehensiveData } = useQuery({
    queryKey: ["/api/products/all/comprehensive-status"],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/products/all?comprehensive=true&limit=12500`);
      return response.json();
    }
  });

  useEffect(() => {
    if (data) {
      if (currentPage === 1) {
        setAllProducts(data.products || []);
        setTotalFetched(data.products?.length || 0);
      } else {
        setAllProducts(prev => [...prev, ...(data.products || [])]);
        setTotalFetched(prev => prev + (data.products?.length || 0));
      }
      setHasMore(data.hasMore || false);
      setIsLoadingMore(false);

      // Check content status for new products
      if (data.products && data.products.length > 0) {
        checkContentStatus(data.products.map((p: ShopifyProduct) => p.id));
      }
    }
  }, [data, currentPage]);

  // Check content status for ALL products when comprehensive data loads
  useEffect(() => {
    if (comprehensiveData && comprehensiveData.products) {
      const allProductIds = comprehensiveData.products.map((p: ShopifyProduct) => p.id);
      console.log(`Checking content status for ${allProductIds.length} total products in store`);
      checkContentStatus(allProductIds);
    }
  }, [comprehensiveData]);

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
      setIsLoadingMore(false);
    }
  }, [error, toast]);

  // Global search query
  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["/api/products/search", debouncedSearchTerm],
    queryFn: async () => {
      if (!debouncedSearchTerm || debouncedSearchTerm.length < 2) {
        return { products: [] };
      }
      const response = await apiRequest("GET", `/api/products/search?q=${encodeURIComponent(debouncedSearchTerm)}`);
      return response.json();
    },
    enabled: debouncedSearchTerm.length >= 2
  });

  // Update search results when search data changes
  useEffect(() => {
    if (searchData) {
      setSearchResults(searchData.products || []);
      setIsSearching(false);
      
      // Check content status for search results
      if (searchData.products && searchData.products.length > 0) {
        checkContentStatus(searchData.products.map((p: ShopifyProduct) => p.id));
      }
    }
  }, [searchData]);

  // Handle search loading state
  useEffect(() => {
    if (debouncedSearchTerm.length >= 2 && searchLoading) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [debouncedSearchTerm, searchLoading]);

  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      setCurrentPage(prev => prev + 1);
    }
  };

  // Filter products based on content status
  const filterProducts = (products: ShopifyProduct[]) => {
    if (contentFilter === 'all') return products;
    
    return products.filter(product => {
      const status = contentStatus[product.id];
      if (!status) return contentFilter === 'none';
      
      switch (contentFilter) {
        case 'shopify':
          return status.hasShopifyContent;
        case 'new-layout':
          return status.hasNewLayout;
        case 'draft-mode':
          return status.hasDraftContent; // Draft mode = has draft content in database
        case 'none':
          return !status.hasShopifyContent && !status.hasNewLayout;
        default:
          return true;
      }
    });
  };

  // Determine which products to display
  const baseProducts = searchTerm.length >= 2 ? searchResults : allProducts;
  const displayProducts = filterProducts(baseProducts);
  const isShowingSearchResults = searchTerm.length >= 2;

  // Calculate counts for filter display using comprehensive data if available
  const allProductsForCounting = comprehensiveData?.products || baseProducts;
  const totalProducts = baseProducts.length;
  const shopifyContentCount = allProductsForCounting.filter((p: ShopifyProduct) => contentStatus[p.id]?.hasShopifyContent).length;
  const newLayoutCount = allProductsForCounting.filter((p: ShopifyProduct) => contentStatus[p.id]?.hasNewLayout).length;
  const draftModeCount = allProductsForCounting.filter((p: ShopifyProduct) => contentStatus[p.id]?.hasDraftContent).length;
  const noContentCount = allProductsForCounting.filter((p: ShopifyProduct) => {
    const status = contentStatus[p.id];
    return !status?.hasShopifyContent && !status?.hasNewLayout;
  }).length;

  // Check content status for products
  const checkContentStatus = async (productIds: number[]) => {
    if (!productIds || productIds.length === 0) return;
    
    try {
      const response = await apiRequest("POST", "/api/products/content-status", {
        body: JSON.stringify({ productIds }),
        headers: { "Content-Type": "application/json" }
      });
      const statusData = await response.json();
      setContentStatus(prev => ({ ...prev, ...statusData }));
    } catch (error) {
      console.error("Error checking content status:", error);
    }
  };

  const handleProductSelect = (product: ShopifyProduct, variant?: ShopifyVariant) => {
    // Store the selected product data for the ProductManager
    sessionStorage.setItem('selectedProduct', JSON.stringify({
      product,
      selectedVariant: variant
    }));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900" data-testid="text-page-title">
              All Products
            </h1>
            <p className="text-slate-600 mt-1">
              {isShowingSearchResults ? (
                <>
                  Search results: <span className="font-semibold" data-testid="text-search-count">{displayProducts.length}</span>
                  {searchTerm && (
                    <span className="ml-2 text-slate-500">
                      for "{searchTerm}"
                    </span>
                  )}
                </>
              ) : (
                <>
                  Showing <span className="font-semibold" data-testid="text-filtered-count">{displayProducts.length}</span> of <span className="font-semibold" data-testid="text-total-count">{totalProducts}</span> products
                </>
              )}
            </p>
            
            {/* Content Statistics */}
            <div className="flex items-center gap-4 mt-2 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Shopify Content: {shopifyContentCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>New Layout: {newLayoutCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span>Draft Mode: {draftModeCount}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span>No Content: {noContentCount}</span>
              </div>
            </div>
          </div>
          <Badge variant="outline" className="text-sm">
            <Package className="w-4 h-4 mr-1" />
            Shopify Catalog
          </Badge>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 animate-spin" />
            )}
            <Input
              type="text"
              placeholder="Search by product title, SKU, or product ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
              data-testid="input-product-search"
            />
            {searchTerm.length >= 2 && (
              <div className="text-xs text-slate-500 mt-1">
                Searching across all products in your store...
              </div>
            )}
          </div>

          {/* Content Filter */}
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-slate-500" />
            <Select value={contentFilter} onValueChange={(value: 'all' | 'shopify' | 'new-layout' | 'draft-mode' | 'none') => setContentFilter(value)}>
              <SelectTrigger className="w-48" data-testid="select-content-filter">
                <SelectValue placeholder="Filter by content" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Products ({totalProducts})</SelectItem>
                <SelectItem value="shopify">Shopify Content ({shopifyContentCount})</SelectItem>
                <SelectItem value="new-layout">New Layout ({newLayoutCount})</SelectItem>
                <SelectItem value="draft-mode">Draft Mode ({draftModeCount})</SelectItem>
                <SelectItem value="none">No Content ({noContentCount})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading && currentPage === 1 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-slate-600">Loading products...</span>
        </div>
      ) : (
        <>
          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {displayProducts.map((product) => (
              <Card key={product.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg line-clamp-2" data-testid={`text-product-title-${product.id}`}>
                    {product.title}
                  </CardTitle>
                  <div className="text-sm text-slate-500">
                    Product ID: {product.id}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-2">
                        Variants ({product.variants.length})
                      </h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {product.variants.slice(0, 3).map((variant) => (
                          <div
                            key={variant.id}
                            className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm"
                          >
                            <div>
                              <div className="font-medium" data-testid={`text-variant-sku-${variant.id}`}>
                                {variant.sku}
                              </div>
                              {variant.title !== "Default Title" && (
                                <div className="text-slate-500 text-xs">{variant.title}</div>
                              )}
                            </div>
                            <div className="text-slate-600 font-medium">
                              ${variant.price}
                            </div>
                          </div>
                        ))}
                        {product.variants.length > 3 && (
                          <div className="text-xs text-slate-500 text-center py-1">
                            +{product.variants.length - 3} more variants...
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Content Status Badges */}
                    <div className="mb-3 flex flex-wrap gap-2">
                      {contentStatus[product.id]?.hasShopifyContent && (
                        <Badge variant="default" className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                          <Package className="w-3 h-3 mr-1" />
                          Shopify Content
                        </Badge>
                      )}
                      {contentStatus[product.id]?.hasNewLayout && (
                        <Badge variant="default" className="text-xs bg-green-100 text-green-800 border-green-200">
                          <Package className="w-3 h-3 mr-1" />
                          New Layout: {contentStatus[product.id]?.contentCount || 0}
                        </Badge>
                      )}
                      {contentStatus[product.id]?.hasDraftContent && (
                        <Badge variant="default" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                          Draft Mode
                        </Badge>
                      )}
                      {!contentStatus[product.id]?.hasShopifyContent && !contentStatus[product.id]?.hasNewLayout && (
                        <Badge variant="outline" className="text-xs">
                          <Package className="w-3 h-3 mr-1" />
                          Content: Not Added
                        </Badge>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-4">
                      <Link
                        href={`/product-manager/${product.id}`}
                        className="flex-1"
                        onClick={() => handleProductSelect(product)}
                      >
                        <Button 
                          className="w-full"
                          data-testid={`button-select-product-${product.id}`}
                        >
                          <ChevronRight className="w-4 h-4 mr-1" />
                          Select Product
                        </Button>
                      </Link>
                    </div>

                    {/* Quick Variant Selection */}
                    {product.variants.length > 1 && (
                      <div className="border-t pt-3 mt-3">
                        <div className="text-xs text-slate-500 mb-2">Quick select variant:</div>
                        <div className="flex flex-wrap gap-1">
                          {product.variants.slice(0, 3).map((variant) => (
                            <Link
                              key={variant.id}
                              href={`/product-manager/${product.id}`}
                              onClick={() => handleProductSelect(product, variant)}
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7"
                                data-testid={`button-select-variant-${variant.id}`}
                              >
                                {variant.sku}
                              </Button>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Load More Button - only show when not searching */}
          {hasMore && !isShowingSearchResults && (
            <div className="text-center">
              <Button
                onClick={loadMore}
                disabled={isLoadingMore}
                size="lg"
                data-testid="button-load-more"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading more...
                  </>
                ) : (
                  <>
                    Load More Products
                    <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          )}

          {!hasMore && totalFetched > 0 && !isShowingSearchResults && (
            <div className="text-center py-6">
              <p className="text-slate-500">
                All products loaded ({totalFetched} total)
              </p>
            </div>
          )}

          {displayProducts.length === 0 && isShowingSearchResults && !isSearching && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No products found</h3>
              <p className="text-slate-500">
                No products match "{searchTerm}". Try different search terms or clear the search to browse all products.
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setSearchTerm("")}
              >
                Clear Search
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}