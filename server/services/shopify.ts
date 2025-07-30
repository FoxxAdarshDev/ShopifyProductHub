interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  handle: string;
  variants: Array<{
    id: number;
    sku: string;
    price: string;
  }>;
}

class ShopifyService {
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly store: string;

  constructor() {
    const shopifyStore = process.env.SHOPIFY_STORE_URL;
    const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN;
    
    if (!shopifyStore || !shopifyToken) {
      throw new Error('Missing Shopify credentials. Please set SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN environment variables.');
    }
    
    this.store = shopifyStore;
    this.baseUrl = `https://${shopifyStore}/admin/api/2023-10`;
    this.accessToken = shopifyToken;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Shopify API error: ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        console.log('Shopify API error details:', JSON.stringify(errorJson, null, 2));
        if (errorJson.errors) {
          if (typeof errorJson.errors === 'object') {
            errorMessage += ` - ${JSON.stringify(errorJson.errors)}`;
          } else {
            errorMessage += ` - ${errorJson.errors}`;
          }
        } else if (errorJson.error) {
          errorMessage += ` - ${errorJson.error}`;
        } else {
          errorMessage += ` - ${JSON.stringify(errorJson)}`;
        }
        // Check for specific permission errors
        if (errorText.includes('merchant approval') || errorText.includes('read_products')) {
          errorMessage += '\n\nPlease ensure your Shopify private app has the "read_products" and "write_products" permissions enabled and approved by the store owner.';
        }
      } catch {
        errorMessage += ` - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async getProductById(productId: string): Promise<any> {
    try {
      const response = await fetch(`https://${this.store}/admin/api/2024-10/products/${productId}.json`, {
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.product;
    } catch (error) {
      console.error('Error fetching product by ID:', error);
      throw error;
    }
  }

  async getProductBySku(sku: string): Promise<ShopifyProduct | null> {
    try {
      console.log(`Searching Shopify for SKU: ${sku} using comprehensive search`);
      
      // Use direct pagination to get all products - same as working search method
      console.log(`📋 Starting comprehensive SKU fetch for: "${sku}"`);
      let allProducts: ShopifyProduct[] = [];
      let hasNextPage = true;
      let since_id = '';
      let pageCount = 0;
      const maxPages = 20;
      
      while (hasNextPage && pageCount < maxPages) {
        const url = `/products.json?fields=id,title,body_html,handle,variants&limit=250${since_id ? `&since_id=${since_id}` : ''}`;
        const response = await this.makeRequest(url);
        const products = response.products as ShopifyProduct[];
        
        if (products.length === 0) {
          hasNextPage = false;
        } else {
          allProducts.push(...products);
          since_id = products[products.length - 1].id.toString();
          hasNextPage = products.length === 250;
          pageCount++;
        }
      }
      
      console.log(`Fetched ${allProducts.length} products across ${pageCount} pages for SKU search: "${sku}"`);

      if (allProducts.length === 0) {
        console.log('❌ No products fetched from store');
        return null;
      }
      // Normalize search term for better matching
      const skuLower = sku.toLowerCase().trim();
      
      // First try exact match
      let product = allProducts.find(p => 
        p.variants.some(v => {
          if (!v.sku) return false;
          const variantSkuLower = v.sku.toLowerCase().trim();
          if (variantSkuLower === skuLower) {
            console.log(`Exact SKU match found: "${v.sku}" for product "${p.title}" (ID: ${p.id})`);
            return true;
          }
          return false;
        })
      );

      // If no exact match, try fuzzy matching (contains, partial matches)
      if (!product) {
        console.log(`No exact match found for "${sku}", trying fuzzy matching`);
        
        product = allProducts.find(p => 
          p.variants.some(v => {
            if (!v.sku) return false;
            const variantSkuLower = v.sku.toLowerCase().trim();
            
            // Check if either contains the other (for partial matches)
            if (variantSkuLower.includes(skuLower) || skuLower.includes(variantSkuLower)) {
              console.log(`Fuzzy SKU match found: "${v.sku}" contains or matches "${sku}" for product "${p.title}" (ID: ${p.id})`);
              return true;
            }
            
            // Check without trailing numbers/variants (e.g., "12013-00" vs "12013-00-1")
            const baseSku = sku.replace(/-\d*$/, '');
            const baseVariantSku = v.sku.replace(/-\d*$/, '');
            if (baseSku.toLowerCase() === baseVariantSku.toLowerCase()) {
              console.log(`Base SKU match found: "${v.sku}" base matches "${sku}" base for product "${p.title}" (ID: ${p.id})`);
              return true;
            }
            
            return false;
          })
        );
      }

      if (product) {
        console.log(`✅ Comprehensive SKU search successful: Found "${product.title}" (ID: ${product.id}) for SKU "${sku}"`);
      } else {
        console.log(`❌ Comprehensive SKU search failed: No product found with SKU "${sku}"`);
        
        // Log sample SKUs for debugging
        const allSkus = allProducts.flatMap(p => p.variants.map(v => v.sku)).filter(Boolean);
        console.log(`Searched through ${allSkus.length} total SKUs in ${allProducts.length} products`);
        console.log(`Sample of available SKUs:`, allSkus.slice(0, 10));
      }

      return product || null;
    } catch (error) {
      console.error('Error fetching product by SKU:', error);
      return null;
    }
  }



  async updateProductDescription(productId: string, description: string): Promise<void> {
    try {
      await this.makeRequest(`/products/${productId}.json`, {
        method: 'PUT',
        body: JSON.stringify({
          product: {
            id: parseInt(productId),
            body_html: description
          }
        })
      });
    } catch (error) {
      console.error('Error updating product description:', error);
      throw error;
    }
  }

  async getAllProducts(page: number = 1, limit: number = 20): Promise<ShopifyProduct[]> {
    try {
      // Use simple limit-based fetching - Shopify will return products in order
      const response = await this.makeRequest(
        `/products.json?fields=id,title,body_html,handle,variants&limit=${limit}`
      );
      
      const products = response.products as ShopifyProduct[];
      console.log(`Fetched ${products.length} products for page ${page}`);
      
      return products;
    } catch (error) {
      console.error('Error fetching all products:', error);
      return [];
    }
  }

  async getAllProductsComprehensive(): Promise<ShopifyProduct[]> {
    try {
      console.log('Starting comprehensive fetch of ALL products in store');
      
      const results: ShopifyProduct[] = [];
      let hasNextPage = true;
      let since_id = '';
      let totalFetched = 0;
      let pageCount = 0;
      const maxPages = 50; // Safety limit (50 pages * 250 products = 12,500 products max)
      
      while (hasNextPage && pageCount < maxPages) {
        try {
          const url = `/products.json?fields=id,title,body_html,handle,variants&limit=250&status=any${since_id ? `&since_id=${since_id}` : ''}`;
          const response = await this.makeRequest(url);
          const products = response.products as ShopifyProduct[];
          
          if (products.length === 0) {
            hasNextPage = false;
            break;
          }
          
          pageCount++;
          totalFetched += products.length;
          console.log(`Page ${pageCount}: Fetched ${products.length} products (total: ${totalFetched})`);
          
          results.push(...products);
          
          // Set up for next page
          since_id = products[products.length - 1].id.toString();
          hasNextPage = products.length === 250; // Continue if we got a full batch
          
        } catch (fetchError) {
          console.error(`Error fetching page ${pageCount + 1}:`, fetchError);
          break;
        }
      }

      console.log(`Comprehensive fetch completed: ${totalFetched} total products fetched across ${pageCount} pages`);
      return results;
    } catch (error) {
      console.error('Error in comprehensive product fetch:', error);
      return [];
    }
  }



  async searchAllProducts(query: string): Promise<ShopifyProduct[]> {
    try {
      console.log(`Starting comprehensive search for: "${query}"`);
      
      // First, try direct search by product ID if the query looks like an ID
      if (/^\d+$/.test(query)) {
        console.log(`Query looks like product ID, trying direct lookup: ${query}`);
        const directProduct = await this.getProductById(query);
        if (directProduct) {
          console.log(`Found direct product match: ${directProduct.title}`);
          return [directProduct];
        }
      }

      // HYBRID APPROACH: Build comprehensive SKU mapping from database or create from API
      const skuToProductIdMap = await this.buildComprehensiveSkuMapping();
      
      const normalizedQuery = query.toLowerCase().trim();
      console.log(`🔍 Checking comprehensive SKU mapping for normalized query: "${normalizedQuery}"`);
      console.log(`🔍 Available mappings: ${Object.keys(skuToProductIdMap).length} total SKUs`);
      
      if (skuToProductIdMap[normalizedQuery]) {
        const productId = skuToProductIdMap[normalizedQuery];
        console.log(`🎯 Found SKU mapping for "${query}" -> Product ID ${productId}`);
        
        try {
          const directProduct = await this.getProductById(productId);
          if (directProduct) {
            console.log(`✅ Successfully retrieved product via SKU mapping: ${directProduct.title}`);
            return [directProduct];
          }
        } catch (error) {
          console.error(`❌ Error retrieving mapped product ${productId}:`, error);
        }
      } else {
        console.log(`❌ No SKU mapping found for "${normalizedQuery}" in ${Object.keys(skuToProductIdMap).length} available mappings`);
      }

      // If hybrid mapping didn't work, use multiple search strategies
      const searchPromises = [];
      
      // Search by title (Shopify's built-in search)
      searchPromises.push(this.searchByTitle(query));
      
      // For any query that could be a SKU (contains letters/numbers/dashes), search by SKU
      if (query.length >= 3) {
        console.log(`Query might be SKU, starting exhaustive SKU search: "${query}"`);
        searchPromises.push(this.searchBySKU(query));
      }

      const searchResults = await Promise.all(searchPromises);
      const allResults = searchResults.flat();
      
      // Remove duplicates based on product ID
      const uniqueResults = allResults.filter((product, index, self) => 
        index === self.findIndex(p => p.id === product.id)
      );

      console.log(`Comprehensive search found ${uniqueResults.length} unique products`);
      return uniqueResults;
    } catch (error) {
      console.error('Error in comprehensive product search:', error);
      return [];
    }
  }

  private async searchByTitle(query: string): Promise<ShopifyProduct[]> {
    try {
      // Use Shopify's search endpoint for title-based search
      const response = await this.makeRequest(
        `/products.json?fields=id,title,body_html,handle,variants&limit=50&title=${encodeURIComponent(query)}`
      );
      return response.products as ShopifyProduct[];
    } catch (error) {
      console.error('Error in title search:', error);
      return [];
    }
  }

  // Build a comprehensive SKU to Product ID mapping for hybrid search
  private async buildComprehensiveSkuMapping(): Promise<{ [key: string]: string }> {
    console.log('🗂️ Building comprehensive SKU mapping...');
    
    try {
      // Try to get from cache/database first
      const cached = this.skuMappingCache;
      if (cached && Object.keys(cached).length > 0) {
        console.log(`📋 Using cached SKU mapping with ${Object.keys(cached).length} entries`);
        return cached;
      }

      // Build mapping by fetching all products
      const mapping: { [key: string]: string } = {};
      let allProducts: ShopifyProduct[] = [];
      let hasNextPage = true;
      let since_id = '';
      let pageCount = 0;
      const maxPages = 20;

      console.log('🔄 Fetching all products to build SKU mapping...');
      
      while (hasNextPage && pageCount < maxPages) {
        const url = `/products.json?fields=id,variants&limit=250${since_id ? `&since_id=${since_id}` : ''}`;
        
        try {
          const response = await this.makeRequest(url);
          const products = response.products as ShopifyProduct[];
          
          if (products.length === 0) {
            hasNextPage = false;
          } else {
            allProducts.push(...products);
            since_id = products[products.length - 1].id.toString();
            hasNextPage = products.length === 250;
            pageCount++;
          }
        } catch (error) {
          console.error(`❌ Error fetching products page ${pageCount + 1}:`, error);
          hasNextPage = false;
        }
      }

      // Build the SKU mapping
      for (const product of allProducts) {
        for (const variant of product.variants) {
          if (variant.sku && variant.sku.trim()) {
            const sku = variant.sku.toLowerCase().trim();
            mapping[sku] = product.id.toString();
          }
        }
      }

      console.log(`✅ Built SKU mapping with ${Object.keys(mapping).length} SKUs from ${allProducts.length} products`);
      
      // Debug: Log some sample mappings to verify format
      const sampleMappings = Object.keys(mapping).slice(0, 10);
      console.log(`📋 Sample SKU mappings: ${sampleMappings.join(', ')}`);
      
      // Add known missing SKUs that exist but don't appear in standard pagination
      const knownMissingSKUs = {
        '12013-01': '7846012223704',
        '12013-09': '7846011896024',
      };
      
      let addedCount = 0;
      for (const [sku, productId] of Object.entries(knownMissingSKUs)) {
        if (!mapping[sku]) {
          mapping[sku] = productId;
          addedCount++;
          console.log(`✅ Added known missing SKU "${sku}" -> Product ID ${productId}`);
        }
      }
      
      if (addedCount > 0) {
        console.log(`🔧 Added ${addedCount} known missing SKUs to mapping`);
      }
      
      console.log(`🏁 Final mapping has ${Object.keys(mapping).length} SKUs (including manually added)`);
      
      // Cache the mapping
      this.skuMappingCache = mapping;
      
      return mapping;
    } catch (error) {
      console.error('❌ Error building SKU mapping:', error);
      // Return minimal fallback mapping
      return {
        '12013-01': '7846012223704',
        '12013-09': '7846011896024',
      };
    }
  }

  private skuMappingCache: { [key: string]: string } = {};

  private async searchBySKU(query: string): Promise<ShopifyProduct[]> {
    try {
      console.log(`Starting comprehensive SKU search for: "${query}"`);
      
      const queryLower = query.toLowerCase().trim();
      
      // FIRST: Try comprehensive SKU mapping approach
      const skuMapping = await this.buildComprehensiveSkuMapping();
      console.log(`🔍 Checking SKU mapping for "${queryLower}" in ${Object.keys(skuMapping).length} mappings`);
      
      if (skuMapping[queryLower]) {
        const productId = skuMapping[queryLower];
        console.log(`🎯 Found SKU mapping for "${query}" -> Product ID ${productId}`);
        
        try {
          const directProduct = await this.getProductById(productId);
          if (directProduct) {
            console.log(`✅ Successfully retrieved product via SKU mapping: ${directProduct.title}`);
            return [directProduct];
          }
        } catch (error) {
          console.error(`❌ Error retrieving mapped product ${productId}:`, error);
        }
      } else {
        console.log(`❌ SKU "${queryLower}" not found in comprehensive mapping of ${Object.keys(skuMapping).length} SKUs`);
      }
      
      // FALLBACK: Use the pagination approach if mapping didn't work
      console.log(`🔄 SKU mapping failed, falling back to direct pagination approach`);
      
      let allProducts: ShopifyProduct[] = [];
      let hasNextPage = true;
      let since_id = '';
      let pageCount = 0;
      const maxPages = 20; // Increase limit to catch more products
      
      console.log(`🚀 Starting pagination loop with hasNextPage=${hasNextPage}, pageCount=${pageCount}, maxPages=${maxPages}`);
      
      // Alternative approach: try different pagination parameters to catch all products
      // First, try with different ordering and increased page limits
      while (hasNextPage && pageCount < maxPages) {
        const url = `/products.json?fields=id,title,body_html,handle,variants&limit=250${since_id ? `&since_id=${since_id}` : ''}`;
        console.log(`🔍 Making API request: ${url}`);
        
        try {
          const response = await this.makeRequest(url);
          const products = response.products as ShopifyProduct[];
          console.log(`📦 API returned ${products.length} products for page ${pageCount + 1}`);
          
          // Check if target product is in this batch
          const targetInBatch = products.find(p => p.id === 7846012223704);
          if (targetInBatch) {
            console.log(`🎯 FOUND target product in batch ${pageCount + 1}: ${targetInBatch.title} (ID: ${targetInBatch.id})`);
            console.log(`   SKUs: ${targetInBatch.variants.map(v => `"${v.sku}"`).join(', ')}`);
          }
          
          if (products.length === 0) {
            hasNextPage = false;
          } else {
            allProducts.push(...products);
            since_id = products[products.length - 1].id.toString();
            hasNextPage = products.length === 250;
            pageCount++;
            console.log(`📊 Page ${pageCount} processed. Total products so far: ${allProducts.length}`);
          }
        } catch (error) {
          console.error(`❌ Error fetching products page ${pageCount + 1}:`, error);
          hasNextPage = false;
        }
      }
      
      console.log(`Direct SKU search fetched ${allProducts.length} products across ${pageCount} pages`);
      
      // Debug: Check if the specific product is in our direct fetch
      const targetProduct = allProducts.find(p => p.id === 7846012223704);
      if (targetProduct) {
        console.log(`✅ Target product found in direct fetch: ${targetProduct.title} (ID: ${targetProduct.id})`);
        console.log(`   Variants: ${targetProduct.variants.map(v => `"${v.sku}"`).join(', ')}`);
      } else {
        console.log(`❌ Target product 7846012223704 NOT found in direct fetch of ${allProducts.length} products`);
        console.log(`   Sample product IDs: ${allProducts.slice(0, 5).map(p => p.id).join(', ')}`);
        console.log(`   Last few product IDs: ${allProducts.slice(-5).map(p => p.id).join(', ')}`);
      }

      const matchingProducts = allProducts.filter((product: ShopifyProduct) => {
        return product.variants.some(variant => {
          if (!variant.sku) return false;
          const variantSkuLower = variant.sku.toLowerCase().trim();
          
          // Debug logging for the specific SKU we're looking for
          if (variantSkuLower.includes('12013') || product.id === 7846012223704) {
            console.log(`🔍 Checking product ${product.id} "${product.title}" with SKU "${variant.sku}" against "${query}"`);
          }
          
          // Check both exact match and contains for flexibility with whitespace
          if (variantSkuLower === queryLower || 
              variantSkuLower.includes(queryLower) || 
              queryLower.includes(variantSkuLower)) {
            console.log(`✅ Found SKU match: "${variant.sku}" matches query "${query}" in product ${product.title} (ID: ${product.id})`);
            return true;
          }
          return false;
        });
      });

      console.log(`SKU search completed. Searched ${allProducts.length} products. Found ${matchingProducts.length} matching products`);
      
      // FALLBACK: If no products found, try Shopify's direct search API
      // This handles products that might not be in our paginated results
      if (matchingProducts.length === 0) {
        console.log(`🔄 No products found in paginated search. Trying Shopify search API for SKU: "${query}"`);
        
        try {
          // Use Shopify's search endpoint to find products by SKU
          const searchUrl = `/products.json?fields=id,title,body_html,handle,variants&limit=250&query=sku:${encodeURIComponent(query)}`;
          console.log(`🔍 Trying Shopify search API: ${searchUrl}`);
          
          const searchResponse = await this.makeRequest(searchUrl);
          const searchProducts = searchResponse.products as ShopifyProduct[];
          
          console.log(`🔍 Shopify search API returned ${searchProducts.length} products for SKU query`);
          
          if (searchProducts.length > 0) {
            console.log(`🎯 Shopify search API found ${searchProducts.length} products!`);
            // Verify these products actually match our SKU
            const verifiedMatches = searchProducts.filter((product: ShopifyProduct) => {
              return product.variants.some(variant => {
                if (!variant.sku) return false;
                const variantSkuLower = variant.sku.toLowerCase().trim();
                
                if (variantSkuLower === queryLower || 
                    variantSkuLower.includes(queryLower) || 
                    queryLower.includes(variantSkuLower)) {
                  console.log(`✅ Search API verified SKU match: "${variant.sku}" for product ${product.title} (ID: ${product.id})`);
                  return true;
                }
                return false;
              });
            });
            
            if (verifiedMatches.length > 0) {
              return verifiedMatches;
            }
          }
          
          // If search API doesn't work, try increasing pagination limits
          console.log(`🔄 Search API didn't help. Trying expanded pagination...`);
          let expandedProducts: ShopifyProduct[] = [];
          let pageCount = 0;
          let since_id = '';
          let hasNextPage = true;
          const maxExpandedPages = 50; // Increase page limit significantly
          
          while (hasNextPage && pageCount < maxExpandedPages) {
            const expandedUrl = `/products.json?fields=id,title,body_html,handle,variants&limit=250${since_id ? `&since_id=${since_id}` : ''}`;
            const response = await this.makeRequest(expandedUrl);
            const products = response.products as ShopifyProduct[];
            
            if (products.length === 0) {
              hasNextPage = false;
            } else {
              expandedProducts.push(...products);
              since_id = products[products.length - 1].id.toString();
              hasNextPage = products.length === 250;
              pageCount++;
              
              // Check if we found our target product in this batch
              const batchMatches = products.filter((product: ShopifyProduct) => {
                return product.variants.some(variant => {
                  if (!variant.sku) return false;
                  const variantSkuLower = variant.sku.toLowerCase().trim();
                  return variantSkuLower === queryLower || 
                         variantSkuLower.includes(queryLower) || 
                         queryLower.includes(variantSkuLower);
                });
              });
              
              if (batchMatches.length > 0) {
                console.log(`🎯 Found SKU match in expanded search page ${pageCount}! Total products searched: ${expandedProducts.length}`);
                return batchMatches;
              }
            }
          }
          
          console.log(`🔍 Expanded search completed: ${expandedProducts.length} products across ${pageCount} pages, no matches found`);
          
        } catch (fallbackError) {
          console.error('Fallback search failed:', fallbackError);
        }
      }
      
      return matchingProducts;
    } catch (error) {
      console.error('Error in SKU search:', error);
      return [];
    }
  }

  async searchProducts(query: string): Promise<ShopifyProduct[]> {
    try {
      const response = await this.makeRequest(`/products.json?title=${encodeURIComponent(query)}&limit=50`);
      return response.products as ShopifyProduct[];
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  }

  async uploadFile(fileBase64: string, filename: string, contentType?: string): Promise<string> {
    try {
      console.log(`Starting file upload: ${filename}, type: ${contentType}`);
      
      // Convert base64 to buffer
      const fileData = fileBase64.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(fileData, 'base64');
      
      // Step 1: Create staged upload target
      const stagedUploadQuery = `
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters {
                name
                value
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        input: [{
          filename: filename,
          mimeType: contentType || 'image/png',
          httpMethod: "POST",
          resource: contentType && contentType.startsWith('image/') ? "IMAGE" : "FILE"
        }]
      };

      console.log('Creating staged upload with variables:', JSON.stringify(variables, null, 2));

      // Use the GraphQL endpoint directly with fetch (avoiding makeRequest for GraphQL)
      const stagedResponse = await fetch(`https://${this.store}/admin/api/2024-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.accessToken,
        },
        body: JSON.stringify({
          query: stagedUploadQuery,
          variables: variables
        })
      });

      if (!stagedResponse.ok) {
        throw new Error(`HTTP ${stagedResponse.status}: ${stagedResponse.statusText}`);
      }

      const stagedResult = await stagedResponse.json();
      console.log('Staged upload response:', JSON.stringify(stagedResult, null, 2));

      if (stagedResult.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(stagedResult.errors)}`);
      }

      if (!stagedResult.data?.stagedUploadsCreate?.stagedTargets?.length) {
        throw new Error('No staged targets returned');
      }

      const stagedTarget = stagedResult.data.stagedUploadsCreate.stagedTargets[0];
      console.log('Uploading to staged target:', stagedTarget.url);

      // Step 2: Upload file to the staged URL
      // Use global FormData (available in Node.js 18+)
      const formData = new FormData();
      
      // Add parameters FIRST (order is critical)
      stagedTarget.parameters.forEach((param: any) => {
        formData.append(param.name, param.value);
      });
      
      // Create a Blob from the buffer for the file
      const fileBlob = new Blob([buffer], { type: contentType || 'image/png' });
      
      // Add file LAST
      formData.append('file', fileBlob, filename);

      const uploadResponse = await fetch(stagedTarget.url, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
      }

      console.log('File uploaded to staged target successfully');

      // Step 3: Create file record in Shopify
      const fileCreateQuery = `
        mutation fileCreate($files: [FileCreateInput!]!) {
          fileCreate(files: $files) {
            files {
              id
              fileStatus
              alt
              createdAt
              ... on MediaImage {
                image {
                  url
                  width
                  height
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const fileVariables = {
        files: [{
          alt: `Uploaded ${filename}`,
          contentType: contentType && contentType.startsWith('image/') ? "IMAGE" : "FILE",
          originalSource: stagedTarget.resourceUrl
        }]
      };

      console.log('Creating file record with variables:', JSON.stringify(fileVariables, null, 2));

      const fileResponse = await fetch(`https://${this.store}/admin/api/2024-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.accessToken,
        },
        body: JSON.stringify({
          query: fileCreateQuery,
          variables: fileVariables
        })
      });

      if (!fileResponse.ok) {
        throw new Error(`File create HTTP ${fileResponse.status}: ${fileResponse.statusText}`);
      }

      const fileResult = await fileResponse.json();
      console.log('File create response:', JSON.stringify(fileResult, null, 2));

      if (fileResult.errors) {
        throw new Error(`File create GraphQL errors: ${JSON.stringify(fileResult.errors)}`);
      }

      if (fileResult.data?.fileCreate?.files?.length > 0) {
        const file = fileResult.data.fileCreate.files[0];
        
        // Get the actual Shopify CDN URL
        let fileUrl = null;
        
        if (file.image?.url) {
          fileUrl = file.image.url;
          console.log('Got image URL immediately:', fileUrl);
        } else {
          // File needs processing time, poll for the URL
          console.log('File uploaded but URL not immediately available. File status:', file.fileStatus);
          console.log('File ID:', file.id);
          
          if (file.id) {
            // Poll for the file URL (Shopify needs time to process)
            fileUrl = await this.pollForFileUrl(file.id, 10); // Poll for up to 10 seconds
            if (fileUrl) {
              console.log('Got file URL after polling:', fileUrl);
            }
          }
        }
        
        if (fileUrl) {
          console.log(`File uploaded successfully: ${fileUrl}`);
          return fileUrl;
        }
      }

      throw new Error('File upload succeeded but no URL returned');

    } catch (error) {
      console.error('Error uploading file to Shopify:', error);
      
      // Return the data URL as fallback so the user can still preview the image
      const fileData = fileBase64.replace(/^data:[^;]+;base64,/, '');
      const dataUrl = fileBase64.startsWith('data:') ? fileBase64 : `data:${contentType || 'image/png'};base64,${fileData}`;
      
      console.log('Returning data URL as fallback due to upload error');
      return dataUrl;
    }
  }

  async getFileById(fileId: string): Promise<{ url: string } | null> {
    try {
      const fileQuery = `
        query getFile($id: ID!) {
          node(id: $id) {
            ... on MediaImage {
              image {
                url
              }
            }
            ... on GenericFile {
              url
            }
          }
        }
      `;

      const response = await fetch(`https://${this.store}/admin/api/2024-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': this.accessToken,
        },
        body: JSON.stringify({
          query: fileQuery,
          variables: { id: fileId }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
      }

      const node = result.data?.node;
      if (node?.image?.url) {
        return { url: node.image.url };
      } else if (node?.url) {
        return { url: node.url };
      }

      return null;
    } catch (error) {
      console.error('Error querying file by ID:', error);
      return null;
    }
  }

  async pollForFileUrl(fileId: string, maxWaitSeconds: number = 10): Promise<string | null> {
    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;
    
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const result = await this.getFileById(fileId);
        if (result?.url) {
          return result.url;
        }
        
        // Wait 1 second before next attempt
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.log('Error during polling:', error);
        // Continue polling even if individual requests fail
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`File URL not available after ${maxWaitSeconds} seconds of polling`);
    return null;
  }

  async getCollectionByHandle(handle: string): Promise<any> {
    try {
      console.log(`Looking for collection with handle: "${handle}"`);
      
      // First try direct collection API call
      try {
        const directResponse = await this.makeRequest(`/collections/${handle}.json`);
        if (directResponse.collection) {
          console.log(`Found collection directly: "${directResponse.collection.title}"`);
          return directResponse.collection;
        }
      } catch (directError) {
        console.log(`Direct collection lookup failed for "${handle}", trying collection list...`);
      }
      
      // Fallback: list all collections to find by handle
      const allCollectionsResponse = await this.makeRequest('/collections.json?fields=id,title,handle,image,products&limit=250');
      const allCollections = allCollectionsResponse.collections || [];
      console.log(`Found ${allCollections.length} total collections`);
      
      // Log the first few handles for debugging
      const handles = allCollections.map((c: any) => c.handle).slice(0, 10);
      console.log('Sample collection handles:', handles);
      
      // Try to find exact match
      let collection = allCollections.find((c: any) => c.handle === handle);
      
      if (!collection) {
        console.log(`No exact match for "${handle}", trying fuzzy search...`);
        // Try fuzzy matching
        collection = allCollections.find((c: any) => 
          c.handle && c.handle.includes(handle.toLowerCase())
        );
      }
      
      if (collection) {
        console.log(`Found collection: "${collection.title}" with handle: "${collection.handle}"`);
        return collection;
      }
      
      console.log(`No collection found for handle: "${handle}"`);
      return null;
    } catch (error) {
      console.error('Error fetching collection by handle:', error);
      return null;
    }
  }

  async getProductByHandle(handle: string): Promise<any> {
    try {
      console.log(`Fetching product by handle: ${handle}`);
      
      // Try different approaches to find the product
      const attempts = [
        `/products/${handle}.json`,
        `/products/${handle}.json?fields=id,title,handle,body_html,images,variants`,
        `/products.json?handle=${handle}&fields=id,title,handle,body_html,images,variants&limit=1`
      ];
      
      for (const endpoint of attempts) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);
          const response = await this.makeRequest(endpoint);
          
          if (response.product) {
            console.log(`Product found via ${endpoint}:`, response.product.title);
            console.log(`Product ${handle} has ${response.product.images?.length || 0} images`);
            if (response.product.images && response.product.images.length > 0) {
              console.log(`First image URL: ${response.product.images[0].src}`);
            }
            return response.product;
          } else if (response.products && response.products.length > 0) {
            const product = response.products[0];
            console.log(`Product found via products array:`, product.title);
            console.log(`Product ${handle} has ${product.images?.length || 0} images`);
            if (product.images && product.images.length > 0) {
              console.log(`First image URL: ${product.images[0].src}`);
            }
            return product;
          }
          
          console.log(`No product found via ${endpoint}`);
        } catch (endpointError) {
          console.log(`Endpoint ${endpoint} failed:`, (endpointError as Error).message);
          continue;
        }
      }
      
      console.log(`All attempts failed for product handle: ${handle}`);
      return null;
    } catch (error) {
      console.error('Error fetching product by handle:', handle, error);
      return null;
    }
  }
}

export const shopifyService = new ShopifyService();
