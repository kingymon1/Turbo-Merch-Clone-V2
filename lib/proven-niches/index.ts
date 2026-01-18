/**
 * Proven Niches Pipeline - Main Entry Point
 *
 * Exports all public functions and types for the Proven Niches module.
 */

// Types
export * from './types';

// Configuration
export { SEED_NICHES, SCRAPE_CONFIG, ANALYSIS_CONFIG, SCAN_SCHEDULE, CRON_CONFIG, log, logError, logWarn } from './config';

// Client
export { getAmazonClient, checkAmazonScrapingStatus } from './client/amazon-client';

// Scrapers
export { scanNiches, initializeSeedNiches, scrapeKeyword } from './scrapers/product-scraper';
export { analyzeKeyword, discoverRelatedKeywords, getKeywordData } from './scrapers/keyword-scraper';

// Analyzers
export { analyzeCompetition, quickCompetitionScore, isWorthEntering } from './analyzers/competition-analyzer';
export { analyzeNicheOpportunities, storeAnalyzedOpportunities } from './analyzers/opportunity-analyzer';

// Storage
export {
  getTrackedNiches,
  getTrackedNiche,
  upsertTrackedNiche,
  updateNicheMetrics,
  storeProducts,
  getProductsForNiche,
  storeOpportunity,
  getOpportunities,
  updateOpportunityStatus,
  storeKeyword,
  getKeyword,
} from './storage/niche-store';

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Check if the Proven Niches pipeline is configured and ready
 */
export async function checkProvenNichesHealth(): Promise<{
  configured: boolean;
  working: boolean;
  details: {
    decodoConfigured: boolean;
    decodoWorking: boolean;
    seedNichesCount: number;
    trackedNichesCount: number;
  };
  errors: string[];
}> {
  const errors: string[] = [];

  // Check Decodo configuration
  const { checkAmazonScrapingStatus } = await import('./client/amazon-client');
  const decodoStatus = await checkAmazonScrapingStatus();

  if (!decodoStatus.configured) {
    errors.push('Decodo API not configured');
  } else if (!decodoStatus.working) {
    errors.push(`Decodo API error: ${decodoStatus.error}`);
  }

  // Check seed niches
  const { SEED_NICHES } = await import('./config');
  const seedNichesCount = SEED_NICHES.length;

  // Check tracked niches
  const { getTrackedNiches } = await import('./storage/niche-store');
  let trackedNichesCount = 0;
  try {
    const niches = await getTrackedNiches();
    trackedNichesCount = niches.length;
  } catch (error) {
    errors.push('Failed to query tracked niches');
  }

  return {
    configured: decodoStatus.configured,
    working: decodoStatus.working && errors.length === 0,
    details: {
      decodoConfigured: decodoStatus.configured,
      decodoWorking: decodoStatus.working,
      seedNichesCount,
      trackedNichesCount,
    },
    errors,
  };
}

/**
 * Run a full marketplace scan with opportunity analysis
 */
export async function runFullScan(options?: {
  niches?: string[];
  maxProductsPerNiche?: number;
}): Promise<{
  success: boolean;
  scanResult: import('./types').ScanResult;
  opportunitiesFound: number;
  errors: string[];
}> {
  const { scanNiches } = await import('./scrapers/product-scraper');
  const { getTrackedNiches, getProductsForNiche } = await import('./storage/niche-store');
  const { analyzeNicheOpportunities, storeAnalyzedOpportunities } = await import('./analyzers/opportunity-analyzer');

  const errors: string[] = [];
  let opportunitiesFound = 0;

  // Run the product scan
  const scanResult = await scanNiches({
    niches: options?.niches,
    maxProductsPerNiche: options?.maxProductsPerNiche,
    includeOpportunityAnalysis: true,
  });

  if (!scanResult.success) {
    errors.push(...scanResult.errors);
  }

  // Run opportunity analysis for each scanned niche
  try {
    const niches = await getTrackedNiches(true);

    for (const niche of niches) {
      try {
        const products = await getProductsForNiche(niche.name);
        if (products.length === 0) continue;

        const opportunities = await analyzeNicheOpportunities(niche, products);
        if (opportunities.length === 0) continue;

        // Get niche ID for storing opportunities
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        const dbNiche = await prisma.trackedNiche.findUnique({
          where: { name: niche.name },
        });

        if (dbNiche) {
          const stored = await storeAnalyzedOpportunities(dbNiche.id, opportunities);
          opportunitiesFound += stored;
        }
      } catch (error) {
        errors.push(`Opportunity analysis failed for ${niche.name}`);
      }
    }
  } catch (error) {
    errors.push('Opportunity analysis failed');
  }

  return {
    success: scanResult.success && errors.length === 0,
    scanResult: {
      ...scanResult,
      opportunitiesFound,
    },
    opportunitiesFound,
    errors,
  };
}
