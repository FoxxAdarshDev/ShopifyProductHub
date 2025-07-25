import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, CheckCircle, Plus } from "lucide-react";

interface ProductLookupProps {
  onProductFound: (product: any, content: any[]) => void;
}

export default function ProductLookup({ onProductFound }: ProductLookupProps) {
  const [sku, setSku] = useState("");
  const [foundProduct, setFoundProduct] = useState<any>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProduct, setNewProduct] = useState({
    sku: "",
    title: "",  
    description: "",
    shopifyId: ""
  });
  const { toast } = useToast();

  const lookupMutation = useMutation({
    mutationFn: async (sku: string) => {
      const response = await apiRequest("GET", `/api/products/lookup/${sku}`);
      return response.json();
    },
    onSuccess: (data) => {
      setFoundProduct(data.product);
      onProductFound(data.product, data.content || []);
      toast({
        title: "Product Found",
        description: `Successfully loaded ${data.product.title}`,
      });
    },
    onError: (error: any) => {
      setFoundProduct(null);
      const errorMessage = error?.message || "No product found with this SKU";
      toast({
        title: "Product Not Found",
        description: errorMessage.includes("suggestion") ? 
          "Product not found. You can create it manually using the form below." : 
          errorMessage,
        variant: "destructive",
      });
    },
  });

  const createProductMutation = useMutation({
    mutationFn: async (productData: any) => {
      const response = await apiRequest("POST", "/api/products", productData);
      return response.json();
    },
    onSuccess: (data) => {
      setFoundProduct(data);
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

  const handleLookup = () => {
    if (!sku.trim()) {
      toast({
        title: "Missing SKU",
        description: "Please enter a SKU to lookup",
        variant: "destructive",
      });
      return;
    }
    lookupMutation.mutate(sku.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLookup();
    }
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
        <div className="flex space-x-4">
          <div className="flex-1">
            <Label htmlFor="sku-input" className="block text-sm font-medium text-slate-700 mb-2">
              Enter SKU
            </Label>
            <Input
              id="sku-input"
              type="text"
              placeholder="e.g., 645-4401-FLS"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              onKeyPress={handleKeyPress}
              data-testid="input-sku"
            />
          </div>
          <div className="flex items-end">
            <Button 
              onClick={handleLookup} 
              disabled={lookupMutation.isPending}
              data-testid="button-lookup"
            >
              <Search className="w-4 h-4 mr-2" />
              {lookupMutation.isPending ? "Looking up..." : "Lookup"}
            </Button>
          </div>
        </div>

        {foundProduct && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-green-900" data-testid="text-product-title">
                  {foundProduct.title}
                </h3>
                <p className="text-sm text-green-700">
                  SKU: <span data-testid="text-product-sku">{foundProduct.sku}</span>
                </p>
              </div>
              <CheckCircle className="text-green-500 w-6 h-6" />
            </div>
          </div>
        )}

        {!foundProduct && !lookupMutation.isPending && (
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
                      placeholder="e.g., 645-4401-FLS"
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
