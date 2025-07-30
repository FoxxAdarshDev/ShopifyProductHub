// Test script to verify our enhanced HTML detection logic
const testHTML = `<div class="container" data-sku="AQG33024HT-5, AQG33024HT-25, AQG33024HT-100">
  <div class="tab-content active" id="description">
    <h2>Product Description</h2>
    <p>This is a test product</p>
  </div>
  <div class="tab-content" id="features">
    <ul>
      <li>Feature 1</li>
      <li>Feature 2</li>
    </ul>
  </div>
</div>`;

// Enhanced detection algorithm (matching our server code)
function detectNewLayoutFromHTML(html) {
  if (!html || html.trim() === '') {
    return { isNewLayout: false, contentCount: 0 };
  }

  // Primary detection: Look for data-sku attribute (most reliable indicator)
  const hasDataSkuAttributes = html.includes('data-sku=');
  
  // Secondary detection: Container class with our specific structure
  const hasContainerClass = html.includes('class="container"');
  
  // Tertiary detection: Tab structure indicators
  const hasTabContent = html.includes('tab-content');
  const hasTabIds = 
    html.includes('id="description"') || 
    html.includes('id="features"') || 
    html.includes('id="applications"') ||
    html.includes('id="specifications"');
  
  // Enhanced detection: Look for additional data attributes
  const hasDataSection = html.includes('data-section=');
  
  // Primary criteria: data-sku is the strongest indicator of our template
  const isNewLayout = hasDataSkuAttributes && (hasContainerClass || hasTabContent || hasTabIds || hasDataSection);

  // Count all possible content sections
  let contentCount = 0;
  if (html.includes('id="description"') || html.includes('data-section="description"')) contentCount++;
  if (html.includes('id="features"') || html.includes('data-section="features"')) contentCount++;
  if (html.includes('id="applications"') || html.includes('data-section="applications"')) contentCount++;
  if (html.includes('id="specifications"') || html.includes('data-section="specifications"')) contentCount++;
  if (html.includes('data-section="documentation"')) contentCount++;
  if (html.includes('data-section="videos"')) contentCount++;
  if (html.includes('data-section="safety-guidelines"')) contentCount++;
  if (html.includes('data-section="sterilization-method"')) contentCount++;
  if (html.includes('data-section="compatible-container"')) contentCount++;
  if (html.includes('data-section="sku-nomenclature"')) contentCount++;

  return { isNewLayout, contentCount };
}

// Test the detection
const result = detectNewLayoutFromHTML(testHTML);
console.log('Detection result:', result);
console.log('Expected: { isNewLayout: true, contentCount: 2 }');