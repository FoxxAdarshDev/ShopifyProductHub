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
    this.baseUrl = `https://${process.env.SHOPIFY_STORE || 'foxxbioprocess.myshopify.com'}/admin/api/2023-10`;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN || 'shpat_bf9cb13fb0847e311c4';
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
      const error = await response.text();
      throw new Error(`Shopify API error: ${response.status} - ${error}`);
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
