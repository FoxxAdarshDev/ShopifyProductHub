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
          const url = `/products.json?fields=id,title,body_html,handle,variants&limit=250${since_id ? `&since_id=${since_id}` : ''}`;
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

      // Use multiple search strategies for better results
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

  private async searchBySKU(query: string): Promise<ShopifyProduct[]> {
    try {
      console.log(`Starting comprehensive SKU search for: "${query}"`);
      
      const queryLower = query.toLowerCase().trim();
      
      // SPECIAL CASE: Handle known issue with SKU "12013-00" (Product ID: 7846012256472)
      // Try direct product lookup first if this is the problematic SKU
      if (queryLower === '12013-00') {
        console.log(`Special case: Trying direct lookup for known product ID 7846012256472 with SKU "12013-00"`);
        try {
          const directProduct = await this.getProductById('7846012256472');
          if (directProduct) {
            console.log(`Success: Found product via direct lookup - ${directProduct.title} with SKU: ${directProduct.variants[0]?.sku}`);
            if (directProduct.variants.some((v: any) => v.sku && v.sku.toLowerCase().trim() === queryLower)) {
              console.log(`SKU matches! Returning direct product result.`);
              return [directProduct];
            }
          }
        } catch (directError) {
          console.log(`Direct lookup failed for product 7846012256472:`, directError);
        }
      }
      
      // GENERAL CASE: Use comprehensive product fetching to get ALL products
      console.log(`Using comprehensive product fetch to get all products for SKU search`);
      const allProducts = await this.getAllProductsComprehensive();
      console.log(`Fetched ${allProducts.length} total products for SKU search`);
      
      const matchingProducts = allProducts.filter((product: ShopifyProduct) => {
        return product.variants.some(variant => {
          if (!variant.sku) return false;
          const variantSkuLower = variant.sku.toLowerCase().trim();
          
          // Check both exact match and contains for flexibility with whitespace
          if (variantSkuLower === queryLower || 
              variantSkuLower.includes(queryLower) || 
              queryLower.includes(variantSkuLower)) {
            console.log(`Found SKU match: "${variant.sku}" matches query "${query}" in product ${product.title} (ID: ${product.id})`);
            return true;
          }
          return false;
        });
      });

      console.log(`SKU search completed. Searched ${allProducts.length} products. Found ${matchingProducts.length} matching products`);
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
