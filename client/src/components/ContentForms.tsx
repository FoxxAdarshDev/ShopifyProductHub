import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileText, Star, ClipboardList, Table, Video, FileDown, Shield, Plus, Trash2 } from "lucide-react";
import LogoManager from "./LogoManager";

interface ContentFormsProps {
  selectedTabs: string[];
  contentData: any;
  onContentChange: (data: any) => void;
}

export default function ContentForms({ selectedTabs, contentData, onContentChange }: ContentFormsProps) {
  const updateContent = (tabType: string, field: string, value: any) => {
    const updated = {
      ...contentData,
      [tabType]: {
        ...contentData[tabType],
        [field]: value,
      },
    };
    onContentChange(updated);
  };

  const addArrayItem = (tabType: string, field: string, defaultValue: any) => {
    const current = contentData[tabType]?.[field] || [];
    updateContent(tabType, field, [...current, defaultValue]);
  };

  const removeArrayItem = (tabType: string, field: string, index: number) => {
    const current = contentData[tabType]?.[field] || [];
    updateContent(tabType, field, current.filter((_: any, i: number) => i !== index));
  };

  const updateArrayItem = (tabType: string, field: string, index: number, value: any) => {
    const current = contentData[tabType]?.[field] || [];
    const updated = [...current];
    updated[index] = value;
    updateContent(tabType, field, updated);
  };

  const renderDescriptionForm = () => (
    <Card key="description" className="content-form">
      <CardHeader className="form-section-header">
        <CardTitle className="flex items-center">
          <FileText className="w-5 h-5 text-primary mr-3" />
          Description Content
        </CardTitle>
      </CardHeader>
      <CardContent className="form-section-content">
        <div className="space-y-4">
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-2">Product Title</Label>
            <Input
              placeholder="Enter product title..."
              value={contentData.description?.title || ""}
              onChange={(e) => updateContent("description", "title", e.target.value)}
              data-testid="input-description-title"
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-2">Product Description</Label>
            <Textarea
              rows={6}
              placeholder="Enter detailed product description..."
              value={contentData.description?.description || ""}
              onChange={(e) => updateContent("description", "description", e.target.value)}
              data-testid="textarea-description-content"
            />
          </div>
          
          <LogoManager
            logos={contentData.description?.logos || []}
            onLogosChange={(logos) => updateContent("description", "logos", logos)}
          />
        </div>
      </CardContent>
    </Card>
  );

  const renderFeaturesForm = () => (
    <Card key="features" className="content-form">
      <CardHeader className="form-section-header">
        <CardTitle className="flex items-center">
          <Star className="w-5 h-5 text-primary mr-3" />
          Features Content
        </CardTitle>
      </CardHeader>
      <CardContent className="form-section-content">
        <div className="space-y-3">
          {(contentData.features?.features || []).map((feature: string, index: number) => (
            <div key={index} className="flex items-start space-x-3">
              <span className="text-slate-400 mt-2">•</span>
              <Textarea
                rows={2}
                placeholder="Enter feature description..."
                value={feature}
                onChange={(e) => updateArrayItem("features", "features", index, e.target.value)}
                className="flex-1"
                data-testid={`textarea-feature-${index}`}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeArrayItem("features", "features", index)}
                className="text-red-500 hover:text-red-700 mt-2"
                data-testid={`button-remove-feature-${index}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          onClick={() => addArrayItem("features", "features", "")}
          className="mt-4 text-primary hover:text-primary/80"
          data-testid="button-add-feature"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Another Feature
        </Button>
      </CardContent>
    </Card>
  );

  const renderApplicationsForm = () => (
    <Card key="applications" className="content-form">
      <CardHeader className="form-section-header">
        <CardTitle className="flex items-center">
          <ClipboardList className="w-5 h-5 text-primary mr-3" />
          Applications Content
        </CardTitle>
      </CardHeader>
      <CardContent className="form-section-content">
        <div className="space-y-3">
          {(contentData.applications?.applications || []).map((application: string, index: number) => (
            <div key={index} className="flex items-start space-x-3">
              <span className="text-slate-400 mt-2">•</span>
              <Input
                placeholder="Enter application..."
                value={application}
                onChange={(e) => updateArrayItem("applications", "applications", index, e.target.value)}
                className="flex-1"
                data-testid={`input-application-${index}`}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeArrayItem("applications", "applications", index)}
                className="text-red-500 hover:text-red-700 mt-2"
                data-testid={`button-remove-application-${index}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          onClick={() => addArrayItem("applications", "applications", "")}
          className="mt-4 text-primary hover:text-primary/80"
          data-testid="button-add-application"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Another Application
        </Button>
      </CardContent>
    </Card>
  );

  const renderSpecificationsForm = () => (
    <Card key="specifications" className="content-form">
      <CardHeader className="form-section-header">
        <CardTitle className="flex items-center">
          <Table className="w-5 h-5 text-primary mr-3" />
          Specifications Content
        </CardTitle>
      </CardHeader>
      <CardContent className="form-section-content">
        <div className="overflow-x-auto">
          <table className="spec-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Value</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(contentData.specifications?.specifications || []).map((spec: { item: string; value: string }, index: number) => (
                <tr key={index}>
                  <td>
                    <Input
                      value={spec.item}
                      onChange={(e) => updateArrayItem("specifications", "specifications", index, { ...spec, item: e.target.value })}
                      className="w-full text-sm"
                      data-testid={`input-spec-item-${index}`}
                    />
                  </td>
                  <td>
                    <Input
                      value={spec.value}
                      onChange={(e) => updateArrayItem("specifications", "specifications", index, { ...spec, value: e.target.value })}
                      className="w-full text-sm"
                      data-testid={`input-spec-value-${index}`}
                    />
                  </td>
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeArrayItem("specifications", "specifications", index)}
                      className="text-red-500 hover:text-red-700"
                      data-testid={`button-remove-spec-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          variant="ghost"
          onClick={() => addArrayItem("specifications", "specifications", { item: "", value: "" })}
          className="mt-4 text-primary hover:text-primary/80"
          data-testid="button-add-specification"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Specification Row
        </Button>
      </CardContent>
    </Card>
  );

  const renderVideosForm = () => (
    <Card key="videos" className="content-form">
      <CardHeader className="form-section-header">
        <CardTitle className="flex items-center">
          <Video className="w-5 h-5 text-primary mr-3" />
          Videos Content
        </CardTitle>
      </CardHeader>
      <CardContent className="form-section-content">
        <div className="space-y-4">
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-2">Video URL (YouTube Embed)</Label>
            <Input
              placeholder="https://www.youtube.com/embed/..."
              value={contentData.videos?.videoUrl || ""}
              onChange={(e) => updateContent("videos", "videoUrl", e.target.value)}
              data-testid="input-video-url"
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-2">YouTube Channel Text</Label>
            <Input
              placeholder="Check out all of our videos on our YouTube Channel!"
              value={contentData.videos?.youtubeChannelText || ""}
              onChange={(e) => updateContent("videos", "youtubeChannelText", e.target.value)}
              data-testid="input-youtube-text"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderDocumentationForm = () => (
    <Card key="documentation" className="content-form">
      <CardHeader className="form-section-header">
        <CardTitle className="flex items-center">
          <FileDown className="w-5 h-5 text-primary mr-3" />
          Documentation Content
        </CardTitle>
      </CardHeader>
      <CardContent className="form-section-content">
        <div className="space-y-4">
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-2">Datasheet Title</Label>
            <Input
              placeholder="Product Datasheet"
              value={contentData.documentation?.datasheetTitle || ""}
              onChange={(e) => updateContent("documentation", "datasheetTitle", e.target.value)}
              data-testid="input-datasheet-title"
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-2">Datasheet URL</Label>
            <Input
              placeholder="https://cdn.shopify.com/..."
              value={contentData.documentation?.datasheetUrl || ""}
              onChange={(e) => updateContent("documentation", "datasheetUrl", e.target.value)}
              data-testid="input-datasheet-url"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderSafetyForm = () => (
    <Card key="safety-usage-guidelines" className="content-form">
      <CardHeader className="form-section-header">
        <CardTitle className="flex items-center">
          <Shield className="w-5 h-5 text-primary mr-3" />
          Safety & Usage Guidelines
        </CardTitle>
      </CardHeader>
      <CardContent className="form-section-content">
        <div className="space-y-3">
          {(contentData['safety-usage-guidelines']?.guidelines || []).map((guideline: string, index: number) => (
            <div key={index} className="flex items-start space-x-3">
              <span className="text-slate-400 mt-2">•</span>
              <Input
                placeholder="Enter safety guideline..."
                value={guideline}
                onChange={(e) => updateArrayItem("safety-usage-guidelines", "guidelines", index, e.target.value)}
                className="flex-1"
                data-testid={`input-guideline-${index}`}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeArrayItem("safety-usage-guidelines", "guidelines", index)}
                className="text-red-500 hover:text-red-700 mt-2"
                data-testid={`button-remove-guideline-${index}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="ghost"
          onClick={() => addArrayItem("safety-usage-guidelines", "guidelines", "")}
          className="mt-4 text-primary hover:text-primary/80"
          data-testid="button-add-guideline"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Another Guideline
        </Button>
      </CardContent>
    </Card>
  );

  const formRenderers: { [key: string]: () => JSX.Element } = {
    description: renderDescriptionForm,
    features: renderFeaturesForm,
    applications: renderApplicationsForm,
    specifications: renderSpecificationsForm,
    videos: renderVideosForm,
    documentation: renderDocumentationForm,
    "safety-usage-guidelines": renderSafetyForm,
  };

  return (
    <div className="space-y-8">
      {selectedTabs.map((tabType) => {
        const renderer = formRenderers[tabType];
        return renderer ? renderer() : null;
      })}
    </div>
  );
}
