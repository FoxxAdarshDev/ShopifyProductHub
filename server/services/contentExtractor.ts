interface ExtractedContent {
  [key: string]: any;
}

/**
 * Extracts structured content from Shopify product HTML descriptions
 * This function parses existing HTML content and converts it back to form data
 */
export function extractContentFromHtml(html: string): ExtractedContent {
  console.log('🔍 EXTRACTION FUNCTION CALLED - Inside function now');
  const extractedContent: ExtractedContent = {};
  
  if (!html) {
    console.log('❌ No HTML provided to extract');
    return extractedContent;
  }
  
  console.log('🧪 Starting extraction with HTML length:', html.length);
  
  try {
    // Test basic extraction first - just get any paragraph text
    const allParagraphs = html.match(/<p[^>]*>(.*?)<\/p>/g);
    console.log('📄 All paragraphs found:', allParagraphs ? allParagraphs.length : 0);
    
    if (allParagraphs && allParagraphs.length > 0) {
      // If we find paragraphs, create a basic description
      const textContent = allParagraphs.map(p => p.replace(/<[^>]*>/g, '').trim()).join('\n\n');
      console.log('📝 Extracted text content preview:', textContent.substring(0, 100) + '...');
      
      extractedContent.description = {
        title: '',
        description: textContent,
        logos: []
      };
      console.log('✅ Description created successfully');
    }
    
    // Test basic list extraction
    const allListItems = html.match(/<li[^>]*>(.*?)<\/li>/g);
    console.log('📋 All list items found:', allListItems ? allListItems.length : 0);
    
    if (allListItems && allListItems.length > 0) {
      const features = allListItems.map(li => li.replace(/<[^>]*>/g, '').trim()).filter(f => f);
      console.log('🎯 Extracted features count:', features.length);
      
      if (features.length > 0) {
        extractedContent.features = {
          features
        };
        console.log('✅ Features created successfully');
      }
    }
    
    // Try to extract structured content from our template format
    
    // Extract description content - look for description div
    const descDiv = html.match(/<div[^>]*id="description"[^>]*>([\s\S]*?)<\/div>/);
    console.log('🔍 Description div search result:', descDiv ? 'FOUND' : 'NOT FOUND');
    if (descDiv && descDiv[1]) {
      console.log('📄 Found description div with structured content');
      console.log('📄 Description div content preview:', descDiv[1].substring(0, 200) + '...');
      
      // Extract H2 heading if present
      const h2Match = descDiv[1].match(/<h2[^>]*>(.*?)<\/h2>/);
      const title = h2Match ? h2Match[1].replace(/<[^>]*>/g, '').trim() : '';
      console.log('📄 H2 heading found:', title || 'None');
      
      // Extract paragraphs
      const paragraphs = descDiv[1].match(/<p[^>]*>(.*?)<\/p>/g);
      console.log('📄 Paragraphs in description div:', paragraphs ? paragraphs.length : 0);
      const textContent = paragraphs ? paragraphs.map(p => p.replace(/<[^>]*>/g, '').trim()).join('\n\n') : '';
      
      // Extract logo grid images
      const logoMatches = descDiv[1].match(/<img[^>]*src="([^"]*)"[^>]*>/g);
      const logos = logoMatches ? logoMatches.map(img => {
        const srcMatch = img.match(/src="([^"]*)"/);
        const altMatch = img.match(/alt="([^"]*)"/);
        return {
          url: srcMatch ? srcMatch[1] : '',
          alt: altMatch ? altMatch[1] : ''
        };
      }) : [];
      console.log('📄 Logo images found:', logos.length);
      
      if (textContent || title || logos.length > 0) {
        extractedContent.description = {
          title: title,
          description: textContent,
          logos: logos
        };
        console.log('✅ Enhanced description extracted with title, text, and logos');
      }
    }

    // Extract features content - look for features div
    const featDiv = html.match(/<div[^>]*id="features"[^>]*>([\s\S]*?)<\/div>/);
    console.log('🔍 Features div search result:', featDiv ? 'FOUND' : 'NOT FOUND');
    if (featDiv && featDiv[1]) {
      console.log('🎯 Found features div with structured content');
      console.log('🎯 Features div content preview:', featDiv[1].substring(0, 200) + '...');
      const listItems = featDiv[1].match(/<li[^>]*>(.*?)<\/li>/g);
      console.log('🎯 List items in features div:', listItems ? listItems.length : 0);
      if (listItems && listItems.length > 0) {
        const features = listItems.map(li => {
          const cleaned = li.replace(/<span[^>]*style="[^"]*"[^>]*>/g, '')
                   .replace(/<\/span>/g, '')
                   .replace(/<[^>]*>/g, '')
                   .trim();
          console.log('🎯 Cleaned feature:', cleaned);
          return cleaned;
        }).filter(f => f);
        
        console.log('🎯 Final features array:', features);
        if (features.length > 0) {
          extractedContent.features = {
            features
          };
          console.log('✅ Structured features extracted');
        }
      }
    }

    // Extract applications content
    const appDiv = html.match(/<div[^>]*id="applications"[^>]*>([\s\S]*?)<\/div>/);
    console.log('🔍 Applications div search result:', appDiv ? 'FOUND' : 'NOT FOUND');
    if (appDiv && appDiv[1]) {
      console.log('🚀 Found applications div with structured content');
      console.log('🚀 Applications div content preview:', appDiv[1].substring(0, 200) + '...');
      const listItems = appDiv[1].match(/<li[^>]*>(.*?)<\/li>/g);
      console.log('🚀 Applications list items found:', listItems ? listItems.length : 0);
      if (listItems && listItems.length > 0) {
        const applications = listItems.map(li => li.replace(/<[^>]*>/g, '').trim()).filter(a => a);
        if (applications.length > 0) {
          extractedContent.applications = {
            applications
          };
          console.log('✅ Structured applications extracted');
        }
      }
    }

    // Extract specifications content
    const specDiv = html.match(/<div[^>]*id="specifications"[^>]*>([\s\S]*?)<\/div>/);
    console.log('🔍 Specifications div search result:', specDiv ? 'FOUND' : 'NOT FOUND');
    if (specDiv && specDiv[1]) {
      console.log('📊 Found specifications div with structured content');
      console.log('📊 Specifications div content preview:', specDiv[1].substring(0, 200) + '...');
      const rowMatches = specDiv[1].match(/<tr[^>]*>(.*?)<\/tr>/g);
      console.log('📊 Table rows found:', rowMatches ? rowMatches.length : 0);
      if (rowMatches && rowMatches.length > 0) {
        const specifications: Array<{item: string, value: string}> = [];
        
        // Skip header row (ITEM/VALUE)
        rowMatches.slice(1).forEach(row => {
          const cellMatches = row.match(/<td[^>]*>(.*?)<\/td>/g);
          if (cellMatches && cellMatches.length >= 2) {
            const item = cellMatches[0].replace(/<[^>]*>/g, '').trim();
            const value = cellMatches[1].replace(/<[^>]*>/g, '').trim();
            console.log('📊 Spec row:', item, '=', value);
            if (item && value && item !== 'ITEM' && value !== 'VALUE') {
              specifications.push({ item, value });
            }
          }
        });
        
        console.log('📊 Final specifications array:', specifications.length, 'items');
        if (specifications.length > 0) {
          extractedContent.specifications = {
            specifications
          };
          console.log('✅ Structured specifications extracted');
        }
      }
    }

    // Extract compatible container content
    const compatDiv = html.match(/<div[^>]*id="compatible-container"[^>]*>([\s\S]*?)<\/div>/);
    console.log('🔍 Compatible Container div search result:', compatDiv ? 'FOUND' : 'NOT FOUND');
    if (compatDiv && compatDiv[1]) {
      console.log('🔗 Found compatible container div with structured content');
      console.log('🔗 Compatible container div content preview:', compatDiv[1].substring(0, 200) + '...');
      
      // Extract container items
      const containerItems: Array<{title: string, url: string, image: string, description: string}> = [];
      const itemDivs = compatDiv[1].match(/<div[^>]*class="[^"]*compatible-item[^"]*"[^>]*>([\s\S]*?)<\/div>/g);
      console.log('🔗 Container items found:', itemDivs ? itemDivs.length : 0);
      
      if (itemDivs) {
        itemDivs.forEach((itemDiv, index) => {
          console.log(`🔗 Processing container item ${index + 1}:`, itemDiv.substring(0, 100) + '...');
          const titleMatch = itemDiv.match(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/);
          const imgMatch = itemDiv.match(/<img[^>]*src="([^"]*)"[^>]*>/);
          const descMatch = itemDiv.match(/<p[^>]*>(.*?)<\/p>/);
          
          if (titleMatch) {
            const item = {
              title: titleMatch[2].replace(/<[^>]*>/g, '').trim(),
              url: titleMatch[1],
              image: imgMatch ? imgMatch[1] : '',
              description: descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : ''
            };
            console.log('🔗 Extracted container item:', item.title);
            containerItems.push(item);
          } else {
            console.log('🔗 No title match found for item', index + 1);
          }
        });
      }
      
      if (containerItems.length > 0) {
        extractedContent['compatible-container'] = {
          compatibleItems: containerItems
        };
        console.log('✅ Compatible container extracted');
      }
    }

    // Extract documentation content
    const docDiv = html.match(/<div[^>]*id="documentation"[^>]*>([\s\S]*?)<\/div>/);
    console.log('🔍 Documentation div search result:', docDiv ? 'FOUND' : 'NOT FOUND');
    if (docDiv && docDiv[1]) {
      console.log('📚 Found documentation div with structured content');
      console.log('📚 Documentation div content preview:', docDiv[1].substring(0, 200) + '...');
      
      const datasheets: Array<{title: string, url: string}> = [];
      const linkMatches = docDiv[1].match(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g);
      console.log('📚 Documentation links found:', linkMatches ? linkMatches.length : 0);
      
      if (linkMatches) {
        linkMatches.forEach(link => {
          const hrefMatch = link.match(/href="([^"]*)"/);
          const textMatch = link.match(/>([^<]*)</);
          if (hrefMatch && textMatch) {
            const url = hrefMatch[1];
            const title = textMatch[1].trim();
            // Skip the default datasheet link
            if (!url.includes('product-data-sheets')) {
              console.log('📚 Extracted documentation link:', title);
              datasheets.push({ title, url });
            }
          }
        });
      }
      
      if (datasheets.length > 0) {
        extractedContent.documentation = {
          datasheets
        };
        console.log('✅ Documentation extracted');
      }
    }

    // Extract videos content
    const videoDiv = html.match(/<div[^>]*id="videos"[^>]*>([\s\S]*?)<\/div>/);
    console.log('🔍 Videos div search result:', videoDiv ? 'FOUND' : 'NOT FOUND');
    if (videoDiv && videoDiv[1]) {
      console.log('🎬 Found videos div with structured content');
      console.log('🎬 Videos div content preview:', videoDiv[1].substring(0, 200) + '...');
      
      const videos: Array<{url: string, title: string}> = [];
      const iframeMatches = videoDiv[1].match(/<iframe[^>]*src="([^"]*)"[^>]*><\/iframe>/g);
      console.log('🎬 Video iframes found:', iframeMatches ? iframeMatches.length : 0);
      
      if (iframeMatches) {
        iframeMatches.forEach(iframe => {
          const srcMatch = iframe.match(/src="([^"]*)"/);
          if (srcMatch) {
            const url = srcMatch[1];
            console.log('🎬 Extracted video URL:', url);
            videos.push({ url, title: 'Product Video' });
          }
        });
      }
      
      if (videos.length > 0) {
        extractedContent.videos = {
          videos
        };
        console.log('✅ Videos extracted');
      }
    }

    console.log('🎉 Final extraction result keys:', Object.keys(extractedContent));
    return extractedContent;
    
  } catch (error) {
    console.error('❌ Content extraction error:', error);
    return extractedContent;
  }
}