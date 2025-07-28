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
    
    // Extract description content - look for tab-content with id="description"
    const descDiv = html.match(/<div[^>]*class="[^"]*tab-content[^"]*"[^>]*id="description"[^>]*>([\s\S]*?)<\/div>/);
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
      
      // Extract logo grid images from the logo-grid div
      const logoGridMatch = descDiv[1].match(/<div[^>]*class="logo-grid"[^>]*>([\s\S]*?)<\/div>/);
      const logos = logoGridMatch ? logoGridMatch[1].match(/<img[^>]*src="([^"]*)"[^>]*>/g)?.map(img => {
        const srcMatch = img.match(/src="([^"]*)"/);
        const altMatch = img.match(/alt="([^"]*)"/);
        return {
          url: srcMatch ? srcMatch[1] : '',
          alt: altMatch ? altMatch[1] : ''
        };
      }) || [] : [];
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

    // Extract features content - look for tab-content with id="features"
    const featDiv = html.match(/<div[^>]*class="[^"]*tab-content[^"]*"[^>]*id="features"[^>]*>([\s\S]*?)<\/div>/);
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

    // Extract specifications content - look for tab-content with id="specification" 
    const specDiv = html.match(/<div[^>]*class="[^"]*tab-content[^"]*"[^>]*id="specification"[^>]*>([\s\S]*?)<\/div>/);
    console.log('🔍 Specifications div search result:', specDiv ? 'FOUND' : 'NOT FOUND');
    if (specDiv && specDiv[1]) {
      console.log('📊 Found specifications div with structured content');
      console.log('📊 Specifications div content preview:', specDiv[1].substring(0, 200) + '...');
      const tableMatch = specDiv[1].match(/<table[^>]*>([\s\S]*?)<\/table>/);
      let rowMatches = null;
      if (tableMatch) {
        rowMatches = tableMatch[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/g);
      }
      console.log('📊 Table rows found:', rowMatches ? rowMatches.length : 0);
      if (rowMatches && rowMatches.length > 0) {
        const specifications: Array<{item: string, value: string}> = [];
        
        // Skip header row (ITEM/VALUE) - process all rows after the first
        rowMatches.slice(1).forEach((row, index) => {
          console.log(`📊 Processing row ${index + 2}:`, row.replace(/\s+/g, ' ').substring(0, 150) + '...');
          const cells = [];
          // Extract cell content more robustly
          const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
          let cellMatch;
          while ((cellMatch = cellRegex.exec(row)) !== null) {
            cells.push(cellMatch[1].replace(/<[^>]*>/g, '').trim());
          }
          console.log('📊 Extracted cells:', cells);
          
          if (cells.length >= 2) {
            const item = cells[0];
            const value = cells[1];
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

    // Extract compatible container content - look for tab-content with id="compatible-container"
    const compatDiv = html.match(/<div[^>]*class="[^"]*tab-content[^"]*compatible-container[^"]*"[^>]*id="compatible-container"[^>]*>([\s\S]*?)<\/div>/);
    console.log('🔍 Compatible Container div search result:', compatDiv ? 'FOUND' : 'NOT FOUND');
    if (compatDiv && compatDiv[1]) {
      console.log('🔗 Found compatible container div with structured content');
      console.log('🔗 Compatible container div content preview:', compatDiv[1].substring(0, 200) + '...');
      
      // Extract container items
      const containerItems: Array<{title: string, url: string, image: string, description: string}> = [];
      // Simpler approach - split by compatible-item divs
      const itemDivs = [];
      const itemStartPattern = /<div[^>]*class="compatible-item"[^>]*>/g;
      let match;
      let lastIndex = 0;
      
      while ((match = itemStartPattern.exec(compatDiv[1])) !== null) {
        if (lastIndex > 0) {
          // Extract the previous item
          const itemContent = compatDiv[1].substring(lastIndex, match.index);
          itemDivs.push(itemContent);
        }
        lastIndex = match.index;
      }
      
      // Add the last item
      if (lastIndex > 0) {
        const remaining = compatDiv[1].substring(lastIndex);
        const itemEndMatch = remaining.match(/^[\s\S]*?(?=<\/div>\s*<\/div>|$)/);
        if (itemEndMatch) {
          itemDivs.push(itemEndMatch[0]);
        }
      }
      
      console.log('🔗 Extracted item divs using split method:', itemDivs.length);
      console.log('🔗 Container items found:', itemDivs ? itemDivs.length : 0);
      console.log('🔗 Full compatible container content length:', compatDiv[1].length);
      
      if (itemDivs) {
        itemDivs.forEach((itemDiv, index) => {
          console.log(`🔗 Processing container item ${index + 1}:`, itemDiv.substring(0, 200) + '...');
          
          // Extract image
          const imgMatch = itemDiv.match(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/);
          
          // Extract title and URL from the link
          const linkMatch = itemDiv.match(/<a[^>]*href="([^"]*)"[^>]*class="[^"]*compatible-item-title[^"]*"[^>]*>(.*?)<\/a>/);
          
          // Extract description from the type div
          const typeMatch = itemDiv.match(/<div[^>]*class="[^"]*compatible-item-type[^"]*"[^>]*>Product:\s*(.*?)<\/div>/);
          
          console.log('🔗 Image match:', imgMatch ? 'FOUND' : 'NOT FOUND');
          console.log('🔗 Link match:', linkMatch ? 'FOUND' : 'NOT FOUND');
          console.log('🔗 Type match:', typeMatch ? 'FOUND' : 'NOT FOUND');
          
          if (linkMatch) {
            const item = {
              title: linkMatch[2].replace(/<[^>]*>/g, '').trim(),
              url: linkMatch[1],
              image: imgMatch ? imgMatch[1] : '',
              description: typeMatch ? typeMatch[1].trim() : ''
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

    // Extract documentation content - look for tab-content with id="documentation"
    const docDiv = html.match(/<div[^>]*id="documentation"[^>]*class="[^"]*tab-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
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
      
      // Always create documentation section - include default link when no custom datasheets
      extractedContent.documentation = {
        datasheets: datasheets
      };
      if (datasheets.length > 0) {
        console.log('✅ Documentation extracted with custom datasheets');
      } else {
        console.log('✅ Documentation section extracted (default content only)');
      }
    }

    // Extract videos content - look for tab-content with id="videos" 
    const videoDiv = html.match(/<div[^>]*id="videos"[^>]*class="[^"]*tab-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
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
      
      // Always create videos section if the div exists (for default content)
      extractedContent.videos = {
        videos: videos
      };
      if (videos.length === 0) {
        console.log('✅ Videos section extracted (default content only)');
      } else {
        console.log('✅ Videos extracted with custom content');
      }
    }

    console.log('🎉 Final extraction result keys:', Object.keys(extractedContent));
    return extractedContent;
    
  } catch (error) {
    console.error('❌ Content extraction error:', error);
    return extractedContent;
  }
}