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
const API_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Check if Decodo API is configured and available
 */
const isApiConfigured = (): boolean => {
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
 * Make a request to Decodo API with timeout and error handling
 */
const makeDecodoRequest = async (payload: Record<string, unknown>): Promise<unknown> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
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
      return null;
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[MARKETPLACE] Decodo API request timed out');
    } else {
      console.error('[MARKETPLACE] Decodo API request failed:', error);
    }
    return null;
  }
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
    const payload = {
      target: 'amazon_search',
      query: `${query} t-shirt`,
      locale: options.locale || 'en-US',
      page_from: options.page || 1,
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
    const payload = {
      target: 'etsy_search',
      query: `${query} shirt`,
      parse: true,
    };

    const response = await makeDecodoRequest(payload);

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
    const results = data.results as Record<string, unknown>[] ||
                   (data.content as Record<string, unknown>)?.results as Record<string, unknown>[] ||
                   [];

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
    const product = data.content as Record<string, unknown> || data;

    if (!product.title) return null;

    return {
      id: `amazon-${product.asin || 'unknown'}`,
      source: 'amazon',
      title: String(product.title || ''),
      price: parseFloat(String(product.price || '0').replace(/[^0-9.]/g, '')) || 0,
      currency: 'USD',
      url: String(product.url || ''),
      asin: String(product.asin || ''),
      reviewCount: parseInt(String(product.reviews_count || '0')) || 0,
      avgRating: parseFloat(String(product.rating || '0')) || 0,
      salesRank: product.sales_rank ? parseInt(String(product.sales_rank)) : undefined,
      category: String(product.category || ''),
      seller: String(product.seller || ''),
      imageUrl: String(product.image || ''),
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
    const results = data.results as Record<string, unknown>[] ||
                   (data.content as Record<string, unknown>)?.listings as Record<string, unknown>[] ||
                   [];

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
            currency: product.currency,
            url: product.url,
            asin: product.asin,
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

      // Update niche market data
      try {
        await updateNicheMarketData({
          niche: query,
          totalProducts: intelligence.totalProducts,
          avgPrice: intelligence.avgPrice,
          priceMin: intelligence.priceRange.min,
          priceMax: intelligence.priceRange.max,
          saturationLevel: intelligence.saturationLevel,
          topKeywords: intelligence.effectiveKeywords,
          commonPricePoints: intelligence.commonPricePoints,
        });
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
};
