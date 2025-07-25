import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, CheckCircle } from "lucide-react";

interface ProductLookupProps {
  onProductFound: (product: any, content: any[]) => void;
}

export default function ProductLookup({ onProductFound }: ProductLookupProps) {
  const [sku, setSku] = useState("");
  const [foundProduct, setFoundProduct] = useState<any>(null);
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
    onError: () => {
      setFoundProduct(null);
      toast({
        title: "Product Not Found",
        description: "No product found with this SKU",
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
      </CardContent>
    </Card>
  );
}
