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
      const paragraphs = descDiv[1].match(/<p[^>]*>(.*?)<\/p>/g);
      console.log('📄 Paragraphs in description div:', paragraphs ? paragraphs.length : 0);
      if (paragraphs && paragraphs.length > 0) {
        const textContent = paragraphs.map(p => p.replace(/<[^>]*>/g, '').trim()).join('\n\n');
        console.log('📄 Extracted description text:', textContent.substring(0, 100) + '...');
        extractedContent.description = {
          title: '',
          description: textContent,
          logos: []
        };
        console.log('✅ Structured description extracted');
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
    if (appDiv && appDiv[1]) {
      console.log('🚀 Found applications div with structured content');
      const listItems = appDiv[1].match(/<li[^>]*>(.*?)<\/li>/g);
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
    if (specDiv && specDiv[1]) {
      console.log('📊 Found specifications div with structured content');
      const rowMatches = specDiv[1].match(/<tr[^>]*>(.*?)<\/tr>/g);
      if (rowMatches && rowMatches.length > 0) {
        const specifications: Array<{item: string, value: string}> = [];
        
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
        
        if (specifications.length > 0) {
          extractedContent.specifications = {
            specifications
          };
          console.log('✅ Structured specifications extracted');
        }
      }
    }

    console.log('🎉 Final extraction result keys:', Object.keys(extractedContent));
    return extractedContent;
    
  } catch (error) {
    console.error('❌ Content extraction error:', error);
    return extractedContent;
  }
}