import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Package, ChevronRight, Loader2 } from "lucide-react";
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

export default function AllProducts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [allProducts, setAllProducts] = useState<ShopifyProduct[]>([]);
  const [searchResults, setSearchResults] = useState<ShopifyProduct[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalFetched, setTotalFetched] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const productsPerPage = 20;
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/products/all", currentPage],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/products/all?page=${currentPage}&limit=${productsPerPage}`);
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
    }
  }, [data, currentPage]);

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

  // Determine which products to display
  const displayProducts = searchTerm.length >= 2 ? searchResults : allProducts;
  const isShowingSearchResults = searchTerm.length >= 2;

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
                  Total products loaded: <span className="font-semibold" data-testid="text-product-count">{totalFetched}</span>
                </>
              )}
            </p>
          </div>
          <Badge variant="outline" className="text-sm">
            <Package className="w-4 h-4 mr-1" />
            Shopify Catalog
          </Badge>
        </div>

        {/* Search */}
        <div className="relative mb-6">
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

                    {/* Content Status Badge */}
                    <div className="mb-3">
                      <Badge variant="outline" className="text-xs">
                        <Package className="w-3 h-3 mr-1" />
                        Content: Not Added
                      </Badge>
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