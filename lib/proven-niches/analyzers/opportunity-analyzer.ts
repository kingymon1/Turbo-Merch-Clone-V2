/**
 * Proven Niches Pipeline - Opportunity Analyzer
 *
 * Identifies market gaps and opportunities within tracked niches.
 * Uses AI to analyze product data and suggest designs.
 */

import {
  AmazonProductData,
  TrackedNicheData,
  NicheOpportunityData,
  OpportunityAnalysis,
} from '../types';
import { ANALYSIS_CONFIG, estimateMonthlySales, log, logError } from '../config';
import { analyzeCompetition, quickCompetitionScore } from './competition-analyzer';
import { storeOpportunity, getProductsForNiche } from '../storage/niche-store';

// =============================================================================
// MAIN ANALYSIS FUNCTION
// =============================================================================

/**
 * Analyze a niche and identify opportunities
 */
export async function analyzeNicheOpportunities(
  niche: TrackedNicheData,
  products: AmazonProductData[]
): Promise<OpportunityAnalysis[]> {
  if (products.length === 0) {
    log(`No products to analyze for niche: ${niche.name}`);
    return [];
  }

  log(`Analyzing opportunities for niche: ${niche.name}`);

  const opportunities: OpportunityAnalysis[] = [];

  // Analyze overall niche opportunity
  const nicheOpportunity = analyzeOverallNiche(niche, products);
  if (nicheOpportunity) {
    opportunities.push(nicheOpportunity);
  }

  // Find keyword gaps
  const keywordGaps = findKeywordGaps(products);
  for (const gap of keywordGaps) {
    opportunities.push(gap);
  }

  // Find price point opportunities
  const priceOpportunities = findPriceOpportunities(products);
  for (const opp of priceOpportunities) {
    opportunities.push(opp);
  }

  // Filter to viable opportunities
  const viableOpportunities = opportunities.filter((o) => o.isViable);

  log(`Found ${viableOpportunities.length} viable opportunities in ${niche.name}`);

  return viableOpportunities;
}

/**
 * Store analyzed opportunities to database
 */
export async function storeAnalyzedOpportunities(
  nicheId: string,
  opportunities: OpportunityAnalysis[]
): Promise<number> {
  let stored = 0;

  for (const opp of opportunities) {
    try {
      const data: NicheOpportunityData = {
        nicheId,
        title: generateTitle(opp),
        description: opp.reasoning,
        keywords: [],
        opportunityScore: opp.opportunityScore,
        demandScore: opp.demandScore,
        competitionScore: opp.competitionScore,
        reasoning: opp.reasoning,
        suggestedPhrases: opp.suggestedPhrases,
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      };

      await storeOpportunity(data);
      stored++;
    } catch (error) {
      logError('Failed to store opportunity', error);
    }
  }

  return stored;
}

// =============================================================================
// OPPORTUNITY DETECTION
// =============================================================================

/**
 * Analyze overall niche opportunity
 */
function analyzeOverallNiche(
  niche: TrackedNicheData,
  products: AmazonProductData[]
): OpportunityAnalysis | null {
  const competitionResult = analyzeCompetition({ products, niche: niche.name });
  const demandScore = calculateDemandScore(products);

  // Calculate overall opportunity score
  const opportunityScore = calculateOpportunityScore(
    competitionResult.competitionScore,
    demandScore,
    products
  );

  // Check if meets minimum thresholds
  if (opportunityScore < ANALYSIS_CONFIG.minOpportunityScore) {
    return null;
  }

  if (demandScore < ANALYSIS_CONFIG.minDemandScore) {
    return null;
  }

  if (competitionResult.competitionScore > ANALYSIS_CONFIG.maxCompetitionScore) {
    return null;
  }

  // Generate reasoning
  const reasoning = generateNicheReasoning(niche, competitionResult, demandScore);

  // Generate suggested phrases
  const suggestedPhrases = generateSuggestedPhrases(niche, products);

  return {
    isViable: true,
    opportunityScore,
    demandScore,
    competitionScore: competitionResult.competitionScore,
    reasoning,
    suggestedPhrases,
    marketGaps: competitionResult.recommendations,
    riskFactors: identifyRiskFactors(competitionResult, demandScore),
  };
}

/**
 * Find gaps in keyword coverage
 */
function findKeywordGaps(products: AmazonProductData[]): OpportunityAnalysis[] {
  const opportunities: OpportunityAnalysis[] = [];

  // Extract all keywords
  const keywordCounts = new Map<string, number>();
  const keywordBsr = new Map<string, number[]>();

  for (const product of products) {
    for (const keyword of product.keywords) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
      if (product.bsr) {
        const bsrs = keywordBsr.get(keyword) || [];
        bsrs.push(product.bsr);
        keywordBsr.set(keyword, bsrs);
      }
    }
  }

  // Find keywords with low competition but decent demand
  for (const [keyword, count] of keywordCounts.entries()) {
    // Skip if too common (high competition) or too rare (no demand signal)
    if (count < 3 || count > products.length * 0.3) continue;

    const bsrs = keywordBsr.get(keyword) || [];
    if (bsrs.length === 0) continue;

    const avgBsr = bsrs.reduce((a, b) => a + b, 0) / bsrs.length;

    // Good opportunity: few products with the keyword but good BSR
    if (avgBsr < 300000 && count < 10) {
      const demandScore = Math.max(0, 1 - (avgBsr / 500000));
      const competitionScore = count / products.length;
      const opportunityScore = (1 - competitionScore) * 0.5 + demandScore * 0.5;

      if (opportunityScore > ANALYSIS_CONFIG.minOpportunityScore) {
        opportunities.push({
          isViable: true,
          opportunityScore,
          demandScore,
          competitionScore,
          reasoning: `Keyword "${keyword}" appears in only ${count} products but has strong BSR (avg ${Math.round(avgBsr)})`,
          suggestedPhrases: [keyword],
          marketGaps: [`Underserved keyword: ${keyword}`],
          riskFactors: [],
        });
      }
    }
  }

  return opportunities.slice(0, 5); // Limit to top 5
}

/**
 * Find price point opportunities
 */
function findPriceOpportunities(products: AmazonProductData[]): OpportunityAnalysis[] {
  const opportunities: OpportunityAnalysis[] = [];

  const priceProducts = products.filter((p) => p.price && p.price > 0);
  if (priceProducts.length < 10) return [];

  // Calculate price distribution
  const prices = priceProducts.map((p) => p.price!);
  prices.sort((a, b) => a - b);

  const minPrice = prices[0];
  const maxPrice = prices[prices.length - 1];
  const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;

  // Look for price gaps
  // Premium opportunity: if most products are low-priced but some premium ones sell well
  const premiumProducts = priceProducts.filter((p) => p.price! > avgPrice * 1.5);
  const premiumWithGoodBsr = premiumProducts.filter((p) => p.bsr && p.bsr < 200000);

  if (premiumWithGoodBsr.length > 0 && premiumProducts.length < products.length * 0.2) {
    const avgPremiumBsr = premiumWithGoodBsr.reduce((s, p) => s + p.bsr!, 0) / premiumWithGoodBsr.length;

    opportunities.push({
      isViable: true,
      opportunityScore: 0.7,
      demandScore: 0.6,
      competitionScore: 0.3,
      reasoning: `Premium price point ($${Math.round(avgPrice * 1.5)}+) is underserved but selling well (avg BSR ${Math.round(avgPremiumBsr)})`,
      suggestedPhrases: [],
      marketGaps: ['Premium positioning opportunity'],
      riskFactors: ['May require higher quality designs'],
    });
  }

  // Value opportunity: if the budget segment is underserved
  const budgetProducts = priceProducts.filter((p) => p.price! < avgPrice * 0.7);
  if (budgetProducts.length < products.length * 0.15) {
    opportunities.push({
      isViable: true,
      opportunityScore: 0.6,
      demandScore: 0.5,
      competitionScore: 0.4,
      reasoning: `Budget price point (under $${Math.round(avgPrice * 0.7)}) has limited competition`,
      suggestedPhrases: [],
      marketGaps: ['Budget-conscious segment opportunity'],
      riskFactors: ['Lower margins', 'Price-sensitive customers'],
    });
  }

  return opportunities;
}

// =============================================================================
// SCORE CALCULATIONS
// =============================================================================

function calculateDemandScore(products: AmazonProductData[]): number {
  const config = ANALYSIS_CONFIG.demand;
  const bsrProducts = products.filter((p) => p.bsr);

  if (bsrProducts.length === 0) return 0.5; // Neutral score

  const avgBsr = bsrProducts.reduce((s, p) => s + p.bsr!, 0) / bsrProducts.length;
  const topBsr = Math.min(...bsrProducts.map((p) => p.bsr!));

  // Score based on average BSR
  let score: number;
  if (avgBsr < config.excellentBsrMax) {
    score = 0.9;
  } else if (avgBsr < config.goodBsrMax) {
    score = 0.75;
  } else if (avgBsr < config.moderateBsrMax) {
    score = 0.5;
  } else if (avgBsr < config.lowBsrMax) {
    score = 0.3;
  } else {
    score = 0.1;
  }

  // Bonus for top seller performance
  if (topBsr < 20000) score = Math.min(1, score + 0.1);

  return score;
}

function calculateOpportunityScore(
  competitionScore: number,
  demandScore: number,
  products: AmazonProductData[]
): number {
  const weights = ANALYSIS_CONFIG.opportunityWeights;

  // Base score from demand and inverse competition
  let score = (demandScore * weights.demand) + ((1 - competitionScore) * weights.competition);

  // Price point bonus
  const avgPrice = calculateAveragePrice(products);
  if (avgPrice >= 15 && avgPrice <= 25) {
    score += weights.pricePoint; // Sweet spot for merch
  } else if (avgPrice >= 12 && avgPrice <= 30) {
    score += weights.pricePoint * 0.5;
  }

  // Review velocity (newer products with reviews = growing market)
  const newWithReviews = products.filter((p) => p.reviewCount > 10 && p.reviewCount < 100);
  if (newWithReviews.length > products.length * 0.2) {
    score += weights.reviewVelocity;
  }

  return Math.min(1, Math.max(0, score));
}

function calculateAveragePrice(products: AmazonProductData[]): number {
  const priced = products.filter((p) => p.price && p.price > 0);
  if (priced.length === 0) return 0;
  return priced.reduce((s, p) => s + p.price!, 0) / priced.length;
}

// =============================================================================
// REASONING GENERATION
// =============================================================================

function generateNicheReasoning(
  niche: TrackedNicheData,
  competition: { competitionScore: number; competitionLevel: string },
  demandScore: number
): string {
  const parts: string[] = [];

  // Competition assessment
  if (competition.competitionScore < 0.3) {
    parts.push('Low competition in this niche');
  } else if (competition.competitionScore < 0.5) {
    parts.push('Moderate competition with room for new entrants');
  } else {
    parts.push('Competitive space requiring differentiation');
  }

  // Demand assessment
  if (demandScore > 0.7) {
    parts.push('strong proven demand');
  } else if (demandScore > 0.4) {
    parts.push('solid market demand');
  } else {
    parts.push('emerging demand signals');
  }

  // Combine
  return `${parts.join(' with ')}. The ${niche.displayName || niche.name} niche shows opportunity for well-designed merch.`;
}

function generateSuggestedPhrases(niche: TrackedNicheData, products: AmazonProductData[]): string[] {
  // Extract common phrases from titles
  const phrases: string[] = [];
  const wordPairs = new Map<string, number>();

  for (const product of products.slice(0, 20)) {
    const words = product.title
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    // Generate pairs
    for (let i = 0; i < words.length - 1; i++) {
      const pair = `${words[i]} ${words[i + 1]}`;
      wordPairs.set(pair, (wordPairs.get(pair) || 0) + 1);
    }
  }

  // Get top phrases
  const sorted = Array.from(wordPairs.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([phrase]) => phrase);

  // Add niche-based phrases
  if (niche.displayName) {
    phrases.push(niche.displayName);
  }

  return [...phrases, ...sorted];
}

function identifyRiskFactors(
  competition: { competitionScore: number; recommendations: string[] },
  demandScore: number
): string[] {
  const risks: string[] = [];

  if (competition.competitionScore > 0.6) {
    risks.push('High competition may limit visibility');
  }

  if (demandScore < 0.4) {
    risks.push('Demand signals are weak - may be a smaller market');
  }

  if (competition.competitionScore > 0.5 && demandScore < 0.5) {
    risks.push('Competition to demand ratio is unfavorable');
  }

  return risks;
}

function generateTitle(opp: OpportunityAnalysis): string {
  if (opp.marketGaps.length > 0) {
    return opp.marketGaps[0];
  }

  if (opp.opportunityScore > 0.7) {
    return 'High-potential opportunity';
  } else if (opp.opportunityScore > 0.5) {
    return 'Solid market opportunity';
  }

  return 'Emerging opportunity';
}
