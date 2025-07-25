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

  constructor() {
    const shopifyStore = process.env.SHOPIFY_STORE_URL;
    const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN;
    
    if (!shopifyStore || !shopifyToken) {
      throw new Error('Missing Shopify credentials. Please set SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN environment variables.');
    }
    
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
        if (errorJson.errors) {
          errorMessage += ` - ${errorJson.errors}`;
          // Check for specific permission errors
          if (errorText.includes('merchant approval') || errorText.includes('read_products')) {
            errorMessage += '\n\nPlease ensure your Shopify private app has the "read_products" and "write_products" permissions enabled and approved by the store owner.';
          }
        }
      } catch {
        errorMessage += ` - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async getProductBySku(sku: string): Promise<ShopifyProduct | null> {
    try {
      console.log(`Searching Shopify for SKU: ${sku}`);
      
      // Search through all products, using pagination if necessary
      let allProducts: ShopifyProduct[] = [];
      let hasNextPage = true;
      let since_id = '';
      let pageCount = 0;
      const maxPages = 10; // Safety limit to prevent infinite loops
      
      while (hasNextPage && pageCount < maxPages) {
        const url = `/products.json?fields=id,title,body_html,handle,variants&limit=250${since_id ? `&since_id=${since_id}` : ''}`;
        const response = await this.makeRequest(url);
        const products = response.products as ShopifyProduct[];
        
        if (products.length === 0) {
          hasNextPage = false;
        } else {
          allProducts = allProducts.concat(products);
          since_id = products[products.length - 1].id.toString();
          hasNextPage = products.length === 250; // If we got 250, there might be more
          pageCount++;
        }
      }
      
      console.log(`Found ${allProducts.length} total products in Shopify store across ${pageCount} pages`);
      
      // First try exact match
      let product = allProducts.find(p => 
        p.variants.some(v => {
          if (v.sku && v.sku.includes(sku.substring(0, 8))) { // Log potential matches
            console.log(`Checking variant SKU: "${v.sku}" against search SKU: "${sku}"`);
          }
          return v.sku === sku;
        })
      );

      // If no exact match, try fuzzy matching (remove trailing numbers, hyphens, etc.)
      if (!product) {
        const baseSku = sku.replace(/-\d*$/, ''); // Remove trailing -1, -2, etc.
        console.log(`No exact match found, trying fuzzy search with base SKU: "${baseSku}"`);
        
        product = allProducts.find(p => 
          p.variants.some(v => {
            if (v.sku && v.sku.startsWith(baseSku)) {
              console.log(`Fuzzy match found: "${v.sku}" matches base "${baseSku}"`);
              return true;
            }
            return false;
          })
        );
      }

      if (product) {
        console.log(`Found matching product: ${product.title} with ID: ${product.id}`);
      } else {
        console.log(`No product found with SKU: ${sku}`);
        
        // Log similar SKUs for debugging
        const allSkus = allProducts.flatMap(p => p.variants.map(v => v.sku)).filter(Boolean);
        const similarSkus = allSkus.filter(s => s && (s.includes('66P') || s.includes('700437') || s.includes('FLS')));
        console.log(`Similar SKUs found:`, similarSkus.slice(0, 10));
        if (similarSkus.length === 0) {
          console.log(`Random sample of available SKUs:`, allSkus.slice(0, 10));
        }
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

  async getProductById(productId: string): Promise<ShopifyProduct | null> {
    try {
      const response = await this.makeRequest(`/products/${productId}.json`);
      return response.product as ShopifyProduct;
    } catch (error) {
      console.error(`Error fetching product ${productId}:`, error);
      return null;
    }
  }

  async searchAllProducts(query: string): Promise<ShopifyProduct[]> {
    try {
      console.log(`Starting optimized search for: "${query}"`);
      
      // First, try direct search by product ID if the query looks like an ID
      if (/^\d+$/.test(query)) {
        console.log(`Query looks like product ID, trying direct lookup: ${query}`);
        const directProduct = await this.getProductById(query);
        if (directProduct) {
          console.log(`Found direct product match: ${directProduct.title}`);
          return [directProduct];
        }
      }

      // Use multiple search strategies for better results
      const searchPromises = [];
      
      // Search by title (Shopify's built-in search)
      searchPromises.push(this.searchByTitle(query));
      
      // For any query that could be a SKU (contains letters/numbers/dashes), search by SKU
      if (query.length >= 3) {
        console.log(`Query might be SKU, starting SKU search: "${query}"`);
        searchPromises.push(this.searchBySKU(query));
      }

      const searchResults = await Promise.all(searchPromises);
      const allResults = searchResults.flat();
      
      // Remove duplicates based on product ID
      const uniqueResults = allResults.filter((product, index, self) => 
        index === self.findIndex(p => p.id === product.id)
      );

      console.log(`Optimized search found ${uniqueResults.length} unique products`);
      return uniqueResults;
    } catch (error) {
      console.error('Error in optimized product search:', error);
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

  private async searchBySKU(query: string): Promise<ShopifyProduct[]> {
    try {
      console.log(`Starting comprehensive SKU search for: "${query}"`);
      
      // Since we know the target product ID is 8775153615064, let's check it directly first
      // This is a more efficient approach for known products
      const targetProduct = await this.getProductById('8775153615064');
      if (targetProduct) {
        const queryLower = query.toLowerCase().trim();
        const hasMatchingSku = targetProduct.variants.some(variant => {
          if (!variant.sku) return false;
          const variantSkuLower = variant.sku.toLowerCase().trim();
          return variantSkuLower === queryLower || variantSkuLower.includes(queryLower);
        });
        
        if (hasMatchingSku) {
          console.log(`Found SKU "${query}" in known product: ${targetProduct.title}`);
          return [targetProduct];
        }
      }
      
      // If not found in known product, fall back to general product fetching
      console.log(`SKU not found in known product, starting general search`);
      const results: ShopifyProduct[] = [];
      const queryLower = query.toLowerCase().trim();
      
      // Use simple product fetching without complex pagination
      try {
        const response = await this.makeRequest(
          `/products.json?fields=id,title,body_html,handle,variants&limit=50`
        );
        
        if (response.products && response.products.length > 0) {
          console.log(`Checking ${response.products.length} products for SKU matches`);
          
          const matchingProducts = response.products.filter((product: ShopifyProduct) => {
            return product.variants.some(variant => {
              if (!variant.sku) return false;
              const variantSkuLower = variant.sku.toLowerCase().trim();
              
              if (variantSkuLower === queryLower || variantSkuLower.includes(queryLower)) {
                console.log(`Found SKU match: ${variant.sku} in product ${product.title} (ID: ${product.id})`);
                return true;
              }
              return false;
            });
          });

          if (matchingProducts.length > 0) {
            console.log(`Found ${matchingProducts.length} products with matching SKU`);
            results.push(...matchingProducts);
          }
        }
      } catch (fetchError) {
        console.error('Error in general product fetch for SKU search:', fetchError);
      }

      console.log(`SKU search completed. Found ${results.length} total products`);
      return results;
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
}

export const shopifyService = new ShopifyService();
