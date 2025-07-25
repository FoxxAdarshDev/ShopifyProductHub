import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Save, Upload } from "lucide-react";

interface PreviewPanelProps {
  contentData: any;
  selectedTabs: string[];
  onSaveContent: () => void;
  onUpdateShopify: () => void;
  isLoading: boolean;
}

export default function PreviewPanel({ 
    contentData, 
    selectedTabs, 
    onSaveContent, 
    onUpdateShopify, 
    isLoading 
}: PreviewPanelProps) {
  const [previewHtml, setPreviewHtml] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const contentArray = selectedTabs.map(tabType => ({
        tabType,
        content: contentData[tabType] || {},
        isActive: true
      }));

      const response = await apiRequest("POST", "/api/preview", { content: contentArray });
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
            <Button
              variant="outline"
              onClick={onSaveContent}
              disabled={isLoading}
              data-testid="button-save-template"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Content
            </Button>
          </div>
          <div className="flex space-x-4">
            <Button
              onClick={onUpdateShopify}
              disabled={isLoading}
              data-testid="button-update-shopify"
            >
              <Upload className="w-4 h-4 mr-2" />
              {isLoading ? "Updating..." : "Update Product"}
            </Button>
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
