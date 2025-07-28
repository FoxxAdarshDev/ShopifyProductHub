import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Link, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface FileUploadProps {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  accept?: string;
  placeholder?: string;
}

export default function FileUpload({ 
  label, 
  value = "", 
  onChange, 
  accept = "image/*",
  placeholder = "Enter image URL or upload file"
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState(value);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = e.target?.result as string;
          
          // Try to upload to Shopify first
          try {
            const response = await apiRequest("POST", "/api/shopify/upload-file", {
              file: base64Data,
              filename: file.name,
              contentType: file.type
            });
            
            const result = await response.json();
            
            if (result.url && !result.url.startsWith('data:')) {
              onChange(result.url);
              toast({
                title: "Success",
                description: "File uploaded to Shopify successfully",
              });
              return;
            }
          } catch (uploadError) {
            console.warn("Shopify upload failed, using local preview:", uploadError);
          }
          
          // Fallback: use the base64 data URL for immediate preview
          onChange(base64Data);
          toast({
            title: "File Ready",
            description: "File loaded for preview. For production use, please use 'Enter URL' option with a public image URL.",
            variant: "default",
          });
          
        } catch (error) {
          console.error("Upload error:", error);
          toast({
            title: "Upload Failed",
            description: "Failed to process file. Please try using 'Enter URL' option instead.",
            variant: "destructive",
          });
        } finally {
          setIsUploading(false);
        }
      };
      
      reader.onerror = () => {
        toast({
          title: "Error",
          description: "Failed to read file",
          variant: "destructive",
        });
        setIsUploading(false);
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("File upload error:", error);
      toast({
        title: "Error",
        description: "Failed to process file",
        variant: "destructive",
      });
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleUrlSubmit = () => {
    if (urlValue.trim()) {
      onChange(urlValue.trim());
      setShowUrlInput(false);
      toast({
        title: "Success",
        description: "URL added successfully",
      });
    }
  };

  const clearValue = () => {
    onChange("");
    setUrlValue("");
    setShowUrlInput(false);
  };

  return (
    <div className="space-y-3">
      <Label className="block text-sm font-medium text-slate-700">{label}</Label>
      
      {value ? (
        <div className="flex items-center gap-2 p-3 border rounded-lg bg-green-50 border-green-200">
          <Check className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-800 flex-1 truncate">{value}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearValue}
            className="text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {showUrlInput ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder={placeholder}
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleUrlSubmit} size="sm" disabled={!urlValue.trim()}>
                  Add
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowUrlInput(false)} 
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
              <div className="text-xs text-slate-600 bg-blue-50 p-2 rounded">
                💡 <strong>Tip:</strong> Use public image URLs from your website, CDN, or upload to{" "}
                <a href="https://imgur.com" target="_blank" className="text-blue-600 underline">
                  Imgur
                </a>
                {" "}or{" "}
                <a href="https://cloudinary.com" target="_blank" className="text-blue-600 underline">
                  Cloudinary
                </a>
                {" "}for reliable hosting.
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex-1"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload from Device
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowUrlInput(true)}
                className="flex-1"
              >
                <Link className="w-4 h-4 mr-2" />
                Enter URL (Recommended)
              </Button>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />

      {value && (
        <div className="mt-2">
          <img 
            src={value} 
            alt="Uploaded preview" 
            className="max-w-32 max-h-32 object-cover rounded border"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          {value.startsWith('data:') && (
            <p className="text-xs text-orange-600 mt-1">
              ⚠️ Preview only - Use 'Enter URL' for production images
            </p>
          )}
        </div>
      )}
    </div>
  );
}