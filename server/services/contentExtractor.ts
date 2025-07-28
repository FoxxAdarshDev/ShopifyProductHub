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
  
  // First, let's identify ALL tab-content divs in the HTML
  const allTabDivs = html.match(/<div[^>]*class="[^"]*tab-content[^"]*"[^>]*id="([^"]*)"[^>]*>/g);
  console.log('📋 ALL TAB DIVS FOUND:', allTabDivs ? allTabDivs.length : 0);
  if (allTabDivs) {
    allTabDivs.forEach((div, index) => {
      const idMatch = div.match(/id="([^"]*)"/);
      console.log(`📋 Tab ${index + 1}: ${idMatch ? idMatch[1] : 'NO ID'}`);
    });
  }
  
  // Check for specific tab types with simplified detection
  const tabTypes = ['description', 'features', 'applications', 'specification', 'videos', 'documentation', 'compatible-container', 'sku-nomenclature', 'safety-guidelines', 'sterilization-method'];
  tabTypes.forEach(tabType => {
    const hasTab = html.includes(`id="${tabType}"`);
    console.log(`🔍 Tab "${tabType}" present:`, hasTab ? 'YES' : 'NO');
  });
  
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

    // Extract compatible container content - More robust approach
    // First find the compatible container div opening tag
    const compatDivMatch = html.match(/<div[^>]*class="[^"]*tab-content[^"]*compatible-container[^"]*"[^>]*id="compatible-container"[^>]*>/);
    console.log('🔍 Compatible Container div search result:', compatDivMatch ? 'FOUND' : 'NOT FOUND');
    
    let compatContent = null;
    
    if (compatDivMatch) {
      const startPos = html.indexOf(compatDivMatch[0]) + compatDivMatch[0].length;
      console.log('🔗 Compatible container starts at position:', startPos);
      
      // Look for the next closing </div> that's at the same level (account for nested divs)
      let divCount = 1;
      let currentPos = startPos;
      let endPos = -1;
      
      while (divCount > 0 && currentPos < html.length) {
        const nextOpenDiv = html.indexOf('<div', currentPos);
        const nextCloseDiv = html.indexOf('</div>', currentPos);
        
        if (nextCloseDiv === -1) break;
        
        if (nextOpenDiv !== -1 && nextOpenDiv < nextCloseDiv) {
          // Found opening div before closing div
          divCount++;
          currentPos = nextOpenDiv + 4;
        } else {
          // Found closing div
          divCount--;
          currentPos = nextCloseDiv + 6;
          if (divCount === 0) {
            endPos = nextCloseDiv;
            break;
          }
        }
      }
      
      if (endPos > startPos) {
        compatContent = html.substring(startPos, endPos);
        console.log('🔗 Found compatible container with manual div matching, length:', compatContent.length);
      } else {
        console.log('🔗 Could not find matching closing div, trying fallback');
        // Fallback: try to capture everything until next major section or end
        const fallbackContent = html.substring(startPos, html.indexOf('</div></div>', startPos) + 11);
        if (fallbackContent.length > 100) {
          compatContent = fallbackContent;
          console.log('🔗 Using fallback content, length:', compatContent.length);
        }
      }
    }
    
    if (compatContent) {
      console.log('🔗 Found compatible container div with structured content');
      console.log('🔗 Compatible container div content preview:', compatContent.substring(0, 300) + '...');
      console.log('🔗 Full compatible container content length:', compatContent.length);
      console.log('🔗 Contains all 4 items?', (compatContent.match(/compatible-item/g) || []).length);
      
      // Extract title if present
      const titleMatch = compatContent.match(/<h3[^>]*>(.*?)<\/h3>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      console.log('🔗 Compatible container title found:', title || 'None');
      
      // Extract container items using a more robust pattern
      const containerItems: Array<{title: string, url: string, image: string, description: string}> = [];
      
      console.log('🔗 Looking for compatible items in content length:', compatContent.length);
      
      // NEW APPROACH: Extract complete compatible-item divs first, then parse each one
      // This pattern captures the entire div from opening to closing, accounting for nested divs
      const itemMatches = [];
      let searchPos = 0;
      
      while (true) {
        const startPattern = '<div class="compatible-item">';
        const startPos = compatContent.indexOf(startPattern, searchPos);
        if (startPos === -1) break;
        
        // Find the matching closing div by counting nested divs
        let divCount = 1;
        let currentPos = startPos + startPattern.length;
        let endPos = -1;
        
        while (divCount > 0 && currentPos < compatContent.length) {
          const nextOpenDiv = compatContent.indexOf('<div', currentPos);
          const nextCloseDiv = compatContent.indexOf('</div>', currentPos);
          
          if (nextCloseDiv === -1) break;
          
          if (nextOpenDiv !== -1 && nextOpenDiv < nextCloseDiv) {
            divCount++;
            currentPos = nextOpenDiv + 4;
          } else {
            divCount--;
            currentPos = nextCloseDiv + 6;
            if (divCount === 0) {
              endPos = nextCloseDiv + 6;
              break;
            }
          }
        }
        
        if (endPos > startPos) {
          const itemHtml = compatContent.substring(startPos, endPos);
          itemMatches.push(itemHtml);
          console.log(`🔗 Found complete item ${itemMatches.length}: ${itemHtml.length} chars`);
          searchPos = endPos;
        } else {
          break;
        }
      }
      
      console.log('🔗 Total compatible items extracted:', itemMatches.length);
      
      // Now parse each complete item div
      itemMatches.forEach((itemHtml, index) => {
        console.log(`🔗 Processing item ${index + 1}/${itemMatches.length}`);
        
        // Extract image
        const imgMatch = itemHtml.match(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/);
        
        // Extract title and URL from the link
        const linkMatch = itemHtml.match(/<a[^>]*href="([^"]*)"[^>]*class="[^"]*compatible-item-title[^"]*"[^>]*>(.*?)<\/a>/);
        
        // Extract description from the type div
        const typeMatch = itemHtml.match(/<div[^>]*class="[^"]*compatible-item-type[^"]*"[^>]*>Product:\s*(.*?)<\/div>/);
        
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
          
          console.log('🔗 Successfully extracted item:', item.title);
          console.log('🔗 Item URL:', item.url);
          console.log('🔗 Item image:', item.image ? item.image.substring(0, 50) + '...' : 'MISSING');
          console.log('🔗 Item description:', item.description || 'MISSING');
          
          containerItems.push(item);
        } else {
          console.log('🔗 Failed to extract link from item', index + 1);
        }
      });
      
      console.log('🔗 Final compatible container items:', containerItems.length);
      if (title || containerItems.length > 0) {
        extractedContent['compatible-container'] = {
          title: title,
          compatibleItems: containerItems
        };
        console.log('✅ Compatible container extracted successfully');
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

    // ====================== ADDITIONAL CONTENT TABS EXTRACTION ======================
    
    // Extract SKU Nomenclature content - look for tab-content with id="sku-nomenclature"
    const skuDiv = html.match(/<div[^>]*class="[^"]*tab-content[^"]*"[^>]*id="sku-nomenclature"[^>]*>([\s\S]*?)<\/div>/);
    console.log('🔍 SKU Nomenclature div search result:', skuDiv ? 'FOUND' : 'NOT FOUND');
    if (skuDiv && skuDiv[1]) {
      console.log('🏷️ Found SKU nomenclature div with structured content');
      console.log('🏷️ SKU nomenclature div content preview:', skuDiv[1].substring(0, 200) + '...');
      
      // Extract title (H3 heading)
      const titleMatch = skuDiv[1].match(/<h3[^>]*>(.*?)<\/h3>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      console.log('🏷️ SKU nomenclature title found:', title || 'None');
      
      // Extract main image if present
      const mainImageMatch = skuDiv[1].match(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/);
      const mainImage = mainImageMatch ? mainImageMatch[1] : '';
      console.log('🏷️ SKU nomenclature main image found:', mainImage || 'None');
      
      // Extract the table data for SKU breakdown
      const tableMatch = skuDiv[1].match(/<table[^>]*>([\s\S]*?)<\/table>/);
      const nomenclatureItems: Array<{position: string, description: string, options: string}> = [];
      
      if (tableMatch) {
        const rowMatches = tableMatch[1].match(/<tr[^>]*>[\s\S]*?<\/tr>/g);
        console.log('🏷️ SKU table rows found:', rowMatches ? rowMatches.length : 0);
        
        if (rowMatches && rowMatches.length > 1) { // Skip header row
          rowMatches.slice(1).forEach((row, index) => {
            console.log(`🏷️ Processing SKU row ${index + 2}:`, row.replace(/\s+/g, ' ').substring(0, 150) + '...');
            const cells = [];
            const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
            let cellMatch;
            while ((cellMatch = cellRegex.exec(row)) !== null) {
              cells.push(cellMatch[1].replace(/<[^>]*>/g, '').trim());
            }
            console.log('🏷️ Extracted SKU cells:', cells);
            
            if (cells.length >= 3) {
              const position = cells[0];
              const description = cells[1];
              const options = cells[2];
              console.log('🏷️ SKU nomenclature row:', position, '=', description, 'options:', options);
              if (position && description && position !== 'Position' && description !== 'Description') {
                nomenclatureItems.push({ position, description, options });
              }
            }
          });
        }
      }
      
      console.log('🏷️ Final SKU nomenclature array:', nomenclatureItems.length, 'items');
      if (title || mainImage || nomenclatureItems.length > 0) {
        extractedContent['sku-nomenclature'] = {
          title: title,
          mainImage: mainImage,
          nomenclatureItems
        };
        console.log('✅ SKU nomenclature extracted successfully');
      }
    }

    // Extract Safety Guidelines content - look for tab-content with id="safety-guidelines"
    const safetyDiv = html.match(/<div[^>]*class="[^"]*tab-content[^"]*"[^>]*id="safety-guidelines"[^>]*>([\s\S]*?)<\/div>/);
    console.log('🔍 Safety Guidelines div search result:', safetyDiv ? 'FOUND' : 'NOT FOUND');
    if (safetyDiv && safetyDiv[1]) {
      console.log('🛡️ Found safety guidelines div with structured content');
      console.log('🛡️ Safety guidelines div content preview:', safetyDiv[1].substring(0, 200) + '...');
      
      const listItems = safetyDiv[1].match(/<li[^>]*>(.*?)<\/li>/g);
      console.log('🛡️ Safety guidelines list items found:', listItems ? listItems.length : 0);
      
      if (listItems && listItems.length > 0) {
        const guidelines = listItems.map(li => {
          const cleaned = li.replace(/<span[^>]*style="[^"]*"[^>]*>/g, '')
                   .replace(/<\/span>/g, '')
                   .replace(/<[^>]*>/g, '')
                   .trim();
          console.log('🛡️ Cleaned safety guideline:', cleaned);
          return cleaned;
        }).filter(g => g);
        
        console.log('🛡️ Final safety guidelines array:', guidelines);
        if (guidelines.length > 0) {
          extractedContent['safety-guidelines'] = {
            guidelines
          };
          console.log('✅ Safety guidelines extracted successfully');
        }
      }
    }

    // Extract Sterilization Method content - look for tab-content with id="sterilization-method"
    const sterilDiv = html.match(/<div[^>]*class="[^"]*tab-content[^"]*"[^>]*id="sterilization-method"[^>]*>([\s\S]*?)<\/div>/);
    console.log('🔍 Sterilization Method div search result:', sterilDiv ? 'FOUND' : 'NOT FOUND');
    if (sterilDiv && sterilDiv[1]) {
      console.log('🧪 Found sterilization method div with structured content');
      console.log('🧪 Sterilization method div content preview:', sterilDiv[1].substring(0, 200) + '...');
      
      // Extract title (H3 heading)
      const titleMatch = sterilDiv[1].match(/<h3[^>]*>(.*?)<\/h3>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      console.log('🧪 Sterilization method title found:', title || 'None');
      
      const listItems = sterilDiv[1].match(/<li[^>]*>(.*?)<\/li>/g);
      console.log('🧪 Sterilization method list items found:', listItems ? listItems.length : 0);
      
      const methods = listItems ? listItems.map(li => {
        const cleaned = li.replace(/<span[^>]*style="[^"]*"[^>]*>/g, '')
                 .replace(/<\/span>/g, '')
                 .replace(/<[^>]*>/g, '')
                 .trim();
        console.log('🧪 Cleaned sterilization method:', cleaned);
        return cleaned;
      }).filter(m => m) : [];
      
      console.log('🧪 Final sterilization methods array:', methods);
      if (title || methods.length > 0) {
        extractedContent['sterilization-method'] = {
          title: title,
          methods
        };
        console.log('✅ Sterilization methods extracted successfully');
      }
    }

    console.log('🎉 Final extraction result keys:', Object.keys(extractedContent));
    console.log('🎉 Additional tabs extracted:', Object.keys(extractedContent).filter(k => ['sku-nomenclature', 'safety-guidelines', 'sterilization-method'].includes(k)));
    return extractedContent;
    
  } catch (error) {
    console.error('❌ Content extraction error:', error);
    return extractedContent;
  }
}