import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, Upload, AlertTriangle, Code, Layers } from "lucide-react";
import VisualPreview from "./VisualPreview";

interface PreviewPanelProps {
  contentData: any;
  selectedTabs: string[];
  onUpdateShopify: () => void;
  isLoading: boolean;
  productSku?: string;
}

export default function PreviewPanel({ 
    contentData, 
    selectedTabs, 
    onUpdateShopify, 
    isLoading,
    productSku 
}: PreviewPanelProps) {
  const [previewHtml, setPreviewHtml] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(false);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const contentArray = selectedTabs.map(tabType => ({
        tabType,
        content: contentData[tabType] || {},
        isActive: true
      }));

      const response = await apiRequest("POST", "/api/preview", { 
        content: contentArray, 
        productSku: productSku || 'unknown-sku' 
      });
      return response.json();
    },
    onSuccess: (data) => {
      setPreviewHtml(data.html);
      setShowPreview(true);
    },
  });

  // Auto-generate HTML when content changes if enabled
  useEffect(() => {
    if (autoGenerate && selectedTabs.length > 0) {
      const hasContent = selectedTabs.some(tabType => {
        const data = contentData[tabType];
        return data && Object.values(data).some(value => 
          value && (typeof value === 'string' ? value.trim() : Array.isArray(value) ? value.length > 0 : true)
        );
      });
      
      if (hasContent) {
        // Debounce auto-generation
        const timeoutId = setTimeout(() => {
          previewMutation.mutate();
        }, 2000); // 2-second delay after content changes
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [contentData, selectedTabs, autoGenerate]);

  const handlePreview = () => {
    previewMutation.mutate();
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Preview & Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="visual" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="visual" className="flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Visual Preview
              </TabsTrigger>
              <TabsTrigger value="html" className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                HTML Code
              </TabsTrigger>
            </TabsList>
            <div className="flex space-x-4">
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <DialogTrigger asChild>
                <Button
                  disabled={isLoading}
                  data-testid="button-update-shopify"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isLoading ? "Updating..." : "Update Product"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    Confirm Product Update
                  </DialogTitle>
                  <DialogDescription>
                    This will update the Shopify product description with your current content. 
                    This action cannot be undone. Are you sure you want to proceed?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowConfirmDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setShowConfirmDialog(false);
                      onUpdateShopify();
                    }}
                    disabled={isLoading}
                  >
                    Update Product
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </div>
          
          <TabsContent value="visual" className="mt-6">
            <VisualPreview 
              contentData={contentData}
              selectedTabs={selectedTabs}
              productSku={productSku}
            />
          </TabsContent>
          
          <TabsContent value="html" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={handlePreview}
                  disabled={previewMutation.isPending}
                  data-testid="button-preview"
                  className="flex-1"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {previewMutation.isPending ? "Generating..." : "Generate HTML Code"}
                </Button>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="auto-generate"
                    checked={autoGenerate}
                    onChange={(e) => setAutoGenerate(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="auto-generate" className="text-sm text-slate-600">
                    Auto-generate HTML
                  </label>
                </div>
              </div>
              
              {showPreview && (
                <div className="preview-html">
                  <h4 className="text-sm font-medium text-slate-700 mb-3">Generated HTML Code</h4>
                  <pre className="preview-html">
                    <code data-testid="text-html-preview">{previewHtml}</code>
                  </pre>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
