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
    console.log('🚀 ENTERING TRY BLOCK - Extraction starting');
    
    // NOTE: Skip basic extraction for description since we want structured extraction only
    // The structured extraction below will handle description content properly
    
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
    
    // Extract description content - FORCED EXTRACTION WITH LOGO FOCUS
    console.log('🔍 ===== STARTING FORCED DESCRIPTION DIV EXTRACTION =====');
    console.log('🔍 HTML contains id="description":', html.includes('id="description"'));
    console.log('🔍 HTML contains tab-content:', html.includes('tab-content'));
    console.log('🔍 HTML contains logo-grid:', html.includes('logo-grid'));
    
    // Force extract with direct search for the description content
    // Since we know the H2 and text are being extracted, let's find where that's happening
    const h2InHtml = html.includes('VersaCap® 38-430 with 3×');
    const logoInHtml = html.includes('class_vi_web_large.png');
    console.log('🔍 HTML contains expected H2:', h2InHtml);
    console.log('🔍 HTML contains expected logo URL:', logoInHtml);
    
    // Try pattern 1: Original complex pattern (class first, then id)
    let descDiv = html.match(/<div[^>]*class="[^"]*tab-content[^"]*"[^>]*id="description"[^>]*>([\s\S]*?)<\/div>/);
    console.log('🔍 Pattern 1 (class-first) result:', descDiv ? 'FOUND' : 'NOT FOUND');
    
    // Try pattern 2: Reverse order (id first, then class)  
    if (!descDiv) {
      console.log('🔍 Trying pattern 2 (id-first)...');
      descDiv = html.match(/<div[^>]*id="description"[^>]*class="[^"]*tab-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      console.log('🔍 Pattern 2 (id-first) result:', descDiv ? 'FOUND' : 'NOT FOUND');
    }
    
    // Try pattern 3: Simple id-only pattern
    if (!descDiv) {
      console.log('🔍 Trying pattern 3 (id-only)...');
      descDiv = html.match(/<div[^>]*id="description"[^>]*>([\s\S]*?)<\/div>/);
      console.log('🔍 Pattern 3 (id-only) result:', descDiv ? 'FOUND' : 'NOT FOUND');
    }
    
    // FORCE EXTRACTION: If patterns fail, search for logo-grid directly
    if (!descDiv && html.includes('logo-grid')) {
      console.log('🔍 FORCING logo extraction from full HTML since div pattern failed...');
      const logoGridMatch = html.match(/<div[^>]*class="logo-grid"[^>]*>([\s\S]*?)<\/div>/);
      if (logoGridMatch) {
        console.log('🔍 Found logo-grid directly in HTML - forcing description creation');
        // Create a forced description extraction
        descDiv = ['', html]; // Use full HTML as content for extraction, with empty first element
      }
    }
    
    console.log('🔍 Final descDiv status:', descDiv ? 'FOUND' : 'NOT FOUND');
    
    if (descDiv && descDiv[1]) {
      console.log('📄 Found description div with structured content');
      console.log('📄 Description div content preview:', descDiv[1].substring(0, 200) + '...');
      console.log('📄 Full description div content length:', descDiv[1].length);
      
      // Extract H2 heading if present
      const h2Match = descDiv[1].match(/<h2[^>]*>(.*?)<\/h2>/);
      const h2Heading = h2Match ? h2Match[1].replace(/<[^>]*>/g, '').trim() : '';
      console.log('📄 H2 heading found:', h2Heading || 'None');
      
      // Extract paragraphs
      const paragraphs = descDiv[1].match(/<p[^>]*>(.*?)<\/p>/g);
      console.log('📄 Paragraphs in description div:', paragraphs ? paragraphs.length : 0);
      const description = paragraphs ? paragraphs.map(p => p.replace(/<[^>]*>/g, '').trim()).join('\n\n') : '';
      
      // Extract logo grid images from the logo-grid div
      const logoGridMatch = descDiv[1].match(/<div[^>]*class="logo-grid"[^>]*>([\s\S]*?)<\/div>/);
      console.log('📄 Logo grid div found:', logoGridMatch ? 'YES' : 'NO');
      if (logoGridMatch) {
        console.log('📄 Logo grid content:', logoGridMatch[1]);
        console.log('📄 Logo grid raw content length:', logoGridMatch[1].length);
      }
      
      let logos: Array<{url: string, alt: string}> = [];
      if (logoGridMatch && logoGridMatch[1]) {
        const logoContent = logoGridMatch[1];
        console.log('📄 Searching for img tags in logo content...');
        const imgMatches = logoContent.match(/<img[^>]*>/g);
        console.log('📄 Raw img tags found:', imgMatches ? imgMatches.length : 0);
        if (imgMatches) {
          imgMatches.forEach((img, index) => {
            console.log(`📄 Processing img tag ${index + 1}:`, img);
            const srcMatch = img.match(/src="([^"]*)"/);
            const altMatch = img.match(/alt="([^"]*)"/);
            if (srcMatch) {
              const logoObj = {
                url: srcMatch[1],
                alt: altMatch ? altMatch[1] : ''
              };
              logos.push(logoObj);
              console.log('📄 Successfully extracted logo:', logoObj);
            } else {
              console.log('📄 No src found in img tag:', img);
            }
          });
        } else {
          console.log('📄 No img tags found in logo grid content');
        }
      }
      console.log('📄 Final logo images found:', logos.length);
      if (logos.length > 0) {
        console.log('📄 Final logo details:', logos);
      }
      
      if (description || h2Heading || logos.length > 0) {
        extractedContent.description = {
          h2Heading: h2Heading, // Use h2Heading to match form field
          description: description, // Use description to match form field
          logos: logos
        };
        console.log('✅ Enhanced description extracted with h2Heading, description, and logos');
        console.log('📄 Final description object:', { h2Heading, descriptionLength: description.length, logoCount: logos.length });
      } else {
        console.log('❌ No description content extracted - h2Heading, description, and logos all empty');
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
        
        // Extract title from h4 tag
        const titleMatch = itemHtml.match(/<h4[^>]*class="[^"]*compatible-item-title[^"]*"[^>]*>(.*?)<\/h4>/);
        
        // Extract URL from the link
        const linkMatch = itemHtml.match(/<a[^>]*href="([^"]*)"[^>]*class="[^"]*compatible-item-link[^"]*"[^>]*>/);
        
        console.log('🔗 Image match:', imgMatch ? 'FOUND' : 'NOT FOUND');
        console.log('🔗 Title match:', titleMatch ? 'FOUND' : 'NOT FOUND');
        console.log('🔗 Link match:', linkMatch ? 'FOUND' : 'NOT FOUND');
        
        if (titleMatch) {
          // Extract product handle/description from title (since there's no separate description field)
          const title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
          
          const item = {
            title: title,
            url: linkMatch ? linkMatch[1] : '',
            image: imgMatch ? imgMatch[1] : '',
            description: title, // Use title as description since no separate description exists
            sourceUrl: linkMatch ? linkMatch[1] : '',
            handle: title, // Use title as handle
            type: 'product'
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
    // Try multiple patterns since class and id order can vary
    let docDiv = html.match(/<div[^>]*id="documentation"[^>]*class="[^"]*tab-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    if (!docDiv) {
      // Try pattern with class first, then id
      docDiv = html.match(/<div[^>]*class="[^"]*tab-content[^"]*"[^>]*id="documentation"[^>]*>([\s\S]*?)<\/div>/);
    }
    if (!docDiv) {
      // Try simple id-only pattern
      docDiv = html.match(/<div[^>]*id="documentation"[^>]*>([\s\S]*?)<\/div>/);
    }
    console.log('🔍 Documentation div search result:', docDiv ? 'FOUND' : 'NOT FOUND');
    if (docDiv && docDiv[1]) {
      console.log('📚 Found documentation div with structured content');
      console.log('📚 Documentation div content preview:', docDiv[1].substring(0, 200) + '...');
      console.log('📚 Full documentation content:', docDiv[1]);
      
      let datasheetTitle = '';
      let datasheetUrl = '';
      
      // Look for documentation-link-card structure first
      const cardMatches = docDiv[1].match(/<div[^>]*class="[^"]*documentation-link-card[^"]*"[^>]*>([\s\S]*?)<\/div>/g);
      console.log('📚 Documentation cards found:', cardMatches ? cardMatches.length : 0);
      
      if (cardMatches) {
        cardMatches.forEach((card, index) => {
          console.log(`📚 Processing card ${index + 1}:`, card.substring(0, 200) + '...');
          
          // Extract href from the card
          const hrefMatch = card.match(/<a[^>]*href="([^"]*)"[^>]*>/);
          
          // Extract title from doc-title span
          const titleMatch = card.match(/<span[^>]*class="[^"]*doc-title[^"]*"[^>]*>(.*?)<\/span>/);
          
          console.log('📚 Card href match:', hrefMatch ? hrefMatch[1] : 'NOT FOUND');
          console.log('📚 Card title match:', titleMatch ? titleMatch[1] : 'NOT FOUND');
          
          if (hrefMatch && titleMatch && !datasheetTitle) {
            const url = hrefMatch[1];
            const title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
            
            // Skip the default datasheet link but capture the first valid one
            if (!url.includes('product-data-sheets')) {
              console.log('📚 Extracted documentation from card:', title, 'URL:', url);
              datasheetTitle = title;
              datasheetUrl = url;
            }
          }
        });
      }
      
      // Fallback: try simple link extraction if no cards found
      if (!datasheetTitle) {
        console.log('📚 No cards found, trying simple link extraction...');
        const linkMatches = docDiv[1].match(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g);
        console.log('📚 Simple documentation links found:', linkMatches ? linkMatches.length : 0);
        
        if (linkMatches) {
          for (const link of linkMatches) {
            const hrefMatch = link.match(/href="([^"]*)"/);
            const textContent = link.replace(/<[^>]*>/g, '').trim();
            
            if (hrefMatch && textContent) {
              const url = hrefMatch[1];
              const title = textContent;
              // Skip the default datasheet link but capture the first valid one
              if (!url.includes('product-data-sheets')) {
                console.log('📚 Extracted simple documentation link:', title);
                datasheetTitle = title;
                datasheetUrl = url;
                break; // Take the first valid one
              }
            }
          }
        }
      }
      
      // Create documentation section with the extracted datasheet info
      if (datasheetTitle && datasheetUrl) {
        extractedContent.documentation = {
          datasheetTitle: datasheetTitle,
          datasheetUrl: datasheetUrl
        };
        console.log('✅ Documentation extracted with datasheet:', datasheetTitle);
        console.log('📚 Datasheet URL:', datasheetUrl);
      } else {
        console.log('✅ Documentation section extracted (no custom datasheet found)');
        extractedContent.documentation = {
          datasheetTitle: '',
          datasheetUrl: ''
        };
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

    // CRITICAL FIX: Force logo extraction if description exists but has empty logos
    if (extractedContent.description && extractedContent.description.logos && extractedContent.description.logos.length === 0) {
      console.log('🔧 CRITICAL FIX: Description found with empty logos, forcing logo extraction...');
      const logoGridMatch = html.match(/<div[^>]*class="logo-grid"[^>]*>([\s\S]*?)<\/div>/);
      console.log('🔧 Logo grid search result:', logoGridMatch ? 'FOUND' : 'NOT FOUND');
      
      if (logoGridMatch && logoGridMatch[1]) {
        console.log('🔧 Logo grid content found:', logoGridMatch[1]);
        const imgMatches = logoGridMatch[1].match(/<img[^>]*>/g);
        console.log('🔧 Img tags in logo grid:', imgMatches ? imgMatches.length : 0);
        
        if (imgMatches) {
          const logos: Array<{url: string, alt: string}> = [];
          imgMatches.forEach((img, index) => {
            console.log(`🔧 Processing logo ${index + 1}:`, img);
            const srcMatch = img.match(/src="([^"]*)"/);
            const altMatch = img.match(/alt="([^"]*)"/);
            if (srcMatch) {
              const logoObj = {
                url: srcMatch[1],
                alt: altMatch ? altMatch[1] : ''
              };
              logos.push(logoObj);
              console.log('🔧 Successfully extracted logo:', logoObj);
            }
          });
          
          if (logos.length > 0) {
            extractedContent.description.logos = logos;
            console.log('🔧 FIXED: Added', logos.length, 'logos to description');
          }
        }
      }
    }

    console.log('🎉 Final extraction result keys:', Object.keys(extractedContent));
    console.log('🎉 Additional tabs extracted:', Object.keys(extractedContent).filter(k => ['sku-nomenclature', 'safety-guidelines', 'sterilization-method'].includes(k)));
    console.log('🎉 Final description logos count:', extractedContent.description?.logos?.length || 0);
    return extractedContent;
    
  } catch (error) {
    console.error('❌ Content extraction error:', error);
    console.error('❌ Error stack:', (error as Error).stack);
    console.log('❌ Partial extraction result before error:', Object.keys(extractedContent));
    return extractedContent;
  }
}