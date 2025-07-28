interface ExtractedContent {
  [key: string]: any;
}

/**
 * Extracts structured content from Shopify product HTML descriptions
 * This function parses existing HTML content and converts it back to form data
 */
export function extractContentFromHtml(html: string): ExtractedContent {
  const extractedContent: ExtractedContent = {};

  if (!html) return extractedContent;

  try {
    // Remove extra whitespace and normalize the HTML
    const cleanHtml = html.replace(/\s+/g, ' ').trim();

    // Extract Description content
    const descriptionMatch = cleanHtml.match(/<div[^>]*data-section="description"[^>]*>([\s\S]*?)<\/div>/);
    if (descriptionMatch) {
      const descContent = descriptionMatch[1];
      
      // Extract title
      const titleMatch = descContent.match(/<h2[^>]*>(.*?)<\/h2>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '') : '';
      
      // Extract paragraphs
      const paragraphMatches = descContent.match(/<p[^>]*>(.*?)<\/p>/g);
      const paragraphs = paragraphMatches ? paragraphMatches.map(p => p.replace(/<[^>]*>/g, '').trim()).filter(p => p) : [];
      
      // Extract logo grid
      const logoMatches = descContent.match(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/g);
      const logoGrid = logoMatches ? logoMatches.map(img => {
        const srcMatch = img.match(/src="([^"]*)"/);
        const altMatch = img.match(/alt="([^"]*)"/);
        return {
          url: srcMatch ? srcMatch[1] : '',
          altText: altMatch ? altMatch[1] : '',
          name: altMatch ? altMatch[1] : 'Logo'
        };
      }) : [];
      
      extractedContent.description = {
        title,
        paragraphs,
        logoGrid
      };
    }

    // Extract Features content
    const featuresMatch = cleanHtml.match(/<div[^>]*data-section="features"[^>]*>([\s\S]*?)<\/div>/);
    if (featuresMatch) {
      const featuresContent = featuresMatch[1];
      
      const titleMatch = featuresContent.match(/<h2[^>]*>(.*?)<\/h2>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '') : 'Features';
      
      // Extract bullet points from ul/li or any list structure
      const listMatches = featuresContent.match(/<li[^>]*>(.*?)<\/li>/g);
      const features = listMatches ? listMatches.map(li => li.replace(/<[^>]*>/g, '').trim()).filter(f => f) : [];
      
      extractedContent.features = {
        title,
        features
      };
    }

    // Extract Applications content
    const applicationsMatch = cleanHtml.match(/<div[^>]*data-section="applications"[^>]*>([\s\S]*?)<\/div>/);
    if (applicationsMatch) {
      const appContent = applicationsMatch[1];
      
      const titleMatch = appContent.match(/<h2[^>]*>(.*?)<\/h2>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '') : 'Applications';
      
      const listMatches = appContent.match(/<li[^>]*>(.*?)<\/li>/g);
      const applications = listMatches ? listMatches.map(li => li.replace(/<[^>]*>/g, '').trim()).filter(a => a) : [];
      
      extractedContent.applications = {
        title,
        applications
      };
    }

    // Extract Specifications content
    const specificationsMatch = cleanHtml.match(/<div[^>]*data-section="specifications"[^>]*>([\s\S]*?)<\/div>/);
    if (specificationsMatch) {
      const specContent = specificationsMatch[1];
      
      const titleMatch = specContent.match(/<h2[^>]*>(.*?)<\/h2>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '') : 'Specifications';
      
      // Extract table data
      const specifications: Array<{parameter: string, value: string}> = [];
      const rowMatches = specContent.match(/<tr[^>]*>(.*?)<\/tr>/g);
      
      if (rowMatches) {
        rowMatches.forEach(row => {
          const cellMatches = row.match(/<td[^>]*>(.*?)<\/td>/g);
          if (cellMatches && cellMatches.length >= 2) {
            const parameter = cellMatches[0].replace(/<[^>]*>/g, '').trim();
            const value = cellMatches[1].replace(/<[^>]*>/g, '').trim();
            if (parameter && value) {
              specifications.push({ parameter, value });
            }
          }
        });
      }
      
      extractedContent.specifications = {
        title,
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
    const safetyMatch = cleanHtml.match(/<div[^>]*data-section="safety-guidelines"[^>]*>([\s\S]*?)<\/div>/);
    if (safetyMatch) {
      const safetyContent = safetyMatch[1];
      
      const titleMatch = safetyContent.match(/<h2[^>]*>(.*?)<\/h2>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '') : 'Safety Guidelines';
      
      // Extract guidelines
      const guidelines: Array<{title: string, description: string}> = [];
      const itemMatches = safetyContent.match(/<div[^>]*class="[^"]*safety-item[^"]*"[^>]*>(.*?)<\/div>/g);
      
      if (itemMatches) {
        itemMatches.forEach(item => {
          const titleMatch = item.match(/<h3[^>]*>(.*?)<\/h3>/);
          const descMatch = item.match(/<p[^>]*>(.*?)<\/p>/);
          
          if (titleMatch) {
            guidelines.push({
              title: titleMatch[1].replace(/<[^>]*>/g, '').trim(),
              description: descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : ''
            });
          }
        });
      }
      
      extractedContent['safety-guidelines'] = {
        title,
        guidelines
      };
    }

    console.log('✅ Content extraction completed. Found sections:', Object.keys(extractedContent));
    return extractedContent;

  } catch (error) {
    console.error('Content extraction error:', error);
    return extractedContent;
  }
}