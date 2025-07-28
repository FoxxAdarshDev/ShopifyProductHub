import React, { useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";  
import { Label } from "@/components/ui/label";
import { FileText, Star, ClipboardList, Table, Video, FileDown, Shield, Plus, Trash2, Hash, Package2, Upload, ClipboardPaste } from "lucide-react";
import LogoManager from "./LogoManager";
import FileUpload from "./FileUpload";
import { apiRequest } from "@/lib/queryClient";

interface ContentFormsProps {
  selectedTabs: string[];
  contentData: any;
  onContentChange: (data: any) => void;
  productId?: string;
  onDraftStatusChange?: (hasDraft: boolean) => void;
}

export default function ContentForms({ selectedTabs, contentData, onContentChange, productId, onDraftStatusChange }: ContentFormsProps) {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save functionality with 1-second delay
  const saveDraftContent = async (tabType: string, content: any, updatedContentData: any) => {
    if (!productId) return;
    
    try {
      await apiRequest("POST", "/api/draft-content", {
        shopifyProductId: productId,
        tabType: tabType,
        content: content
      });
      
      // Update draft status if callback is provided
      if (onDraftStatusChange) {
        // Check if any selected tabs have meaningful content using the updated content data
        const hasContent = selectedTabs.some(tabType => {
          const data = updatedContentData[tabType];
          if (!data) return false;
          
          // Check different types of content
          return Object.values(data).some(value => {
            if (typeof value === 'string') {
              return value.trim().length > 0;
            } else if (Array.isArray(value)) {
              return value.length > 0 && value.some(item => 
                typeof item === 'string' ? item.trim().length > 0 : 
                typeof item === 'object' && item !== null
              );
            } else if (typeof value === 'object' && value !== null) {
              return Object.values(value).some(subValue => 
                typeof subValue === 'string' ? subValue.trim().length > 0 : 
                Array.isArray(subValue) ? subValue.length > 0 : Boolean(subValue)
              );
            }
            return Boolean(value);
          });
        });
        onDraftStatusChange(hasContent);
      }
    } catch (error) {
      console.error('Failed to save draft content:', error);
    }
  };

  const updateContent = (tabType: string, field: string, value: any) => {
    const updated = {
      ...contentData,
      [tabType]: {
        ...contentData[tabType],
        [field]: value,
      },
    };
    onContentChange(updated);
    
    // Auto-save with 1-second delay
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveDraftContent(tabType, updated[tabType], updated);
    }, 1000);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Initialize Compatible Container state if it doesn't exist
  useEffect(() => {
    if (selectedTabs.includes('compatible-container')) {
      if (!contentData['compatible-container'] || !contentData['compatible-container'].compatibleItems) {
        const updated = {
          ...contentData,
          'compatible-container': {
            ...contentData['compatible-container'],
            title: contentData['compatible-container']?.title || "Compatible Container",
            compatibleItems: contentData['compatible-container']?.compatibleItems || []
          }
        };
        onContentChange(updated);
        console.log('Initialized Compatible Container state');
      }
    }
  }, [selectedTabs, contentData]);

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

  // Parse table data from various formats (Excel, Google Sheets, HTML)
  const parseTableData = (pastedData: string) => {
    if (!pastedData.trim()) return [];

    // Check if it's HTML table format
    if (pastedData.includes('<table') || pastedData.includes('<tr') || pastedData.includes('<td')) {
      return parseHTMLTable(pastedData);
    }

    // Check if it's tab-separated or CSV format (Excel/Google Sheets)
    return parseDelimitedData(pastedData);
  };

  const parseHTMLTable = (htmlData: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlData, 'text/html');
    const rows = doc.querySelectorAll('tr');
    const specifications: { item: string; value: string }[] = [];

    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('td, th');
      if (cells.length >= 2) {
        // Skip header row if it contains "Item" and "Value" or similar
        const firstCell = cells[0].textContent?.trim().toLowerCase() || '';
        const secondCell = cells[1].textContent?.trim().toLowerCase() || '';
        
        if (index === 0 && (firstCell.includes('item') || firstCell.includes('property') || 
                           firstCell.includes('specification') || firstCell.includes('parameter')) &&
                           (secondCell.includes('value') || secondCell.includes('description'))) {
          return; // Skip header row
        }

        const item = cells[0].textContent?.trim() || '';
        const value = cells[1].textContent?.trim() || '';
        
        if (item && value) {
          specifications.push({ item, value });
        }
      }
    });

    return specifications;
  };

  const parseDelimitedData = (data: string) => {
    const lines = data.trim().split('\n');
    const specifications: { item: string; value: string }[] = [];

    lines.forEach((line, index) => {
      // Try tab-separated first (Excel default), then comma-separated
      let cells = line.split('\t');
      if (cells.length < 2) {
        cells = line.split(',');
      }
      // Also try pipe-separated
      if (cells.length < 2) {
        cells = line.split('|');
      }

      if (cells.length >= 2) {
        const item = cells[0].trim().replace(/^["']|["']$/g, ''); // Remove quotes
        const value = cells[1].trim().replace(/^["']|["']$/g, '');

        // Skip header row if it looks like headers
        if (index === 0 && (item.toLowerCase().includes('item') || item.toLowerCase().includes('property') || 
                           item.toLowerCase().includes('specification')) &&
                           (value.toLowerCase().includes('value') || value.toLowerCase().includes('description'))) {
          return;
        }

        if (item && value) {
          specifications.push({ item, value });
        }
      }
    });

    return specifications;
  };

  const handleTableImport = (pastedData: string) => {
    const parsedSpecs = parseTableData(pastedData);
    if (parsedSpecs.length > 0) {
      // Add to existing specifications
      const currentSpecs = contentData.specifications?.specifications || [];
      updateContent("specifications", "specifications", [...currentSpecs, ...parsedSpecs]);
    }
  };

  // Smart text processing for features and applications
  const parseListText = (text: string): string[] => {
    if (!text.trim()) return [];

    // Remove common bullet point characters and clean up
    const cleanText = text
      .replace(/^[\s]*[•·‣⁃▪▫▬▭⌐◦‣⁃]/gm, '') // Remove bullet characters at start of lines
      .replace(/^[\s]*[-*]/gm, '') // Remove dash/asterisk bullets
      .replace(/^[\s]*\d+[\.\)]/gm, '') // Remove numbered lists
      .trim();

    // Check if text contains HTML list elements
    if (cleanText.includes('<li>') || cleanText.includes('<ul>') || cleanText.includes('<ol>')) {
      return parseHTMLList(cleanText);
    }

    // Split by line breaks first (handles copy-paste from sheets/documents)
    const lines = cleanText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length > 1) {
      // Multiple lines - treat each as separate item
      return lines;
    }

    // Single line - split by periods if it looks like sentences
    const singleLine = lines[0] || cleanText;
    
    // Check if it looks like multiple sentences (has periods followed by capital letters or spaces)
    if (singleLine.match(/\.\s+[A-Z]/) || singleLine.match(/\.[A-Z]/)) {
      // Split by periods and clean up
      return singleLine
        .split('.')
        .map(sentence => sentence.trim())
        .filter(sentence => sentence.length > 0)
        .map(sentence => sentence.charAt(0).toUpperCase() + sentence.slice(1)); // Capitalize first letter
    }

    // Single item
    return [singleLine];
  };

  const parseHTMLList = (htmlText: string): string[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');
    const listItems = doc.querySelectorAll('li');
    const items: string[] = [];

    listItems.forEach(item => {
      const text = item.textContent?.trim();
      if (text) {
        items.push(text);
      }
    });

    return items.length > 0 ? items : [htmlText.replace(/<[^>]*>/g, '').trim()];
  };

  const handleSmartTextInput = (tabType: string, field: string, text: string) => {
    const parsedItems = parseListText(text);
    const currentItems = contentData[tabType]?.[field] || [];
    
    if (parsedItems.length > 1) {
      // Multiple items found - replace current items
      updateContent(tabType, field, parsedItems);
    } else if (parsedItems.length === 1) {
      // Single item - just update normally
      const targetIndex = currentItems.length - 1; // Assuming we're updating the last item
      if (targetIndex >= 0) {
        updateArrayItem(tabType, field, targetIndex, parsedItems[0]);
      } else {
        updateContent(tabType, field, parsedItems);
      }
    }
  };

  // Smart URL handling for Shopify collections and products
  const parseShopifyUrl = (url: string) => {
    if (!url.trim()) return null;

    const cleanUrl = url.trim();
    console.log('Parsing URL:', cleanUrl);
    
    try {
      const urlObj = new URL(cleanUrl);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      console.log('URL parts:', pathParts);
      
      // Handle /collections/handle/products/product-handle format
      if (pathParts[0] === 'collections' && pathParts[2] === 'products' && pathParts[3]) {
        console.log('Found product in collection:', pathParts[3]);
        return {
          type: 'product',
          handle: pathParts[3],
          url: cleanUrl
        };
      }
      
      // Handle /collections/handle format
      if (pathParts[0] === 'collections' && pathParts[1]) {
        console.log('Found collection:', pathParts[1]);
        return {
          type: 'collection',
          handle: pathParts[1],
          url: cleanUrl
        };
      }
      
      // Handle /products/handle format
      if (pathParts[0] === 'products' && pathParts[1]) {
        console.log('Found product:', pathParts[1]);
        return {
          type: 'product',
          handle: pathParts[1],
          url: cleanUrl
        };
      }
    } catch (error) {
      // If URL parsing fails, try regex patterns for partial URLs
      console.log('URL parsing failed, trying regex patterns');
      
      // Extract collection handle from URL patterns
      const collectionMatch = cleanUrl.match(/\/collections\/([a-z0-9-]+)/);
      if (collectionMatch) {
        return {
          type: 'collection',
          handle: collectionMatch[1],
          url: cleanUrl
        };
      }

      // Extract product handle from URL patterns
      const productMatch = cleanUrl.match(/\/products\/([a-z0-9-]+)/);
      if (productMatch) {
        return {
          type: 'product',
          handle: productMatch[1],
          url: cleanUrl
        };
      }
    }

    return null;
  };

  const fetchShopifyData = async (urlData: any) => {
    try {
      if (urlData.type === 'collection') {
        // Fetch collection data
        const response = await fetch(`/api/shopify/collections/${urlData.handle}`);
        if (response.ok) {
          const data = await response.json();
          console.log('Collection API response:', data);
          
          // Handle both direct collection and nested collection format
          const collection = data.collection || data;
          if (collection) {
            // Get collection image or featured image
            let imageUrl = collection.image?.src || collection.image || null;
            
            // If no collection image, try to get first product image
            if (!imageUrl && collection.products?.length > 0) {
              const firstProduct = collection.products[0];
              if (firstProduct.images?.length > 0) {
                imageUrl = firstProduct.images[0].src || firstProduct.images[0];
              } else if (firstProduct.image) {
                imageUrl = firstProduct.image.src || firstProduct.image;
              }
            }
            
            return {
              title: collection.title,
              image: imageUrl,
              handle: urlData.handle
            };
          }
        }
      } else if (urlData.type === 'product') {
        // Fetch product data
        const response = await fetch(`/api/shopify/products/handle/${urlData.handle}`);
        if (response.ok) {
          const data = await response.json();
          console.log('Product API response:', data);
          
          const product = data.product || data;
          if (product) {
            // Get product image - try multiple possible formats
            let imageUrl = null;
            
            if (product.images && Array.isArray(product.images) && product.images.length > 0) {
              imageUrl = product.images[0].src || product.images[0];
            } else if (product.image) {
              imageUrl = product.image.src || product.image;
            } else if (product.featured_image) {
              imageUrl = product.featured_image;
            }
            
            return {
              title: product.title,
              image: imageUrl,
              handle: urlData.handle
            };
          }
        }
      }
    } catch (error) {
      console.error('Error fetching Shopify data:', error);
    }
    return null;
  };



  const handleUrlInput = async (url: string) => {
    console.log('🔥 handleUrlInput called with URL:', url);
    const urlData = parseShopifyUrl(url);
    if (!urlData) {
      console.log('❌ Could not parse URL:', url);
      return;
    }

    console.log('📡 Parsed URL data:', urlData);
    console.log('🔍 About to fetch Shopify data...');
    const shopifyData = await fetchShopifyData(urlData);
    console.log('📦 Received shopifyData:', shopifyData);
    
    // Ensure state is initialized before adding items
    const initializeContainer = () => {
      if (!contentData['compatible-container']) {
        console.log('🔧 Initializing compatible-container state');
        updateContent("compatible-container", "title", "Compatible Container");
        updateContent("compatible-container", "compatibleItems", []);
      }
    };
    
    initializeContainer();
    
    // Create the new item
    const newItem = shopifyData ? {
      handle: urlData.handle,
      title: shopifyData.title,
      image: shopifyData.image,
      sourceUrl: url,
      type: urlData.type
    } : {
      handle: urlData.handle,
      title: urlData.handle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      image: null,
      sourceUrl: url,
      type: urlData.type
    };

    // Add to the compatible items array
    const currentItems = contentData['compatible-container']?.compatibleItems || [];
    const updatedItems = [...currentItems, newItem];
    console.log('🔄 Current items:', currentItems);
    console.log('🆕 New item:', newItem);
    console.log('📋 Updated items array:', updatedItems);
    
    // Force a fresh update to trigger re-render with proper state update
    onContentChange({
      ...contentData,
      'compatible-container': {
        ...contentData['compatible-container'],
        compatibleItems: updatedItems,
        title: "Compatible Container"
      }
    });
    
    // Also update the primary fields for backward compatibility
    if (currentItems.length === 0) {
      // Set collection handle for first item
      onContentChange({
        ...contentData,
        'compatible-container': {
          ...contentData['compatible-container'],
          compatibleItems: updatedItems,
          title: "Compatible Container",
          collectionHandle: urlData.handle
        }
      });
    }
    
    // Auto-save the updated compatible container data
    setTimeout(() => {
      const updatedContentData = {
        ...contentData,
        'compatible-container': {
          title: "Compatible Container",
          compatibleItems: updatedItems,
          collectionHandle: urlData.handle
        }
      };
      saveDraftContent("compatible-container", {
        title: "Compatible Container",
        compatibleItems: updatedItems,
        collectionHandle: urlData.handle
      }, updatedContentData);
    }, 100);
    
    console.log('✅ Compatible container item added successfully');
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
            <Label className="block text-sm font-medium text-slate-700 mb-2">H2 Heading</Label>
            <Input
              placeholder="Enter H2 heading..."
              value={contentData.description?.h2Heading || ""}
              onChange={(e) => updateContent("description", "h2Heading", e.target.value)}
              data-testid="input-description-h2"
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
        {/* Smart Import Section */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardPaste className="w-5 h-5 text-blue-600" />
            <h3 className="font-medium text-blue-900">Smart Import Features</h3>
          </div>
          <p className="text-sm text-blue-700 mb-3">
            Paste text with features and it will automatically split by periods or lines. Supports bullet points from spreadsheets.
          </p>
          <Textarea
            placeholder={`Paste your features here. Examples:

From spreadsheet/bullet points:
• Delivers clear, tamper-evident indication
• VersaCap technology provides flexibility
• Adapter rotates independently

From paragraph:
Delivers clear indication. VersaCap provides flexibility. Adapter rotates independently.

From HTML:
<ul><li>Feature 1</li><li>Feature 2</li></ul>`}
            rows={4}
            className="w-full mb-3"
            onPaste={(e) => {
              setTimeout(() => {
                const textarea = e.target as HTMLTextAreaElement;
                if (textarea.value.trim()) {
                  const parsed = parseListText(textarea.value);
                  const currentFeatures = contentData.features?.features || [];
                  updateContent("features", "features", [...currentFeatures, ...parsed]);
                  textarea.value = "";
                }
              }, 10);
            }}
            data-testid="textarea-features-import"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const textarea = document.querySelector('[data-testid="textarea-features-import"]') as HTMLTextAreaElement;
                if (textarea?.value.trim()) {
                  const parsed = parseListText(textarea.value);
                  const currentFeatures = contentData.features?.features || [];
                  updateContent("features", "features", [...currentFeatures, ...parsed]);
                  textarea.value = "";
                }
              }}
              data-testid="button-import-features"
            >
              <Upload className="w-4 h-4 mr-1" />
              Import Features
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateContent("features", "features", [])}
              className="text-red-600 hover:text-red-800"
              data-testid="button-clear-features"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          </div>
        </div>

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
        {/* Smart Import Section */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardPaste className="w-5 h-5 text-blue-600" />
            <h3 className="font-medium text-blue-900">Smart Import Applications</h3>
          </div>
          <p className="text-sm text-blue-700 mb-3">
            Paste text with applications and it will automatically split by periods or lines. Supports bullet points from spreadsheets.
          </p>
          <Textarea
            placeholder={`Paste your applications here. Examples:

From spreadsheet/bullet points:
• Biopharmaceutical manufacturing
• Laboratory sample collection
• Medical device testing

From paragraph:
Biopharmaceutical manufacturing. Laboratory sample collection. Medical device testing.

From HTML:
<ul><li>Application 1</li><li>Application 2</li></ul>`}
            rows={4}
            className="w-full mb-3"
            onPaste={(e) => {
              setTimeout(() => {
                const textarea = e.target as HTMLTextAreaElement;
                if (textarea.value.trim()) {
                  const parsed = parseListText(textarea.value);
                  const currentApplications = contentData.applications?.applications || [];
                  updateContent("applications", "applications", [...currentApplications, ...parsed]);
                  textarea.value = "";
                }
              }, 10);
            }}
            data-testid="textarea-applications-import"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const textarea = document.querySelector('[data-testid="textarea-applications-import"]') as HTMLTextAreaElement;
                if (textarea?.value.trim()) {
                  const parsed = parseListText(textarea.value);
                  const currentApplications = contentData.applications?.applications || [];
                  updateContent("applications", "applications", [...currentApplications, ...parsed]);
                  textarea.value = "";
                }
              }}
              data-testid="button-import-applications"
            >
              <Upload className="w-4 h-4 mr-1" />
              Import Applications
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateContent("applications", "applications", [])}
              className="text-red-600 hover:text-red-800"
              data-testid="button-clear-applications"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear All
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {(contentData.applications?.applications || []).map((application: string, index: number) => (
            <div key={index} className="flex items-start space-x-3">
              <span className="text-slate-400 mt-2">•</span>
              <Textarea
                rows={2}
                placeholder="Enter application..."
                value={application}
                onChange={(e) => updateArrayItem("applications", "applications", index, e.target.value)}
                className="flex-1"
                data-testid={`textarea-application-${index}`}
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
        {/* Table Import Section */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardPaste className="w-5 h-5 text-blue-600" />
            <h3 className="font-medium text-blue-900">Import Table Data</h3>
          </div>
          <p className="text-sm text-blue-700 mb-3">
            Paste table data from Excel, Google Sheets, or HTML tables. The system will automatically parse and add the specifications.
          </p>
          <div className="space-y-3">
            <Textarea
              placeholder={`Paste your table data here. Supported formats:

Excel/Google Sheets (tab-separated):
Material        Polycarbonate, USP Class VI
Pressure Range  Up to 60 psi, 4.1 bar
Color   White with white pull tab

HTML Table:
<table><tr><td>Material</td><td>Polycarbonate</td></tr></table>

CSV Format:
Material,Polycarbonate USP Class VI
Pressure Range,Up to 60 psi 4.1 bar`}
              rows={6}
              className="w-full"
              onPaste={(e) => {
                // Small delay to let the paste content appear
                setTimeout(() => {
                  const textarea = e.target as HTMLTextAreaElement;
                  if (textarea.value.trim()) {
                    handleTableImport(textarea.value);
                    textarea.value = ""; // Clear after import
                  }
                }, 10);
              }}
              data-testid="textarea-table-import"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const textarea = document.querySelector('[data-testid="textarea-table-import"]') as HTMLTextAreaElement;
                  if (textarea?.value.trim()) {
                    handleTableImport(textarea.value);
                    textarea.value = "";
                  }
                }}
                data-testid="button-import-table"
              >
                <Upload className="w-4 h-4 mr-1" />
                Import Table Data
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateContent("specifications", "specifications", [])}
                className="text-red-600 hover:text-red-800"
                data-testid="button-clear-specifications"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            </div>
          </div>
        </div>

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
    <Card key="safety-guidelines" className="content-form">
      <CardHeader className="form-section-header">
        <CardTitle className="flex items-center">
          <Shield className="w-5 h-5 text-primary mr-3" />
          Safety Usage Guidelines
        </CardTitle>
      </CardHeader>
      <CardContent className="form-section-content">
        <div className="space-y-3">
          {(contentData['safety-guidelines']?.guidelines || []).map((guideline: string, index: number) => (
            <div key={index} className="flex items-start space-x-3">
              <span className="text-slate-400 mt-2">•</span>
              <Textarea
                rows={2}
                placeholder="Enter safety guideline..."
                value={guideline}
                onChange={(e) => updateArrayItem("safety-guidelines", "guidelines", index, e.target.value)}
                className="flex-1"
                data-testid={`textarea-guideline-${index}`}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeArrayItem("safety-guidelines", "guidelines", index)}
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
          onClick={() => addArrayItem("safety-guidelines", "guidelines", "")}
          className="mt-4 text-primary hover:text-primary/80"
          data-testid="button-add-guideline"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Another Guideline
        </Button>
      </CardContent>
    </Card>
  );

  const renderSKUNomenclatureForm = () => (
    <Card key="sku-nomenclature" className="content-form">
      <CardHeader className="form-section-header">
        <CardTitle className="flex items-center">
          <Hash className="w-5 h-5 text-primary mr-3" />
          SKU Nomenclature
        </CardTitle>
      </CardHeader>
      <CardContent className="form-section-content">
        <div className="space-y-6">
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-2">SKU Breakdown Title</Label>
            <Input
              placeholder="SKU Breakdown"
              value={contentData['sku-nomenclature']?.title || ""}
              onChange={(e) => updateContent("sku-nomenclature", "title", e.target.value)}
              data-testid="input-sku-title"
            />
          </div>

          {/* Main SKU Nomenclature Image */}
          <div>
            <FileUpload
              label="Main SKU Nomenclature Image (Optional)"
              value={contentData['sku-nomenclature']?.mainImage || ""}
              onChange={(url) => updateContent("sku-nomenclature", "mainImage", url)}
              placeholder="Upload or enter URL for main SKU nomenclature image"
            />
          </div>

          {/* Additional Images Gallery */}
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-3">Additional Images</Label>
            <div className="space-y-3">
              {(contentData['sku-nomenclature']?.additionalImages || []).map((imageUrl: string, index: number) => (
                <div key={index} className="flex items-center space-x-3 p-3 border rounded">
                  <div className="flex-1">
                    <FileUpload
                      label={`Image ${index + 1}`}
                      value={imageUrl}
                      onChange={(url) => updateArrayItem("sku-nomenclature", "additionalImages", index, url)}
                      placeholder="Upload or enter image URL"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeArrayItem("sku-nomenclature", "additionalImages", index)}
                    className="text-red-500 hover:text-red-700 mt-6"
                    data-testid={`button-remove-additional-image-${index}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              onClick={() => addArrayItem("sku-nomenclature", "additionalImages", "")}
              className="mt-3 text-primary hover:text-primary/80"
              data-testid="button-add-additional-image"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Another Image
            </Button>
          </div>

          {/* SKU Components */}
          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-2">SKU Components</Label>
            <div className="space-y-3">
              {(contentData['sku-nomenclature']?.components || []).map((component: { code: string; description: string; images?: string[] }, index: number) => (
                <div key={index} className="space-y-3 p-4 border rounded-lg bg-slate-50">
                  <div className="flex items-center space-x-3">
                    <Input
                      placeholder="Code (e.g., TS)"
                      value={component.code}
                      onChange={(e) => updateArrayItem("sku-nomenclature", "components", index, { ...component, code: e.target.value })}
                      className="w-24"
                      data-testid={`input-sku-code-${index}`}
                    />
                    <span className="text-slate-400">=</span>
                    <Input
                      placeholder="Description (e.g., Titanium Series)"
                      value={component.description}
                      onChange={(e) => updateArrayItem("sku-nomenclature", "components", index, { ...component, description: e.target.value })}
                      className="flex-1"
                      data-testid={`input-sku-description-${index}`}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeArrayItem("sku-nomenclature", "components", index)}
                      className="text-red-500 hover:text-red-700"
                      data-testid={`button-remove-sku-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Component Images */}
                  <div className="ml-8">
                    <Label className="block text-sm font-medium text-slate-600 mb-2">Component Images</Label>
                    <div className="space-y-2">
                      {(component.images || []).map((imageUrl: string, imgIndex: number) => (
                        <div key={imgIndex} className="flex items-center space-x-2">
                          <div className="flex-1">
                            <FileUpload
                              label={`Image ${imgIndex + 1}`}
                              value={imageUrl}
                              onChange={(url) => {
                                const updatedImages = [...(component.images || [])];
                                updatedImages[imgIndex] = url;
                                updateArrayItem("sku-nomenclature", "components", index, { ...component, images: updatedImages });
                              }}
                              placeholder="Upload component image"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const updatedImages = (component.images || []).filter((_, i) => i !== imgIndex);
                              updateArrayItem("sku-nomenclature", "components", index, { ...component, images: updatedImages });
                            }}
                            className="text-red-500 hover:text-red-700 mt-6"
                            data-testid={`button-remove-component-image-${index}-${imgIndex}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const updatedImages = [...(component.images || []), ""];
                        updateArrayItem("sku-nomenclature", "components", index, { ...component, images: updatedImages });
                      }}
                      className="mt-2 text-sm"
                      data-testid={`button-add-component-image-${index}`}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add Image
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="ghost"
              onClick={() => addArrayItem("sku-nomenclature", "components", { code: "", description: "", images: [] })}
              className="mt-4 text-primary hover:text-primary/80"
              data-testid="button-add-sku-component"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add SKU Component
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderCompatibleContainerForm = () => (
    <Card key="compatible-container" className="content-form">
      <CardHeader className="form-section-header">
        <CardTitle className="flex items-center">
          <Package2 className="w-5 h-5 text-primary mr-3" />
          Compatible Container
        </CardTitle>
      </CardHeader>
      <CardContent className="form-section-content">
        <div className="space-y-4">
          {/* Smart URL Input Section */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardPaste className="w-5 h-5 text-blue-600" />
              <h3 className="font-medium text-blue-900">Smart URL Import</h3>
            </div>
            <p className="text-sm text-blue-700 mb-3">
              Paste a Shopify collection or product URL and click Add to fetch title and image data.
            </p>
            <div className="flex gap-2">
              <Input
                id="url-input"
                placeholder="https://foxxbioprocess.myshopify.com/collections/compatible-bottles or /products/product-name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.target as HTMLInputElement;
                    if (input.value.trim()) {
                      handleUrlInput(input.value).then(() => {
                        input.value = "";
                      }).catch(error => {
                        console.error('Error on Enter:', error);
                      });
                    }
                  }
                }}
                className="flex-1"
                data-testid="input-url-import"
              />
              <Button
                onClick={async () => {
                  const input = document.getElementById('url-input') as HTMLInputElement;
                  if (input && input.value.trim()) {
                    try {
                      await handleUrlInput(input.value);
                      input.value = "";
                    } catch (error) {
                      console.error('Error adding URL:', error);
                    }
                  }
                }}
                className="px-4"
              >
                Add
              </Button>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              Supports: Collection URLs, Product URLs, or just the handle name
            </p>
          </div>


          


          {/* Display compatible items as cards */}
          {contentData['compatible-container']?.compatibleItems && contentData['compatible-container'].compatibleItems.length > 0 && (
            <div className="space-y-3">
              <Label className="block text-sm font-medium text-slate-700">
                Compatible Items ({contentData['compatible-container'].compatibleItems.length})
              </Label>
              {contentData['compatible-container'].compatibleItems.map((item: any, index: number) => (
                <div key={index} className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {item.image && (
                        <img 
                          src={item.image} 
                          alt={item.title}
                          className="w-16 h-16 object-cover rounded border"
                        />
                      )}
                      <div className="flex-1 space-y-2">
                        <Input
                          value={item.title}
                          onChange={(e) => {
                            const currentItems = contentData['compatible-container']?.compatibleItems || [];
                            const updatedItems = currentItems.map((existingItem: any, i: number) => 
                              i === index ? { ...existingItem, title: e.target.value } : existingItem
                            );
                            updateContent("compatible-container", "compatibleItems", updatedItems);
                          }}
                          className="font-medium text-blue-600 border-none shadow-none p-0 h-auto bg-transparent"
                          placeholder="Edit title..."
                        />
                        <Input
                          value={item.image || ''}
                          onChange={(e) => {
                            const currentItems = contentData['compatible-container']?.compatibleItems || [];
                            const updatedItems = currentItems.map((existingItem: any, i: number) => 
                              i === index ? { ...existingItem, image: e.target.value } : existingItem
                            );
                            updateContent("compatible-container", "compatibleItems", updatedItems);
                          }}
                          className="text-xs text-gray-600 border border-gray-200 rounded px-2 py-1"
                          placeholder="Image URL (optional)..."
                        />
                        <p className="text-sm text-gray-500">
                          {item.type === 'collection' ? 'Collection' : 'Product'}: {item.handle}
                        </p>
                        <a 
                          href={item.sourceUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-600 hover:underline truncate max-w-xs block"
                        >
                          {item.sourceUrl}
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          const currentItems = contentData['compatible-container']?.compatibleItems || [];
                          const updatedItems = currentItems.filter((_: any, i: number) => i !== index);
                          updateContent("compatible-container", "compatibleItems", updatedItems);
                        }}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add another item button */}
          <div className="flex justify-center py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // Focus the URL input for next item
                const urlInput = document.querySelector('input[placeholder*="foxxbioprocess"]') as HTMLInputElement;
                if (urlInput) {
                  urlInput.focus();
                  urlInput.value = '';
                  // Temporarily change placeholder to encourage input
                  const originalPlaceholder = urlInput.placeholder;
                  urlInput.placeholder = "Paste URL here and press Enter to add another item";
                  // Reset placeholder after focus loss
                  urlInput.addEventListener('blur', () => {
                    urlInput.placeholder = originalPlaceholder;
                  }, { once: true });
                }
              }}
              className="text-blue-600 border-blue-300 hover:bg-blue-50"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Another Compatible Item
            </Button>
          </div>

          <div>
            <Label className="block text-sm font-medium text-slate-700 mb-2">Section Title</Label>
            <Input
              placeholder="Compatible Container"
              value={contentData['compatible-container']?.title || "Compatible Container"}
              onChange={(e) => updateContent("compatible-container", "title", e.target.value)}
              data-testid="input-compatible-title"
            />
          </div>
          {/* Description field is hidden for Compatible Container as it defaults to no description */}
        </div>
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
    "safety-guidelines": renderSafetyForm,
    "sku-nomenclature": renderSKUNomenclatureForm,
    "compatible-container": renderCompatibleContainerForm,
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
