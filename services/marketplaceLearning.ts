/**
 * Marketplace Learning Engine
 *
 * Analyzes stored marketplace data to learn patterns and best practices.
 * Provides learned intelligence to the AI for better design decisions.
 *
 * This service:
 * 1. Analyzes successful listings to learn title patterns, keywords, pricing
 * 2. Tracks design style effectiveness across niches
 * 3. Identifies opportunities and gaps
 * 4. Provides learned patterns to the synthesis prompts
 */

import { PrismaClient } from '@prisma/client';

// Types
export interface LearnedPatterns {
  titlePatterns: TitlePattern[];
  effectiveKeywords: KeywordPattern[];
  priceStrategies: PriceStrategy[];
  designStyles: DesignStyleInsight[];
  lastUpdated: Date;
}

export interface TitlePattern {
  pattern: string;
  examples: string[];
  successRate: number;
  sampleSize: number;
  confidence: number;
}

export interface KeywordPattern {
  keyword: string;
  frequency: number;
  avgPerformance: number;
  bestNiches: string[];
  confidence: number;
}

export interface PriceStrategy {
  pricePoint: number;
  frequency: number;
  avgReviewCount: number;
  recommendedFor: string[]; // Niches
}

export interface DesignStyleInsight {
  style: string;
  marketplacePerformance: {
    totalProducts: number;
    topSellerPercentage: number;
    avgRating: number;
  };
  platformPerformance: {
    generationCount: number;
    downloadRate: number;
    regenerationRate: number;
  };
  bestNiches: string[];
  isTrending: boolean;
  recommendation: string;
}

export interface NicheOpportunity {
  niche: string;
  opportunityType: 'GAP' | 'TIMING' | 'IMPROVE' | 'MERGE';
  score: number;
  description: string;
  suggestedApproach: string;
  marketData: {
    totalProducts: number;
    saturation: string;
    avgPrice: number;
  };
}

// Singleton Prisma client
let prisma: PrismaClient | null = null;

const getPrisma = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
};

/**
 * Check if the database is configured and accessible
 */
export const isDatabaseConfigured = async (): Promise<boolean> => {
  try {
    const db = getPrisma();
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

// ============================================================================
// DATA STORAGE - Save scraped data to database
// ============================================================================

/**
 * Store a scraped marketplace product
 */
export const storeMarketplaceProduct = async (product: {
  source: 'amazon' | 'etsy';
  externalId: string;
  title: string;
  price: number;
  url?: string;
  reviewCount?: number;
  avgRating?: number;
  salesRank?: number;
  category?: string;
  seller?: string;
  imageUrl?: string;
  niche: string;
  // Enhanced fields
  isMerchByAmazon?: boolean;
  titleCharCount?: number;
  primaryKeywords?: string[];
  keywordRepetitions?: Record<string, number>;
  designTextInTitle?: boolean;
  brandStyle?: string;
  brandName?: string;
}): Promise<void> => {
  try {
    const db = getPrisma();

    // Analyze title for patterns
    const titleAnalysis = analyzeTitlePatterns(product.title);

    // Check for existing product (for BSR tracking)
    const existingProduct = await db.marketplaceProduct.findUnique({
      where: {
        source_externalId: {
          source: product.source,
          externalId: product.externalId,
        },
      },
      select: { id: true, salesRank: true },
    });

    const upsertedProduct = await db.marketplaceProduct.upsert({
      where: {
        source_externalId: {
          source: product.source,
          externalId: product.externalId,
        },
      },
      create: {
        source: product.source,
        externalId: product.externalId,
        title: product.title,
        price: product.price,
        url: product.url,
        reviewCount: product.reviewCount || 0,
        avgRating: product.avgRating,
        salesRank: product.salesRank,
        category: product.category,
        seller: product.seller,
        imageUrl: product.imageUrl,
        niche: product.niche.toLowerCase(),
        // Basic title analysis
        titleWordCount: titleAnalysis.wordCount,
        titleKeywords: titleAnalysis.keywords,
        hasGiftKeyword: titleAnalysis.hasGift,
        hasFunnyKeyword: titleAnalysis.hasFunny,
        // Enhanced fields
        isMerchByAmazon: product.isMerchByAmazon || false,
        mbaDetectedAt: product.isMerchByAmazon ? new Date() : null,
        titleCharCount: product.titleCharCount || product.title.length,
        primaryKeywords: product.primaryKeywords || [],
        keywordRepetitions: product.keywordRepetitions || {},
        designTextInTitle: product.designTextInTitle,
        brandStyle: product.brandStyle,
        brandName: product.brandName,
        lastScrapedAt: new Date(),
      },
      update: {
        title: product.title,
        price: product.price,
        url: product.url,
        reviewCount: product.reviewCount || 0,
        avgRating: product.avgRating,
        salesRank: product.salesRank,
        category: product.category,
        seller: product.seller,
        imageUrl: product.imageUrl,
        titleWordCount: titleAnalysis.wordCount,
        titleKeywords: titleAnalysis.keywords,
        hasGiftKeyword: titleAnalysis.hasGift,
        hasFunnyKeyword: titleAnalysis.hasFunny,
        // Enhanced fields (update if provided)
        ...(product.isMerchByAmazon !== undefined && {
          isMerchByAmazon: product.isMerchByAmazon,
          mbaDetectedAt: product.isMerchByAmazon ? new Date() : null,
        }),
        ...(product.titleCharCount !== undefined && { titleCharCount: product.titleCharCount }),
        ...(product.primaryKeywords !== undefined && { primaryKeywords: product.primaryKeywords }),
        ...(product.keywordRepetitions !== undefined && { keywordRepetitions: product.keywordRepetitions }),
        ...(product.designTextInTitle !== undefined && { designTextInTitle: product.designTextInTitle }),
        ...(product.brandStyle !== undefined && { brandStyle: product.brandStyle }),
        ...(product.brandName !== undefined && { brandName: product.brandName }),
        lastScrapedAt: new Date(),
        scrapedCount: { increment: 1 },
      },
    });

    // Track BSR history if product has salesRank
    if (product.salesRank && product.source === 'amazon') {
      await trackBsrHistory(
        db,
        upsertedProduct.id,
        product.salesRank,
        existingProduct?.salesRank || null
      );
    }
  } catch (error) {
    console.error('[LEARNING] Failed to store product:', error);
  }
};

/**
 * Track BSR history and detect spikes
 */
const trackBsrHistory = async (
  db: PrismaClient,
  productId: string,
  currentBsr: number,
  previousBsr: number | null
): Promise<void> => {
  try {
    let bsrChange: number | null = null;
    let changePercent: number | null = null;
    let isSpike = false;
    let spikeType: string | null = null;

    if (previousBsr !== null && previousBsr > 0) {
      bsrChange = currentBsr - previousBsr; // Negative = improving
      changePercent = ((previousBsr - currentBsr) / previousBsr) * 100;

      // Detect spikes (significant improvement)
      if (changePercent > 50) {
        isSpike = true;
        spikeType = 'viral';
      } else if (changePercent > 25) {
        isSpike = true;
        spikeType = 'major';
      } else if (changePercent > 10) {
        isSpike = true;
        spikeType = 'minor';
      }
    }

    // Create BSR history record
    await db.bsrHistory.create({
      data: {
        productId,
        bsr: currentBsr,
        previousBsr,
        bsrChange,
        changePercent,
        isSpike,
        spikeType,
      },
    });

    // Update product with spike info if detected
    if (isSpike) {
      await db.marketplaceProduct.update({
        where: { id: productId },
        data: {
          bsrSpikeDetected: true,
          bsrSpikeDate: new Date(),
          bsrChange24h: bsrChange,
        },
      });
    }
  } catch (error) {
    // Don't fail main operation for BSR tracking
    console.log('[LEARNING] BSR tracking error:', error);
  }
};

/**
 * Update niche market data aggregates
 */
export const updateNicheMarketData = async (niche: string): Promise<void> => {
  try {
    const db = getPrisma();
    const normalizedNiche = niche.toLowerCase();

    // Get all products for this niche
    const products = await db.marketplaceProduct.findMany({
      where: { niche: normalizedNiche },
    });

    if (products.length === 0) return;

    // Calculate metrics
    const prices = products.map(p => Number(p.price)).filter(p => p > 0);
    const reviews = products.map(p => p.reviewCount).filter(r => r > 0);
    const ratings = products.map(p => Number(p.avgRating)).filter(r => r > 0);
    const bsrs = products.map(p => p.salesRank).filter((r): r is number => r !== null && r > 0);

    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
    const avgReviewCount = reviews.length > 0 ? reviews.reduce((a, b) => a + b, 0) / reviews.length : 0;
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const avgBsr = bsrs.length > 0 ? Math.round(bsrs.reduce((a, b) => a + b, 0) / bsrs.length) : null;

    // Count MBA products
    const mbaProducts = products.filter(p => p.isMerchByAmazon === true).length;

    // Count products with BSR spikes
    const risingProductCount = products.filter(p => p.bsrSpikeDetected === true).length;

    // Determine saturation
    let saturationLevel = 'unknown';
    if (products.length > 500) saturationLevel = 'oversaturated';
    else if (products.length > 200) saturationLevel = 'high';
    else if (products.length > 50) saturationLevel = 'medium';
    else if (products.length > 0) saturationLevel = 'low';

    // Calculate entry recommendation
    const { recommendation, reason, confidence } = calculateEntryRecommendation(
      products,
      saturationLevel,
      avgReviewCount,
      risingProductCount
    );

    // Extract effective keywords from top performers
    const topProducts = products
      .filter(p => p.reviewCount > 10)
      .sort((a, b) => b.reviewCount - a.reviewCount)
      .slice(0, 20);

    const effectiveKeywords = extractEffectiveKeywords(topProducts);
    const commonPricePoints = findCommonPricePoints(prices);
    const winningDesignStyles = extractDesignStyles(topProducts);

    // Extract long-tail keywords from all products
    const longTailKeywords = extractLongTailKeywordsFromProducts(products);

    // Detect gaps and opportunities
    const gaps = detectMarketGaps(products, normalizedNiche);
    const opportunityScore = calculateOpportunityScore(products, saturationLevel);

    await db.nicheMarketData.upsert({
      where: { niche: normalizedNiche },
      create: {
        niche: normalizedNiche,
        totalProducts: products.length,
        amazonProducts: products.filter(p => p.source === 'amazon').length,
        etsyProducts: products.filter(p => p.source === 'etsy').length,
        mbaProducts,
        saturationLevel,
        // Entry recommendation
        entryRecommendation: recommendation,
        entryReason: reason,
        entryConfidence: confidence,
        // Pricing
        avgPrice,
        minPrice,
        maxPrice,
        avgReviewCount,
        avgRating,
        // BSR tracking
        avgBsr,
        risingProductCount,
        // Patterns
        effectiveKeywords,
        commonPricePoints,
        winningDesignStyles,
        longTailKeywords,
        detectedGaps: gaps,
        opportunityScore,
        lastAnalyzed: new Date(),
      },
      update: {
        totalProducts: products.length,
        amazonProducts: products.filter(p => p.source === 'amazon').length,
        etsyProducts: products.filter(p => p.source === 'etsy').length,
        mbaProducts,
        saturationLevel,
        // Entry recommendation
        entryRecommendation: recommendation,
        entryReason: reason,
        entryConfidence: confidence,
        // Pricing
        avgPrice,
        minPrice,
        maxPrice,
        avgReviewCount,
        avgRating,
        // BSR tracking
        avgBsr,
        risingProductCount,
        // Patterns
        effectiveKeywords,
        commonPricePoints,
        winningDesignStyles,
        longTailKeywords,
        detectedGaps: gaps,
        opportunityScore,
        lastAnalyzed: new Date(),
        queryCount: { increment: 1 },
        lastQueriedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('[LEARNING] Failed to update niche data:', error);
  }
};

/**
 * Calculate entry recommendation (ENTER/CAUTION/AVOID)
 */
const calculateEntryRecommendation = (
  products: Array<{ reviewCount: number; bsrSpikeDetected: boolean | null }>,
  saturation: string,
  avgReviewCount: number,
  risingProductCount: number
): { recommendation: string; reason: string; confidence: number } => {
  let score = 50; // Base score
  const reasons: string[] = [];

  // Saturation factor
  switch (saturation) {
    case 'low':
      score += 25;
      reasons.push('Low competition');
      break;
    case 'medium':
      score += 10;
      reasons.push('Moderate competition');
      break;
    case 'high':
      score -= 15;
      reasons.push('High competition');
      break;
    case 'oversaturated':
      score -= 30;
      reasons.push('Oversaturated market');
      break;
  }

  // Competition strength (review counts)
  if (avgReviewCount < 20) {
    score += 20;
    reasons.push('Weak competitors (low reviews)');
  } else if (avgReviewCount > 100) {
    score -= 20;
    reasons.push('Strong entrenched competitors');
  }

  // Rising products (indicates trending niche)
  if (risingProductCount > 5) {
    score += 15;
    reasons.push('Multiple rising products (trending)');
  } else if (risingProductCount > 0) {
    score += 5;
    reasons.push('Some products gaining traction');
  }

  // Determine recommendation
  let recommendation: string;
  if (score >= 70) {
    recommendation = 'enter';
  } else if (score >= 40) {
    recommendation = 'caution';
  } else {
    recommendation = 'avoid';
  }

  // Calculate confidence (higher with more data)
  const confidence = Math.min(100, Math.max(0, products.length * 2));

  return {
    recommendation,
    reason: reasons.join('. '),
    confidence,
  };
};

/**
 * Extract long-tail keywords from product primary keywords
 */
const extractLongTailKeywordsFromProducts = (
  products: Array<{ primaryKeywords: string[] }>
): string[] => {
  const keywordCounts = new Map<string, number>();

  for (const product of products) {
    if (product.primaryKeywords && Array.isArray(product.primaryKeywords)) {
      for (const keyword of product.primaryKeywords) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
      }
    }
  }

  // Return keywords that appear in multiple products
  return Array.from(keywordCounts.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([keyword]) => keyword);
};

// ============================================================================
// PATTERN LEARNING - Analyze data to extract patterns
// ============================================================================

/**
 * Run the learning engine to update patterns from stored data
 */
export const runLearningEngine = async (): Promise<void> => {
  console.log('[LEARNING] Starting pattern analysis...');

  try {
    const db = getPrisma();

    // Get high-performing products (top 20% by review count)
    const allProducts = await db.marketplaceProduct.findMany({
      where: {
        reviewCount: { gt: 10 },
      },
      orderBy: { reviewCount: 'desc' },
      take: 1000,
    });

    if (allProducts.length < 50) {
      console.log('[LEARNING] Not enough data to learn patterns (need 50+ products)');
      return;
    }

    // Learn title patterns
    await learnTitlePatterns(allProducts);

    // Learn keyword effectiveness
    await learnKeywordPatterns(allProducts);

    // Learn price strategies
    await learnPriceStrategies(allProducts);

    // Learn design style effectiveness
    await learnDesignStyles(allProducts);

    console.log('[LEARNING] Pattern analysis complete');
  } catch (error) {
    console.error('[LEARNING] Learning engine failed:', error);
  }
};

/**
 * Learn effective title patterns
 */
const learnTitlePatterns = async (products: Array<{ title: string; reviewCount: number }>): Promise<void> => {
  const db = getPrisma();

  // Common patterns to look for
  const patterns = [
    { pattern: '{Adjective} {Topic} Shirt', regex: /^(funny|cute|cool|vintage|retro)\s+.+\s+shirt$/i },
    { pattern: '{Topic} Gift For {Audience}', regex: /.+\s+gift\s+for\s+.+/i },
    { pattern: '{Topic} Lover {Item}', regex: /.+\s+lover\s+.+/i },
    { pattern: '{Occasion} {Topic} Shirt', regex: /^(christmas|birthday|halloween|mothers day|fathers day)\s+.+\s+shirt$/i },
  ];

  for (const { pattern, regex } of patterns) {
    const matchingProducts = products.filter(p => regex.test(p.title));

    if (matchingProducts.length >= 5) {
      const avgReviews = matchingProducts.reduce((a, b) => a + b.reviewCount, 0) / matchingProducts.length;
      const overallAvg = products.reduce((a, b) => a + b.reviewCount, 0) / products.length;
      const successRate = (avgReviews / overallAvg) * 100;

      await db.listingPattern.upsert({
        where: {
          patternType_pattern_category: {
            patternType: 'title_structure',
            pattern,
            category: 'apparel',
          },
        },
        create: {
          patternType: 'title_structure',
          pattern,
          category: 'apparel',
          examples: matchingProducts.slice(0, 5).map(p => p.title),
          sampleSize: matchingProducts.length,
          avgPerformance: avgReviews,
          successRate: Math.min(successRate, 200),
          confidence: Math.min(matchingProducts.length / 10 * 100, 100),
          lastValidated: new Date(),
        },
        update: {
          examples: matchingProducts.slice(0, 5).map(p => p.title),
          sampleSize: matchingProducts.length,
          avgPerformance: avgReviews,
          successRate: Math.min(successRate, 200),
          confidence: Math.min(matchingProducts.length / 10 * 100, 100),
          lastValidated: new Date(),
          validationCount: { increment: 1 },
        },
      });
    }
  }
};

/**
 * Learn effective keywords
 */
const learnKeywordPatterns = async (products: Array<{ title: string; reviewCount: number; niche: string }>): Promise<void> => {
  const db = getPrisma();

  const keywordStats = new Map<string, { count: number; totalReviews: number; niches: Set<string> }>();

  // Extract keywords from titles
  for (const product of products) {
    const words = product.title.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'for', 'with', 'shirt', 'tshirt', 't-shirt', 'tee']);

    for (const word of words) {
      const cleaned = word.replace(/[^a-z]/g, '');
      if (cleaned.length > 2 && !stopWords.has(cleaned)) {
        const stats = keywordStats.get(cleaned) || { count: 0, totalReviews: 0, niches: new Set() };
        stats.count++;
        stats.totalReviews += product.reviewCount;
        stats.niches.add(product.niche);
        keywordStats.set(cleaned, stats);
      }
    }
  }

  // Store top keywords
  const topKeywords = Array.from(keywordStats.entries())
    .filter(([_, stats]) => stats.count >= 5)
    .map(([keyword, stats]) => ({
      keyword,
      count: stats.count,
      avgPerformance: stats.totalReviews / stats.count,
      niches: Array.from(stats.niches),
    }))
    .sort((a, b) => b.avgPerformance - a.avgPerformance)
    .slice(0, 50);

  for (const kw of topKeywords) {
    await db.listingPattern.upsert({
      where: {
        patternType_pattern_category: {
          patternType: 'keyword',
          pattern: kw.keyword,
          category: 'apparel',
        },
      },
      create: {
        patternType: 'keyword',
        pattern: kw.keyword,
        category: 'apparel',
        examples: kw.niches.slice(0, 5),
        sampleSize: kw.count,
        avgPerformance: kw.avgPerformance,
        confidence: Math.min(kw.count / 5 * 100, 100),
        lastValidated: new Date(),
      },
      update: {
        examples: kw.niches.slice(0, 5),
        sampleSize: kw.count,
        avgPerformance: kw.avgPerformance,
        confidence: Math.min(kw.count / 5 * 100, 100),
        lastValidated: new Date(),
        validationCount: { increment: 1 },
      },
    });
  }
};

/**
 * Learn price strategies
 */
const learnPriceStrategies = async (products: Array<{ price: unknown; reviewCount: number }>): Promise<void> => {
  const db = getPrisma();

  const priceStats = new Map<number, { count: number; totalReviews: number }>();

  // Group by rounded price
  for (const product of products) {
    const price = Math.round(Number(product.price));
    if (price > 0 && price < 100) {
      const stats = priceStats.get(price) || { count: 0, totalReviews: 0 };
      stats.count++;
      stats.totalReviews += product.reviewCount;
      priceStats.set(price, stats);
    }
  }

  // Store common price points
  const topPrices = Array.from(priceStats.entries())
    .filter(([_, stats]) => stats.count >= 5)
    .map(([price, stats]) => ({
      price,
      count: stats.count,
      avgReviews: stats.totalReviews / stats.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  for (const pp of topPrices) {
    await db.listingPattern.upsert({
      where: {
        patternType_pattern_category: {
          patternType: 'price_strategy',
          pattern: `$${pp.price}`,
          category: 'apparel',
        },
      },
      create: {
        patternType: 'price_strategy',
        pattern: `$${pp.price}`,
        category: 'apparel',
        examples: [`Used by ${pp.count} products, avg ${pp.avgReviews.toFixed(0)} reviews`],
        sampleSize: pp.count,
        avgPerformance: pp.avgReviews,
        confidence: Math.min(pp.count / 10 * 100, 100),
        lastValidated: new Date(),
      },
      update: {
        examples: [`Used by ${pp.count} products, avg ${pp.avgReviews.toFixed(0)} reviews`],
        sampleSize: pp.count,
        avgPerformance: pp.avgReviews,
        confidence: Math.min(pp.count / 10 * 100, 100),
        lastValidated: new Date(),
        validationCount: { increment: 1 },
      },
    });
  }
};

/**
 * Learn design style effectiveness
 */
const learnDesignStyles = async (products: Array<{ designStyle: string | null; reviewCount: number; niche: string }>): Promise<void> => {
  const db = getPrisma();

  const styleStats = new Map<string, { count: number; totalReviews: number; niches: Set<string> }>();

  for (const product of products) {
    if (product.designStyle) {
      const stats = styleStats.get(product.designStyle) || { count: 0, totalReviews: 0, niches: new Set() };
      stats.count++;
      stats.totalReviews += product.reviewCount;
      stats.niches.add(product.niche);
      styleStats.set(product.designStyle, stats);
    }
  }

  for (const [style, stats] of styleStats) {
    if (stats.count >= 5) {
      await db.designStyleMetrics.upsert({
        where: { styleName: style },
        create: {
          styleName: style,
          totalProducts: stats.count,
          avgReviewCount: stats.totalReviews / stats.count,
          bestPerformingNiches: Array.from(stats.niches).slice(0, 10),
        },
        update: {
          totalProducts: stats.count,
          avgReviewCount: stats.totalReviews / stats.count,
          bestPerformingNiches: Array.from(stats.niches).slice(0, 10),
          updatedAt: new Date(),
        },
      });
    }
  }
};

// ============================================================================
// PATTERN RETRIEVAL - Get learned patterns for AI consumption
// ============================================================================

/**
 * Get learned patterns for a specific niche
 */
export const getLearnedPatterns = async (niche?: string): Promise<LearnedPatterns> => {
  try {
    const db = getPrisma();

    // Get title patterns
    const titlePatterns = await db.listingPattern.findMany({
      where: { patternType: 'title_structure', isActive: true },
      orderBy: { confidence: 'desc' },
      take: 5,
    });

    // Get keyword patterns
    const keywords = await db.listingPattern.findMany({
      where: { patternType: 'keyword', isActive: true },
      orderBy: { avgPerformance: 'desc' },
      take: 20,
    });

    // Get price strategies
    const prices = await db.listingPattern.findMany({
      where: { patternType: 'price_strategy', isActive: true },
      orderBy: { sampleSize: 'desc' },
      take: 5,
    });

    // Get design style metrics
    const styles = await db.designStyleMetrics.findMany({
      orderBy: { totalProducts: 'desc' },
      take: 10,
    });

    return {
      titlePatterns: titlePatterns.map(p => ({
        pattern: p.pattern,
        examples: (p.examples as string[]) || [],
        successRate: Number(p.successRate) || 0,
        sampleSize: p.sampleSize,
        confidence: Number(p.confidence),
      })),
      effectiveKeywords: keywords.map(k => ({
        keyword: k.pattern,
        frequency: k.sampleSize,
        avgPerformance: Number(k.avgPerformance) || 0,
        bestNiches: (k.examples as string[]) || [],
        confidence: Number(k.confidence),
      })),
      priceStrategies: prices.map(p => ({
        pricePoint: parseFloat(p.pattern.replace('$', '')),
        frequency: p.sampleSize,
        avgReviewCount: Number(p.avgPerformance) || 0,
        recommendedFor: [],
      })),
      designStyles: styles.map(s => ({
        style: s.styleName,
        marketplacePerformance: {
          totalProducts: s.totalProducts,
          topSellerPercentage: (s.topSellerCount / s.totalProducts) * 100 || 0,
          avgRating: Number(s.avgRating) || 0,
        },
        platformPerformance: {
          generationCount: s.generationCount,
          downloadRate: Number(s.downloadRate) || 0,
          regenerationRate: Number(s.regenerationRate) || 0,
        },
        bestNiches: (s.bestPerformingNiches as string[]) || [],
        isTrending: s.isTrending,
        recommendation: s.isTrending ? 'Trending - consider using' : 'Stable performer',
      })),
      lastUpdated: new Date(),
    };
  } catch (error) {
    console.error('[LEARNING] Failed to get patterns:', error);
    return {
      titlePatterns: [],
      effectiveKeywords: [],
      priceStrategies: [],
      designStyles: [],
      lastUpdated: new Date(),
    };
  }
};

/**
 * Build learned patterns context for AI
 */
export const buildLearnedPatternsContext = async (niche?: string): Promise<string> => {
  const patterns = await getLearnedPatterns(niche);

  if (patterns.titlePatterns.length === 0 && patterns.effectiveKeywords.length === 0) {
    return ''; // No learned patterns yet
  }

  return `
═══════════════════════════════════════════════════════════════
LEARNED PATTERNS (From ${patterns.titlePatterns[0]?.sampleSize || 0}+ successful listings)
═══════════════════════════════════════════════════════════════

${patterns.titlePatterns.length > 0 ? `
EFFECTIVE TITLE PATTERNS:
${patterns.titlePatterns.map((p, i) => `
${i + 1}. Pattern: "${p.pattern}"
   Success rate: ${p.successRate.toFixed(0)}% | Confidence: ${p.confidence.toFixed(0)}%
   Example: "${p.examples[0] || 'N/A'}"
`).join('')}
` : ''}

${patterns.effectiveKeywords.length > 0 ? `
HIGH-PERFORMING KEYWORDS:
${patterns.effectiveKeywords.slice(0, 10).map(k =>
    `• "${k.keyword}" - avg ${k.avgPerformance.toFixed(0)} reviews (${k.confidence.toFixed(0)}% confidence)`
  ).join('\n')}
` : ''}

${patterns.priceStrategies.length > 0 ? `
OPTIMAL PRICE POINTS:
${patterns.priceStrategies.map(p =>
    `• $${p.pricePoint} - ${p.frequency} successful products, avg ${p.avgReviewCount.toFixed(0)} reviews`
  ).join('\n')}
` : ''}

${patterns.designStyles.length > 0 ? `
DESIGN STYLE EFFECTIVENESS:
${patterns.designStyles.slice(0, 5).map(s =>
    `• ${s.style}: ${s.marketplacePerformance.totalProducts} products, ` +
    `${s.isTrending ? '📈 TRENDING' : 'stable'}`
  ).join('\n')}
` : ''}

Use these patterns to inform your recommendations, but don't blindly copy -
combine proven patterns with fresh angles for the best results.
═══════════════════════════════════════════════════════════════
`;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const analyzeTitlePatterns = (title: string): {
  wordCount: number;
  keywords: string[];
  hasGift: boolean;
  hasFunny: boolean;
} => {
  const words = title.toLowerCase().split(/\s+/);
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'for', 'with', 'shirt', 'tshirt', 't-shirt', 'tee', '-']);

  return {
    wordCount: words.length,
    keywords: words.filter(w => w.length > 2 && !stopWords.has(w)).slice(0, 10),
    hasGift: /gift/i.test(title),
    hasFunny: /funny/i.test(title),
  };
};

const extractEffectiveKeywords = (products: Array<{ title: string }>): string[] => {
  const wordCounts = new Map<string, number>();
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'for', 'with', 'shirt', 'tshirt', 't-shirt', 'tee']);

  for (const product of products) {
    const words = product.title.toLowerCase().split(/\s+/);
    for (const word of words) {
      const cleaned = word.replace(/[^a-z]/g, '');
      if (cleaned.length > 2 && !stopWords.has(cleaned)) {
        wordCounts.set(cleaned, (wordCounts.get(cleaned) || 0) + 1);
      }
    }
  }

  return Array.from(wordCounts.entries())
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
};

const findCommonPricePoints = (prices: number[]): number[] => {
  const priceCounts = new Map<number, number>();

  for (const price of prices) {
    const rounded = Math.round(price);
    priceCounts.set(rounded, (priceCounts.get(rounded) || 0) + 1);
  }

  return Array.from(priceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([price]) => price);
};

const extractDesignStyles = (products: Array<{ designStyle: string | null }>): string[] => {
  const styleCounts = new Map<string, number>();

  for (const product of products) {
    if (product.designStyle) {
      styleCounts.set(product.designStyle, (styleCounts.get(product.designStyle) || 0) + 1);
    }
  }

  return Array.from(styleCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([style]) => style);
};

const detectMarketGaps = (products: Array<{ reviewCount: number; title: string }>, niche: string): string[] => {
  const gaps: string[] = [];

  // Check for low competition
  if (products.length < 50) {
    gaps.push(`Low competition: Only ${products.length} products found`);
  }

  // Check for weak listings
  const weakListings = products.filter(p => p.reviewCount < 10);
  if (weakListings.length > products.length * 0.5) {
    gaps.push('Many competitors have weak listings (few reviews)');
  }

  // Check for missing keywords
  const hasGiftProducts = products.filter(p => /gift/i.test(p.title));
  if (hasGiftProducts.length < products.length * 0.1) {
    gaps.push('Few products targeting "gift" buyers');
  }

  return gaps;
};

const calculateOpportunityScore = (products: Array<{ reviewCount: number }>, saturation: string): number => {
  let score = 50; // Base score

  // Adjust for saturation
  if (saturation === 'low') score += 30;
  else if (saturation === 'medium') score += 10;
  else if (saturation === 'high') score -= 10;
  else if (saturation === 'oversaturated') score -= 30;

  // Adjust for competition strength
  const avgReviews = products.reduce((a, b) => a + b.reviewCount, 0) / products.length;
  if (avgReviews < 20) score += 20; // Weak competition
  else if (avgReviews > 100) score -= 20; // Strong competition

  return Math.max(0, Math.min(100, score));
};

// ============================================================================
// NICHE FUSION DETECTION
// ============================================================================

/**
 * Detect and store cross-niche fusion opportunities
 * Finds combinations of niches that work well together
 */
export const detectNicheFusions = async (): Promise<void> => {
  try {
    const db = getPrisma();

    // Get all niches with enough data
    const niches = await db.nicheMarketData.findMany({
      where: { totalProducts: { gte: 20 } },
      select: { id: true, niche: true, opportunityScore: true },
    });

    console.log(`[FUSION] Analyzing ${niches.length} niches for fusion opportunities`);

    // Common fusion patterns to look for
    const fusionPatterns = [
      // Profession + Hobby
      { base: ['nurse', 'teacher', 'trucker', 'mechanic'], modifier: ['dog', 'cat', 'fishing', 'coffee'] },
      // Family + Hobby
      { base: ['dad', 'mom', 'grandpa', 'grandma'], modifier: ['fishing', 'hunting', 'gardening', 'golf'] },
      // Family + Animal
      { base: ['dad', 'mom'], modifier: ['dog', 'cat', 'horse'] },
    ];

    for (const pattern of fusionPatterns) {
      for (const baseNiche of pattern.base) {
        for (const modifierNiche of pattern.modifier) {
          // Check if we have data for both niches
          const baseData = niches.find(n => n.niche.includes(baseNiche));
          const modifierData = niches.find(n => n.niche.includes(modifierNiche));

          if (!baseData || !modifierData) continue;

          // Look for products that contain both keywords
          const fusionQuery = `${baseNiche} ${modifierNiche}`;
          const fusionProducts = await db.marketplaceProduct.findMany({
            where: {
              OR: [
                { title: { contains: baseNiche, mode: 'insensitive' } },
                { niche: { contains: baseNiche, mode: 'insensitive' } },
              ],
              AND: [
                {
                  OR: [
                    { title: { contains: modifierNiche, mode: 'insensitive' } },
                    { niche: { contains: modifierNiche, mode: 'insensitive' } },
                  ],
                },
              ],
            },
            take: 50,
          });

          if (fusionProducts.length >= 3) {
            const avgReviews = fusionProducts.reduce((a, b) => a + b.reviewCount, 0) / fusionProducts.length;
            const bsrs = fusionProducts
              .map(p => p.salesRank)
              .filter((r): r is number => r !== null);
            const avgBsr = bsrs.length > 0 ? Math.round(bsrs.reduce((a, b) => a + b, 0) / bsrs.length) : null;

            // Calculate opportunity score for fusion
            const opportunityScore = calculateFusionOpportunity(fusionProducts.length, avgReviews, avgBsr);

            // Determine recommendation
            let recommendation = 'caution';
            let saturationLevel = 'medium';

            if (fusionProducts.length < 10 && avgReviews < 50) {
              recommendation = 'enter';
              saturationLevel = 'low';
            } else if (fusionProducts.length > 50 || avgReviews > 200) {
              recommendation = 'avoid';
              saturationLevel = 'high';
            }

            // Get top product as example
            const topProduct = fusionProducts.sort((a, b) => b.reviewCount - a.reviewCount)[0];
            const topProductData = topProduct ? {
              title: topProduct.title,
              reviews: topProduct.reviewCount,
              price: Number(topProduct.price),
            } : undefined;

            await db.nicheFusion.upsert({
              where: {
                niche1_niche2: {
                  niche1: baseNiche,
                  niche2: modifierNiche,
                },
              },
              create: {
                niche1: baseNiche,
                niche2: modifierNiche,
                niche1Id: baseData.id,
                niche2Id: modifierData.id,
                fusionQuery,
                productCount: fusionProducts.length,
                avgReviews,
                avgBsr,
                opportunityScore,
                saturationLevel,
                recommendation,
                ...(topProductData && { topProduct: topProductData }),
                estimatedAudience: `${baseNiche} professionals who are also ${modifierNiche} enthusiasts`,
                lastValidated: new Date(),
              },
              update: {
                productCount: fusionProducts.length,
                avgReviews,
                avgBsr,
                opportunityScore,
                saturationLevel,
                recommendation,
                ...(topProductData && { topProduct: topProductData }),
                lastValidated: new Date(),
                validationCount: { increment: 1 },
              },
            });
          }
        }
      }
    }

    console.log('[FUSION] Fusion detection complete');
  } catch (error) {
    console.error('[FUSION] Fusion detection failed:', error);
  }
};

/**
 * Calculate opportunity score for a niche fusion
 */
const calculateFusionOpportunity = (
  productCount: number,
  avgReviews: number,
  avgBsr: number | null
): number => {
  let score = 50;

  // Low product count = opportunity
  if (productCount < 10) score += 25;
  else if (productCount < 25) score += 10;
  else if (productCount > 50) score -= 15;

  // Low review count = weak competition
  if (avgReviews < 20) score += 20;
  else if (avgReviews < 50) score += 10;
  else if (avgReviews > 200) score -= 20;

  // Good BSR = validated demand
  if (avgBsr !== null) {
    if (avgBsr < 100000) score += 15;
    else if (avgBsr < 500000) score += 5;
  }

  return Math.max(0, Math.min(100, score));
};

/**
 * Get fusion opportunities for a specific niche
 */
export const getFusionOpportunities = async (niche: string): Promise<Array<{
  fusionWith: string;
  query: string;
  opportunity: number;
  recommendation: string;
  productCount: number;
}>> => {
  try {
    const db = getPrisma();

    const fusions = await db.nicheFusion.findMany({
      where: {
        OR: [
          { niche1: { contains: niche, mode: 'insensitive' } },
          { niche2: { contains: niche, mode: 'insensitive' } },
        ],
        recommendation: { not: 'avoid' },
      },
      orderBy: { opportunityScore: 'desc' },
      take: 10,
    });

    return fusions.map(f => ({
      fusionWith: f.niche1.includes(niche.toLowerCase()) ? f.niche2 : f.niche1,
      query: f.fusionQuery,
      opportunity: Number(f.opportunityScore) || 0,
      recommendation: f.recommendation,
      productCount: f.productCount,
    }));
  } catch (error) {
    console.error('[FUSION] Failed to get fusion opportunities:', error);
    return [];
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  isDatabaseConfigured,
  storeMarketplaceProduct,
  updateNicheMarketData,
  runLearningEngine,
  getLearnedPatterns,
  buildLearnedPatternsContext,
  detectNicheFusions,
  getFusionOpportunities,
};
