interface QueueItem {
  id: string;
  priority: number; // Lower number = higher priority
  endpoint: string;
  options: RequestInit;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

export class ShopifyAPIQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly MIN_DELAY = 1000; // 1 second minimum between requests
  private readonly MAX_DELAY = 3000; // 3 seconds max delay for safety
  private requestCounter = 0;

  constructor() {
    console.log('🚦 Shopify API Queue initialized');
  }

  async addRequest(
    endpoint: string, 
    options: RequestInit = {}, 
    priority: number = 5
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = `req_${Date.now()}_${++this.requestCounter}`;
      
      const queueItem: QueueItem = {
        id,
        priority,
        endpoint,
        options,
        resolve,
        reject,
        timestamp: Date.now()
      };

      // Insert item in queue based on priority (lower number = higher priority)
      const insertIndex = this.queue.findIndex(item => item.priority > priority);
      if (insertIndex === -1) {
        this.queue.push(queueItem);
      } else {
        this.queue.splice(insertIndex, 0, queueItem);
      }

      console.log(`📥 Queue: Added request ${id} (priority ${priority}). Queue size: ${this.queue.length}`);
      
      // Start processing if not already running
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    console.log('🔄 Queue: Starting to process requests...');

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      
      try {
        // Calculate delay needed to respect rate limits
        const timeSinceLastRequest = Date.now() - this.lastRequestTime;
        const delayNeeded = Math.max(0, this.MIN_DELAY - timeSinceLastRequest);
        
        if (delayNeeded > 0) {
          console.log(`⏱️ Queue: Waiting ${delayNeeded}ms before processing request ${item.id}`);
          await this.sleep(delayNeeded);
        }

        console.log(`🚀 Queue: Processing request ${item.id} - ${item.endpoint}`);
        
        // Make the actual request
        const result = await this.makeDirectRequest(item.endpoint, item.options);
        this.lastRequestTime = Date.now();
        
        console.log(`✅ Queue: Request ${item.id} completed successfully`);
        item.resolve(result);

        // Add small buffer delay for safety
        await this.sleep(100);

      } catch (error: any) {
        console.error(`❌ Queue: Request ${item.id} failed:`, error.message);
        
        // If rate limited, add back to front of queue with higher priority and longer delay
        if (error.message.includes('429') || error.message.includes('rate')) {
          console.log(`🔄 Queue: Rate limited, re-queuing request ${item.id} with delay`);
          
          // Add request back to front of queue with highest priority
          this.queue.unshift({
            ...item,
            priority: 0, // Highest priority for retry
            timestamp: Date.now()
          });
          
          // Wait longer before retry
          await this.sleep(this.MAX_DELAY);
          continue;
        }
        
        item.reject(error);
      }
    }

    this.processing = false;
    console.log('✅ Queue: Processing completed. Queue is now empty.');
  }

  private async makeDirectRequest(endpoint: string, options: RequestInit): Promise<any> {
    const shopifyStore = process.env.SHOPIFY_STORE_URL;
    const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN;
    
    if (!shopifyStore || !shopifyToken) {
      throw new Error('Missing Shopify credentials');
    }

    const baseUrl = `https://${shopifyStore}/admin/api/2023-10`;
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'X-Shopify-Access-Token': shopifyToken,
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
        }
      } catch {
        errorMessage += ` - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }

    return response.json();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get queue status for monitoring
  getQueueStatus(): { queueSize: number; processing: boolean; lastRequestTime: number } {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      lastRequestTime: this.lastRequestTime
    };
  }

  // Clear the queue (for emergencies)
  clearQueue(): void {
    console.log('🧹 Queue: Clearing all pending requests');
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
    this.processing = false;
  }
}

// Global singleton instance
export const shopifyApiQueue = new ShopifyAPIQueue();