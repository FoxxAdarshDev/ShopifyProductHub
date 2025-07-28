interface ExtractedContent {
  [key: string]: any;
}

/**
 * Extracts structured content from Shopify product HTML descriptions
 * This function parses existing HTML content and converts it back to form data
 */
export function extractContentFromHtml(html: string): ExtractedContent {
  const extractedContent: ExtractedContent = {};

  if (!html) {
    return extractedContent;
  }

  try {
    console.log('🔍 Starting extraction with HTML length:', html.length);
    
    // Extract description content - look for description div and extract paragraphs
    const descDiv = html.match(/<div[^>]*id="description"[^>]*>([\s\S]*?)<\/div>/);
    console.log('📄 Description div match result:', descDiv ? 'FOUND' : 'NOT FOUND');
    
    if (descDiv && descDiv[1]) {
      console.log('📝 Description div content:', descDiv[1].substring(0, 100) + '...');
      const paragraphs = descDiv[1].match(/<p[^>]*>(.*?)<\/p>/g);
      console.log('📄 Paragraphs found:', paragraphs ? paragraphs.length : 0);
      
      if (paragraphs && paragraphs.length > 0) {
        const textContent = paragraphs.map(p => p.replace(/<[^>]*>/g, '').trim()).join('\n\n');
        console.log('✅ Extracted description text:', textContent.substring(0, 100) + '...');
        extractedContent.description = {
          title: '',
          description: textContent,
          logos: []
        };
      }
    }

    // Extract features content - look for features div and extract list items
    const featDiv = html.match(/<div[^>]*id="features"[^>]*>([\s\S]*?)<\/div>/);
    if (featDiv && featDiv[1]) {
      const listItems = featDiv[1].match(/<li[^>]*>(.*?)<\/li>/g);
      if (listItems && listItems.length > 0) {
        const features = listItems.map(li => {
          // Clean up nested spans and HTML tags
          return li.replace(/<span[^>]*style="[^"]*"[^>]*>/g, '')
                   .replace(/<\/span>/g, '')
                   .replace(/<[^>]*>/g, '')
                   .trim();
        }).filter(f => f);
        
        extractedContent.features = {
          features
        };
      }
    }

    // Extract applications content
    const appDiv = html.match(/<div[^>]*id="applications"[^>]*>([\s\S]*?)<\/div>/);
    if (appDiv && appDiv[1]) {
      const listItems = appDiv[1].match(/<li[^>]*>(.*?)<\/li>/g);
      if (listItems && listItems.length > 0) {
        const applications = listItems.map(li => li.replace(/<[^>]*>/g, '').trim()).filter(a => a);
        extractedContent.applications = {
          applications
        };
      }
    }

    return extractedContent;
  } catch (error) {
    console.error('Content extraction error:', error);
    return extractedContent;
  }
}

    // Extract Applications content
    const applicationsMatch = cleanHtml.match(/<div[^>]*id="applications"[^>]*>(.*?)<\/div>/s) ||
                             cleanHtml.match(/<div[^>]*class="tab-content[^"]*"[^>]*id="applications"[^>]*>(.*?)<\/div>/s) ||
                             cleanHtml.match(/<div[^>]*data-section="applications"[^>]*>(.*?)<\/div>/s);
    
    if (applicationsMatch) {
      console.log('Found applications section:', applicationsMatch[1].substring(0, 100) + '...');
      const appContent = applicationsMatch[1];
      
      const listMatches = appContent.match(/<li[^>]*>(.*?)<\/li>/g);
      const applications = listMatches ? listMatches.map(li => {
        const cleanText = li.replace(/<span[^>]*style="[^"]*"[^>]*>([^<]*)<\/span>/g, '$1')
                           .replace(/<[^>]*>/g, '').trim();
        return cleanText;
      }).filter(a => a) : [];
      
      extractedContent.applications = {
        applications
      };
    }

    // Extract Specifications content  
    const specificationsMatch = cleanHtml.match(/<div[^>]*id="specification"[^>]*>(.*?)<\/div>/s) ||
                               cleanHtml.match(/<div[^>]*class="tab-content[^"]*"[^>]*id="specification"[^>]*>(.*?)<\/div>/s) ||
                               cleanHtml.match(/<div[^>]*data-section="specifications"[^>]*>(.*?)<\/div>/s);
    
    if (specificationsMatch) {
      console.log('Found specifications section:', specificationsMatch[1].substring(0, 100) + '...');
      const specContent = specificationsMatch[1];
      
      // Extract table data
      const specifications: Array<{item: string, value: string}> = [];
      const rowMatches = specContent.match(/<tr[^>]*>(.*?)<\/tr>/g);
      
      if (rowMatches) {
        // Skip header row (ITEM/VALUE)
        rowMatches.slice(1).forEach(row => {
          const cellMatches = row.match(/<td[^>]*>(.*?)<\/td>/g);
          if (cellMatches && cellMatches.length >= 2) {
            const item = cellMatches[0].replace(/<[^>]*>/g, '').trim();
            const value = cellMatches[1].replace(/<[^>]*>/g, '').trim();
            if (item && value && item !== 'ITEM' && value !== 'VALUE') {
              specifications.push({ item, value });
            }
          }
        });
      }
      
      extractedContent.specifications = {
        specifications
      };
    }

    // Extract Compatible Container content
    const compatibleMatch = cleanHtml.match(/<div[^>]*data-section="compatible-container"[^>]*>([\s\S]*?)<\/div>/);
    if (compatibleMatch) {
      const compatContent = compatibleMatch[1];
      
      const titleMatch = compatContent.match(/<h2[^>]*>(.*?)<\/h2>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '') : 'Compatible Container';
      
      // Extract individual compatible items
      const compatibleItems: Array<{handle: string, title: string, image?: string, sourceUrl: string, type: string}> = [];
      const itemMatches = compatContent.match(/<div[^>]*class="[^"]*compatible-item[^"]*"[^>]*>(.*?)<\/div>/g);
      
      if (itemMatches) {
        itemMatches.forEach(item => {
          const linkMatch = item.match(/<a[^>]*href="([^"]*)"[^>]*>/);
          const titleMatch = item.match(/<[^>]*class="[^"]*item-title[^"]*"[^>]*>(.*?)<\/[^>]*>/);
          const imageMatch = item.match(/<img[^>]*src="([^"]*)"[^>]*>/);
          
          if (linkMatch && titleMatch) {
            const sourceUrl = linkMatch[1];
            const title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
            const image = imageMatch ? imageMatch[1] : undefined;
            
            // Extract handle from URL
            const handleMatch = sourceUrl.match(/\/(?:products|collections)\/([^/?]+)/);
            const handle = handleMatch ? handleMatch[1] : '';
            const type = sourceUrl.includes('/collections/') ? 'collection' : 'product';
            
            compatibleItems.push({
              handle,
              title,
              image,
              sourceUrl,
              type
            });
          }
        });
      }
      
      extractedContent['compatible-container'] = {
        title,
        compatibleItems
      };
    }

    // Extract Videos content
    const videosMatch = cleanHtml.match(/<div[^>]*data-section="videos"[^>]*>([\s\S]*?)<\/div>/);
    if (videosMatch) {
      const videoContent = videosMatch[1];
      
      const titleMatch = videoContent.match(/<h2[^>]*>(.*?)<\/h2>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '') : 'Videos';
      
      // Extract embedded videos
      const videos: Array<{title: string, url: string, embedCode?: string}> = [];
      const iframeMatches = videoContent.match(/<iframe[^>]*src="([^"]*)"[^>]*><\/iframe>/g);
      
      if (iframeMatches) {
        iframeMatches.forEach(iframe => {
          const srcMatch = iframe.match(/src="([^"]*)"/);
          if (srcMatch) {
            videos.push({
              title: 'Video',
              url: srcMatch[1],
              embedCode: iframe
            });
          }
        });
      }
      
      extractedContent.videos = {
        title,
        videos
      };
    }

    // Extract Documentation content
    const documentationMatch = cleanHtml.match(/<div[^>]*data-section="documentation"[^>]*>([\s\S]*?)<\/div>/);
    if (documentationMatch) {
      const docContent = documentationMatch[1];
      
      const titleMatch = docContent.match(/<h2[^>]*>(.*?)<\/h2>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '') : 'Documentation';
      
      // Extract document links
      const documents: Array<{title: string, url: string, description?: string}> = [];
      const linkMatches = docContent.match(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g);
      
      if (linkMatches) {
        linkMatches.forEach(link => {
          const hrefMatch = link.match(/href="([^"]*)"/);
          const textMatch = link.match(/>([^<]*)</);
          
          if (hrefMatch && textMatch) {
            documents.push({
              title: textMatch[1].trim(),
              url: hrefMatch[1],
              description: ''
            });
          }
        });
      }
      
      extractedContent.documentation = {
        title,
        documents
      };
    }

    // Extract Safety Guidelines content
    const safetyMatch = cleanHtml.match(/<div[^>]*(?:data-section="safety-guidelines"|id="safety-guidelines")[^>]*>([\s\S]*?)<\/div>/) ||
                       cleanHtml.match(/<div[^>]*class="tab-content[^"]*"[^>]*id="safety-guidelines"[^>]*>([\s\S]*?)<\/div>/);
    if (safetyMatch) {
      const safetyContent = safetyMatch[1];
      
      // Extract guidelines from list items
      const listMatches = safetyContent.match(/<li[^>]*>(.*?)<\/li>/g);
      const guidelines = listMatches ? listMatches.map(li => {
        const cleanText = li.replace(/<span[^>]*style="[^"]*"[^>]*>([^<]*)<\/span>/g, '$1')
                           .replace(/<[^>]*>/g, '').trim();
        return cleanText;
      }).filter(g => g) : [];
      
      extractedContent['safety-guidelines'] = {
        guidelines
      };
    }

    // Extract Sterilization Method content
    const sterilizationMatch = cleanHtml.match(/<div[^>]*(?:data-section="sterilization-method"|id="sterilization-method")[^>]*>([\s\S]*?)<\/div>/) ||
                              cleanHtml.match(/<div[^>]*class="tab-content[^"]*"[^>]*id="sterilization-method"[^>]*>([\s\S]*?)<\/div>/);
    if (sterilizationMatch) {
      const sterilizationContent = sterilizationMatch[1];
      
      // Extract title if present
      const titleMatch = sterilizationContent.match(/<h3[^>]*>(.*?)<\/h3>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      
      // Extract methods from list items
      const listMatches = sterilizationContent.match(/<li[^>]*>(.*?)<\/li>/g);
      const methods = listMatches ? listMatches.map(li => {
        const cleanText = li.replace(/<span[^>]*style="[^"]*"[^>]*>([^<]*)<\/span>/g, '$1')
                           .replace(/<[^>]*>/g, '').trim();
        return cleanText;
      }).filter(m => m) : [];
      
      extractedContent['sterilization-method'] = {
        title,
        methods
      };
    }

    console.log('✅ Content extraction completed. Found sections:', Object.keys(extractedContent));
    return extractedContent;

  } catch (error) {
    console.error('Content extraction error:', error);
    return extractedContent;
  }
}