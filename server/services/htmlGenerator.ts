import { ProductContent } from "@shared/schema";

interface LogoItem {
  url: string;
  altText: string;
}

interface ContentItem {
  tabType: string;
  content: any;
}

class HtmlGenerator {
  generateProductHtml(content: ProductContent[]): string {
    let html = '<div class="container">\n';
    
    // Get the product title from description content if available
    const descriptionContent = content.find(c => c.tabType === 'description');
    if (descriptionContent && (descriptionContent.content as any)?.title) {
      html += `    <h2>${(descriptionContent.content as any).title}</h2>\n`;
    }

    // Generate tabs based on content
    content.forEach(item => {
      if (!item.isActive) return;

      switch (item.tabType) {
        case 'description':
          html += this.generateDescriptionTab(item.content);
          break;
        case 'features':
          html += this.generateFeaturesTab(item.content);
          break;
        case 'applications':
          html += this.generateApplicationsTab(item.content);
          break;
        case 'specifications':
          html += this.generateSpecificationsTab(item.content);
          break;
        case 'videos':
          html += this.generateVideosTab(item.content);
          break;
        case 'documentation':
          html += this.generateDocumentationTab(item.content);
          break;
        case 'safety-guidelines':
          html += this.generateSafetyTab(item.content);
          break;
        case 'sku-nomenclature':
          html += this.generateSKUNomenclatureTab(item.content);
          break;
        case 'compatible-container':
          html += this.generateCompatibleContainerTab(item.content);
          break;
      }
    });

    html += '</div>';
    return html;
  }

  private generateDescriptionTab(content: any): string {
    let html = '    <div class="tab-content active" id="description">\n';
    
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

  private generateFeaturesTab(content: any): string {
    let html = '    <div class="tab-content" id="features">\n';
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

  private generateApplicationsTab(content: any): string {
    let html = '    <div class="tab-content" id="applications">\n';
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

  private generateSpecificationsTab(content: any): string {
    let html = '    <div class="tab-content" id="specification">\n';
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

  private generateVideosTab(content: any): string {
    let html = '    <div id="videos" class="tab-content">\n';
    
    if (content.videoUrl) {
      html += `        <iframe width="560" height="315" src="${content.videoUrl}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>\n`;
    }

    if (content.youtubeChannelText) {
      html += `    <p>${content.youtubeChannelText}</p>\n`;
    }

    html += '    </div>\n';
    return html;
  }

  private generateDocumentationTab(content: any): string {
    let html = '    <div id="documentation" class="tab-content">\n';
    
    if (content.datasheetUrl) {
      html += `    <p><a href="${content.datasheetUrl}" target="_blank">${content.datasheetTitle || 'Product Datasheet'}</a></p>\n`;
    }

    if (content.additionalLinks && Array.isArray(content.additionalLinks)) {
      content.additionalLinks.forEach((link: { url: string; title: string }) => {
        html += `    <p><a href="${link.url}" target="_blank">${link.title}</a></p>\n`;
      });
    }

    html += '    </div>\n';
    return html;
  }

  private generateSafetyTab(content: any): string {
    let html = '    <div class="tab-content" id="safety-guidelines">\n';
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

  private generateSKUNomenclatureTab(content: any): string {
    let html = '    <div class="tab-content" id="sku-nomenclature">\n';
    
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

  private generateCompatibleContainerTab(content: any): string {
    let html = '    <div class="tab-content" id="compatible-container">\n';
    
    if (content.title) {
      html += `        <h3>${content.title}</h3>\n`;
    }
    
    if (content.description) {
      html += `        <p>${content.description}</p>\n`;
    }
    
    if (content.collectionHandle) {
      html += `        <div class="collection-showcase" data-collection="${content.collectionHandle}">\n`;
      html += `            <!-- This will be populated by Shopify's collection liquid tags -->\n`;
      html += `            <p>Browse compatible products in the <a href="/collections/${content.collectionHandle}">product collection</a>.</p>\n`;
      html += '        </div>\n';
    }

    html += '    </div>\n';
    return html;
  }
}

export const htmlGenerator = new HtmlGenerator();
