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
      // Search for products with this SKU in variants
      const response = await this.makeRequest(`/products.json?fields=id,title,body_html,handle,variants&limit=250`);
      
      const products = response.products as ShopifyProduct[];
      const product = products.find(p => 
        p.variants.some(v => v.sku === sku)
      );

      return product || null;
    } catch (error) {
      console.error('Error fetching product by SKU:', error);
      return null;
    }
  }

  async getProductById(productId: string): Promise<ShopifyProduct | null> {
    try {
      const response = await this.makeRequest(`/products/${productId}.json`);
      return response.product as ShopifyProduct;
    } catch (error) {
      console.error('Error fetching product by ID:', error);
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
