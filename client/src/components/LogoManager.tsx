import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import FileUpload from "./FileUpload";

interface Logo {
  url: string;
  altText: string;
}

interface LogoManagerProps {
  logos: Logo[];
  onLogosChange: (logos: Logo[]) => void;
}

export default function LogoManager({ logos, onLogosChange }: LogoManagerProps) {
  const addLogo = () => {
    onLogosChange([...logos, { url: "", altText: "" }]);
  };

  const removeLogo = (index: number) => {
    onLogosChange(logos.filter((_, i) => i !== index));
  };

  const updateLogo = (index: number, field: keyof Logo, value: string) => {
    const updated = [...logos];
    updated[index] = { ...updated[index], [field]: value };
    onLogosChange(updated);
  };

  return (
    <div className="border-t border-slate-200 pt-4">
      <h4 className="text-base font-medium text-slate-900 mb-3">Logo Grid</h4>
      <div className="space-y-3">
        {logos.map((logo, index) => (
          <div key={index} className="space-y-3 p-3 border rounded">
            <div className="flex items-center space-x-3">
              <Input
                type="text"
                placeholder="Alt text"
                value={logo.altText}
                onChange={(e) => updateLogo(index, "altText", e.target.value)}
                className="flex-1"
                data-testid={`input-logo-alt-${index}`}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeLogo(index)}
                className="text-red-500 hover:text-red-700"
                data-testid={`button-remove-logo-${index}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Logo Image Upload */}
            <FileUpload
              label="Logo Image"
              value={logo.url}
              onChange={(url) => updateLogo(index, "url", url)}
              placeholder="Enter logo URL or upload image file"
            />
          </div>
        ))}
      </div>
      <Button
        variant="ghost"
        onClick={addLogo}
        className="mt-3 text-primary hover:text-primary/80 text-sm font-medium"
        data-testid="button-add-logo"
      >
        <Plus className="w-4 h-4 mr-1" />
        Add Another Logo
      </Button>

      {/* Logo Preview */}
      {logos.length > 0 && logos.some(logo => logo.url) && (
        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
          <h5 className="text-sm font-medium text-slate-700 mb-2">Preview</h5>
          <div className="logo-grid">
            {logos.map((logo, index) => 
              logo.url ? (
                <img
                  key={index}
                  src={logo.url}
                  alt={logo.altText}
                  className="h-10 w-auto border border-gray-200 rounded-md p-2 object-contain"
                  data-testid={`img-logo-preview-${index}`}
                />
              ) : null
            )}
          </div>
        </div>
      )}
    </div>
  );
}
