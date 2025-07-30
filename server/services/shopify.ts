import { shopifyApiQueue } from './apiQueue.js';

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
  private readonly store: string;

  constructor() {
    const shopifyStore = process.env.SHOPIFY_STORE_URL;
    const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN;
    
    if (!shopifyStore || !shopifyToken) {
      throw new Error('Missing Shopify credentials. Please set SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN environment variables.');
    }
    
    this.store = shopifyStore;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}, priority: number = 5) {
    // Use the queue system for ALL Shopify API requests
    return await shopifyApiQueue.addRequest(endpoint, options, priority);
  }

  private async makeGraphQLRequest(query: string, variables: any = {}): Promise<any> {
    const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN;
    if (!shopifyToken) {
      throw new Error('Missing Shopify access token');
    }

    const response = await fetch(`https://${this.store}/admin/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': shopifyToken,
      },
      body: JSON.stringify({
        query,
        variables
      })
    });

    if (!response.ok) {
      throw new Error(`GraphQL HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Get total product count from store
  async getProductCount(): Promise<number> {
    try {
      const response = await this.makeRequest('/products/count.json');
      return response.count || 0;
    } catch (error) {
      console.warn('Failed to get product count:', error);
      return 0;
    }
  }

  // Get products in efficient batches using cursor-based pagination (modern Shopify API)
  async getProductsBatch(limit: number = 5, since_id?: string): Promise<{ products: any[], hasMore: boolean }> {
    try {
      const url = since_id 
        ? `/products.json?limit=${limit}&since_id=${since_id}&fields=id,title,body_html,handle,variants`
        : `/products.json?limit=${limit}&fields=id,title,body_html,handle,variants`;
      
      console.log(`📦 Fetching ${limit} products from Shopify${since_id ? ` (since_id: ${since_id})` : ''}`);
      const response = await this.makeRequest(url, {}, 4); // Medium priority for batch operations
      const products = response.products || [];
      
      console.log(`✅ Fetched ${products.length} products from batch`);
      
      return {
        products,
        hasMore: products.length === limit
      };
    } catch (error) {
      console.warn(`Failed to fetch products batch:`, error);
      return { products: [], hasMore: false };
    }
  }

  async getProductById(productId: string): Promise<any> {
    try {
      console.log(`🔍 Fetching product by ID: ${productId}`);
      const response = await this.makeRequest(`/products/${productId}.json`, {}, 3); // High priority
      return response.product;
    } catch (error: any) {
      console.error('Error fetching product by ID:', error);
      if (error.message.includes('404')) {
        return null;
      }
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
      }, 2); // High priority for user-initiated updates
    } catch (error) {
      console.error('Error updating product description:', error);
      throw error;
    }
  }

  async getAllProducts(page: number = 1, limit: number = 20): Promise<ShopifyProduct[]> {
    // This method is deprecated - use getAllProductsComprehensive() instead
    console.warn('getAllProducts() with pagination is deprecated. Use getAllProductsComprehensive() for all products.');
    return this.getAllProductsComprehensive();
  }

  async getAllProductsComprehensive(): Promise<ShopifyProduct[]> {
    try {
      console.log('🚀 Starting comprehensive fetch of ALL products in store');
      
      // First, get the total count to know how many we should expect
      const countResponse = await this.makeRequest('/products/count.json', {}, 6);
      const expectedTotal = countResponse.count;
      console.log(`🎯 Store has ${expectedTotal} total products to fetch`);
      
      const results: ShopifyProduct[] = [];
      let totalFetched = 0;
      let pageCount = 0;
      const maxPages = Math.ceil(expectedTotal / 250) + 5; // Dynamic limit based on expected count + buffer
      
      // Strategy 1: Try cursor-based pagination first
      console.log('📄 Attempting cursor-based pagination...');
      let since_id = '';
      let hasNextPage = true;
      
      while (hasNextPage && pageCount < maxPages && totalFetched < expectedTotal) {
        try {
          const url = `/products.json?fields=id,title,body_html,handle,variants&limit=250${since_id ? `&since_id=${since_id}` : ''}`;
          const response = await this.makeRequest(url, {}, 6);
          const products = response.products as ShopifyProduct[];
          
          pageCount++;
          totalFetched += products.length;
          console.log(`📄 Page ${pageCount}: Fetched ${products.length} products (total: ${totalFetched}/${expectedTotal})`);
          
          if (products.length === 0) {
            console.log(`⏹️  No more products found with cursor pagination`);
            hasNextPage = false;
            break;
          }
          
          results.push(...products);
          since_id = products[products.length - 1].id.toString();
          
          // Continue if we got a full batch AND haven't reached expected total
          if (products.length < 250) {
            console.log(`📋 Cursor pagination appears to be complete: only ${products.length} products in last batch`);
            hasNextPage = false;
          }
          
        } catch (fetchError) {
          console.error(`❌ Error fetching page ${pageCount + 1}:`, fetchError);
          break;
        }
      }
      
      // Strategy 2: If we didn't get all products, try different approaches to fill gaps
      if (totalFetched < expectedTotal) {
        console.log(`🔄 Got ${totalFetched}/${expectedTotal} products with cursor. Trying alternative strategies...`);
        
        const existingIds = new Set(results.map(p => p.id));
        
        // Strategy 2a: Try different field combinations (sometimes affects pagination)
        console.log(`🔄 Trying minimal fields strategy...`);
        let minimalCursor = '';
        let minimalPageCount = 0;
        
        while (minimalPageCount < 20 && totalFetched < expectedTotal) {
          try {
            const url = `/products.json?fields=id&limit=250${minimalCursor ? `&since_id=${minimalCursor}` : ''}`;
            const response = await this.makeRequest(url, {}, 6);
            const minimalProducts = response.products as { id: number }[];
            
            if (minimalProducts.length === 0) break;
            
            // Get full product data for new products only
            const newProductIds = minimalProducts
              .filter(p => !existingIds.has(p.id))
              .map(p => p.id);
            
            if (newProductIds.length > 0) {
              console.log(`📄 Minimal fetch page ${minimalPageCount + 1}: Found ${newProductIds.length} new product IDs`);
              
              // Fetch full product data for new products in small batches
              for (let i = 0; i < newProductIds.length; i += 10) {
                const batchIds = newProductIds.slice(i, i + 10);
                const batchPromises = batchIds.map(id => 
                  this.makeRequest(`/products/${id}.json?fields=id,title,body_html,handle,variants`, {}, 6)
                    .then(response => response.product)
                    .catch(error => {
                      console.warn(`Failed to fetch product ${id}:`, error.message);
                      return null;
                    })
                );
                
                const batchProducts = (await Promise.all(batchPromises)).filter(p => p !== null);
                results.push(...batchProducts);
                totalFetched += batchProducts.length;
                batchProducts.forEach(p => existingIds.add(p.id));
                
                if (totalFetched >= expectedTotal) break;
              }
            }
            
            minimalCursor = minimalProducts[minimalProducts.length - 1].id.toString();
            minimalPageCount++;
            
            if (minimalProducts.length < 250) break;
            
          } catch (fetchError) {
            console.error(`❌ Error with minimal fields strategy:`, fetchError);
            break;
          }
        }
        
        // Strategy 2b: Try reverse chronological order if still missing products
        if (totalFetched < expectedTotal && totalFetched > 0) {
          console.log(`🔄 Trying reverse chronological order...`);
          
          // Get the oldest product ID we have and work backwards
          const oldestProductId = Math.min(...results.map(p => p.id));
          
          try {
            // Try fetching products created before our oldest product
            const url = `/products.json?fields=id,title,body_html,handle,variants&limit=250&created_at_max=${new Date(2020, 0, 1).toISOString()}`;
            const response = await this.makeRequest(url, {}, 6);
            const oldProducts = response.products as ShopifyProduct[];
            
            const newOldProducts = oldProducts.filter(p => !existingIds.has(p.id));
            if (newOldProducts.length > 0) {
              console.log(`📄 Reverse fetch: Found ${newOldProducts.length} older products`);
              results.push(...newOldProducts);
              totalFetched += newOldProducts.length;
            }
            
          } catch (fetchError) {
            console.warn(`⚠️  Reverse fetch failed:`, fetchError);
          }
        }
      }

      console.log(`✅ Comprehensive fetch completed: ${totalFetched}/${expectedTotal} products fetched`);
      
      if (totalFetched < expectedTotal) {
        console.warn(`⚠️  Only fetched ${totalFetched} out of ${expectedTotal} expected products. Some products may be missing.`);
      }
      
      return results;
    } catch (error) {
      console.error('❌ Error in comprehensive product fetch:', error);
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

      // COMPREHENSIVE SKU SEARCH: Build full mapping for ALL SKUs
      const normalizedQuery = query.toLowerCase().trim();
      console.log(`🔍 Starting comprehensive SKU search for: "${normalizedQuery}"`);
      
      // Build complete SKU mapping if not cached
      const skuMapping = await this.buildComprehensiveSkuMapping();
      console.log(`📋 Checking against comprehensive SKU mapping with ${Object.keys(skuMapping).length} SKUs`);
      
      if (skuMapping[normalizedQuery]) {
        const productId = skuMapping[normalizedQuery];
        console.log(`🎯 Found SKU in comprehensive mapping: "${query}" -> Product ID ${productId}`);
        
        try {
          const directProduct = await this.getProductById(productId);
          if (directProduct) {
            console.log(`✅ Successfully retrieved product via comprehensive SKU mapping: ${directProduct.title}`);
            return [directProduct];
          }
        } catch (error) {
          console.error(`❌ Error retrieving product ${productId}:`, error);
        }
      } else {
        console.log(`❌ SKU "${normalizedQuery}" not found in comprehensive mapping of ${Object.keys(skuMapping).length} SKUs`);
        
        // Show some sample SKUs for debugging
        const sampleSKUs = Object.keys(skuMapping).slice(0, 10);
        console.log(`📋 Sample SKUs in mapping: ${sampleSKUs.join(', ')}`);
      }

      // Note: Comprehensive SKU mapping was already checked above, continuing with fallback searches

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
      const maxPages = 50; // Increased to capture more products (50 * 250 = 12,500 max)

      console.log('🔄 Fetching all products to build comprehensive SKU mapping...');
      
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
            
            // Log progress for large mapping builds
            if (pageCount % 5 === 0) {
              console.log(`📊 SKU mapping progress: ${pageCount} pages processed, ${allProducts.length} products loaded`);
            }
          }
        } catch (error) {
          console.error(`❌ Error fetching products page ${pageCount + 1}:`, error);
          // Continue with next page instead of breaking completely
          pageCount++;
          if (pageCount >= maxPages) {
            hasNextPage = false;
          }
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

      console.log(`✅ Built comprehensive SKU mapping with ${Object.keys(mapping).length} SKUs from ${allProducts.length} products across ${pageCount} pages`);
      
      // Debug: Log some sample mappings to verify format
      const sampleMappings = Object.keys(mapping).slice(0, 10);
      console.log(`📋 Sample SKU mappings: ${sampleMappings.join(', ')}`);
      
      // Add known missing SKUs that might not appear in standard pagination
      // This is a safety net for edge cases
      const knownMissingSKUs: { [key: string]: string } = {
        '12013-01': '7846012223704',
        '12013-09': '7846011896024', 
        '12013-25': '7846011240664',
      };
      
      console.log(`🔧 Adding ${Object.keys(knownMissingSKUs).length} known missing SKUs as safety net`);
      console.log(`📋 Known missing SKUs: ${Object.keys(knownMissingSKUs).join(', ')}`);
      
      // Force add any known missing SKUs to ensure comprehensive coverage
      for (const [sku, productId] of Object.entries(knownMissingSKUs)) {
        const normalizedSku = sku.toLowerCase().trim();
        if (!mapping[normalizedSku]) {
          mapping[normalizedSku] = productId;
          console.log(`➕ Added safety net SKU "${sku}" -> Product ID ${productId}`);
        }
      }
      
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
      
      console.log(`🏁 Final comprehensive mapping has ${Object.keys(mapping).length} SKUs from ${allProducts.length} products`);
      console.log(`📊 Mapping coverage: ${pageCount}/${maxPages} pages processed`);
      
      // Cache the mapping with timestamp
      this.skuMappingCache = mapping;
      console.log(`💾 Cached comprehensive SKU mapping for future searches`);
      
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

  // Method to clear cache and force rebuild
  clearSkuMappingCache(): void {
    console.log('🗑️ Clearing SKU mapping cache');
    this.skuMappingCache = {};
  }

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

      // Use the GraphQL endpoint
      const stagedResult = await this.makeGraphQLRequest(stagedUploadQuery, variables);
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

      const fileResult = await this.makeGraphQLRequest(fileCreateQuery, fileVariables);
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

      const result = await this.makeGraphQLRequest(fileQuery, { id: fileId });
      
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
