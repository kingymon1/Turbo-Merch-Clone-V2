/**
 * Marketplace Bootstrap Service
 *
 * Phase 7D: Bootstraps the marketplace intelligence system with real Amazon MBA data.
 *
 * THE PROBLEM:
 * The marketplace intelligence system returns low confidence (~10%) because
 * the database has no Amazon MBA product data yet.
 *
 * THE SOLUTION:
 * Systematically seed the database with 200-400 products across 15-20 core
 * MBA niches to enable 30-40% confidence scores.
 *
 * STRATEGY:
 * 1. Focus on proven high-value MBA niches (nurse humor, teacher life, dog mom, etc.)
 * 2. Use enhanced MBA detection (higher sample size for product detail checks)
 * 3. Track progress and report confidence improvements
 * 4. Trigger learning engine after each niche for immediate pattern analysis
 */

import {
  searchAmazonWithMbaDetection,
  enhanceProductWithAnalysis,
  isApiConfigured,
} from './marketplaceIntelligence';

import {
  storeMarketplaceProduct,
  updateNicheMarketData,
  runLearningEngine,
  isDatabaseConfigured,
  getOptimizedKeywordsForNiche,
} from './marketplaceLearning';

// ============================================================================
// CORE MBA NICHES TO BOOTSTRAP
// ============================================================================

/**
 * High-value niches proven to perform well on Merch by Amazon.
 * These are carefully selected based on:
 * - High search volume
 * - Strong MBA presence
 * - Gift-giving potential
 * - Evergreen demand
 */
export const CORE_MBA_NICHES = [
  // Professions - High gift market, evergreen
  'nurse shirt funny',
  'teacher shirt funny',
  'trucker shirt funny',
  'mechanic shirt funny',
  'electrician shirt funny',

  // Family - Major gift occasions, high volume
  'dad shirt funny',
  'mom shirt funny',
  'grandpa shirt funny',
  'grandma shirt funny',

  // Pets - Passionate audiences
  'dog mom shirt',
  'cat mom shirt',
  'dog dad shirt',

  // Hobbies - Evergreen, loyal audiences
  'fishing shirt funny',
  'hunting shirt funny',
  'camping shirt funny',
  'golf shirt funny',
  'gardening shirt funny',

  // Lifestyle
  'coffee shirt funny',
  'beer shirt funny',
  'bbq shirt funny',
];

// ============================================================================
// BOOTSTRAP PROGRESS TYPES
// ============================================================================

export interface NicheBootstrapResult {
  niche: string;
  productsFound: number;
  productsStored: number;
  mbaProductsFound: number;
  mbaProductsStored: number;
  confidenceBefore: number;
  confidenceAfter: number;
  confidenceGain: number;
  durationMs: number;
  error?: string;
}

export interface BootstrapProgress {
  status: 'running' | 'complete' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  totalNiches: number;
  nichesCompleted: number;
  currentNiche?: string;
  results: NicheBootstrapResult[];
  summary?: BootstrapSummary;
}

export interface BootstrapSummary {
  totalProducts: number;
  totalMbaProducts: number;
  avgConfidenceGain: number;
  nichesWithGoodConfidence: number;  // 30%+ confidence
  totalDurationMs: number;
  recommendation: string;
}

// ============================================================================
// BOOTSTRAP IMPLEMENTATION
// ============================================================================

/**
 * Bootstrap the marketplace database with core MBA niche data.
 *
 * This is the main function to populate the learning system with
 * initial data so getOptimizedKeywordsForNiche() returns useful results.
 *
 * @param options - Bootstrap configuration
 * @param onProgress - Callback for progress updates
 * @returns Complete bootstrap results
 */
export const bootstrapMarketplace = async (
  options: {
    niches?: string[];           // Override default niches
    productsPerNiche?: number;   // Target products per niche (default: 20)
    mbaSampleSize?: number;      // Products to check for MBA (default: 8)
    delayBetweenNiches?: number; // Rate limiting delay (default: 2000ms)
    runLearningAfterEach?: boolean; // Run learning after each niche (default: false)
  } = {},
  onProgress?: (progress: BootstrapProgress) => void
): Promise<BootstrapProgress> => {
  const {
    niches = CORE_MBA_NICHES,
    productsPerNiche = 20,
    mbaSampleSize = 8,
    delayBetweenNiches = 2000,
    runLearningAfterEach = false,
  } = options;

  const progress: BootstrapProgress = {
    status: 'running',
    startedAt: new Date(),
    totalNiches: niches.length,
    nichesCompleted: 0,
    results: [],
  };

  console.log(`[BOOTSTRAP] Starting marketplace bootstrap with ${niches.length} niches`);
  console.log(`[BOOTSTRAP] Target: ${productsPerNiche} products per niche, ${mbaSampleSize} MBA sample size`);

  // Validate prerequisites
  if (!isApiConfigured()) {
    progress.status = 'failed';
    progress.results.push({
      niche: 'SYSTEM',
      productsFound: 0,
      productsStored: 0,
      mbaProductsFound: 0,
      mbaProductsStored: 0,
      confidenceBefore: 0,
      confidenceAfter: 0,
      confidenceGain: 0,
      durationMs: 0,
      error: 'Decodo API not configured',
    });
    return progress;
  }

  if (!(await isDatabaseConfigured())) {
    progress.status = 'failed';
    progress.results.push({
      niche: 'SYSTEM',
      productsFound: 0,
      productsStored: 0,
      mbaProductsFound: 0,
      mbaProductsStored: 0,
      confidenceBefore: 0,
      confidenceAfter: 0,
      confidenceGain: 0,
      durationMs: 0,
      error: 'Database not configured',
    });
    return progress;
  }

  // Process each niche
  for (const niche of niches) {
    const nicheStart = Date.now();
    progress.currentNiche = niche;
    onProgress?.(progress);

    console.log(`[BOOTSTRAP] Processing: "${niche}" (${progress.nichesCompleted + 1}/${niches.length})`);

    const result: NicheBootstrapResult = {
      niche,
      productsFound: 0,
      productsStored: 0,
      mbaProductsFound: 0,
      mbaProductsStored: 0,
      confidenceBefore: 0,
      confidenceAfter: 0,
      confidenceGain: 0,
      durationMs: 0,
    };

    try {
      // Get confidence before
      const keywordsBefore = await getOptimizedKeywordsForNiche(niche);
      result.confidenceBefore = keywordsBefore?.confidence ?? 0;

      // Search Amazon with enhanced MBA detection
      const searchResult = await searchAmazonWithMbaDetection(niche, {
        mbaSampleSize,
      });

      if (searchResult.success && searchResult.products.length > 0) {
        result.productsFound = searchResult.products.length;
        result.mbaProductsFound = searchResult.mbaStats.found;

        console.log(`[BOOTSTRAP] "${niche}": Found ${result.productsFound} products, ${result.mbaProductsFound} MBA`);

        // Store products (up to productsPerNiche)
        const productsToStore = searchResult.products.slice(0, productsPerNiche);

        for (const product of productsToStore) {
          try {
            const enhanced = enhanceProductWithAnalysis(product);

            await storeMarketplaceProduct({
              source: 'amazon',
              externalId: enhanced.asin || enhanced.id,
              title: enhanced.title,
              price: enhanced.price,
              url: enhanced.url,
              reviewCount: enhanced.reviewCount,
              avgRating: enhanced.avgRating,
              salesRank: enhanced.salesRank,
              category: enhanced.category,
              seller: enhanced.seller,
              imageUrl: enhanced.imageUrl,
              niche: niche,
              isMerchByAmazon: enhanced.isMerchByAmazon,
              titleCharCount: enhanced.titleCharCount,
              primaryKeywords: enhanced.primaryKeywords,
              keywordRepetitions: enhanced.keywordRepetitions,
              designTextInTitle: enhanced.designTextInTitle,
              brandStyle: enhanced.brandStyle,
              brandName: enhanced.brandName,
            });

            result.productsStored++;
            if (enhanced.isMerchByAmazon) {
              result.mbaProductsStored++;
            }
          } catch (storeError) {
            console.log(`[BOOTSTRAP] Failed to store product: ${storeError}`);
          }
        }

        // Update niche market data
        await updateNicheMarketData(niche);

        // Optionally run learning engine after each niche
        if (runLearningAfterEach && result.productsStored >= 10) {
          console.log(`[BOOTSTRAP] Running learning engine for "${niche}"...`);
          await runLearningEngine();
        }

        // Get confidence after
        const keywordsAfter = await getOptimizedKeywordsForNiche(niche);
        result.confidenceAfter = keywordsAfter?.confidence ?? 0;
        result.confidenceGain = result.confidenceAfter - result.confidenceBefore;

        console.log(`[BOOTSTRAP] "${niche}": Confidence ${result.confidenceBefore}% -> ${result.confidenceAfter}% (+${result.confidenceGain}%)`);
      } else {
        result.error = searchResult.error || 'No products found';
        console.log(`[BOOTSTRAP] "${niche}": Failed - ${result.error}`);
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[BOOTSTRAP] "${niche}": Error - ${result.error}`);
    }

    result.durationMs = Date.now() - nicheStart;
    progress.results.push(result);
    progress.nichesCompleted++;
    onProgress?.(progress);

    // Rate limiting delay
    if (progress.nichesCompleted < niches.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenNiches));
    }
  }

  // Run final learning engine pass
  console.log('[BOOTSTRAP] Running final learning engine pass...');
  await runLearningEngine();

  // Calculate summary
  progress.status = 'complete';
  progress.completedAt = new Date();
  progress.currentNiche = undefined;

  const totalProducts = progress.results.reduce((sum, r) => sum + r.productsStored, 0);
  const totalMbaProducts = progress.results.reduce((sum, r) => sum + r.mbaProductsStored, 0);
  const confidenceGains = progress.results.filter(r => r.confidenceGain > 0).map(r => r.confidenceGain);
  const avgConfidenceGain = confidenceGains.length > 0
    ? confidenceGains.reduce((a, b) => a + b, 0) / confidenceGains.length
    : 0;
  const nichesWithGoodConfidence = progress.results.filter(r => r.confidenceAfter >= 30).length;
  const totalDurationMs = progress.results.reduce((sum, r) => sum + r.durationMs, 0);

  progress.summary = {
    totalProducts,
    totalMbaProducts,
    avgConfidenceGain: Math.round(avgConfidenceGain * 10) / 10,
    nichesWithGoodConfidence,
    totalDurationMs,
    recommendation: getRecommendation(totalProducts, totalMbaProducts, nichesWithGoodConfidence, niches.length),
  };

  console.log(`[BOOTSTRAP] Complete!`);
  console.log(`[BOOTSTRAP] Total: ${totalProducts} products, ${totalMbaProducts} MBA products`);
  console.log(`[BOOTSTRAP] Niches with 30%+ confidence: ${nichesWithGoodConfidence}/${niches.length}`);
  console.log(`[BOOTSTRAP] Duration: ${Math.round(totalDurationMs / 1000)}s`);

  onProgress?.(progress);
  return progress;
};

/**
 * Generate recommendation based on bootstrap results
 */
const getRecommendation = (
  totalProducts: number,
  mbaProducts: number,
  goodNiches: number,
  totalNiches: number
): string => {
  if (totalProducts < 50) {
    return 'Insufficient data collected. Check API configuration and try again.';
  }

  if (mbaProducts < 10) {
    return 'Few MBA products detected. MBA detection may need verification, but keyword data is still valuable.';
  }

  if (goodNiches >= totalNiches * 0.5) {
    return `Excellent! ${goodNiches}/${totalNiches} niches have 30%+ confidence. Marketplace intelligence is ready for use.`;
  }

  if (goodNiches >= totalNiches * 0.25) {
    return `Good progress. ${goodNiches}/${totalNiches} niches have good confidence. Consider re-running for remaining niches.`;
  }

  return 'Bootstrap complete but confidence is lower than expected. Run learning engine or add more data.';
};

/**
 * Quick bootstrap with minimal niches for testing
 */
export const bootstrapQuick = async (
  onProgress?: (progress: BootstrapProgress) => void
): Promise<BootstrapProgress> => {
  const quickNiches = [
    'nurse shirt funny',
    'dad shirt funny',
    'dog mom shirt',
    'fishing shirt funny',
    'coffee shirt funny',
  ];

  return bootstrapMarketplace({
    niches: quickNiches,
    productsPerNiche: 15,
    mbaSampleSize: 5,
    delayBetweenNiches: 1500,
  }, onProgress);
};

/**
 * Check current bootstrap status across all core niches
 */
export const getBootstrapStatus = async (): Promise<{
  totalNiches: number;
  nichesWithData: number;
  nichesWithGoodConfidence: number;
  totalProducts: number;
  totalMbaProducts: number;
  avgConfidence: number;
  nicheDetails: Array<{
    niche: string;
    hasData: boolean;
    confidence: number;
    mbaCount: number;
  }>;
  recommendation: string;
}> => {
  const nicheDetails: Array<{
    niche: string;
    hasData: boolean;
    confidence: number;
    mbaCount: number;
  }> = [];

  let totalProducts = 0;
  let totalMbaProducts = 0;
  let confidenceSum = 0;
  let nichesWithData = 0;

  for (const niche of CORE_MBA_NICHES) {
    const keywords = await getOptimizedKeywordsForNiche(niche);

    const hasData = keywords !== null && keywords.mbaInsights.productCount > 0;
    const confidence = keywords?.confidence ?? 0;
    const mbaCount = keywords?.mbaInsights.productCount ?? 0;

    nicheDetails.push({ niche, hasData, confidence, mbaCount });

    if (hasData) {
      nichesWithData++;
      confidenceSum += confidence;
      totalMbaProducts += mbaCount;
      // Estimate total products (MBA is usually subset)
      totalProducts += Math.max(mbaCount * 2, 10);
    }
  }

  const avgConfidence = nichesWithData > 0 ? Math.round(confidenceSum / nichesWithData) : 0;
  const nichesWithGoodConfidence = nicheDetails.filter(n => n.confidence >= 30).length;

  let recommendation: string;
  if (nichesWithData === 0) {
    recommendation = 'Database is empty. Run bootstrap to seed marketplace data.';
  } else if (avgConfidence < 20) {
    recommendation = 'Low confidence across niches. Run full bootstrap to improve data quality.';
  } else if (avgConfidence < 35) {
    recommendation = 'Moderate confidence. Consider running bootstrap for niches with low data.';
  } else {
    recommendation = 'Good confidence levels. Marketplace intelligence is ready for production use.';
  }

  return {
    totalNiches: CORE_MBA_NICHES.length,
    nichesWithData,
    nichesWithGoodConfidence,
    totalProducts,
    totalMbaProducts,
    avgConfidence,
    nicheDetails,
    recommendation,
  };
};

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  CORE_MBA_NICHES,
  bootstrapMarketplace,
  bootstrapQuick,
  getBootstrapStatus,
};
