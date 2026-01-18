/**
 * Proven Niches Pipeline - Competition Analyzer
 *
 * Analyzes competition levels in a niche based on product data.
 */

import {
  AmazonProductData,
  CompetitionAnalysisInput,
  CompetitionAnalysisResult,
  CompetitionLevel,
} from '../types';
import { ANALYSIS_CONFIG, getCompetitionLevel, log } from '../config';

// =============================================================================
// MAIN ANALYSIS FUNCTION
// =============================================================================

/**
 * Analyze competition for a set of products in a niche
 */
export function analyzeCompetition(input: CompetitionAnalysisInput): CompetitionAnalysisResult {
  const { products, niche } = input;

  if (products.length === 0) {
    return {
      competitionLevel: 'very_low',
      competitionScore: 0,
      metrics: {
        totalProducts: 0,
        avgReviews: 0,
        avgBsr: 0,
        topBrandShare: 0,
        newEntrantsRatio: 0,
      },
      insights: ['No products found in this niche'],
      recommendations: ['Great opportunity - no existing competition'],
    };
  }

  log(`Analyzing competition for niche: ${niche} (${products.length} products)`);

  // Calculate core metrics
  const metrics = calculateMetrics(products);

  // Calculate competition score (0-1)
  const competitionScore = calculateCompetitionScore(products, metrics);
  const competitionLevel = getCompetitionLevel(competitionScore);

  // Generate insights
  const insights = generateInsights(metrics, competitionLevel);

  // Generate recommendations
  const recommendations = generateRecommendations(metrics, competitionLevel);

  return {
    competitionLevel,
    competitionScore,
    metrics,
    insights,
    recommendations,
  };
}

// =============================================================================
// METRICS CALCULATION
// =============================================================================

interface Metrics {
  totalProducts: number;
  avgReviews: number;
  avgBsr: number;
  topBrandShare: number;
  newEntrantsRatio: number;
}

function calculateMetrics(products: AmazonProductData[]): Metrics {
  const totalProducts = products.length;

  // Average reviews
  const avgReviews = products.reduce((sum, p) => sum + p.reviewCount, 0) / totalProducts;

  // Average BSR
  const bsrProducts = products.filter((p) => p.bsr);
  const avgBsr = bsrProducts.length > 0
    ? bsrProducts.reduce((sum, p) => sum + p.bsr!, 0) / bsrProducts.length
    : 500000;

  // Top brand share (what % of top 10 is held by single brand)
  const topBrandShare = calculateTopBrandShare(products.slice(0, 10));

  // New entrants ratio (products with < 50 reviews = newer)
  const newProducts = products.filter((p) => p.reviewCount < 50);
  const newEntrantsRatio = newProducts.length / totalProducts;

  return {
    totalProducts,
    avgReviews,
    avgBsr,
    topBrandShare,
    newEntrantsRatio,
  };
}

function calculateTopBrandShare(products: AmazonProductData[]): number {
  if (products.length === 0) return 0;

  const brandCounts = new Map<string, number>();
  for (const product of products) {
    const brand = (product.brand || 'unknown').toLowerCase();
    brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
  }

  const maxCount = Math.max(...brandCounts.values());
  return maxCount / products.length;
}

// =============================================================================
// COMPETITION SCORE
// =============================================================================

function calculateCompetitionScore(products: AmazonProductData[], metrics: Metrics): number {
  const config = ANALYSIS_CONFIG.competition;

  // Review-based score (0-0.4)
  let reviewScore: number;
  if (metrics.avgReviews < config.veryLowReviewsMax) {
    reviewScore = 0.1;
  } else if (metrics.avgReviews < config.lowReviewsMax) {
    reviewScore = 0.2;
  } else if (metrics.avgReviews < config.mediumReviewsMax) {
    reviewScore = 0.3;
  } else {
    reviewScore = 0.4;
  }

  // Brand dominance score (0-0.3)
  let dominanceScore: number;
  if (metrics.topBrandShare < config.lowDominanceMax) {
    dominanceScore = 0.05;
  } else if (metrics.topBrandShare < config.mediumDominanceMax) {
    dominanceScore = 0.15;
  } else if (metrics.topBrandShare < config.highDominanceMax) {
    dominanceScore = 0.25;
  } else {
    dominanceScore = 0.3;
  }

  // BSR score (lower avg BSR = more competition for those spots)
  // 0-0.2
  let bsrScore: number;
  if (metrics.avgBsr < 50000) {
    bsrScore = 0.2;
  } else if (metrics.avgBsr < 150000) {
    bsrScore = 0.15;
  } else if (metrics.avgBsr < 300000) {
    bsrScore = 0.1;
  } else {
    bsrScore = 0.05;
  }

  // New entrant ratio score (more new = less established = easier entry)
  // 0-0.1
  let newEntrantScore = 0.1 - (metrics.newEntrantsRatio * 0.1);

  return Math.min(1, reviewScore + dominanceScore + bsrScore + newEntrantScore);
}

// =============================================================================
// INSIGHTS GENERATION
// =============================================================================

function generateInsights(metrics: Metrics, level: CompetitionLevel): string[] {
  const insights: string[] = [];

  // Product count insight
  if (metrics.totalProducts < 20) {
    insights.push('Limited product selection in this niche');
  } else if (metrics.totalProducts > 100) {
    insights.push('Crowded marketplace with many competitors');
  }

  // Review insight
  if (metrics.avgReviews < 50) {
    insights.push('Products have few reviews - newer or less established niche');
  } else if (metrics.avgReviews > 500) {
    insights.push('High average reviews indicate established, competitive space');
  }

  // BSR insight
  if (metrics.avgBsr < 100000) {
    insights.push('Strong sales velocity - products are selling well');
  } else if (metrics.avgBsr > 500000) {
    insights.push('Lower sales velocity - may indicate niche market');
  }

  // Brand dominance insight
  if (metrics.topBrandShare > 0.5) {
    insights.push('Single brand dominates top positions');
  } else if (metrics.topBrandShare < 0.2) {
    insights.push('Fragmented market with no dominant brand');
  }

  // New entrant insight
  if (metrics.newEntrantsRatio > 0.3) {
    insights.push('Many new sellers entering this space');
  } else if (metrics.newEntrantsRatio < 0.1) {
    insights.push('Established sellers dominate - harder for new entrants');
  }

  return insights;
}

// =============================================================================
// RECOMMENDATIONS GENERATION
// =============================================================================

function generateRecommendations(metrics: Metrics, level: CompetitionLevel): string[] {
  const recommendations: string[] = [];

  switch (level) {
    case 'very_low':
      recommendations.push('Excellent entry point - minimal competition');
      recommendations.push('Focus on quality designs to establish early presence');
      break;

    case 'low':
      recommendations.push('Good opportunity with manageable competition');
      recommendations.push('Differentiate with unique designs and niches within the niche');
      break;

    case 'medium':
      recommendations.push('Moderate competition - requires strong differentiation');
      recommendations.push('Look for sub-niches or unique angles');
      recommendations.push('Consider targeting specific demographics within the niche');
      break;

    case 'high':
      recommendations.push('Competitive space - need significant differentiation');
      recommendations.push('Focus on underserved sub-segments');
      recommendations.push('Quality and design uniqueness are critical');
      break;

    case 'saturated':
      recommendations.push('Highly saturated - consider alternative niches');
      recommendations.push('If entering, target very specific micro-niches');
      recommendations.push('Premium positioning may be required');
      break;
  }

  // Additional recommendations based on metrics
  if (metrics.topBrandShare > 0.4) {
    recommendations.push('Avoid directly competing with dominant brand - find gaps');
  }

  if (metrics.newEntrantsRatio > 0.2) {
    recommendations.push('Act quickly - others are also seeing this opportunity');
  }

  return recommendations;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate a quick competition score for a set of products
 */
export function quickCompetitionScore(products: AmazonProductData[]): number {
  if (products.length === 0) return 0;

  const avgReviews = products.reduce((s, p) => s + p.reviewCount, 0) / products.length;
  const reviewScore = Math.min(1, avgReviews / 500);

  const bsrProducts = products.filter((p) => p.bsr);
  const avgBsr = bsrProducts.length > 0
    ? bsrProducts.reduce((s, p) => s + p.bsr!, 0) / bsrProducts.length
    : 500000;
  const bsrScore = avgBsr < 100000 ? 0.8 : avgBsr < 300000 ? 0.5 : 0.2;

  return (reviewScore * 0.6) + (bsrScore * 0.4);
}

/**
 * Determine if a niche is worth entering based on competition
 */
export function isWorthEntering(competitionScore: number, demandScore: number): boolean {
  // Worth entering if: low competition OR (medium competition AND high demand)
  if (competitionScore < 0.4) return true;
  if (competitionScore < 0.6 && demandScore > 0.6) return true;
  return false;
}
