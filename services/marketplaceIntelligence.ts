/**
 * Marketplace Intelligence Service
 *
 * Integrates with Decodo/Smartproxy eCommerce Scraping API to provide
 * marketplace data (Amazon, Etsy) for trend validation and opportunity detection.
 *
 * IMPORTANT: This service is designed with graceful degradation.
 * If the API is unavailable, misconfigured, or rate-limited, the system
 * continues to function without marketplace data.
 */

import {
  storeMarketplaceProduct,
  updateNicheMarketData,
  buildLearnedPatternsContext,
  isDatabaseConfigured,
} from './marketplaceLearning';

// Types
export interface MarketplaceProduct {
  id: string;
  source: 'amazon' | 'etsy';
  title: string;
  price: number;
  currency: string;
  url: string;
  asin?: string;
  reviewCount: number;
  avgRating: number;
  salesRank?: number;
  category?: string;
  seller?: string;
  imageUrl?: string;
  // Merch by Amazon detection
  isMerchByAmazon?: boolean;
  // Enhanced keyword analysis
  titleCharCount?: number;
  primaryKeywords?: string[]; // Long-tail keywords (3+ words)
  keywordRepetitions?: Record<string, number>; // How many times each keyword repeats
  designTextInTitle?: boolean; // Does title suggest design has text?
  brandStyle?: 'studio_name' | 'generic' | 'niche_specific' | 'keyword_brand';
  brandName?: string;
  bullet1CharCount?: number;
  // AI-extracted design analysis (added during processing)
  designAnalysis?: {
    hasText: boolean;
    textContent?: string;
    designStyle?: string;
    visualElements?: string[];
  };
  scrapedAt: Date;
}

export interface MarketplaceSearchResult {
  success: boolean;
  source: 'amazon' | 'etsy' | 'cache' | 'fallback';
  products: MarketplaceProduct[];
  totalResults?: number;
  searchQuery: string;
  error?: string;
  cached?: boolean;
  timestamp: Date;
}

export interface NicheIntelligence {
  niche: string;
  lastUpdated: Date;
  dataSource: 'live' | 'cached' | 'unavailable';

  // Market overview
  totalProducts: number;
  avgPrice: number;
  priceRange: { min: number; max: number };

  // Competition
  saturationLevel: 'low' | 'medium' | 'high' | 'oversaturated' | 'unknown';
  topSellers: MarketplaceProduct[];

  // Patterns (learned over time)
  winningDesignStyles: string[];
  effectiveKeywords: string[];
  commonPricePoints: number[];

  // Opportunities
  gaps: string[];
  emergingAngles: string[];
}

export interface MarketplaceConfig {
  modeName: string;
  priority: string;
  instruction: string;
  opportunityTypes: string[];
  focusAreas: string[];
}

// Simple in-memory cache (would use Redis/DB in production)
const cache = new Map<string, { data: MarketplaceSearchResult; expiry: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// API Configuration
const DECODO_API_ENDPOINT = 'https://scraper-api.decodo.com/v2/scrape';
const API_TIMEOUT_MS = 45000; // 45 seconds (increased for slow API responses)

/**
 * Check if Decodo API is configured and available
 */
export const isApiConfigured = (): boolean => {
  const username = process.env.DECODO_USERNAME;
  const password = process.env.DECODO_PASSWORD;
  return !!(username && password);
};

/**
 * Get authorization header for Decodo API
 */
const getAuthHeader = (): string => {
  const username = process.env.DECODO_USERNAME || '';
  const password = process.env.DECODO_PASSWORD || '';
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${credentials}`;
};

/**
 * Make a request to Decodo API with timeout, error handling, and retry logic
 */
const makeDecodoRequest = async (payload: Record<string, unknown>, retries = 4): Promise<unknown> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      console.log(`[MARKETPLACE] Decodo request (attempt ${attempt}/${retries}):`, JSON.stringify(payload));

      const response = await fetch(DECODO_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader(),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`[MARKETPLACE] Decodo API error: ${response.status} ${response.statusText}`);
        if (attempt < retries) {
          console.log(`[MARKETPLACE] Retrying in ${attempt * 2}s...`);
          await new Promise(r => setTimeout(r, attempt * 2000));
          continue;
        }
        return null;
      }

      const jsonResponse = await response.json();
      console.log(`[MARKETPLACE] Decodo raw response keys:`, Object.keys(jsonResponse));

      // Check for Decodo-specific error codes in response
      // Status 12000 = rate limit or temporary error
      if (Array.isArray(jsonResponse.results) && jsonResponse.results.length > 0) {
        const firstResult = jsonResponse.results[0] as Record<string, unknown>;
        const content = firstResult.content as Record<string, unknown>;

        // Convert status_code to number (API may return string or number)
        const statusCode = content ? Number(content.status_code) : 0;

        if (content && statusCode && statusCode !== 200) {
          console.error(`[MARKETPLACE] Decodo returned status ${statusCode} (type: ${typeof content.status_code})`);

          // Retry on rate limit or temporary errors (12000, 429, etc)
          // Use longer delays to give API time to recover
          if (statusCode === 12000 || statusCode === 429 || statusCode >= 500) {
            if (attempt < retries) {
              const waitTime = attempt * 5000; // 5s, 10s, 15s
              console.log(`[MARKETPLACE] Rate limited/error, retrying in ${waitTime / 1000}s (attempt ${attempt}/${retries})...`);
              await new Promise(r => setTimeout(r, waitTime));
              continue;
            }
            console.error(`[MARKETPLACE] All ${retries} retry attempts failed with status ${statusCode}`);
          }
          return null;
        }

        // Check if results.content.results is null (no data)
        if (content && content.results === null) {
          console.error(`[MARKETPLACE] Decodo returned null results (status: ${statusCode})`);
          if (attempt < retries) {
            const waitTime = attempt * 4000; // 4s, 8s, 12s
            console.log(`[MARKETPLACE] Empty results, retrying in ${waitTime / 1000}s (attempt ${attempt}/${retries})...`);
            await new Promise(r => setTimeout(r, waitTime));
            continue;
          }
          console.error(`[MARKETPLACE] All ${retries} retry attempts returned null results`);
          return null;
        }
      }

      console.log(`[MARKETPLACE] Decodo response structure:`, JSON.stringify(jsonResponse, null, 2).slice(0, 2000));
      return jsonResponse;

    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[MARKETPLACE] Decodo API request timed out');
      } else {
        console.error('[MARKETPLACE] Decodo API request failed:', error);
      }

      if (attempt < retries) {
        console.log(`[MARKETPLACE] Retrying in ${attempt * 2}s...`);
        await new Promise(r => setTimeout(r, attempt * 2000));
        continue;
      }
      return null;
    }
  }

  return null;
};

/**
 * Search Amazon for products
 */
export const searchAmazon = async (
  query: string,
  options: {
    locale?: string;
    page?: number;
    category?: string;
  } = {}
): Promise<MarketplaceSearchResult> => {
  const cacheKey = `amazon:search:${query}:${options.locale || 'en-US'}:${options.page || 1}`;

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    console.log(`[MARKETPLACE] Using cached Amazon results for "${query}"`);
    return { ...cached.data, cached: true, source: 'cache' };
  }

  // Check if API is configured
  if (!isApiConfigured()) {
    console.log('[MARKETPLACE] Decodo API not configured - returning empty result');
    return createEmptyResult(query, 'amazon', 'API not configured');
  }

  console.log(`[MARKETPLACE] Searching Amazon for "${query}"`);

  try {
    // Decodo API format: target, query, page_from (string), parse
    // Note: locale is not supported - use domain for regional targeting
    const payload = {
      target: 'amazon_search',
      query: `${query} t-shirt`,
      page_from: String(options.page || 1),  // Must be string
      parse: true,
    };

    const response = await makeDecodoRequest(payload);

    if (!response) {
      return createEmptyResult(query, 'amazon', 'API request failed');
    }

    const products = parseAmazonSearchResults(response, query);

    const result: MarketplaceSearchResult = {
      success: true,
      source: 'amazon',
      products,
      totalResults: products.length,
      searchQuery: query,
      timestamp: new Date(),
    };

    // Cache the result
    cache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL_MS });

    return result;
  } catch (error) {
    console.error('[MARKETPLACE] Amazon search error:', error);
    return createEmptyResult(query, 'amazon', 'Search failed');
  }
};

/**
 * Get Amazon product details by ASIN
 */
export const getAmazonProduct = async (asin: string): Promise<MarketplaceProduct | null> => {
  if (!isApiConfigured()) {
    console.log('[MARKETPLACE] Decodo API not configured');
    return null;
  }

  const cacheKey = `amazon:product:${asin}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.data.products[0] || null;
  }

  try {
    const payload = {
      target: 'amazon_product',
      query: asin,
      locale: 'en-US',
      parse: true,
    };

    const response = await makeDecodoRequest(payload);

    if (!response) return null;

    const product = parseAmazonProduct(response);

    if (product) {
      cache.set(cacheKey, {
        data: {
          success: true,
          source: 'amazon',
          products: [product],
          searchQuery: asin,
          timestamp: new Date()
        },
        expiry: Date.now() + CACHE_TTL_MS
      });
    }

    return product;
  } catch (error) {
    console.error('[MARKETPLACE] Amazon product fetch error:', error);
    return null;
  }
};

/**
 * Get Amazon reviews for a product
 */
export const getAmazonReviews = async (
  asin: string,
  options: { page?: number } = {}
): Promise<{ reviews: string[]; avgRating: number } | null> => {
  if (!isApiConfigured()) return null;

  try {
    const payload = {
      target: 'amazon_reviews',
      query: asin,
      locale: 'en-US',
      page_from: options.page || 1,
      parse: true,
    };

    const response = await makeDecodoRequest(payload);

    if (!response) return null;

    return parseAmazonReviews(response);
  } catch (error) {
    console.error('[MARKETPLACE] Amazon reviews fetch error:', error);
    return null;
  }
};

/**
 * Search Etsy for products
 */
export const searchEtsy = async (
  query: string,
  options: { page?: number } = {}
): Promise<MarketplaceSearchResult> => {
  const cacheKey = `etsy:search:${query}:${options.page || 1}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    console.log(`[MARKETPLACE] Using cached Etsy results for "${query}"`);
    return { ...cached.data, cached: true, source: 'cache' };
  }

  if (!isApiConfigured()) {
    console.log('[MARKETPLACE] Decodo API not configured - returning empty result');
    return createEmptyResult(query, 'etsy', 'API not configured');
  }

  console.log(`[MARKETPLACE] Searching Etsy for "${query}"`);

  try {
    // NOTE: Etsy scraping is temporarily disabled.
    // Decodo doesn't have a dedicated 'etsy_search' target - would require
    // 'universal' target with HTML parsing. Focusing on Amazon for MBA data.
    console.log('[MARKETPLACE] Etsy scraping disabled - focusing on Amazon for MBA products');
    return createEmptyResult(query, 'etsy', 'Etsy scraping temporarily disabled - use Amazon');

    /* Original Etsy implementation (requires HTML parsing):
    const etsySearchUrl = `https://www.etsy.com/search?q=${encodeURIComponent(query + ' shirt')}`;
    const payload = {
      target: 'universal',
      url: etsySearchUrl,
      headless: 'html',
    };
    const response = await makeDecodoRequest(payload);
    */

    const response = null; // Placeholder
    if (!response) {
      return createEmptyResult(query, 'etsy', 'API request failed');
    }

    const products = parseEtsySearchResults(response, query);

    const result: MarketplaceSearchResult = {
      success: true,
      source: 'etsy',
      products,
      totalResults: products.length,
      searchQuery: query,
      timestamp: new Date(),
    };

    cache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL_MS });

    return result;
  } catch (error) {
    console.error('[MARKETPLACE] Etsy search error:', error);
    return createEmptyResult(query, 'etsy', 'Search failed');
  }
};

// ============================================================================
// PARSERS - Extract structured data from API responses
// ============================================================================

const parseAmazonSearchResults = (response: unknown, query: string): MarketplaceProduct[] => {
  try {
    const data = response as Record<string, unknown>;

    // Debug: Log what paths we're trying to find products in
    console.log(`[MARKETPLACE] Parsing Amazon results. Top-level keys:`, Object.keys(data));

    // Decodo returns: { results: [{ content: { results: { results: { organic: [...], paid: [...] } } } }] }
    // We need to drill down to find the actual product arrays
    let products: Record<string, unknown>[] = [];

    // Path 1: Decodo nested structure - results[0].content.results.results.organic
    if (Array.isArray(data.results) && data.results.length > 0) {
      const wrapper = data.results[0] as Record<string, unknown>;
      if (wrapper.content && typeof wrapper.content === 'object') {
        const content = wrapper.content as Record<string, unknown>;
        if (content.results && typeof content.results === 'object') {
          const innerResults = content.results as Record<string, unknown>;
          if (innerResults.results && typeof innerResults.results === 'object') {
            const productResults = innerResults.results as Record<string, unknown>;

            // Get organic results (non-sponsored)
            if (Array.isArray(productResults.organic)) {
              products = [...products, ...productResults.organic];
              console.log(`[MARKETPLACE] Found ${productResults.organic.length} organic products`);
            }

            // Also get paid/sponsored results for more data
            if (Array.isArray(productResults.paid)) {
              products = [...products, ...productResults.paid];
              console.log(`[MARKETPLACE] Found ${productResults.paid.length} sponsored products`);
            }
          }
        }
      }
    }

    // Path 2: Simpler structure - data.results (if it's already an array of products)
    if (products.length === 0 && Array.isArray(data.results)) {
      // Check if first item looks like a product (has title, price, etc)
      const firstItem = data.results[0] as Record<string, unknown>;
      if (firstItem && (firstItem.title || firstItem.asin)) {
        products = data.results;
        console.log(`[MARKETPLACE] Found products at data.results (${products.length} items)`);
      }
    }

    // Path 3: data.content.organic or data.organic
    if (products.length === 0) {
      if (data.content && typeof data.content === 'object') {
        const content = data.content as Record<string, unknown>;
        if (Array.isArray(content.organic)) {
          products = content.organic;
          console.log(`[MARKETPLACE] Found products at data.content.organic (${products.length} items)`);
        }
      } else if (Array.isArray(data.organic)) {
        products = data.organic;
        console.log(`[MARKETPLACE] Found products at data.organic (${products.length} items)`);
      }
    }

    console.log(`[MARKETPLACE] Total products found: ${products.length}`);

    if (products.length > 0) {
      // Log full first product to see ALL available fields for MBA detection
      console.log(`[MARKETPLACE] First product FULL:`, JSON.stringify(products[0], null, 2));
    } else {
      console.log(`[MARKETPLACE] No products found. Response structure:`, JSON.stringify(data).slice(0, 1000));
    }

    // Map to results variable for compatibility
    const results = products;

    return results.slice(0, 20).map((item: Record<string, unknown>, index: number) => ({
      id: `amazon-${query}-${index}`,
      source: 'amazon' as const,
      title: String(item.title || ''),
      price: parseFloat(String(item.price || item.price_raw || '0').replace(/[^0-9.]/g, '')) || 0,
      currency: 'USD',
      url: String(item.url || item.link || ''),
      asin: String(item.asin || ''),
      reviewCount: parseInt(String(item.reviews_count || item.rating_count || '0')) || 0,
      avgRating: parseFloat(String(item.rating || item.stars || '0')) || 0,
      salesRank: item.sales_rank ? parseInt(String(item.sales_rank)) : undefined,
      // Extract seller/brand and category for MBA detection
      seller: String(item.seller || item.brand || item.merchant || item.sold_by || ''),
      category: String(item.category || item.department || ''),
      imageUrl: String(item.image || item.thumbnail || ''),
      scrapedAt: new Date(),
    }));
  } catch (error) {
    console.error('[MARKETPLACE] Error parsing Amazon results:', error);
    return [];
  }
};

const parseAmazonProduct = (response: unknown): MarketplaceProduct | null => {
  try {
    const data = response as Record<string, unknown>;

    // Debug: Log full response structure to understand where MBA tag appears
    console.log(`[MARKETPLACE] Amazon product response keys:`, Object.keys(data));

    // Decodo returns: { results: [{ content: { results: { ...product } } }] }
    // Note: Product data is at results[0].content.results (not results[0].content)
    let product: Record<string, unknown> = {};

    // Path 1: Deeply nested structure - results[0].content.results
    if (Array.isArray(data.results) && data.results.length > 0) {
      const wrapper = data.results[0] as Record<string, unknown>;
      if (wrapper.content && typeof wrapper.content === 'object') {
        const content = wrapper.content as Record<string, unknown>;
        // Product data is inside content.results
        if (content.results && typeof content.results === 'object') {
          product = content.results as Record<string, unknown>;
          console.log(`[MARKETPLACE] Found product at results[0].content.results`);
        } else if (content.title) {
          // Fallback: product directly in content
          product = content;
          console.log(`[MARKETPLACE] Found product at results[0].content`);
        }
      }
    }

    // Path 2: Direct content.results
    if (!product.title && data.content && typeof data.content === 'object') {
      const content = data.content as Record<string, unknown>;
      if (content.results && typeof content.results === 'object') {
        product = content.results as Record<string, unknown>;
        console.log(`[MARKETPLACE] Found product at data.content.results`);
      } else if (content.title) {
        product = content;
        console.log(`[MARKETPLACE] Found product at data.content`);
      }
    }

    // Path 3: Direct response
    if (!product.title && data.title) {
      product = data;
      console.log(`[MARKETPLACE] Found product at root level`);
    }

    if (!product.title) {
      console.log(`[MARKETPLACE] No title found. Response structure:`, JSON.stringify(data).slice(0, 1000));
      return null;
    }

    // Extract seller info from buybox array - MBA tag appears as seller_name
    // Structure: buybox: [{ seller_name: "Amazon Merch on Demand", ships_from_name: "..." }]
    let sellerName = '';
    let shipsFrom = '';

    if (Array.isArray(product.buybox) && product.buybox.length > 0) {
      const buybox = product.buybox[0] as Record<string, unknown>;
      sellerName = String(buybox.seller_name || '');
      shipsFrom = String(buybox.ships_from_name || '');
      console.log(`[MARKETPLACE] Buybox seller_name: "${sellerName}"`);
      console.log(`[MARKETPLACE] Buybox ships_from_name: "${shipsFrom}"`);
    }

    // Also check top-level brand/seller fields as fallback
    const brandInfo = String(product.brand || '');

    // Combine all seller-related info for MBA detection
    const allSellerText = [sellerName, shipsFrom, brandInfo].join(' ');

    console.log(`[MARKETPLACE] Product ASIN: ${product.asin}`);
    console.log(`[MARKETPLACE] Brand: "${brandInfo}"`);
    console.log(`[MARKETPLACE] All seller text: "${allSellerText}"`);

    // Check for MBA in any seller-related field
    // MBA products show seller as "Amazon.com" (not third-party sellers)
    const lowerSellerText = allSellerText.toLowerCase();
    const isMba = lowerSellerText.includes('amazon merch on demand') ||
                  lowerSellerText.includes('merch by amazon') ||
                  lowerSellerText.includes('amazon.com services llc') ||
                  sellerName.toLowerCase() === 'amazon.com' ||  // MBA products sold by Amazon.com
                  shipsFrom.toLowerCase() === 'amazon.com';     // Ships from Amazon.com

    console.log(`[MARKETPLACE] MBA detected: ${isMba}`);

    return {
      id: `amazon-${product.asin || 'unknown'}`,
      source: 'amazon',
      title: String(product.title || ''),
      price: parseFloat(String(product.price || '0').replace(/[^0-9.]/g, '')) || 0,
      currency: 'USD',
      url: String(product.url || ''),
      asin: String(product.asin || ''),
      reviewCount: parseInt(String(product.reviews_count || product.rating_count || '0')) || 0,
      avgRating: parseFloat(String(product.rating || product.stars || '0')) || 0,
      salesRank: product.sales_rank ? parseInt(String(product.sales_rank)) : undefined,
      category: String(product.category || product.department || ''),
      seller: sellerName || brandInfo, // Use seller_name from buybox, fallback to brand
      imageUrl: Array.isArray(product.images) ? String(product.images[0] || '') : String(product.image || product.thumbnail || ''),
      isMerchByAmazon: isMba, // Set MBA flag based on seller info
      scrapedAt: new Date(),
    };
  } catch (error) {
    console.error('[MARKETPLACE] Error parsing Amazon product:', error);
    return null;
  }
};

const parseAmazonReviews = (response: unknown): { reviews: string[]; avgRating: number } | null => {
  try {
    const data = response as Record<string, unknown>;
    const reviewsData = data.reviews as Record<string, unknown>[] ||
                        (data.content as Record<string, unknown>)?.reviews as Record<string, unknown>[] ||
                        [];

    const reviews = reviewsData.map((r: Record<string, unknown>) => String(r.text || r.body || r.content || ''));
    const avgRating = parseFloat(String(data.rating || data.average_rating || '0')) || 0;

    return { reviews: reviews.filter(r => r.length > 0), avgRating };
  } catch (error) {
    console.error('[MARKETPLACE] Error parsing Amazon reviews:', error);
    return null;
  }
};

const parseEtsySearchResults = (response: unknown, query: string): MarketplaceProduct[] => {
  try {
    const data = response as Record<string, unknown>;

    // Debug: Log what paths we're trying to find products in
    console.log(`[MARKETPLACE] Parsing Etsy results. data.results exists:`, !!data.results);
    console.log(`[MARKETPLACE] data.content exists:`, !!data.content);

    let results: Record<string, unknown>[] = [];

    if (Array.isArray(data.results)) {
      results = data.results;
      console.log(`[MARKETPLACE] Etsy: Found results at data.results (${results.length} items)`);
    } else if (data.content && typeof data.content === 'object') {
      const content = data.content as Record<string, unknown>;
      if (Array.isArray(content.listings)) {
        results = content.listings;
        console.log(`[MARKETPLACE] Etsy: Found results at data.content.listings (${results.length} items)`);
      } else if (Array.isArray(content.results)) {
        results = content.results;
        console.log(`[MARKETPLACE] Etsy: Found results at data.content.results (${results.length} items)`);
      } else if (Array.isArray(content.organic)) {
        results = content.organic;
        console.log(`[MARKETPLACE] Etsy: Found results at data.content.organic (${results.length} items)`);
      } else {
        console.log(`[MARKETPLACE] Etsy: data.content keys:`, Object.keys(content));
      }
    } else if (Array.isArray(data.listings)) {
      results = data.listings;
      console.log(`[MARKETPLACE] Etsy: Found results at data.listings (${results.length} items)`);
    } else if (Array.isArray(data.organic)) {
      results = data.organic;
      console.log(`[MARKETPLACE] Etsy: Found results at data.organic (${results.length} items)`);
    } else {
      console.log(`[MARKETPLACE] Etsy: Could not find products array. Top-level keys:`, Object.keys(data));
    }

    if (results.length > 0) {
      console.log(`[MARKETPLACE] Etsy: First result sample:`, JSON.stringify(results[0]).slice(0, 500));
    }

    return results.slice(0, 20).map((item: Record<string, unknown>, index: number) => ({
      id: `etsy-${query}-${index}`,
      source: 'etsy' as const,
      title: String(item.title || ''),
      price: parseFloat(String(item.price || '0').replace(/[^0-9.]/g, '')) || 0,
      currency: 'USD',
      url: String(item.url || item.link || ''),
      reviewCount: parseInt(String(item.num_reviews || item.reviews || '0')) || 0,
      avgRating: parseFloat(String(item.rating || item.stars || '0')) || 0,
      seller: String(item.shop_name || item.seller || ''),
      imageUrl: String(item.image || item.thumbnail || ''),
      scrapedAt: new Date(),
    }));
  } catch (error) {
    console.error('[MARKETPLACE] Error parsing Etsy results:', error);
    return [];
  }
};

// ============================================================================
// HYBRID MBA DETECTION - Fetch product details to reliably detect MBA
// ============================================================================

/**
 * Fetch product details for a sample of ASINs to detect MBA products
 *
 * The "Amazon Merch on Demand" tag only appears on product detail pages,
 * not in search results. This function fetches details for a sample of
 * products to reliably detect which ones are MBA.
 *
 * @param products - Products from search results (must have ASINs)
 * @param sampleSize - How many products to check (default: 5)
 * @returns Map of ASIN -> isMBA boolean
 */
export const fetchMbaDetectionForProducts = async (
  products: MarketplaceProduct[],
  sampleSize: number = 5
): Promise<{
  mbaAsins: Set<string>;
  checkedCount: number;
  mbaCount: number;
  mbaProducts: MarketplaceProduct[];
}> => {
  const result = {
    mbaAsins: new Set<string>(),
    checkedCount: 0,
    mbaCount: 0,
    mbaProducts: [] as MarketplaceProduct[],
  };

  if (!isApiConfigured()) {
    console.log('[MARKETPLACE] API not configured - skipping MBA detection');
    return result;
  }

  // Get products with ASINs
  const productsWithAsins = products.filter(p => p.asin && p.asin.length > 0);

  if (productsWithAsins.length === 0) {
    console.log('[MARKETPLACE] No products with ASINs found - skipping MBA detection');
    return result;
  }

  // Take a sample (prioritize products with more reviews as they're more likely MBA bestsellers)
  const sortedByReviews = [...productsWithAsins].sort((a, b) => b.reviewCount - a.reviewCount);
  const sample = sortedByReviews.slice(0, sampleSize);

  console.log(`[MARKETPLACE] Fetching product details for ${sample.length} ASINs to detect MBA...`);

  // Fetch product details in parallel (with small batches to avoid rate limiting)
  const batchSize = 3;
  for (let i = 0; i < sample.length; i += batchSize) {
    const batch = sample.slice(i, i + batchSize);

    const detailPromises = batch.map(async (product) => {
      try {
        const details = await getAmazonProduct(product.asin!);
        result.checkedCount++;

        if (details) {
          console.log(`[MARKETPLACE] ASIN ${product.asin}: MBA=${details.isMerchByAmazon}, seller="${details.seller?.slice(0, 50)}..."`);

          if (details.isMerchByAmazon) {
            result.mbaAsins.add(product.asin!);
            result.mbaCount++;
            result.mbaProducts.push(details);
          }
        }
      } catch (error) {
        console.log(`[MARKETPLACE] Failed to fetch details for ${product.asin}: ${error}`);
      }
    });

    await Promise.all(detailPromises);

    // Small delay between batches to avoid rate limiting
    if (i + batchSize < sample.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`[MARKETPLACE] MBA detection complete: ${result.mbaCount}/${result.checkedCount} products are MBA`);

  return result;
};

/**
 * Enhanced search that includes MBA detection via product detail fetching
 *
 * This performs:
 * 1. Normal Amazon search to get product listings
 * 2. Fetches product details for sample to detect MBA
 * 3. Returns enriched results with accurate MBA flags
 */
export const searchAmazonWithMbaDetection = async (
  query: string,
  options: {
    locale?: string;
    page?: number;
    category?: string;
    mbaSampleSize?: number;
  } = {}
): Promise<MarketplaceSearchResult & { mbaStats: { checked: number; found: number } }> => {
  const { mbaSampleSize = 5, ...searchOptions } = options;

  // Step 1: Normal search
  const searchResult = await searchAmazon(query, searchOptions);

  if (!searchResult.success || searchResult.products.length === 0) {
    return {
      ...searchResult,
      mbaStats: { checked: 0, found: 0 },
    };
  }

  console.log(`[MARKETPLACE] Search found ${searchResult.products.length} products, now detecting MBA...`);

  // Step 2: Fetch product details for sample to detect MBA
  const mbaDetection = await fetchMbaDetectionForProducts(searchResult.products, mbaSampleSize);

  // Step 3: Update products with MBA detection results
  const enrichedProducts = searchResult.products.map(product => {
    if (product.asin && mbaDetection.mbaAsins.has(product.asin)) {
      return { ...product, isMerchByAmazon: true };
    }
    return product;
  });

  return {
    ...searchResult,
    products: enrichedProducts,
    mbaStats: {
      checked: mbaDetection.checkedCount,
      found: mbaDetection.mbaCount,
    },
  };
};

// ============================================================================
// INTELLIGENCE - Analyze marketplace data for opportunities
// ============================================================================

/**
 * Build comprehensive niche intelligence from marketplace data
 */
export const buildNicheIntelligence = async (
  query: string
): Promise<NicheIntelligence> => {
  // Try to get data from both Amazon and Etsy
  const [amazonResults, etsyResults] = await Promise.all([
    searchAmazon(query),
    searchEtsy(query),
  ]);

  const allProducts = [...amazonResults.products, ...etsyResults.products];

  // If no data available, return unknown state
  if (allProducts.length === 0) {
    return createEmptyIntelligence(query, amazonResults.error || etsyResults.error);
  }

  // Calculate metrics
  const prices = allProducts.map(p => p.price).filter(p => p > 0);
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  // Determine saturation level
  let saturationLevel: NicheIntelligence['saturationLevel'] = 'unknown';
  if (allProducts.length > 500) saturationLevel = 'oversaturated';
  else if (allProducts.length > 200) saturationLevel = 'high';
  else if (allProducts.length > 50) saturationLevel = 'medium';
  else if (allProducts.length > 0) saturationLevel = 'low';

  // Get top sellers (by review count as proxy for sales)
  const topSellers = [...allProducts]
    .sort((a, b) => b.reviewCount - a.reviewCount)
    .slice(0, 10);

  // Extract patterns from titles
  const effectiveKeywords = extractKeywordsFromTitles(topSellers.map(p => p.title));
  const commonPricePoints = findCommonPricePoints(prices);

  // Detect gaps (simplified - AI will do deeper analysis)
  const gaps = detectGaps(allProducts, query);
  const emergingAngles = detectEmergingAngles(allProducts);

  return {
    niche: query,
    lastUpdated: new Date(),
    dataSource: allProducts.length > 0 ? 'live' : 'unavailable',
    totalProducts: allProducts.length,
    avgPrice: Math.round(avgPrice * 100) / 100,
    priceRange: { min: minPrice, max: maxPrice },
    saturationLevel,
    topSellers,
    winningDesignStyles: [], // AI will analyze this
    effectiveKeywords,
    commonPricePoints,
    gaps,
    emergingAngles,
  };
};

/**
 * Get marketplace configuration based on virality mode
 */
export const getMarketplaceConfig = (viralityLevel: number): MarketplaceConfig => {
  if (viralityLevel <= 25) {
    return {
      modeName: 'SAFE/COMMERCIAL',
      priority: 'HIGH - Follow the market',
      instruction: `MARKETPLACE DATA IS YOUR PRIMARY GUIDE.
- Prioritize designs similar to proven bestsellers
- Use keywords from top-performing listings
- Stay within established price ranges
- Avoid experimental or untested concepts
- If market is too small or unproven, suggest alternatives`,
      opportunityTypes: ['IMPROVE', 'MERGE'],
      focusAreas: [
        'Bestselling designs to learn from',
        'Proven keywords and title structures',
        'Safe price points',
        'High-review products to emulate'
      ],
    };
  } else if (viralityLevel <= 50) {
    return {
      modeName: 'BALANCED',
      priority: 'MEDIUM - Validate and differentiate',
      instruction: `USE MARKETPLACE DATA TO VALIDATE AND FIND ANGLES.
- Confirm trend has some commercial viability
- Find gaps in existing offerings (style, audience, angle)
- Merge trending topic with proven design approaches
- Balance fresh ideas with market evidence
- Don't just copy - differentiate`,
      opportunityTypes: ['GAP', 'MERGE', 'IMPROVE'],
      focusAreas: [
        'Does this trend have marketplace presence?',
        'Is competition reasonable?',
        'What design styles are working?',
        'Where are the gaps?'
      ],
    };
  } else if (viralityLevel <= 75) {
    return {
      modeName: 'AGGRESSIVE',
      priority: 'MEDIUM-LOW - Find whitespace',
      instruction: `USE MARKETPLACE DATA TO FIND WHAT'S MISSING.
- Low/no competition is a POSITIVE signal
- Look for trending topics with minimal marketplace presence
- Prioritize being first over being safe
- Use trend language over proven keywords
- If market already crowded, SKIP - find something fresher`,
      opportunityTypes: ['GAP', 'TIMING'],
      focusAreas: [
        'Where is the trend NOT yet on marketplace?',
        'What sub-niches are empty?',
        'Ignore bestsellers - find whitespace',
        'What COULD work that nobody is doing?'
      ],
    };
  } else {
    return {
      modeName: 'PREDICTIVE',
      priority: 'LOW (Inverse signal)',
      instruction: `MARKETPLACE DATA IS AN INVERSE SIGNAL.
- If something is already selling well, you're too late
- Look for trends with ZERO marketplace presence
- High risk, high reward - don't play it safe
- Create listings that will DEFINE the category
- Ignore "proven" patterns - create new ones`,
      opportunityTypes: ['GAP', 'TIMING'],
      focusAreas: [
        'If it exists on Amazon, it might be TOO LATE',
        'Zero marketplace presence = opportunity',
        'Create new categories',
        'Use marketplace data only to AVOID saturated spaces'
      ],
    };
  }
};

/**
 * Build context string for AI consumption based on mode
 */
export const buildMarketplaceContext = async (
  query: string,
  viralityLevel: number
): Promise<string> => {
  const config = getMarketplaceConfig(viralityLevel);
  const intelligence = await buildNicheIntelligence(query);

  // Try to get learned patterns (gracefully fails if DB not available)
  let learnedPatternsContext = '';
  try {
    if (await isDatabaseConfigured()) {
      learnedPatternsContext = await buildLearnedPatternsContext(query);
    }
  } catch (error) {
    console.log('[MARKETPLACE] Learned patterns unavailable:', error);
  }

  // Store scraped data for learning (async, don't block)
  storeScrapedDataAsync(query, intelligence);

  // If no data available, return minimal context (but still include learned patterns if available)
  if (intelligence.dataSource === 'unavailable') {
    return `
═══════════════════════════════════════════════════════════════
MARKETPLACE INTELLIGENCE: UNAVAILABLE
═══════════════════════════════════════════════════════════════

Marketplace data could not be retrieved for "${query}".
Reason: ${intelligence.gaps[0] || 'API unavailable or not configured'}

PROCEED WITHOUT MARKETPLACE DATA:
- Continue with trend research from other sources
- Make design decisions based on cultural signals
- Consider this a higher-risk opportunity (less validation)
═══════════════════════════════════════════════════════════════
${learnedPatternsContext}
`;
  }

  // Build mode-appropriate context
  const topSellersSection = viralityLevel <= 50
    ? formatTopSellers(intelligence.topSellers)
    : `(Top sellers de-prioritized in ${config.modeName} mode - focus on gaps instead)`;

  const gapsSection = viralityLevel >= 50
    ? formatGaps(intelligence.gaps, intelligence.emergingAngles)
    : `(Gap analysis available but not prioritized in ${config.modeName} mode)`;

  return `
═══════════════════════════════════════════════════════════════
MARKETPLACE INTELLIGENCE FOR "${query}"
Mode: ${config.modeName} | Priority: ${config.priority}
═══════════════════════════════════════════════════════════════

${config.instruction}

FOCUS AREAS FOR THIS MODE:
${config.focusAreas.map(f => `• ${f}`).join('\n')}

───────────────────────────────────────────────────────────────
MARKET STATE
───────────────────────────────────────────────────────────────
• Total products found: ${intelligence.totalProducts}
• Saturation level: ${intelligence.saturationLevel.toUpperCase()}
• Price range: $${intelligence.priceRange.min.toFixed(2)} - $${intelligence.priceRange.max.toFixed(2)}
• Average price: $${intelligence.avgPrice.toFixed(2)}

${viralityLevel <= 50 ? `
───────────────────────────────────────────────────────────────
TOP SELLERS (Learn from these)
───────────────────────────────────────────────────────────────
${topSellersSection}

EFFECTIVE KEYWORDS: ${intelligence.effectiveKeywords.slice(0, 10).join(', ') || 'None detected'}
COMMON PRICE POINTS: ${intelligence.commonPricePoints.map(p => '$' + p.toFixed(2)).join(', ') || 'Varied'}
` : ''}

${viralityLevel >= 25 ? `
───────────────────────────────────────────────────────────────
OPPORTUNITIES & GAPS
───────────────────────────────────────────────────────────────
${gapsSection}
` : ''}

───────────────────────────────────────────────────────────────
OPPORTUNITY TYPES TO CONSIDER: ${config.opportunityTypes.join(', ')}
───────────────────────────────────────────────────────────────

USE THIS DATA AS INSTRUCTED FOR ${config.modeName} MODE.
Data freshness: ${intelligence.lastUpdated.toISOString()}
═══════════════════════════════════════════════════════════════
${learnedPatternsContext}
`;
};

// ============================================================================
// LEARNING ENGINE INTEGRATION
// ============================================================================

/**
 * Store scraped data asynchronously for learning (doesn't block main flow)
 */
const storeScrapedDataAsync = (query: string, intelligence: NicheIntelligence): void => {
  // Run in background - don't await
  (async () => {
    try {
      if (!(await isDatabaseConfigured())) {
        return;
      }

      // Store top products for pattern learning
      for (const product of intelligence.topSellers.slice(0, 10)) {
        try {
          await storeMarketplaceProduct({
            externalId: product.id,
            source: product.source,
            title: product.title,
            price: product.price,
            url: product.url,
            reviewCount: product.reviewCount,
            avgRating: product.avgRating,
            salesRank: product.salesRank,
            category: product.category,
            seller: product.seller,
            imageUrl: product.imageUrl,
            niche: query,
          });
        } catch (productError) {
          // Silently continue - individual product storage failure shouldn't stop others
          console.log(`[MARKETPLACE] Could not store product: ${productError}`);
        }
      }

      // Update niche market data (recalculates from stored products)
      try {
        await updateNicheMarketData(query);
      } catch (nicheError) {
        console.log(`[MARKETPLACE] Could not update niche data: ${nicheError}`);
      }

      console.log(`[MARKETPLACE] Stored data for "${query}" for future learning`);
    } catch (error) {
      // Silently fail - learning storage should never break main functionality
      console.log('[MARKETPLACE] Background data storage failed:', error);
    }
  })();
};

// ============================================================================
// HELPERS
// ============================================================================

const createEmptyResult = (
  query: string,
  source: 'amazon' | 'etsy',
  error: string
): MarketplaceSearchResult => ({
  success: false,
  source: 'fallback',
  products: [],
  searchQuery: query,
  error,
  timestamp: new Date(),
});

const createEmptyIntelligence = (query: string, error?: string): NicheIntelligence => ({
  niche: query,
  lastUpdated: new Date(),
  dataSource: 'unavailable',
  totalProducts: 0,
  avgPrice: 0,
  priceRange: { min: 0, max: 0 },
  saturationLevel: 'unknown',
  topSellers: [],
  winningDesignStyles: [],
  effectiveKeywords: [],
  commonPricePoints: [],
  gaps: [error || 'Marketplace data unavailable'],
  emergingAngles: [],
});

const extractKeywordsFromTitles = (titles: string[]): string[] => {
  const wordCounts = new Map<string, number>();
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'shirt', 'tshirt', 't-shirt', 'tee']);

  titles.forEach(title => {
    const words = title.toLowerCase().split(/\s+/);
    words.forEach(word => {
      const cleaned = word.replace(/[^a-z]/g, '');
      if (cleaned.length > 2 && !stopWords.has(cleaned)) {
        wordCounts.set(cleaned, (wordCounts.get(cleaned) || 0) + 1);
      }
    });
  });

  return Array.from(wordCounts.entries())
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
};

const findCommonPricePoints = (prices: number[]): number[] => {
  if (prices.length === 0) return [];

  // Round to nearest dollar and count
  const priceCounts = new Map<number, number>();
  prices.forEach(p => {
    const rounded = Math.round(p);
    priceCounts.set(rounded, (priceCounts.get(rounded) || 0) + 1);
  });

  return Array.from(priceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([price]) => price);
};

const detectGaps = (products: MarketplaceProduct[], query: string): string[] => {
  const gaps: string[] = [];

  // Check for low competition
  if (products.length < 50) {
    gaps.push(`Low competition: Only ${products.length} products found`);
  }

  // Check for weak listings (low reviews)
  const weakListings = products.filter(p => p.reviewCount < 10);
  if (weakListings.length > products.length * 0.5) {
    gaps.push('Many competitors have weak listings (few reviews)');
  }

  // Check for high prices (room to undercut)
  const avgPrice = products.reduce((a, b) => a + b.price, 0) / products.length;
  if (avgPrice > 25) {
    gaps.push(`Higher price point niche (avg $${avgPrice.toFixed(2)}) - room for value positioning`);
  }

  return gaps;
};

const detectEmergingAngles = (products: MarketplaceProduct[]): string[] => {
  // This would be enhanced with AI analysis
  // For now, return placeholder
  return ['AI will analyze design patterns for emerging angles'];
};

const formatTopSellers = (products: MarketplaceProduct[]): string => {
  if (products.length === 0) return 'No top sellers found';

  return products.slice(0, 5).map((p, i) => `
${i + 1}. "${p.title.slice(0, 60)}${p.title.length > 60 ? '...' : ''}"
   Price: $${p.price.toFixed(2)} | Reviews: ${p.reviewCount} | Rating: ${p.avgRating}/5
   Source: ${p.source}${p.asin ? ` | ASIN: ${p.asin}` : ''}
`).join('');
};

const formatGaps = (gaps: string[], emergingAngles: string[]): string => {
  const gapLines = gaps.map(g => `• GAP: ${g}`).join('\n');
  const angleLines = emergingAngles.map(a => `• EMERGING: ${a}`).join('\n');
  return `${gapLines}\n${angleLines}` || 'No clear gaps detected';
};

// ============================================================================
// TRENDING T-SHIRT DISCOVERY
// Scrape best sellers and trending designs to learn what works
// ============================================================================

/**
 * Pre-defined queries to discover trending t-shirt designs
 * These target high-performing, diverse niches on Amazon/Etsy
 */
export const TRENDING_SCRAPE_QUERIES = [
  // Best sellers / general
  'graphic tshirt best seller',
  'funny t shirt best seller',

  // Professions (proven high-volume niches)
  'nurse shirt funny',
  'teacher shirt funny',
  'trucker shirt',
  'mechanic shirt funny',
  'electrician shirt',

  // Hobbies (evergreen demand)
  'fishing shirt funny',
  'hunting shirt',
  'gardening shirt',
  'camping shirt',
  'golf shirt funny',

  // Family (gift market)
  'dad shirt funny',
  'mom shirt funny',
  'grandpa shirt',
  'grandma shirt',

  // Animals
  'dog lover shirt',
  'cat mom shirt',
  'horse girl shirt',

  // Food & Drink
  'coffee shirt funny',
  'beer shirt',
  'bbq shirt',

  // Seasonal (adjust based on current month)
  'christmas shirt funny',
  'halloween shirt',
];

/**
 * Scrape trending t-shirts across multiple niches
 *
 * This function is designed to be called periodically (e.g., daily)
 * to keep the learning engine updated with current market data.
 */
export const scrapeTrendingTshirts = async (options?: {
  queries?: string[];
  sources?: ('amazon' | 'etsy')[];
  limitPerQuery?: number;
  onProgress?: (message: string) => void;
  filterGraphicTeesOnly?: boolean; // Filter out blanks, polos, etc.
  filterMbaOnly?: boolean; // Only store Merch by Amazon products
}): Promise<{
  success: boolean;
  queriesProcessed: number;
  productsFound: number;
  productsFiltered: number;
  productsStored: number;
  mbaProductsFound: number;
  errors: string[];
}> => {
  const {
    queries = TRENDING_SCRAPE_QUERIES,
    sources = ['amazon', 'etsy'],
    limitPerQuery = 30,
    onProgress,
    filterGraphicTeesOnly = true,
    filterMbaOnly = false,
  } = options || {};

  const results = {
    success: false,
    queriesProcessed: 0,
    productsFound: 0,
    productsFiltered: 0,
    productsStored: 0,
    mbaProductsFound: 0,
    errors: [] as string[],
  };

  if (!isApiConfigured()) {
    results.errors.push('Decodo API not configured');
    return results;
  }

  console.log(`[TRENDING] Starting scrape of ${queries.length} queries from ${sources.join(', ')}`);
  console.log(`[TRENDING] Filters: graphicTeesOnly=${filterGraphicTeesOnly}, mbaOnly=${filterMbaOnly}`);

  for (const query of queries) {
    try {
      onProgress?.(`Scraping: ${query}`);
      console.log(`[TRENDING] Scraping: "${query}"`);

      // Scrape each source
      for (const source of sources) {
        try {
          const searchResult = source === 'amazon'
            ? await searchAmazon(query, { page: 1 })
            : await searchEtsy(query, { page: 1 });

          if (searchResult.success && searchResult.products.length > 0) {
            results.productsFound += searchResult.products.length;

            // Filter and enhance products (limit to limitPerQuery)
            let productsToStore = searchResult.products.slice(0, limitPerQuery);

            // Filter for graphic tees (not blanks/polos)
            if (filterGraphicTeesOnly) {
              const beforeFilter = productsToStore.length;
              productsToStore = productsToStore.filter(p => isGraphicTee(p.title));
              results.productsFiltered += beforeFilter - productsToStore.length;
            }

            // Enhance all products with analysis
            productsToStore = productsToStore.map(p => enhanceProductWithAnalysis(p));

            // Count MBA products
            const mbaProducts = productsToStore.filter(p => p.isMerchByAmazon);
            results.mbaProductsFound += mbaProducts.length;

            // Optionally filter for MBA only
            if (filterMbaOnly) {
              const beforeMbaFilter = productsToStore.length;
              productsToStore = mbaProducts;
              results.productsFiltered += beforeMbaFilter - productsToStore.length;
            }

            // Store filtered and enhanced products
            for (const product of productsToStore) {
              try {
                await storeMarketplaceProduct({
                  source,
                  externalId: product.asin || product.id,
                  title: product.title,
                  price: product.price,
                  url: product.url,
                  reviewCount: product.reviewCount,
                  avgRating: product.avgRating,
                  salesRank: product.salesRank,
                  category: product.category,
                  seller: product.seller,
                  imageUrl: product.imageUrl,
                  niche: query,
                  // Enhanced fields
                  isMerchByAmazon: product.isMerchByAmazon,
                  titleCharCount: product.titleCharCount,
                  primaryKeywords: product.primaryKeywords,
                  keywordRepetitions: product.keywordRepetitions,
                  designTextInTitle: product.designTextInTitle,
                  brandStyle: product.brandStyle,
                  brandName: product.brandName,
                });
                results.productsStored++;
              } catch (storeError) {
                // Don't fail the whole operation for one product
                console.error(`[TRENDING] Failed to store product: ${storeError}`);
              }
            }
          }
        } catch (sourceError) {
          results.errors.push(`${source}/${query}: ${sourceError instanceof Error ? sourceError.message : 'Unknown error'}`);
        }
      }

      results.queriesProcessed++;

      // Update niche data after scraping
      await updateNicheMarketData(query);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (queryError) {
      results.errors.push(`${query}: ${queryError instanceof Error ? queryError.message : 'Unknown error'}`);
    }
  }

  results.success = results.productsStored > 0;

  console.log(`[TRENDING] Complete: ${results.queriesProcessed} queries, ${results.productsStored} products stored`);
  console.log(`[TRENDING] MBA products found: ${results.mbaProductsFound}, filtered out: ${results.productsFiltered}`);
  if (results.errors.length > 0) {
    console.log(`[TRENDING] Errors: ${results.errors.length}`);
  }

  return results;
};

/**
 * Get suggested queries based on current date/season
 */
export const getSeasonalQueries = (): string[] => {
  const now = new Date();
  const month = now.getMonth(); // 0-11

  const seasonal: string[] = [];

  // Christmas season (Nov-Dec)
  if (month === 10 || month === 11) {
    seasonal.push('christmas shirt funny', 'ugly christmas sweater', 'holiday shirt');
  }

  // Halloween (Sep-Oct)
  if (month === 8 || month === 9) {
    seasonal.push('halloween shirt', 'spooky shirt', 'witch shirt');
  }

  // Summer (Jun-Aug)
  if (month >= 5 && month <= 7) {
    seasonal.push('summer shirt', 'beach shirt', '4th of july shirt', 'vacation shirt');
  }

  // Spring (Mar-May)
  if (month >= 2 && month <= 4) {
    seasonal.push('mothers day shirt', 'easter shirt', 'spring shirt');
  }

  // Father's Day (June)
  if (month === 5) {
    seasonal.push('fathers day shirt', 'dad gift shirt');
  }

  // Back to school (Aug)
  if (month === 7) {
    seasonal.push('back to school shirt', 'teacher first day shirt');
  }

  return seasonal;
};

// ============================================================================
// ENHANCED PRODUCT ANALYSIS
// Detect MBA products, analyze keywords, filter for graphic tees
// ============================================================================

/**
 * Terms that indicate a product is NOT a graphic tee (should be filtered out)
 */
const NON_GRAPHIC_TEE_TERMS = [
  'blank', 'plain', 'polo', 'henley', 'v-neck basic', 'undershirt',
  'compression', 'athletic fit basic', 'work shirt', 'uniform',
  'pack of', 'multipack', '3-pack', '5-pack', '6-pack',
];

/**
 * Terms that indicate design text is present on the shirt
 */
const DESIGN_TEXT_INDICATORS = [
  'funny', 'saying', 'quote', 'slogan', 'text', 'words',
  'humor', 'sarcastic', 'novelty', 'joke', 'pun',
];

/**
 * Check if a product is likely a graphic tee (not blank/polo/etc)
 */
export const isGraphicTee = (title: string): boolean => {
  const lowerTitle = title.toLowerCase();

  // Check for non-graphic tee indicators
  for (const term of NON_GRAPHIC_TEE_TERMS) {
    if (lowerTitle.includes(term)) {
      return false;
    }
  }

  // Look for positive graphic tee indicators
  const graphicIndicators = [
    'graphic', 'funny', 'vintage', 'retro', 'design', 'print',
    'novelty', 'cool', 'awesome', 'gift', 'birthday',
  ];

  for (const indicator of graphicIndicators) {
    if (lowerTitle.includes(indicator)) {
      return true;
    }
  }

  // Default to true if no strong signals either way
  // (most t-shirt searches return graphic tees)
  return true;
};

/**
 * Detect if product is from Merch by Amazon
 *
 * The ONLY reliable indicator is the "Amazon Merch on Demand" tag that appears
 * on MBA product pages underneath the price. This text may appear in:
 * - seller field
 * - brand field
 * - category field
 * - or other metadata returned by the API
 *
 * NOTE: Price ranges and brand patterns like "Solid Colors" are NOT reliable
 * indicators and should not be used.
 */
export const detectMerchByAmazon = (product: {
  seller?: string;
  category?: string;
  title?: string;
  url?: string;
}): boolean => {
  // Combine all available text fields to search for the MBA tag
  const searchText = [
    product.seller || '',
    product.category || '',
    product.title || '',
  ].join(' ').toLowerCase();

  // The ONLY reliable indicator - the actual MBA tag text
  const mbaIndicators = [
    'amazon merch on demand',
    'merch by amazon',
    'amazon.com services llc',  // Sometimes appears as seller for MBA products
  ];

  for (const indicator of mbaIndicators) {
    if (searchText.includes(indicator)) {
      return true;
    }
  }

  return false;
};

/**
 * Extract long-tail keyword phrases (3+ words) from title
 */
export const extractLongTailKeywords = (title: string): string[] => {
  const words = title.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);

  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'to', 'of', 'in', 'on',
    'is', 'are', 'was', 'be', 'this', 'that', 'it', 'as', 'at', 'by', 'from',
    'shirt', 'tshirt', 't-shirt', 'tee', 'top', 'apparel', 'clothing',
  ]);

  const phrases: string[] = [];

  // Extract 3-word phrases
  for (let i = 0; i <= words.length - 3; i++) {
    const phrase = words.slice(i, i + 3);
    const hasStopWordStart = stopWords.has(phrase[0]);
    const hasStopWordEnd = stopWords.has(phrase[2]);

    if (!hasStopWordStart && !hasStopWordEnd) {
      phrases.push(phrase.join(' '));
    }
  }

  // Extract 4-word phrases
  for (let i = 0; i <= words.length - 4; i++) {
    const phrase = words.slice(i, i + 4);
    const hasStopWordStart = stopWords.has(phrase[0]);
    const hasStopWordEnd = stopWords.has(phrase[3]);

    if (!hasStopWordStart && !hasStopWordEnd) {
      phrases.push(phrase.join(' '));
    }
  }

  return [...new Set(phrases)]; // Remove duplicates
};

/**
 * Count keyword repetitions in title
 */
export const countKeywordRepetitions = (title: string): Record<string, number> => {
  const words = title.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'to', 'of', 'in', 'on',
    'shirt', 'tshirt', 'tee',
  ]);

  const counts: Record<string, number> = {};

  for (const word of words) {
    if (!stopWords.has(word)) {
      counts[word] = (counts[word] || 0) + 1;
    }
  }

  // Only return words that appear more than once
  return Object.fromEntries(
    Object.entries(counts).filter(([_, count]) => count > 1)
  );
};

/**
 * Detect if title suggests the design has text
 */
export const hasDesignTextIndicator = (title: string): boolean => {
  const lowerTitle = title.toLowerCase();
  return DESIGN_TEXT_INDICATORS.some(term => lowerTitle.includes(term));
};

/**
 * Analyze brand style from title/seller
 */
export const analyzeBrandStyle = (title: string, seller?: string): {
  style: 'studio_name' | 'generic' | 'niche_specific' | 'keyword_brand';
  brandName?: string;
} => {
  const lowerTitle = title.toLowerCase();
  const lowerSeller = seller?.toLowerCase() || '';

  // Look for studio/brand name patterns (usually at start or end of title)
  const words = title.split(/\s+/);
  const firstWord = words[0] || '';
  const lastWord = words[words.length - 1] || '';

  // Generic brand indicators
  if (lowerSeller.includes('solid colors') || lowerSeller.includes('heather')) {
    return { style: 'generic' };
  }

  // Niche-specific brand (contains niche keyword in brand)
  const nicheKeywords = ['nurse', 'teacher', 'fishing', 'hunting', 'dad', 'mom', 'dog', 'cat'];
  for (const keyword of nicheKeywords) {
    if (lowerSeller.includes(keyword)) {
      return { style: 'niche_specific', brandName: seller };
    }
  }

  // Keyword brand (brand name is just keywords)
  const keywordBrandPattern = /^(funny|cool|awesome|best|great)\s/i;
  if (keywordBrandPattern.test(firstWord)) {
    return { style: 'keyword_brand' };
  }

  // Studio name (appears to be an actual brand)
  if (seller && seller.length < 30 && !lowerSeller.includes('amazon')) {
    return { style: 'studio_name', brandName: seller };
  }

  return { style: 'generic' };
};

/**
 * Enhance a product with additional analysis
 */
export const enhanceProductWithAnalysis = (product: MarketplaceProduct): MarketplaceProduct => {
  const enhanced = { ...product };

  // Title analysis
  enhanced.titleCharCount = product.title.length;
  enhanced.primaryKeywords = extractLongTailKeywords(product.title);
  enhanced.keywordRepetitions = countKeywordRepetitions(product.title);
  enhanced.designTextInTitle = hasDesignTextIndicator(product.title);

  // Brand analysis
  const brandAnalysis = analyzeBrandStyle(product.title, product.seller);
  enhanced.brandStyle = brandAnalysis.style;
  enhanced.brandName = brandAnalysis.brandName;

  // MBA detection
  enhanced.isMerchByAmazon = detectMerchByAmazon(product);

  return enhanced;
};

/**
 * Filter products to only include graphic tees
 */
export const filterGraphicTees = (products: MarketplaceProduct[]): MarketplaceProduct[] => {
  return products.filter(p => isGraphicTee(p.title));
};

/**
 * Filter products to only include Merch by Amazon items
 */
export const filterMerchByAmazon = (products: MarketplaceProduct[]): MarketplaceProduct[] => {
  return products.filter(p => p.isMerchByAmazon === true);
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  searchAmazon,
  searchEtsy,
  getAmazonProduct,
  getAmazonReviews,
  buildNicheIntelligence,
  buildMarketplaceContext,
  getMarketplaceConfig,
  isApiConfigured,
  scrapeTrendingTshirts,
  getSeasonalQueries,
  TRENDING_SCRAPE_QUERIES,
  // Enhanced analysis
  isGraphicTee,
  detectMerchByAmazon,
  extractLongTailKeywords,
  countKeywordRepetitions,
  hasDesignTextIndicator,
  analyzeBrandStyle,
  enhanceProductWithAnalysis,
  filterGraphicTees,
  filterMerchByAmazon,
  // Hybrid MBA detection
  fetchMbaDetectionForProducts,
  searchAmazonWithMbaDetection,
};
