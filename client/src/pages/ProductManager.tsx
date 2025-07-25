import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/Sidebar";
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
    <div className="min-h-screen bg-slate-50">
      {/* Header Navigation */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img 
              src="https://images.unsplash.com/photo-1611224923853-80b023f02d71?ixlib=rb-4.0.3&auto=format&fit=crop&w=100&h=40" 
              alt="Foxx Life Sciences Logo" 
              className="h-10"
            />
            <h1 className="text-xl font-semibold text-slate-900">Product Content Management</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <Store className="w-4 h-4 text-primary" />
              <span>foxxbioprocess.myshopify.com</span>
            </div>
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      </nav>

      <div className="flex min-h-screen">
        <Sidebar />
        
        <main className="flex-1 p-8">
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
