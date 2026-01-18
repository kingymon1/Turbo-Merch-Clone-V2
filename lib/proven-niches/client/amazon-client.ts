/**
 * Proven Niches Pipeline - Amazon Scraping Client
 *
 * Uses Decodo API to scrape Amazon product data.
 * Handles product search, product details, and parsing.
 */

import { AmazonProductData, AmazonScrapeResult, ProductDetailResult } from '../types';
import { SCRAPE_CONFIG, log, logError, logWarn } from '../config';

// =============================================================================
// DECODO CONFIGURATION
// =============================================================================

const DECODO_CONFIG = {
  username: process.env.DECODO_USERNAME || '',
  password: process.env.DECODO_PASSWORD || '',
  baseUrl: 'https://scraper-api.decodo.com/v2',
  timeout: 60000,
  maxRetries: 2,
  retryDelayMs: 2000,
};

function isDecodoConfigured(): boolean {
  return Boolean(DECODO_CONFIG.username && DECODO_CONFIG.password);
}

// =============================================================================
// TYPES
// =============================================================================

interface DecodoScrapeParams {
  target: string;
  url?: string;
  query?: string;
  domain?: string;
  parse?: boolean;
  geo?: string;
  start_page?: number;
  pages?: number;
}

interface DecodoScrapeResult {
  content: unknown;
  status_code: number;
  url: string;
  task_id: string;
}

interface DecodoResponse {
  results: DecodoScrapeResult[];
}

// Decodo Amazon product parsed structure
interface DecodoAmazonProduct {
  asin?: string;
  title?: string;
  brand?: string;
  price?: number | string;
  price_string?: string;
  rating?: number;
  reviews_count?: number;
  reviews?: number;
  bsr?: number;
  best_seller_rank?: number;
  bestseller_rank?: number | { rank?: number; category?: string };
  category?: string;
  image?: string;
  url?: string;
  is_prime?: boolean;
}

interface DecodoAmazonSearchResult {
  results?: DecodoAmazonProduct[];
  organic?: DecodoAmazonProduct[];
  products?: DecodoAmazonProduct[];
  total_results?: number;
}

interface DecodoAmazonProductResult {
  product?: DecodoAmazonProduct;
  asin?: string;
  title?: string;
  brand?: string;
  price?: number;
  rating?: number;
  reviews_count?: number;
  bestseller_rank?: number | { rank?: number; category?: string };
}

// =============================================================================
// CLIENT CLASS
// =============================================================================

export class AmazonClient {
  private credentials: { username: string; password: string };
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor() {
    this.credentials = {
      username: DECODO_CONFIG.username,
      password: DECODO_CONFIG.password,
    };
    this.baseUrl = DECODO_CONFIG.baseUrl;
    this.timeout = DECODO_CONFIG.timeout;
    this.maxRetries = DECODO_CONFIG.maxRetries;
    this.retryDelayMs = DECODO_CONFIG.retryDelayMs;
  }

  /**
   * Check if the client is configured with credentials
   */
  isConfigured(): boolean {
    return isDecodoConfigured();
  }

  /**
   * Get Basic Auth header value
   */
  private getAuthHeader(): string {
    const encoded = Buffer.from(
      `${this.credentials.username}:${this.credentials.password}`
    ).toString('base64');
    return `Basic ${encoded}`;
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Make a scrape request to Decodo
   */
  private async scrape(params: DecodoScrapeParams): Promise<DecodoScrapeResult[]> {
    if (!this.isConfigured()) {
      throw new Error('Decodo API not configured. Set DECODO_USERNAME and DECODO_PASSWORD environment variables.');
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.baseUrl}/scrape`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.getAuthHeader(),
          },
          body: JSON.stringify(params),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');

          // Don't retry on client errors (except 429)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(`Decodo API error ${response.status}: ${errorText}`);
          }

          throw new Error(`Decodo API error ${response.status}: ${errorText}`);
        }

        const data: DecodoResponse = await response.json();
        return data.results || [];

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (lastError.name === 'AbortError') {
          throw new Error(`Decodo API timeout after ${this.timeout}ms`);
        }

        if (attempt === this.maxRetries) {
          break;
        }

        const delay = this.retryDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
        log(`Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Decodo API request failed');
  }

  /**
   * Search Amazon for products by keyword
   */
  async searchProducts(
    keyword: string,
    options?: { maxResults?: number; domain?: string }
  ): Promise<AmazonScrapeResult> {
    const domain = options?.domain || 'com';
    const maxResults = options?.maxResults || SCRAPE_CONFIG.maxProductsPerSearch;

    log(`Searching Amazon for: "${keyword}"`);

    try {
      const results = await this.scrape({
        target: 'amazon_search',
        query: keyword,
        domain,
        parse: true,
        pages: Math.ceil(maxResults / 16), // ~16 products per page
      });

      if (!results.length || !results[0].content) {
        logWarn(`No search results for "${keyword}"`);
        return { success: false, products: [], error: 'No results returned' };
      }

      const content = results[0].content as DecodoAmazonSearchResult;
      const rawProducts = content.results || content.organic || content.products || [];

      const products: AmazonProductData[] = rawProducts
        .slice(0, maxResults)
        .map((p) => this.parseProduct(p))
        .filter((p): p is AmazonProductData => p !== null);

      log(`Found ${products.length} products for "${keyword}"`);

      return {
        success: true,
        products,
        totalResults: content.total_results,
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`Failed to search Amazon for "${keyword}"`, error);
      return { success: false, products: [], error: message };
    }
  }

  /**
   * Get details for a specific product by ASIN
   */
  async getProductDetails(asin: string, domain?: string): Promise<ProductDetailResult> {
    const d = domain || 'com';

    log(`Fetching product details for ASIN: ${asin}`);

    try {
      const results = await this.scrape({
        target: 'amazon_product',
        url: `https://www.amazon.${d}/dp/${asin}`,
        parse: true,
      });

      if (!results.length || !results[0].content) {
        return { success: false, error: 'No product data returned' };
      }

      const content = results[0].content as DecodoAmazonProductResult;
      const rawProduct = content.product || content;

      const product = this.parseProduct({
        asin: rawProduct.asin || asin,
        title: rawProduct.title,
        brand: rawProduct.brand,
        price: rawProduct.price,
        rating: rawProduct.rating,
        reviews_count: rawProduct.reviews_count,
        bestseller_rank: rawProduct.bestseller_rank,
      });

      if (!product) {
        return { success: false, error: 'Failed to parse product data' };
      }

      return { success: true, product };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logError(`Failed to get product ${asin}`, error);
      return { success: false, error: message };
    }
  }

  /**
   * Parse a raw Decodo product into our format
   */
  private parseProduct(raw: DecodoAmazonProduct): AmazonProductData | null {
    if (!raw.asin || !raw.title) {
      return null;
    }

    // Parse price (can be number or string like "$19.99")
    let price: number | undefined;
    if (typeof raw.price === 'number') {
      price = raw.price;
    } else if (typeof raw.price === 'string') {
      const priceMatch = raw.price.match(/[\d.]+/);
      price = priceMatch ? parseFloat(priceMatch[0]) : undefined;
    } else if (raw.price_string) {
      const priceMatch = raw.price_string.match(/[\d.]+/);
      price = priceMatch ? parseFloat(priceMatch[0]) : undefined;
    }

    // Parse BSR (can be nested object)
    let bsr: number | undefined;
    let bsrCategory: string | undefined;

    if (typeof raw.bestseller_rank === 'number') {
      bsr = raw.bestseller_rank;
    } else if (typeof raw.bestseller_rank === 'object' && raw.bestseller_rank) {
      bsr = raw.bestseller_rank.rank;
      bsrCategory = raw.bestseller_rank.category;
    } else if (raw.bsr) {
      bsr = raw.bsr;
    } else if (raw.best_seller_rank) {
      bsr = raw.best_seller_rank;
    }

    // Parse review count
    const reviewCount = raw.reviews_count || raw.reviews || 0;

    return {
      asin: raw.asin,
      title: raw.title,
      brand: raw.brand,
      price,
      bsr,
      bsrCategory: bsrCategory || raw.category,
      reviewCount,
      rating: raw.rating,
      keywords: this.extractKeywords(raw.title),
      category: raw.category,
      imageUrl: raw.image,
      productUrl: raw.url || `https://www.amazon.com/dp/${raw.asin}`,
      scrapedAt: new Date(),
    };
  }

  /**
   * Extract keywords from a product title
   */
  private extractKeywords(title: string): string[] {
    // Remove common stop words and extract meaningful keywords
    const stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
      'it', 'its', 'this', 'that', 'these', 'those', 'i', 'we', 'you',
      'he', 'she', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
      'his', 'our', 'their', '-', '|', '–', '—',
    ]);

    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word))
      .slice(0, 10);
  }

  /**
   * Search for multiple keywords and combine results
   */
  async searchMultipleKeywords(
    keywords: string[],
    options?: { maxResultsPerKeyword?: number; dedupeByAsin?: boolean }
  ): Promise<AmazonScrapeResult> {
    const maxPer = options?.maxResultsPerKeyword || 20;
    const dedupe = options?.dedupeByAsin ?? true;

    const allProducts: AmazonProductData[] = [];
    const seenAsins = new Set<string>();
    const errors: string[] = [];

    for (const keyword of keywords) {
      // Rate limiting
      if (allProducts.length > 0) {
        await this.sleep(SCRAPE_CONFIG.delayBetweenRequests);
      }

      const result = await this.searchProducts(keyword, { maxResults: maxPer });

      if (!result.success) {
        errors.push(`${keyword}: ${result.error}`);
        continue;
      }

      for (const product of result.products) {
        if (dedupe && seenAsins.has(product.asin)) {
          continue;
        }
        seenAsins.add(product.asin);
        allProducts.push(product);
      }
    }

    return {
      success: errors.length < keywords.length,
      products: allProducts,
      totalResults: allProducts.length,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let clientInstance: AmazonClient | null = null;

export function getAmazonClient(): AmazonClient {
  if (!clientInstance) {
    clientInstance = new AmazonClient();
  }
  return clientInstance;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if Amazon scraping is configured and available
 */
export async function checkAmazonScrapingStatus(): Promise<{
  configured: boolean;
  working: boolean;
  error?: string;
}> {
  if (!isDecodoConfigured()) {
    return {
      configured: false,
      working: false,
      error: 'DECODO_USERNAME and DECODO_PASSWORD not set',
    };
  }

  try {
    const client = getAmazonClient();
    // Try a simple search to verify credentials work
    const result = await client.searchProducts('test shirt', { maxResults: 1 });

    if (!result.success) {
      return {
        configured: true,
        working: false,
        error: result.error,
      };
    }

    return { configured: true, working: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('Amazon scraping health check failed', error);
    return {
      configured: true,
      working: false,
      error: message,
    };
  }
}
