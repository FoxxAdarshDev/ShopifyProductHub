import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ProductLookup from "@/components/ProductLookup";
import TabSelector from "@/components/TabSelector";
import ContentForms from "@/components/ContentForms";
import PreviewPanel from "@/components/PreviewPanel";
import { Store, User } from "lucide-react";

export default function ProductManager() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  const [contentData, setContentData] = useState<any>({});
  const { toast } = useToast();

  // Check if a product was selected from AllProducts page
  useEffect(() => {
    const savedProduct = sessionStorage.getItem('selectedProduct');
    if (savedProduct) {
      try {
        const { product, selectedVariant } = JSON.parse(savedProduct);
        setSelectedProduct({
          id: product.id,
          shopifyId: product.id.toString(),
          sku: selectedVariant?.sku || product.variants[0]?.sku || '',
          title: product.title,
          description: product.body_html || ''
        });
        sessionStorage.removeItem('selectedProduct'); // Clear after use
      } catch (error) {
        console.error('Error parsing selected product:', error);
      }
    }
  }, []);

  // Update product content mutation
  const updateContentMutation = useMutation({
    mutationFn: async ({ productId, content }: { productId: string; content: any[] }) => {
      return apiRequest("POST", `/api/products/${productId}/content`, content);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Content saved successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save content",
        variant: "destructive",
      });
    },
  });

  // Update Shopify product mutation
  const updateShopifyMutation = useMutation({
    mutationFn: async (productId: string) => {
      return apiRequest("POST", `/api/products/${productId}/update-shopify`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Product updated on Shopify successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update Shopify product",
        variant: "destructive",
      });
    },
  });

  const handleProductFound = (product: any, content: any[]) => {
    setSelectedProduct(product);
    
    // Set selected tabs based on existing content
    const existingTabs = content.map(c => c.tabType);
    setSelectedTabs(existingTabs);
    
    // Set content data
    const contentMap: any = {};
    content.forEach(c => {
      contentMap[c.tabType] = c.content;
    });
    setContentData(contentMap);
  };

  const handleSaveContent = () => {
    if (!selectedProduct) return;

    const contentArray = selectedTabs.map(tabType => ({
      tabType,
      content: contentData[tabType] || {},
      isActive: true
    }));

    updateContentMutation.mutate({
      productId: selectedProduct.id,
      content: contentArray
    });
  };

  const handleUpdateShopify = () => {
    if (!selectedProduct) return;
    updateShopifyMutation.mutate(selectedProduct.id);
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900" data-testid="text-page-title">
                Product Content Manager
              </h1>
              <p className="text-slate-600 mt-1">
                Create and manage product content for your Shopify store
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-slate-500">
                <Store className="w-4 h-4 mr-1" />
                foxxbioprocess.myshopify.com
              </div>
              <div className="flex items-center text-sm text-slate-500">
                <User className="w-4 h-4 mr-1" />
                Admin
              </div>
            </div>
          </div>
        </div>

        <main className="space-y-8">
          <ProductLookup onProductFound={handleProductFound} />
          
          {selectedProduct && (
            <>
              <TabSelector
                selectedTabs={selectedTabs}
                onTabsChange={setSelectedTabs}
              />
              
              <ContentForms
                selectedTabs={selectedTabs}
                contentData={contentData}
                onContentChange={setContentData}
              />
              
              <PreviewPanel
                contentData={contentData}
                selectedTabs={selectedTabs}
                onSaveContent={handleSaveContent}
                onUpdateShopify={handleUpdateShopify}
                isLoading={updateContentMutation.isPending || updateShopifyMutation.isPending}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
