import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "wouter";
import ProductLookup from "@/components/ProductLookup";
import TabSelector from "@/components/TabSelector";
import ContentForms from "@/components/ContentForms";
import PreviewPanel from "@/components/PreviewPanel";
import { Store, User, FileText, Eye, Code, ExternalLink, Package, Link as LinkIcon, Download, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Define the fixed tab ordering groups
const TAB_ORDER_GROUPS = {
  GROUP_1: ['description', 'features', 'applications'],
  GROUP_2: ['specifications', 'documentation', 'videos'],
  ADDITIONAL: ['sku-nomenclature', 'safety-guidelines', 'compatible-container', 'sterilization-method']
};

// Function to order tabs according to the fixed groups
const orderTabs = (tabs: string[]): string[] => {
  const orderedTabs: string[] = [];
  
  // Add Group 1 tabs in order (if selected)
  TAB_ORDER_GROUPS.GROUP_1.forEach(tab => {
    if (tabs.includes(tab)) {
      orderedTabs.push(tab);
    }
  });
  
  // Add Additional tabs in between groups (if selected)
  TAB_ORDER_GROUPS.ADDITIONAL.forEach(tab => {
    if (tabs.includes(tab)) {
      orderedTabs.push(tab);
    }
  });
  
  // Add Group 2 tabs in order (if selected)
  TAB_ORDER_GROUPS.GROUP_2.forEach(tab => {
    if (tabs.includes(tab)) {
      orderedTabs.push(tab);
    }
  });
  
  return orderedTabs;
};

// Helper function to convert relative URLs to absolute URLs in HTML content
const convertRelativeUrlsInHtml = (html: string): string => {
  if (!html) return html;
  
  // Convert href attributes with relative URLs
  const hrefRegex = /href=["']([^"']+)["']/g;
  const srcRegex = /src=["']([^"']+)["']/g;
  
  let convertedHtml = html.replace(hrefRegex, (match, url) => {
    if (url.startsWith('/') && !url.startsWith('http')) {
      return match.replace(url, `https://foxxbioprocess.com${url}`);
    }
    return match;
  });
  
  convertedHtml = convertedHtml.replace(srcRegex, (match, url) => {
    if (url.startsWith('/') && !url.startsWith('http')) {
      return match.replace(url, `https://foxxbioprocess.com${url}`);
    }
    return match;
  });
  
  return convertedHtml;
};

export default function ProductManager() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  const [contentData, setContentData] = useState<any>({});
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [hasDraftContent, setHasDraftContent] = useState(false);
  const [showExtractButton, setShowExtractButton] = useState(false);
  const [hasShopifyTemplate, setHasShopifyTemplate] = useState(false);
  const [contentStatus, setContentStatus] = useState<any>(null);
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

  // Check content status for a product
  const checkContentStatus = async (productId: string) => {
    try {
      const response = await apiRequest("POST", "/api/products/content-status", { productIds: [parseInt(productId)] });
      const statusData = await response.json();
      setContentStatus(statusData[productId] || null);
    } catch (error) {
      console.error("Error checking content status:", error);
      setContentStatus(null);
    }
  };

  // Load draft content for a product
  const loadDraftContent = async (product: any) => {
    let finalContentMap: any = {};
    let finalSelectedTabs: string[] = [];
    
    try {
      const response = await apiRequest("GET", `/api/draft-content/${product.id}`);
      const draftData = await response.json();
      
      if (draftData.draftContent && draftData.draftContent.length > 0) {
        // Use draft content if it exists
        console.log('Loading draft content from database');
        draftData.draftContent.forEach((draft: any) => {
          finalContentMap[draft.tabType] = draft.content;
          if (!finalSelectedTabs.includes(draft.tabType)) {
            finalSelectedTabs.push(draft.tabType);
          }
        });
      }
    } catch (error) {
      console.log('No draft content found, checking for existing content');
    }
    
    // If no draft content, try to extract content from Shopify description
    if (Object.keys(finalContentMap).length === 0) {
      try {
        const response = await apiRequest("GET", `/api/extract-content/${product.id}`);
        const extractionData = await response.json();
        
        if (extractionData.extractedContent && Object.keys(extractionData.extractedContent).length > 0) {
          console.log('Loading extracted content from Shopify description');
          finalContentMap = extractionData.extractedContent;
          finalSelectedTabs = Object.keys(extractionData.extractedContent);
          
          // Show success message for auto-extraction
          console.log('🎯 Auto-detected and loaded template structure');
          toast({
            title: "Content Auto-Loaded",
            description: `Detected existing layout with ${finalSelectedTabs.length} sections: ${finalSelectedTabs.join(', ')}`,
          });
        }
      } catch (error) {
        console.log('No content could be extracted from Shopify description');
      }
    }
    
    // Try to load from database content if nothing else exists
    if (Object.keys(finalContentMap).length === 0) {
      try {
        const response = await apiRequest("GET", `/api/products/lookup/${product.sku}`);
        const data = await response.json();
        
        if (data.content && data.content.length > 0) {
          console.log('Using database content as fallback');
          const existingTabs = data.content.map((c: any) => c.tabType);
          finalSelectedTabs = existingTabs;
          
          data.content.forEach((c: any) => {
            finalContentMap[c.tabType] = c.content;
          });
        }
      } catch (error) {
        console.log('No existing content found in database');
      }
    }
    
    // Apply fixed ordering to tabs before setting them
    const orderedTabs = orderTabs(finalSelectedTabs);
    setSelectedTabs(orderedTabs);
    setContentData(finalContentMap);
    
    // Check if content has our template structure in Shopify
    let hasShopifyTemplate = false;
    if (product.description) {
      const html = product.description;
      const hasContainerClass = html.includes('class="container"');
      const hasTabStructure = html.includes('id="description"') || html.includes('id="features"') || html.includes('id="applications"');
      const hasDataSkuAttributes = html.includes('data-sku=');
      
      hasShopifyTemplate = hasContainerClass && hasTabStructure && hasDataSkuAttributes;
    }
    setHasShopifyTemplate(hasShopifyTemplate);
    
    // Check if we have draft content or content data
    // Hide draft mode if content is already saved to Shopify
    const showDraftMode = Object.keys(finalContentMap).length > 0 && !hasShopifyTemplate;
    setHasDraftContent(showDraftMode);
    
    // Show extract button only if no content was found and there's a description to extract from
    if (Object.keys(finalContentMap).length === 0 && product.description && product.description.trim() !== '') {
      setShowExtractButton(true);
    } else {
      setShowExtractButton(false);
    }
  };

  // Load product from URL or session storage
  useEffect(() => {
    if (productFromUrl) {
      const product = {
        id: productFromUrl.id,
        shopifyId: productFromUrl.id.toString(),
        sku: productFromUrl.variants[0]?.sku || '',
        title: productFromUrl.title,
        description: productFromUrl.body_html || ''
      };
      setSelectedProduct(product);
      // Load draft content for this product
      loadDraftContent(product);
      // Check content status for badges
      checkContentStatus(product.id.toString());
      return;
    }

    // Check if a product was selected from AllProducts page
    const savedProduct = sessionStorage.getItem('selectedProduct');
    if (savedProduct) {
      try {
        const { product, selectedVariant } = JSON.parse(savedProduct);
        const productData = {
          id: product.id,
          shopifyId: product.id.toString(),
          sku: selectedVariant?.sku || product.variants[0]?.sku || '',
          title: product.title,
          description: product.body_html || ''
        };
        setSelectedProduct(productData);
        // Load draft content for this product
        loadDraftContent(productData);
        // Check content status for badges
        checkContentStatus(productData.id.toString());
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

  // HTML Content Extraction Mutation
  const extractContentMutation = useMutation({
    mutationFn: async ({ html, shopifyProductId }: { html: string; shopifyProductId: string }) => {
      const response = await apiRequest("POST", "/api/extract-content", { html, shopifyProductId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.extractedContent && Object.keys(data.extractedContent).length > 0) {
        // Transform extracted data to match frontend expectations
        const transformedContent = { ...data.extractedContent };
        
        // Transform Compatible Container data structure
        if (transformedContent['compatible-container']?.compatibleItems) {
          console.log('🔄 Original compatible items:', transformedContent['compatible-container'].compatibleItems.length);
          transformedContent['compatible-container'].compatibleItems = transformedContent['compatible-container'].compatibleItems.map((item: any, index: number) => {
            // Extract handle from URL (get the last part after /products/ or /collections/)
            const urlParts = item.url.split('/');
            const handle = urlParts[urlParts.length - 1];
            
            // Determine type based on URL
            const type = item.url.includes('/products/') ? 'product' : 'collection';
            
            const transformedItem = {
              handle: handle,
              title: item.title,
              image: item.image,
              sourceUrl: item.url,
              type: type
            };
            
            console.log(`🔄 Transformed item ${index + 1}:`, { 
              title: transformedItem.title, 
              handle: transformedItem.handle, 
              type: transformedItem.type 
            });
            
            return transformedItem;
          });
          console.log('✅ Final transformed items count:', transformedContent['compatible-container'].compatibleItems.length);
        }
        
        // Debug logging for extracted content
        console.log('🔍 Final extracted content:', transformedContent);
        if (transformedContent.description) {
          console.log('📄 Description title extracted:', transformedContent.description.title);
        }
        if (transformedContent.documentation) {
          console.log('📚 Documentation extracted:', transformedContent.documentation);
        }
        
        // Update content data with transformed content
        setContentData(transformedContent);
        // Select tabs that were extracted
        const extractedTabs = Object.keys(transformedContent);
        setSelectedTabs(orderTabs(extractedTabs));
        setHasDraftContent(true);
        setShowExtractButton(false);
        
        toast({
          title: "Content Extracted Successfully",
          description: `Found and loaded ${extractedTabs.length} content sections: ${extractedTabs.join(', ')}`,
        });
      } else {
        toast({
          title: "No Content Found",
          description: "The existing HTML doesn't match our template structure.",
          variant: "destructive",
        });
      }
    },
    onError: () => {
      toast({
        title: "Extraction Failed",
        description: "Failed to extract content from the existing HTML",
        variant: "destructive",
      });
    },
  });

  const handleProductFound = async (product: any, content: any[]) => {
    setSelectedProduct(product);
    await loadDraftContent(product);
    checkContentStatus(product.id.toString());
    
    // Check if we should show the extract button
    if (product.description && product.description.trim() !== '' && 
        !Object.keys(contentData).length && !hasDraftContent) {
      setShowExtractButton(true);
    }
  };

  const handleExtractContent = () => {
    if (selectedProduct && selectedProduct.description) {
      extractContentMutation.mutate({
        html: selectedProduct.description,
        shopifyProductId: selectedProduct.id.toString()
      });
    }
  };



  const handleUpdateShopify = async () => {
    if (!selectedProduct) return;
    
    // Update Shopify first
    updateShopifyMutation.mutate(selectedProduct.id, {
      onSuccess: async () => {
        // After successful Shopify update, delete draft content and clear draft status
        try {
          await apiRequest("DELETE", `/api/draft-content/${selectedProduct.id}`);
          setHasDraftContent(false);
          // Refresh content status to update badges
          checkContentStatus(selectedProduct.id.toString());
          console.log('Draft content cleaned up after successful Shopify update');
        } catch (error) {
          console.error('Failed to clean up draft content:', error);
        }
      }
    });
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
              {/* Product Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Product Information
                    <div className="flex items-center gap-2 ml-auto">
                      {contentStatus?.hasShopifyContent && (
                        <Badge variant="default" className="text-xs bg-blue-100 text-blue-800 border-blue-200">
                          <Package className="w-3 h-3 mr-1" />
                          Shopify Content
                        </Badge>
                      )}
                      {contentStatus?.hasNewLayout && (
                        <Badge variant="default" className="text-xs bg-green-100 text-green-800 border-green-200">
                          <Package className="w-3 h-3 mr-1" />
                          New Layout: {contentStatus?.contentCount || 0}
                        </Badge>
                      )}
                      {hasDraftContent && selectedTabs.length > 0 && !hasShopifyTemplate && (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                          Draft Mode
                        </Badge>
                      )}
                      <Badge variant="outline">
                        Product ID: {selectedProduct.id}
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Product Details */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold text-lg mb-2">{selectedProduct.title}</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-600">Product ID:</span>
                            <span className="font-mono bg-slate-100 px-2 py-1 rounded">{selectedProduct.id}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-600">Live URL:</span>
                            <a
                              href={`https://foxxbioprocess.myshopify.com/products/${productFromUrl?.handle || selectedProduct.handle || ''}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 underline"
                              data-testid="link-shopify-product"
                            >
                              View on Shopify
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Variants/SKUs */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-slate-700 mb-3">
                          Product Variants ({productFromUrl?.variants?.length || 0} SKUs)
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {productFromUrl?.variants?.map((variant: any, index: number) => (
                            <div
                              key={variant.id}
                              className="flex items-center justify-between p-3 bg-slate-50 rounded border"
                            >
                              <div className="flex-1">
                                <div className="font-mono text-sm font-medium text-slate-900">
                                  {variant.sku}
                                </div>
                                {variant.title !== "Default Title" && (
                                  <div className="text-xs text-slate-500 mt-1">{variant.title}</div>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-slate-600 font-medium">${variant.price}</span>
                                <a
                                  href={`https://foxxbioprocess.myshopify.com/products/${productFromUrl?.handle || ''}?variant=${variant.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
                                  data-testid={`link-variant-${variant.id}`}
                                  title="View this variant on Shopify"
                                >
                                  <LinkIcon className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          )) || (
                            <div className="text-slate-500 text-sm italic">No variants available</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

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
                    {showExtractButton && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleExtractContent}
                        disabled={extractContentMutation.isPending}
                        className="ml-auto bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                        data-testid="button-extract-content"
                      >
                        <Sparkles className="w-4 h-4 mr-1" />
                        {extractContentMutation.isPending ? "Extracting..." : "Extract Content to Tabs"}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {showExtractButton && (
                    <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="font-medium text-green-800 mb-1">Content Extraction Available</h4>
                          <p className="text-sm text-green-700 mb-3">
                            I found existing HTML content that matches our template structure. 
                            I can automatically extract this content into editable tabs to save you time.
                          </p>
                          <Button
                            onClick={handleExtractContent}
                            disabled={extractContentMutation.isPending}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Download className="w-4 h-4 mr-1" />
                            {extractContentMutation.isPending ? "Extracting..." : "Extract Content Now"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                  
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
                          dangerouslySetInnerHTML={{ __html: convertRelativeUrlsInHtml(selectedProduct.description) || '<p class="text-slate-500 italic">No description available</p>' }}
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
                productId={selectedProduct?.id}
                onDraftStatusChange={setHasDraftContent}
              />
              
              <PreviewPanel
                contentData={contentData}
                selectedTabs={selectedTabs}
                onUpdateShopify={handleUpdateShopify}
                isLoading={updateContentMutation.isPending || updateShopifyMutation.isPending}
                productSku={selectedProduct.sku}
                shopifyProductId={selectedProduct.id?.toString()}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
