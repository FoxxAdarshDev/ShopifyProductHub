import { ProductContent } from "@shared/schema";

interface LogoItem {
  url: string;
  altText: string;
}

interface ContentItem {
  tabType: string;
  content: any;
}

// Helper function to convert relative URLs to absolute URLs with proper domain
const convertToAbsoluteUrl = (url: string): string => {
  if (!url) return url;
  
  // If URL is already absolute, return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // If it's a relative URL starting with /
  if (url.startsWith('/')) {
    const shopifyStoreUrl = process.env.SHOPIFY_STORE_URL;
    if (shopifyStoreUrl) {
      // Convert foxxbioprocess.myshopify.com to foxxbioprocess.com
      const storeName = shopifyStoreUrl.split('.')[0];
      const domain = `https://${storeName}.com`;
      return `${domain}${url}`;
    }
  }
  
  return url;
};

// Helper function to convert all URLs in HTML content to absolute URLs
const convertHtmlUrlsToAbsolute = (html: string): string => {
  if (!html) return html;
  
  // Replace href attributes with relative URLs
  html = html.replace(/href="(\/[^"]*)"/g, (match, url) => {
    const absoluteUrl = convertToAbsoluteUrl(url);
    return `href="${absoluteUrl}"`;
  });
  
  // Replace src attributes with relative URLs  
  html = html.replace(/src="(\/[^"]*)"/g, (match, url) => {
    const absoluteUrl = convertToAbsoluteUrl(url);
    return `src="${absoluteUrl}"`;
  });
  
  return html;
};

// Define the fixed tab ordering groups
const TAB_ORDER_GROUPS = {
  GROUP_1: ['description', 'features', 'applications'],
  GROUP_2: ['specifications', 'documentation', 'videos'],
  ADDITIONAL: ['sku-nomenclature', 'safety-guidelines', 'compatible-container', 'sterilization-method']
};

// Function to order tabs according to the fixed groups
const orderTabs = (content: ProductContent[]): ProductContent[] => {
  const orderedContent: ProductContent[] = [];
  
  // Add Group 1 tabs in order (if available)
  TAB_ORDER_GROUPS.GROUP_1.forEach(tabType => {
    const item = content.find(c => c.tabType === tabType);
    if (item && item.isActive) {
      orderedContent.push(item);
    }
  });
  
  // Add Additional tabs in between groups (if available)
  TAB_ORDER_GROUPS.ADDITIONAL.forEach(tabType => {
    const item = content.find(c => c.tabType === tabType);
    if (item && item.isActive) {
      orderedContent.push(item);
    }
  });
  
  // Add Group 2 tabs in order (if available)
  TAB_ORDER_GROUPS.GROUP_2.forEach(tabType => {
    const item = content.find(c => c.tabType === tabType);
    if (item && item.isActive) {
      orderedContent.push(item);
    }
  });
  
  return orderedContent;
};

class HtmlGenerator {
  generateProductHtml(content: ProductContent[], productSku?: string, allVariantSkus?: string[]): string {
    // Create comma-separated SKU list for data attributes
    const skuAttribute = allVariantSkus && allVariantSkus.length > 0 
      ? allVariantSkus.join(', ') 
      : (productSku || 'unknown-sku');
    
    let html = `<div class="container" data-sku="${skuAttribute}">\n`;
    
    // Order content according to fixed groups before processing
    const orderedContent = orderTabs(content);
    
    // Get the product title from description content if available
    const descriptionContent = orderedContent.find(c => c.tabType === 'description');
    if (descriptionContent && (descriptionContent.content as any)?.title) {
      html += `    <h2 data-sku="${skuAttribute}">${(descriptionContent.content as any).title}</h2>\n`;
    }

    // Generate tabs based on ordered content
    orderedContent.forEach(item => {

      switch (item.tabType) {
        case 'description':
          html += this.generateDescriptionTab(item.content, skuAttribute);
          break;
        case 'features':
          html += this.generateFeaturesTab(item.content, skuAttribute);
          break;
        case 'applications':
          html += this.generateApplicationsTab(item.content, skuAttribute);
          break;
        case 'specifications':
          html += this.generateSpecificationsTab(item.content, skuAttribute);
          break;
        case 'videos':
          html += this.generateVideosTab(item.content, skuAttribute);
          break;
        case 'documentation':
          html += this.generateDocumentationTab(item.content, skuAttribute);
          break;
        case 'safety-guidelines':
          html += this.generateSafetyTab(item.content, skuAttribute);
          break;
        case 'sku-nomenclature':
          html += this.generateSKUNomenclatureTab(item.content, skuAttribute);
          break;
        case 'compatible-container':
          html += this.generateCompatibleContainerTab(item.content, skuAttribute);
          break;
        case 'sterilization-method':
          html += this.generateSterilizationMethodTab(item.content, skuAttribute);
          break;
      }
    });

    html += '</div>';
    
    // Convert all relative URLs to absolute URLs before returning
    return convertHtmlUrlsToAbsolute(html);
  }

  private generateDescriptionTab(content: any, sku: string): string {
    let html = `    <div class="tab-content active" id="description" data-sku="${sku}">\n`;
    
    // Add H2 title if present (this was missing!)
    if (content.title) {
      html += `    <h2 data-sku="${sku}">${content.title}</h2>\n`;
    }
    
    if (content.description) {
      // Split description into paragraphs
      const paragraphs = content.description.split('\n\n');
      paragraphs.forEach((paragraph: string) => {
        if (paragraph.trim()) {
          html += `    <p>${paragraph.trim()}</p>\n`;
        }
      });
    }

    // Add logo grid if logos exist
    if (content.logos && content.logos.length > 0) {
      html += '    <div class="logo-grid">\n';
      content.logos.forEach((logo: LogoItem) => {
        html += `    <img alt="${logo.altText}" src="${logo.url}">\n`;
      });
      html += '    </div>\n';
    }

    html += '    </div>\n';
    return html;
  }

  private generateFeaturesTab(content: any, sku: string): string {
    let html = `    <div class="tab-content" id="features" data-sku="${sku}">\n`;
    html += '     <ul>\n';
    
    if (content.features && Array.isArray(content.features)) {
      content.features.forEach((feature: string) => {
        html += `            <li><span style="line-height: 1.4;">${feature}</span></li>\n`;
      });
    }

    html += '     </ul>\n';
    html += '    </div>\n';
    return html;
  }

  private generateApplicationsTab(content: any, sku: string): string {
    let html = `    <div class="tab-content" id="applications" data-sku="${sku}">\n`;
    html += '    <ul>\n';
    
    if (content.applications && Array.isArray(content.applications)) {
      content.applications.forEach((application: string) => {
        html += `            <li><span style="line-height: 1.4;">${application}</span></li>\n`;
      });
    }

    html += '    </ul>\n';
    html += '    </div>\n';
    return html;
  }

  private generateSpecificationsTab(content: any, sku: string): string {
    let html = `    <div class="tab-content" id="specification" data-sku="${sku}">\n`;
    html += '    <table style="width: 100%; height: 78.3752px;">\n';
    html += '    <tbody>\n';
    html += '    <tr>\n';
    html += '    <td>ITEM</td>\n';
    html += '    <td>VALUE</td>\n';
    html += '    </tr>\n';

    if (content.specifications && Array.isArray(content.specifications)) {
      content.specifications.forEach((spec: { item: string; value: string }) => {
        html += '    <tr>\n';
        html += `    <td>${spec.item}</td>\n`;
        html += `    <td>${spec.value}</td>\n`;
        html += '    </tr>\n';
      });
    }

    html += '    </tbody>\n';
    html += '    </table>\n';
    html += '    </div>\n';
    return html;
  }

  private generateVideosTab(content: any, sku: string): string {
    let html = `    <div id="videos" class="tab-content" data-sku="${sku}">\n`;
    
    // Always show "Video coming soon" if no specific video URL is provided
    if (!content.videoUrl) {
      html += `    <p>Video coming soon</p>\n`;
    } else {
      html += `        <iframe width="560" height="315" src="${content.videoUrl}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>\n`;
    }

    // Always include YouTube channel link (default or custom)
    const youtubeText = content.youtubeChannelText || 'Check out all of our videos on our <a href="https://www.youtube.com/channel/UCfTcuV6zESARyzKfG2T6YFg" target="_blank">YouTube Channel</a>!';
    html += `    <p>${youtubeText}</p>\n`;

    html += '    </div>\n';
    return html;
  }

  private generateDocumentationTab(content: any, sku: string): string {
    let html = `    <div id="documentation" class="tab-content" data-sku="${sku}">\n`;
    
    // Add specific product datasheet if provided
    if (content.datasheetUrl) {
      const absoluteUrl = convertToAbsoluteUrl(content.datasheetUrl);
      html += `    <p><a href="${absoluteUrl}" target="_blank">${content.datasheetTitle || 'Product Datasheet'}</a></p>\n`;
    }

    // Add additional links if provided
    if (content.additionalLinks && Array.isArray(content.additionalLinks)) {
      content.additionalLinks.forEach((link: { url: string; title: string }) => {
        const absoluteUrl = convertToAbsoluteUrl(link.url);
        html += `    <p><a href="${absoluteUrl}" target="_blank">${link.title}</a></p>\n`;
      });
    }

    // Always include default product datasheets link
    const defaultDatasheetText = content.defaultDatasheetText || 'Click <a href="http://www.foxxlifesciences.com/pages/product-data-sheets" target="_blank">here</a> for a full list of our product datasheets!';
    html += `    <p>${defaultDatasheetText}</p>\n`;

    html += '    </div>\n';
    return html;
  }

  private generateSafetyTab(content: any, sku: string): string {
    let html = `    <div class="tab-content" id="safety-guidelines" data-sku="${sku}">\n`;
    html += '        <ul>\n';
    
    if (content.guidelines && Array.isArray(content.guidelines)) {
      content.guidelines.forEach((guideline: string) => {
        html += `                <li><span style="line-height: 1.4;">${guideline}</span></li>\n`;
      });
    }

    html += '        </ul>\n';
    html += '        </div>\n';
    return html;
  }

  private generateSKUNomenclatureTab(content: any, sku: string): string {
    let html = `    <div class="tab-content" id="sku-nomenclature" data-sku="${sku}">\n`;
    
    if (content.title) {
      html += `        <h3>${content.title}</h3>\n`;
    }

    // Main SKU nomenclature image
    if (content.mainImage) {
      html += `        <div class="sku-main-image">\n`;
      html += `            <img src="${content.mainImage}" alt="SKU Nomenclature" class="sku-nomenclature-image" />\n`;
      html += '        </div>\n';
    }

    // Additional images gallery
    if (content.additionalImages && Array.isArray(content.additionalImages) && content.additionalImages.length > 0) {
      html += '        <div class="sku-additional-images">\n';
      html += '            <h4>Additional Images</h4>\n';
      html += '            <div class="image-gallery">\n';
      content.additionalImages.forEach((imageUrl: string) => {
        if (imageUrl) {
          html += `                <img src="${imageUrl}" alt="SKU Additional Image" class="gallery-image" />\n`;
        }
      });
      html += '            </div>\n';
      html += '        </div>\n';
    }
    
    if (content.components && Array.isArray(content.components)) {
      html += '        <div class="sku-breakdown">\n';
      content.components.forEach((component: { code: string; description: string; images?: string[] }) => {
        if (component.code && component.description) {
          html += '            <div class="sku-component">\n';
          html += `                <p><strong>${component.code}</strong> = ${component.description}</p>\n`;
          
          // Component images
          if (component.images && Array.isArray(component.images) && component.images.length > 0) {
            html += '                <div class="component-images">\n';
            component.images.forEach((imageUrl: string) => {
              if (imageUrl) {
                html += `                    <img src="${imageUrl}" alt="${component.code} Image" class="component-image" />\n`;
              }
            });
            html += '                </div>\n';
          }
          
          html += '            </div>\n';
        }
      });
      html += '        </div>\n';
    }

    html += '    </div>\n';
    return html;
  }

  private generateCompatibleContainerTab(content: any, sku: string): string {
    let html = `    <div class="tab-content compatible-container" id="compatible-container" data-sku="${sku}">\n`;
    
    // Use default title if not provided
    const title = content.title || "Compatible Container";
    html += `        <h3>${title}</h3>\n`;
    
    // Only add description if explicitly provided (not default for Compatible Container)
    if (content.description && content.description.trim()) {
      html += `        <p>${content.description}</p>\n`;
    }
    
    // Generate compatible items if available
    if (content.compatibleItems && Array.isArray(content.compatibleItems) && content.compatibleItems.length > 0) {
      html += '        <div class="compatible-items-grid">\n';
      content.compatibleItems.forEach((item: any) => {
        html += '            <div class="compatible-item">\n';
        
        if (item.image) {
          html += `                <img src="${item.image}" alt="${item.title}" loading="lazy" />\n`;
        }
        
        html += '                <div class="compatible-item-content">\n';
        html += `                    <h4 class="compatible-item-title">${item.title}</h4>\n`;
        if (item.description || item.handle) {
          html += `                    <p class="compatible-item-description">Product: ${item.description || item.handle}</p>\n`;
        }
        const itemUrl = item.url || item.sourceUrl;
        if (itemUrl) {
          const absoluteUrl = convertToAbsoluteUrl(itemUrl);
          html += `                    <a href="${absoluteUrl}" target="_blank" class="compatible-item-link">View Product →</a>\n`;
        }
        html += '                </div>\n';

        html += '            </div>\n';
      });
      html += '        </div>\n';
    } else if (content.collectionHandle) {
      // Fallback to collection link if no compatible items
      html += `        <div class="collection-showcase" data-collection="${content.collectionHandle}">\n`;
      const collectionUrl = convertToAbsoluteUrl(`/collections/${content.collectionHandle}`);
      html += `            <p>Browse compatible products in the <a href="${collectionUrl}">product collection</a>.</p>\n`;
      html += '        </div>\n';
    }

    html += '    </div>\n';
    return html;
  }

  private generateSterilizationMethodTab(content: any, sku: string): string {
    let html = `    <div class="tab-content" id="sterilization-method" data-sku="${sku}">\n`;
    
    if (content.title) {
      html += `        <h3>${content.title}</h3>\n`;
    }

    if (content.methods && Array.isArray(content.methods)) {
      html += '        <ul>\n';
      content.methods.forEach((method: string) => {
        html += `            <li><span style="line-height: 1.4;">${method}</span></li>\n`;
      });
      html += '        </ul>\n';
    }

    html += '    </div>\n';
    return html;
  }
}

export const htmlGenerator = new HtmlGenerator();
