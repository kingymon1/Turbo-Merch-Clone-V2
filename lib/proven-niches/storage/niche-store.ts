/**
 * Proven Niches Pipeline - Storage Layer
 *
 * Handles database operations for niches, products, and opportunities.
 */

import { PrismaClient } from '@prisma/client';
import {
  AmazonProductData,
  TrackedNicheData,
  NicheOpportunityData,
  NicheKeywordData,
  CompetitionLevel,
} from '../types';
import { getCompetitionLevel, log, logError } from '../config';

// =============================================================================
// PRISMA CLIENT
// =============================================================================

const prisma = new PrismaClient();

// =============================================================================
// TRACKED NICHES
// =============================================================================

/**
 * Get all tracked niches
 */
export async function getTrackedNiches(activeOnly: boolean = false): Promise<TrackedNicheData[]> {
  try {
    const niches = await prisma.trackedNiche.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });

    return niches.map((n) => ({
      name: n.name,
      displayName: n.displayName || undefined,
      searchKeywords: n.searchKeywords,
      description: n.category || undefined,
      productCount: n.productCount,
      avgBsr: n.avgBsr || undefined,
      avgPrice: n.avgPrice || undefined,
      avgReviews: n.avgReviews || undefined,
      competitionScore: n.competitionScore || undefined,
      competitionLevel: (n.competitionLevel as CompetitionLevel) || undefined,
      opportunityScore: n.opportunityScore || undefined,
      isActive: n.isActive,
      lastScannedAt: n.lastScrapedAt || undefined,
    }));
  } catch (error) {
    logError('Failed to get tracked niches', error);
    return [];
  }
}

/**
 * Get a single tracked niche by name
 */
export async function getTrackedNiche(name: string): Promise<TrackedNicheData | null> {
  try {
    const niche = await prisma.trackedNiche.findUnique({
      where: { name },
    });

    if (!niche) return null;

    return {
      name: niche.name,
      displayName: niche.displayName || undefined,
      searchKeywords: niche.searchKeywords,
      description: niche.category || undefined,
      productCount: niche.productCount,
      avgBsr: niche.avgBsr || undefined,
      avgPrice: niche.avgPrice || undefined,
      avgReviews: niche.avgReviews || undefined,
      competitionScore: niche.competitionScore || undefined,
      competitionLevel: (niche.competitionLevel as CompetitionLevel) || undefined,
      opportunityScore: niche.opportunityScore || undefined,
      isActive: niche.isActive,
      lastScannedAt: niche.lastScrapedAt || undefined,
    };
  } catch (error) {
    logError(`Failed to get tracked niche ${name}`, error);
    return null;
  }
}

/**
 * Create or update a tracked niche
 */
export async function upsertTrackedNiche(data: TrackedNicheData): Promise<void> {
  try {
    await prisma.trackedNiche.upsert({
      where: { name: data.name },
      create: {
        name: data.name,
        displayName: data.displayName,
        searchKeywords: data.searchKeywords,
        category: data.description,
        productCount: data.productCount,
        avgBsr: data.avgBsr,
        avgPrice: data.avgPrice,
        avgReviews: data.avgReviews,
        competitionScore: data.competitionScore,
        competitionLevel: data.competitionLevel,
        opportunityScore: data.opportunityScore,
        isActive: data.isActive,
      },
      update: {
        displayName: data.displayName,
        searchKeywords: data.searchKeywords,
        category: data.description,
        productCount: data.productCount,
        avgBsr: data.avgBsr,
        avgPrice: data.avgPrice,
        avgReviews: data.avgReviews,
        competitionScore: data.competitionScore,
        competitionLevel: data.competitionLevel,
        opportunityScore: data.opportunityScore,
        isActive: data.isActive,
        lastScrapedAt: new Date(),
      },
    });
  } catch (error) {
    logError(`Failed to upsert tracked niche ${data.name}`, error);
    throw error;
  }
}

/**
 * Update niche metrics based on scraped products
 */
export async function updateNicheMetrics(
  nicheName: string,
  products: AmazonProductData[]
): Promise<void> {
  if (products.length === 0) return;

  const bsrValues = products.filter((p) => p.bsr).map((p) => p.bsr!);
  const priceValues = products.filter((p) => p.price).map((p) => p.price!);
  const reviewValues = products.map((p) => p.reviewCount);

  const avgBsr = bsrValues.length > 0
    ? bsrValues.reduce((a, b) => a + b, 0) / bsrValues.length
    : undefined;

  const avgPrice = priceValues.length > 0
    ? priceValues.reduce((a, b) => a + b, 0) / priceValues.length
    : undefined;

  const avgReviews = reviewValues.length > 0
    ? reviewValues.reduce((a, b) => a + b, 0) / reviewValues.length
    : undefined;

  // Calculate median BSR
  let medianBsr: number | undefined;
  if (bsrValues.length > 0) {
    const sorted = [...bsrValues].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianBsr = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // Calculate competition score
  const competitionScore = calculateCompetitionScore(products);
  const competitionLevel = getCompetitionLevel(competitionScore);

  // Calculate opportunity score (inverse competition weighted by demand)
  const demandScore = avgBsr ? Math.max(0, 1 - (avgBsr / 1000000)) : 0.5;
  const opportunityScore = (1 - competitionScore) * 0.6 + demandScore * 0.4;

  try {
    await prisma.trackedNiche.update({
      where: { name: nicheName },
      data: {
        productCount: products.length,
        avgBsr,
        medianBsr,
        minBsr: bsrValues.length > 0 ? Math.min(...bsrValues) : undefined,
        maxBsr: bsrValues.length > 0 ? Math.max(...bsrValues) : undefined,
        avgPrice,
        avgReviews,
        competitionScore,
        competitionLevel,
        opportunityScore,
        lastScrapedAt: new Date(),
      },
    });
  } catch (error) {
    logError(`Failed to update niche metrics for ${nicheName}`, error);
  }
}

// =============================================================================
// PRODUCTS
// =============================================================================

/**
 * Store products in database
 */
export async function storeProducts(
  products: AmazonProductData[],
  nicheName: string
): Promise<number> {
  let stored = 0;

  // Get niche ID
  const niche = await prisma.trackedNiche.findUnique({
    where: { name: nicheName },
  });

  for (const product of products) {
    try {
      await prisma.amazonProduct.upsert({
        where: { asin: product.asin },
        create: {
          asin: product.asin,
          title: product.title,
          brand: product.brand,
          price: product.price,
          bsr: product.bsr,
          bsrCategory: product.bsrCategory,
          reviewCount: product.reviewCount,
          rating: product.rating,
          keywords: product.keywords,
          category: product.category,
          imageUrl: product.imageUrl,
          url: product.productUrl || `https://www.amazon.com/dp/${product.asin}`,
          nicheId: niche?.id,
          lastScrapedAt: product.scrapedAt,
        },
        update: {
          title: product.title,
          brand: product.brand,
          price: product.price,
          bsr: product.bsr,
          bsrCategory: product.bsrCategory,
          reviewCount: product.reviewCount,
          rating: product.rating,
          keywords: product.keywords,
          category: product.category,
          imageUrl: product.imageUrl,
          url: product.productUrl || `https://www.amazon.com/dp/${product.asin}`,
          nicheId: niche?.id,
          lastScrapedAt: product.scrapedAt,
          scrapeCount: { increment: 1 },
        },
      });

      // Record price history if BSR or price available
      if (product.price || product.bsr) {
        await recordPriceHistory(product.asin, product.price || 0, product.bsr, product.reviewCount);
      }

      stored++;
    } catch (error) {
      logError(`Failed to store product ${product.asin}`, error);
    }
  }

  return stored;
}

/**
 * Record price/BSR history for a product
 */
async function recordPriceHistory(
  asin: string,
  price: number,
  bsr?: number,
  reviewCount?: number
): Promise<void> {
  try {
    const product = await prisma.amazonProduct.findUnique({
      where: { asin },
    });

    if (!product) return;

    // Check if we already have a recent entry (within last hour)
    const recentEntry = await prisma.priceHistory.findFirst({
      where: {
        productId: product.id,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000),
        },
      },
    });

    if (recentEntry) return; // Skip if we have recent data

    await prisma.priceHistory.create({
      data: {
        productId: product.id,
        price,
        bsr,
        reviewCount,
      },
    });
  } catch (error) {
    // Silently fail for price history - not critical
  }
}

/**
 * Get products for a niche
 */
export async function getProductsForNiche(
  nicheName: string,
  limit: number = 100
): Promise<AmazonProductData[]> {
  try {
    const niche = await prisma.trackedNiche.findUnique({
      where: { name: nicheName },
    });

    if (!niche) return [];

    const products = await prisma.amazonProduct.findMany({
      where: { nicheId: niche.id },
      orderBy: { bsr: 'asc' },
      take: limit,
    });

    return products.map((p) => ({
      asin: p.asin,
      title: p.title,
      brand: p.brand || undefined,
      price: p.price || undefined,
      bsr: p.bsr || undefined,
      bsrCategory: p.bsrCategory || undefined,
      reviewCount: p.reviewCount,
      rating: p.rating || undefined,
      keywords: p.keywords,
      category: p.category || undefined,
      imageUrl: p.imageUrl || undefined,
      productUrl: p.url,
      scrapedAt: p.lastScrapedAt,
    }));
  } catch (error) {
    logError(`Failed to get products for niche ${nicheName}`, error);
    return [];
  }
}

// =============================================================================
// OPPORTUNITIES
// =============================================================================

/**
 * Store a niche opportunity
 */
export async function storeOpportunity(data: NicheOpportunityData): Promise<string> {
  try {
    const opportunity = await prisma.nicheOpportunity.create({
      data: {
        nicheId: data.nicheId,
        title: data.title,
        description: data.description,
        keywords: data.keywords,
        opportunityScore: data.opportunityScore,
        demandScore: data.demandScore,
        competitionScore: data.competitionScore,
        reasoning: data.reasoning,
        suggestedPhrases: data.suggestedPhrases,
        status: data.status,
        expiresAt: data.expiresAt,
      },
    });

    return opportunity.id;
  } catch (error) {
    logError('Failed to store opportunity', error);
    throw error;
  }
}

/**
 * Get opportunities for a niche
 */
export async function getOpportunities(
  nicheName?: string,
  activeOnly: boolean = true
): Promise<NicheOpportunityData[]> {
  try {
    let nicheId: string | undefined;

    if (nicheName) {
      const niche = await prisma.trackedNiche.findUnique({
        where: { name: nicheName },
      });
      nicheId = niche?.id;
    }

    const opportunities = await prisma.nicheOpportunity.findMany({
      where: {
        ...(nicheId && { nicheId }),
        ...(activeOnly && { status: 'active' }),
      },
      orderBy: { opportunityScore: 'desc' },
    });

    return opportunities.map((o) => ({
      nicheId: o.nicheId,
      title: o.title,
      description: o.description,
      keywords: o.keywords,
      opportunityScore: o.opportunityScore,
      demandScore: o.demandScore,
      competitionScore: o.competitionScore,
      reasoning: o.reasoning,
      suggestedPhrases: o.suggestedPhrases,
      status: o.status as NicheOpportunityData['status'],
      expiresAt: o.expiresAt || undefined,
    }));
  } catch (error) {
    logError('Failed to get opportunities', error);
    return [];
  }
}

/**
 * Update opportunity status
 */
export async function updateOpportunityStatus(
  opportunityId: string,
  status: NicheOpportunityData['status']
): Promise<void> {
  try {
    await prisma.nicheOpportunity.update({
      where: { id: opportunityId },
      data: {
        status,
        ...(status === 'pursued' && { usedAt: new Date() }),
      },
    });
  } catch (error) {
    logError(`Failed to update opportunity ${opportunityId}`, error);
  }
}

// =============================================================================
// KEYWORDS
// =============================================================================

/**
 * Store keyword data
 */
export async function storeKeyword(data: NicheKeywordData): Promise<void> {
  try {
    await prisma.nicheKeyword.upsert({
      where: { keyword: data.keyword },
      create: {
        keyword: data.keyword,
        searchVolume: data.searchVolume,
        competition: data.competition,
        amazonResults: data.amazonResults,
        topBsr: data.topBsr,
        relatedKeywords: data.relatedKeywords || [],
        lastUpdatedAt: data.lastUpdatedAt,
      },
      update: {
        searchVolume: data.searchVolume,
        competition: data.competition,
        amazonResults: data.amazonResults,
        topBsr: data.topBsr,
        relatedKeywords: data.relatedKeywords || [],
        lastUpdatedAt: data.lastUpdatedAt,
      },
    });
  } catch (error) {
    logError(`Failed to store keyword ${data.keyword}`, error);
  }
}

/**
 * Get keyword data
 */
export async function getKeyword(keyword: string): Promise<NicheKeywordData | null> {
  try {
    const kw = await prisma.nicheKeyword.findUnique({
      where: { keyword },
    });

    if (!kw) return null;

    return {
      keyword: kw.keyword,
      searchVolume: kw.searchVolume || undefined,
      competition: kw.competition || undefined,
      amazonResults: kw.amazonResults || undefined,
      topBsr: kw.topBsr || undefined,
      relatedKeywords: kw.relatedKeywords,
      lastUpdatedAt: kw.lastUpdatedAt,
    };
  } catch (error) {
    logError(`Failed to get keyword ${keyword}`, error);
    return null;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function calculateCompetitionScore(products: AmazonProductData[]): number {
  if (products.length === 0) return 0;

  // Higher reviews = more competition
  const avgReviews = products.reduce((a, b) => a + b.reviewCount, 0) / products.length;
  const reviewScore = Math.min(1, avgReviews / 500);

  // Brand dominance
  const brands = products.map((p) => p.brand?.toLowerCase() || 'unknown');
  const brandCounts = new Map<string, number>();
  for (const brand of brands) {
    brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
  }
  const topBrandCount = Math.max(...brandCounts.values());
  const dominanceScore = topBrandCount / products.length;

  // Lower BSR = more competitive space
  const bsrValues = products.filter((p) => p.bsr).map((p) => p.bsr!);
  const avgBsr = bsrValues.length > 0
    ? bsrValues.reduce((a, b) => a + b, 0) / bsrValues.length
    : 500000;
  const bsrScore = avgBsr < 100000 ? 0.8 : avgBsr < 300000 ? 0.5 : avgBsr < 500000 ? 0.3 : 0.1;

  return (reviewScore * 0.4) + (dominanceScore * 0.3) + (bsrScore * 0.3);
}
