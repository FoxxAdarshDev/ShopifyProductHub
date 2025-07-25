import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, CheckCircle, Plus, Loader2 } from "lucide-react";

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

interface ProductLookupProps {
  onProductFound: (product: any, content: any[]) => void;
}

export default function ProductLookup({ onProductFound }: ProductLookupProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [foundProducts, setFoundProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProduct, setNewProduct] = useState({
    sku: "",
    title: "",  
    description: "",
    shopifyId: ""
  });
  const { toast } = useToast();
  const debouncedSearchTerm = useDebounce(searchTerm, 500);

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
      setFoundProducts(searchData.products || []);
      if (searchData.products && searchData.products.length === 1) {
        // Auto-select if only one result
        const product = searchData.products[0];
        setSelectedProduct(product);
      } else {
        setSelectedProduct(null);
      }
    }
  }, [searchData]);

  const createProductMutation = useMutation({
    mutationFn: async (productData: any) => {
      const response = await apiRequest("POST", "/api/products", productData);
      return response.json();
    },
    onSuccess: (data) => {
      setSelectedProduct(data);
      onProductFound(data, []);
      setShowCreateForm(false);
      setNewProduct({ sku: "", title: "", description: "", shopifyId: "" });
      toast({
        title: "Product Created",
        description: `Successfully created ${data.title}`,
      });
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Failed to create product",
        variant: "destructive",
      });
    },
  });

  const handleProductSelect = (product: any) => {
    setSelectedProduct(product);
    onProductFound({
      id: product.id,
      shopifyId: product.id.toString(),
      sku: product.variants[0]?.sku || '',
      title: product.title,
      description: product.body_html || ''
    }, []);
    toast({
      title: "Product Selected",
      description: `Successfully loaded ${product.title}`,
    });
  };

  const handleCreateProduct = () => {
    if (!newProduct.sku.trim() || !newProduct.title.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both SKU and title",
        variant: "destructive",
      });
      return;
    }
    createProductMutation.mutate(newProduct);
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Product Lookup</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="search-input" className="block text-sm font-medium text-slate-700 mb-2">
              Search by Product ID, SKU, or Title
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              {searchLoading && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 animate-spin" />
              )}
              <Input
                id="search-input"
                type="text"
                placeholder="Search by product ID, SKU, or title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10"
                data-testid="input-search"
              />
            </div>
            {searchTerm.length >= 2 && (
              <div className="text-xs text-slate-500 mt-1">
                Searching across all products in your store...
              </div>
            )}
          </div>

          {/* Search Results */}
          {foundProducts.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Search Results ({foundProducts.length})
              </Label>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {foundProducts.map((product) => (
                  <div
                    key={product.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedProduct?.id === product.id
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                    onClick={() => handleProductSelect(product)}
                    data-testid={`product-result-${product.id}`}
                  >
                    <h4 className="font-medium text-slate-900 text-sm">{product.title}</h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Product ID: {product.id}
                    </p>
                    {product.variants.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-slate-500 mb-1">SKUs:</p>
                        <div className="flex flex-wrap gap-1">
                          {product.variants.slice(0, 3).map((variant: any) => (
                            <span
                              key={variant.id}
                              className="inline-block px-2 py-1 bg-slate-100 text-xs rounded"
                            >
                              {variant.sku}
                            </span>
                          ))}
                          {product.variants.length > 3 && (
                            <span className="text-xs text-slate-500">
                              +{product.variants.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchTerm.length >= 2 && foundProducts.length === 0 && !searchLoading && (
            <div className="text-center py-6 text-slate-500">
              <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p>No products found for "{searchTerm}"</p>
              <p className="text-sm mt-1">Try a different search term or create the product manually.</p>
            </div>
          )}
        </div>

        {selectedProduct && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-green-900" data-testid="text-product-title">
                  {selectedProduct.title}
                </h3>
                <p className="text-sm text-green-700">
                  Product ID: <span data-testid="text-product-id">{selectedProduct.id}</span>
                </p>
                {selectedProduct.variants.length > 0 && (
                  <p className="text-sm text-green-700">
                    Primary SKU: <span data-testid="text-product-sku">{selectedProduct.variants[0].sku}</span>
                  </p>
                )}
              </div>
              <CheckCircle className="text-green-500 w-6 h-6" />
            </div>
          </div>
        )}

        {searchTerm.length >= 2 && foundProducts.length === 0 && !searchLoading && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Product not found? Create it manually:
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateForm(!showCreateForm)}
                data-testid="button-toggle-create"
              >
                <Plus className="w-4 h-4 mr-2" />
                {showCreateForm ? "Cancel" : "Create Product"}
              </Button>
            </div>

            {showCreateForm && (
              <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="new-sku">SKU *</Label>
                    <Input
                      id="new-sku"
                      value={newProduct.sku}
                      onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                      placeholder={searchTerm || "e.g., 645-4401-FLS"}
                      data-testid="input-new-sku"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-title">Product Title *</Label>
                    <Input
                      id="new-title"
                      value={newProduct.title}
                      onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                      placeholder="e.g., EZBio PETG 1000mL Bottle"
                      data-testid="input-new-title"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Label htmlFor="new-description">Description</Label>
                  <Textarea
                    id="new-description"
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    placeholder="Enter product description..."
                    rows={3}
                    data-testid="textarea-new-description"
                  />
                </div>
                <div className="mt-4">
                  <Label htmlFor="new-shopify-id">Shopify Product ID (optional)</Label>
                  <Input
                    id="new-shopify-id"
                    value={newProduct.shopifyId}
                    onChange={(e) => setNewProduct({ ...newProduct, shopifyId: e.target.value })}
                    placeholder="Leave empty if unknown"
                    data-testid="input-new-shopify-id"
                  />
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={handleCreateProduct}
                    disabled={createProductMutation.isPending}
                    data-testid="button-create-product"
                  >
                    {createProductMutation.isPending ? "Creating..." : "Create Product"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
