import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, Star, ClipboardList, Table, Video, FileDown, Shield, Hash, Package2 } from "lucide-react";

// Helper function to convert relative URLs to absolute URLs on the frontend
const convertToAbsoluteUrl = (url: string): string => {
  if (!url) return url;
  
  // If URL is already absolute, return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // If it's a relative URL starting with /
  if (url.startsWith('/')) {
    return `https://foxxbioprocess.com${url}`;
  }
  
  return url;
};

interface VisualPreviewProps {
  contentData: any;
  selectedTabs: string[];
  productSku?: string;
}

export default function VisualPreview({ contentData, selectedTabs, productSku }: VisualPreviewProps) {
  const getTabIcon = (tabType: string) => {
    const icons: { [key: string]: JSX.Element } = {
      description: <FileText className="w-4 h-4" />,
      features: <Star className="w-4 h-4" />,
      applications: <ClipboardList className="w-4 h-4" />,
      specifications: <Table className="w-4 h-4" />,
      videos: <Video className="w-4 h-4" />,
      documentation: <FileDown className="w-4 h-4" />,
      "safety-guidelines": <Shield className="w-4 h-4" />,
      "sku-nomenclature": <Hash className="w-4 h-4" />,
      "compatible-container": <Package2 className="w-4 h-4" />,
      "sterilization-method": <Star className="w-4 h-4" />
    };
    return icons[tabType] || <FileText className="w-4 h-4" />;
  };

  const getTabTitle = (tabType: string) => {
    const titles: { [key: string]: string } = {
      description: "Description",
      features: "Features",
      applications: "Applications",
      specifications: "Specifications",
      videos: "Videos",
      documentation: "Documentation",
      "safety-guidelines": "Safety Guidelines",
      "sku-nomenclature": "SKU Nomenclature",
      "compatible-container": "Compatible Container",
      "sterilization-method": "Sterilization Method"
    };
    return titles[tabType] || tabType;
  };

  const renderDescriptionPreview = (data: any) => {
    // Handle both form data structure and extracted content structure
    const title = data?.h2Heading || data?.title;
    const description = data?.description;
    const paragraphs = data?.paragraphs;
    const logos = data?.logos || data?.logoGrid;

    return (
      <div className="space-y-4">
        {title && (
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        )}
        {description && (
          <div className="space-y-3">
            {/* Split description by line breaks to create paragraphs */}
            {description.split('\n').filter((para: string) => para.trim()).map((paragraph: string, index: number) => (
              <p key={index} className="text-slate-600 leading-relaxed">{paragraph.trim()}</p>
            ))}
          </div>
        )}
        {paragraphs?.length > 0 && (
          <div className="space-y-3">
            {paragraphs.map((paragraph: string, index: number) => (
              <p key={index} className="text-slate-600 leading-relaxed">{paragraph}</p>
            ))}
          </div>
        )}
        {logos?.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-slate-700 mb-3">Partner Logos</h4>
            <div className="grid grid-cols-4 gap-4">
              {logos.map((logo: any, index: number) => (
                <div key={index} className="flex items-center justify-center p-2 border border-slate-200 rounded">
                  <img src={logo.url || logo.logoUrl} alt={logo.altText || logo.name} className="max-h-8 max-w-full object-contain" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFeaturesPreview = (data: any) => (
    <div className="space-y-4">
      {data?.title && (
        <h3 className="text-lg font-semibold text-slate-800">{data.title}</h3>
      )}
      {data?.features?.length > 0 && (
        <ul className="space-y-2">
          {data.features.map((feature: string, index: number) => (
            <li key={index} className="flex items-start gap-2">
              <Star className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <span className="text-slate-600">{feature}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderApplicationsPreview = (data: any) => (
    <div className="space-y-4">
      {data?.title && (
        <h3 className="text-lg font-semibold text-slate-800">{data.title}</h3>
      )}
      {data?.applications?.length > 0 && (
        <ul className="space-y-2">
          {data.applications.map((app: string, index: number) => (
            <li key={index} className="flex items-start gap-2">
              <ClipboardList className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-slate-600">{app}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderSpecificationsPreview = (data: any) => (
    <div className="space-y-4">
      {data?.title && (
        <h3 className="text-lg font-semibold text-slate-800">{data.title}</h3>
      )}
      {data?.specifications?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-slate-300">
            <tbody>
              {data.specifications.map((spec: any, index: number) => (
                <tr key={index} className="border-b border-slate-200">
                  <td className="px-4 py-2 bg-slate-50 font-medium text-slate-700 border-r border-slate-200">
                    {spec.parameter}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{spec.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const renderCompatibleContainerPreview = (data: any) => (
    <div className="space-y-4" data-sku={productSku}>
      {data?.title && (
        <h3 className="text-lg font-semibold text-slate-800">{data.title}</h3>
      )}
      {data?.compatibleItems?.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.compatibleItems.map((item: any, index: number) => (
            <div key={index} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              {item.image && (
                <div className="mb-3">
                  <img 
                    src={item.image} 
                    alt={item.title}
                    className="w-full h-32 object-cover rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <h4 className="font-medium text-slate-800 mb-2">{item.title}</h4>
              <p className="text-sm text-slate-500 mb-2">
                {item.type === 'collection' ? 'Collection' : 'Product'}: {item.handle}
              </p>
              {item.sourceUrl && (
                <a 
                  href={convertToAbsoluteUrl(item.sourceUrl)} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  View Product →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderVideosPreview = (data: any) => (
    <div className="space-y-4">
      {data?.title && (
        <h3 className="text-lg font-semibold text-slate-800">{data.title}</h3>
      )}
      {data?.videoUrl && (
        <div className="aspect-video">
          <iframe
            src={data.videoUrl}
            title="Product Video"
            className="w-full h-full rounded-lg"
            frameBorder="0"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );

  const renderDocumentationPreview = (data: any) => (
    <div className="space-y-4">
      {data?.title && (
        <h3 className="text-lg font-semibold text-slate-800">{data.title}</h3>
      )}
      {data?.datasheetTitle && data?.datasheetUrl && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
          <FileDown className="w-6 h-6 text-blue-600" />
          <div>
            <h4 className="font-medium text-slate-800">{data.datasheetTitle}</h4>
            <a 
              href={convertToAbsoluteUrl(data.datasheetUrl)} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              Download PDF →
            </a>
          </div>
        </div>
      )}
    </div>
  );

  const renderSafetyPreview = (data: any) => (
    <div className="space-y-4">
      {data?.title && (
        <h3 className="text-lg font-semibold text-slate-800">{data.title}</h3>
      )}
      {data?.guidelines?.length > 0 && (
        <div className="space-y-3">
          {data.guidelines.map((guideline: string, index: number) => (
            <div key={index} className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
              <Shield className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <span className="text-slate-700">{guideline}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSKUNomenclaturePreview = (data: any) => (
    <div className="space-y-4">
      {data?.title && (
        <h3 className="text-lg font-semibold text-slate-800">{data.title}</h3>
      )}
      {data?.nomenclature && (
        <div className="bg-slate-50 p-4 rounded-lg">
          <pre className="text-sm text-slate-700 whitespace-pre-wrap">{data.nomenclature}</pre>
        </div>
      )}
    </div>
  );

  const renderSterilizationMethodPreview = (data: any) => (
    <div className="space-y-4">
      {data?.title && (
        <h3 className="text-lg font-semibold text-slate-800">{data.title}</h3>
      )}
      {data?.methods?.length > 0 && (
        <ul className="space-y-2">
          {data.methods.map((method: string, index: number) => (
            <li key={index} className="flex items-start gap-2">
              <Star className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
              <span className="text-slate-600">{method}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderTabContent = (tabType: string, data: any) => {
    switch (tabType) {
      case 'description':
        return renderDescriptionPreview(data);
      case 'features':
        return renderFeaturesPreview(data);
      case 'applications':
        return renderApplicationsPreview(data);
      case 'specifications':
        return renderSpecificationsPreview(data);
      case 'compatible-container':
        return renderCompatibleContainerPreview(data);
      case 'videos':
        return renderVideosPreview(data);
      case 'documentation':
        return renderDocumentationPreview(data);
      case 'safety-guidelines':
        return renderSafetyPreview(data);
      case 'sku-nomenclature':
        return renderSKUNomenclaturePreview(data);
      case 'sterilization-method':
        return renderSterilizationMethodPreview(data);
      default:
        return <div className="text-slate-500 italic">No preview available for this content type.</div>;
    }
  };

  if (selectedTabs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-slate-500">
            <Package2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>Select content tabs to see preview</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package2 className="w-5 h-5" />
          Content Preview
          <Badge variant="outline" className="ml-auto">{selectedTabs.length} tab{selectedTabs.length !== 1 ? 's' : ''}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={selectedTabs[0]} className="w-full">
          <TabsList className="grid w-full grid-cols-auto gap-1 h-auto p-1" style={{ gridTemplateColumns: `repeat(${selectedTabs.length}, 1fr)` }}>
            {selectedTabs.map((tabType) => (
              <TabsTrigger 
                key={tabType} 
                value={tabType} 
                className="flex items-center gap-2 text-xs p-2"
              >
                {getTabIcon(tabType)}
                <span className="hidden sm:inline">{getTabTitle(tabType)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          
          {selectedTabs.map((tabType) => (
            <TabsContent key={tabType} value={tabType} className="mt-6">
              <div className="min-h-[200px]">
                {contentData[tabType] ? (
                  renderTabContent(tabType, contentData[tabType])
                ) : (
                  <div className="text-center text-slate-500 py-8">
                    <div className="text-slate-300 mb-2">{getTabIcon(tabType)}</div>
                    <p>No content added yet for {getTabTitle(tabType)}</p>
                    <p className="text-sm">Add content in the form above to see preview</p>
                  </div>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}