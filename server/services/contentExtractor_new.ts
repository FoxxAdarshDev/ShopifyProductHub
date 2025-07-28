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
  
  console.log('🧪 Testing basic functionality');
  
  // Test basic extraction first - just get any paragraph text
  const allParagraphs = html.match(/<p[^>]*>(.*?)<\/p>/g);
  console.log('📄 All paragraphs found:', allParagraphs ? allParagraphs.length : 0);
  
  if (allParagraphs && allParagraphs.length > 0) {
    // If we find paragraphs, create a basic description
    const textContent = allParagraphs.map(p => p.replace(/<[^>]*>/g, '').trim()).join('\n\n');
    console.log('📝 Extracted text content:', textContent.substring(0, 100) + '...');
    
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
    console.log('🎯 Extracted features:', features);
    
    extractedContent.features = {
      features
    };
    console.log('✅ Features created successfully');
  }
  
  console.log('🎉 Final result keys:', Object.keys(extractedContent));
  return extractedContent;
}