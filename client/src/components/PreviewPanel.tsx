import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye, Upload, AlertTriangle } from "lucide-react";

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

  const handlePreview = () => {
    previewMutation.mutate();
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Preview & Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="flex space-x-4">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={previewMutation.isPending}
              data-testid="button-preview"
            >
              <Eye className="w-4 h-4 mr-2" />
              {previewMutation.isPending ? "Generating..." : "Preview HTML"}
            </Button>

          </div>
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

        {showPreview && (
          <div className="preview-html">
            <h4 className="text-sm font-medium text-slate-700 mb-3">Generated HTML Preview</h4>
            <pre className="preview-html">
              <code data-testid="text-html-preview">{previewHtml}</code>
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
