import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "wouter";
import ProductLookup from "@/components/ProductLookup";
import TabSelector from "@/components/TabSelector";
import ContentForms from "@/components/ContentForms";
import PreviewPanel from "@/components/PreviewPanel";
import { Store, User, FileText, Eye, Code } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ProductManager() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  const [contentData, setContentData] = useState<any>({});
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const { toast } = useToast();
  const params = useParams();
  const productId = params.productId;

  // Load product if productId is in URL
  const { data: productFromUrl } = useQuery({
    queryKey: ["/api/products/shopify", productId],
    queryFn: async () => {
      if (!productId) return null;
      const response = await apiRequest("GET", `/api/products/shopify/${productId}`);
      return response.json();
    },
    enabled: !!productId
  });

  // Load product from URL or session storage
  useEffect(() => {
    if (productFromUrl) {
      setSelectedProduct({
        id: productFromUrl.id,
        shopifyId: productFromUrl.id.toString(),
        sku: productFromUrl.variants[0]?.sku || '',
        title: productFromUrl.title,
        description: productFromUrl.body_html || ''
      });
      return;
    }

    // Check if a product was selected from AllProducts page
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
  }, [productFromUrl]);

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
              {/* Current Product Description */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Current Product Description
                    <Badge variant="outline" className="ml-auto">
                      Shopify Content
                    </Badge>
                  </CardTitle>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant={!showHtmlPreview ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowHtmlPreview(false)}
                      data-testid="button-preview-toggle"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Preview
                    </Button>
                    <Button
                      variant={showHtmlPreview ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowHtmlPreview(true)}
                      data-testid="button-html-toggle"
                    >
                      <Code className="w-4 h-4 mr-1" />
                      HTML
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <h3 className="font-semibold text-lg mb-2">{selectedProduct.title}</h3>
                    {showHtmlPreview ? (
                      <div className="border rounded-lg p-4 bg-slate-50">
                        <pre className="whitespace-pre-wrap text-sm font-mono overflow-x-auto">
                          {selectedProduct.description || '<p class="text-slate-500 italic">No description available</p>'}
                        </pre>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-6 bg-white shadow-sm">
                        <div 
                          className="shopify-content"
                          dangerouslySetInnerHTML={{ __html: selectedProduct.description || '<p class="text-slate-500 italic">No description available</p>' }}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

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
