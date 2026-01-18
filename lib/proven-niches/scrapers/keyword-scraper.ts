/**
 * Proven Niches Pipeline - Keyword Scraper
 *
 * Discovers and analyzes keywords for niche research.
 */

import { getAmazonClient } from '../client/amazon-client';
import { NicheKeywordData, KeywordAnalysis, AmazonProductData } from '../types';
import { SCRAPE_CONFIG, log, logError } from '../config';
import { storeKeyword, getKeyword } from '../storage/niche-store';

// =============================================================================
// KEYWORD ANALYSIS
// =============================================================================

/**
 * Analyze a keyword's potential based on Amazon search results
 */
export async function analyzeKeyword(keyword: string): Promise<KeywordAnalysis> {
  const client = getAmazonClient();

  if (!client.isConfigured()) {
    throw new Error('Decodo API not configured');
  }

  log(`Analyzing keyword: "${keyword}"`);

  // Search for the keyword
  const result = await client.searchProducts(keyword, {
    maxResults: 48, // Get enough products for analysis
  });

  if (!result.success || result.products.length === 0) {
    throw new Error(result.error || 'No products found for keyword');
  }

  const products = result.products;

  // Calculate metrics
  const avgReviews = calculateAverage(products.map((p) => p.reviewCount));
  const avgBsr = calculateAverage(
    products.filter((p) => p.bsr).map((p) => p.bsr!)
  );

  // Competition score (0-1, higher = more competition)
  const competitionScore = calculateCompetitionScore(products);

  // Opportunity score (inverse of competition, adjusted by demand)
  const opportunityScore = Math.max(0, 1 - competitionScore) * (avgBsr < 500000 ? 1 : 0.5);

  // Extract related keywords from product titles
  const relatedKeywords = extractRelatedKeywords(products, keyword);

  // Store keyword data
  const keywordData: NicheKeywordData = {
    keyword,
    searchVolume: undefined, // Would need separate API for this
    competition: competitionScore,
    amazonResults: result.totalResults,
    topBsr: products[0]?.bsr,
    relatedKeywords,
    lastUpdatedAt: new Date(),
  };

  await storeKeyword(keywordData);

  return {
    keyword,
    searchVolume: 0, // Placeholder
    competition: competitionScore,
    opportunity: opportunityScore,
    relatedKeywords,
    topProducts: products.slice(0, 10),
  };
}

/**
 * Discover related keywords from a seed keyword
 */
export async function discoverRelatedKeywords(
  seedKeyword: string,
  depth: number = 1
): Promise<string[]> {
  const discovered = new Set<string>();
  const processed = new Set<string>();

  // Start with seed
  const toProcess = [seedKeyword];

  for (let level = 0; level < depth && toProcess.length > 0; level++) {
    const current = toProcess.shift()!;

    if (processed.has(current)) continue;
    processed.add(current);

    try {
      // Analyze current keyword
      const analysis = await analyzeKeyword(current);

      // Add related keywords
      for (const related of analysis.relatedKeywords) {
        if (!processed.has(related) && !discovered.has(related)) {
          discovered.add(related);
          if (level < depth - 1) {
            toProcess.push(related);
          }
        }
      }

      // Rate limit
      await sleep(SCRAPE_CONFIG.delayBetweenRequests);

    } catch (error) {
      logError(`Failed to analyze keyword "${current}"`, error);
    }
  }

  return Array.from(discovered);
}

/**
 * Get cached keyword data or fetch fresh
 */
export async function getKeywordData(
  keyword: string,
  maxAgeHours: number = 24
): Promise<NicheKeywordData | null> {
  // Check cache first
  const cached = await getKeyword(keyword);

  if (cached) {
    const age = Date.now() - cached.lastUpdatedAt.getTime();
    const maxAge = maxAgeHours * 60 * 60 * 1000;

    if (age < maxAge) {
      return cached;
    }
  }

  // Fetch fresh data
  try {
    await analyzeKeyword(keyword);
    return await getKeyword(keyword);
  } catch (error) {
    logError(`Failed to get keyword data for "${keyword}"`, error);
    return cached || null;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function calculateCompetitionScore(products: AmazonProductData[]): number {
  if (products.length === 0) return 0;

  // Factors that indicate competition:
  // 1. High average review count (established sellers)
  // 2. Low BSR variance (all products selling well)
  // 3. Brand dominance

  const avgReviews = calculateAverage(products.map((p) => p.reviewCount));
  const reviewScore = Math.min(1, avgReviews / 500); // 500+ reviews = high competition

  // Check brand dominance
  const brands = products.map((p) => p.brand?.toLowerCase() || 'unknown');
  const brandCounts = new Map<string, number>();
  for (const brand of brands) {
    brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
  }
  const topBrandCount = Math.max(...brandCounts.values());
  const dominanceScore = topBrandCount / products.length;

  // BSR analysis (lower BSR = more competition for that spot)
  const bsrValues = products.filter((p) => p.bsr).map((p) => p.bsr!);
  const avgBsr = calculateAverage(bsrValues);
  const bsrScore = avgBsr < 100000 ? 0.8 : avgBsr < 500000 ? 0.5 : 0.2;

  // Combined score
  return (reviewScore * 0.4) + (dominanceScore * 0.3) + (bsrScore * 0.3);
}

function extractRelatedKeywords(
  products: AmazonProductData[],
  originalKeyword: string
): string[] {
  const keywordCounts = new Map<string, number>();
  const originalWords = new Set(originalKeyword.toLowerCase().split(/\s+/));

  for (const product of products) {
    const words = product.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !originalWords.has(w));

    for (const word of words) {
      keywordCounts.set(word, (keywordCounts.get(word) || 0) + 1);
    }
  }

  // Return top keywords that appear in multiple products
  return Array.from(keywordCounts.entries())
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
