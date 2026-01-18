/**
 * Emerging Trends Pipeline - Main Module
 *
 * A completely separate module for discovering emerging trends from social platforms
 * (Reddit, TikTok) before they become mainstream.
 *
 * Key insight: Relative velocity within a community matters more than absolute numbers.
 * A post with 500 upvotes in a 30k subreddit is a bigger signal than 5,000 in a 5M subreddit.
 *
 * @example
 * import { discoverEmergingTrends, getActiveEmergingTrends } from '@/lib/emerging-trends';
 *
 * // Run discovery (typically via cron)
 * const result = await discoverEmergingTrends({ platforms: ['reddit'] });
 *
 * // Get trends for UI
 * const trends = await getActiveEmergingTrends({ limit: 20 });
 */

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Types
export * from './types';

// Config
export {
  isDecodoConfigured,
  SEED_COMMUNITIES,
  DISCOVERY_CONFIG,
  DEFAULT_VELOCITY_PRESET,
  getVelocityConfig,
  TREND_LIFECYCLE,
  CRON_CONFIG,
} from './config';

// Client
export { DecodoClient, getDecodoClient, checkDecodoStatus } from './client/decodo-client';

// Scrapers
export { scrapeRedditSubreddit, scrapeMultipleSubreddits } from './scrapers/reddit-scraper';
export { scrapeTikTokVideo, scrapeTikTokShopSearch } from './scrapers/tiktok-scraper';
export {
  getSeedCommunities,
  discoverRelatedSubreddits,
  estimateMerchPotential,
  categorizeSubreddit,
} from './scrapers/discovery-scraper';

// Analyzers
export {
  calculateVelocity,
  scoreSignals,
  scoreSignalsWithPreset,
  filterByThresholds,
  calculateDynamicBaseline,
  getTopSignals,
  groupByTier,
} from './analyzers/velocity-calculator';

// Evaluators
export {
  evaluateSignal,
  evaluateSignalsBatch,
  filterForEvaluation,
  quickFilter,
} from './evaluators/merch-evaluator';

// Storage
export {
  upsertSocialSignal,
  upsertSocialSignals,
  getUnevaluatedSignals,
  markSignalEvaluated,
  createEmergingTrend,
  getActiveEmergingTrends,
  markTrendUsed,
  deactivateExpiredTrends,
  upsertCommunity,
  getCommunitiesToScrape,
  updateCommunityAfterScrape,
  getCommunityBaseline,
} from './storage/trend-store';

// =============================================================================
// ORCHESTRATION
// =============================================================================

import {
  Platform,
  VelocityPreset,
  DiscoveryResult,
  DiscoveryOptions,
} from './types';
import { isDecodoConfigured, DISCOVERY_CONFIG, log, logError } from './config';
import { scrapeRedditSubreddit } from './scrapers/reddit-scraper';
import { getSeedCommunities } from './scrapers/discovery-scraper';
import {
  scoreSignalsWithPreset,
  filterByThresholds,
  calculateDynamicBaseline,
} from './analyzers/velocity-calculator';
import { quickFilter, evaluateSignalsBatch } from './evaluators/merch-evaluator';
import {
  upsertSocialSignals,
  upsertCommunity,
  getCommunitiesToScrape,
  updateCommunityAfterScrape,
  getCommunityBaseline,
  createEmergingTrend,
  deactivateExpiredTrends,
} from './storage/trend-store';
import { VELOCITY_PRESETS } from './types';

/**
 * Main discovery orchestration function
 *
 * This is the primary entry point for the emerging trends system.
 * Call this from a cron job or on-demand to discover new trends.
 */
export async function discoverEmergingTrends(
  options: Partial<DiscoveryOptions> = {}
): Promise<DiscoveryResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  const {
    platforms = ['reddit'],
    velocityPreset = 'moderate',
    maxSignalsPerCommunity = DISCOVERY_CONFIG.maxSignalsPerCommunity,
    maxTotalSignals = DISCOVERY_CONFIG.maxTotalSignals,
    includeEvaluations = true,
  } = options;

  log('Starting emerging trends discovery', { platforms, velocityPreset });

  // Check if Decodo is configured
  if (!isDecodoConfigured()) {
    const error = 'Decodo API not configured. Set DECODO_USERNAME and DECODO_PASSWORD.';
    logError(error);
    return {
      success: false,
      signalsFound: 0,
      signalsStored: 0,
      trendsEvaluated: 0,
      trendsCreated: 0,
      errors: [error],
      duration: Date.now() - startTime,
    };
  }

  let signalsFound = 0;
  let signalsStored = 0;
  let trendsEvaluated = 0;
  let trendsCreated = 0;

  try {
    // 1. Ensure seed communities exist
    const seeds = getSeedCommunities();
    for (const seed of seeds) {
      if (platforms.includes(seed.platform)) {
        await upsertCommunity(seed);
      }
    }

    // 2. Get communities to scrape
    const communities = await getCommunitiesToScrape(
      DISCOVERY_CONFIG.maxCommunitiesPerRun,
      DISCOVERY_CONFIG.minHoursBetweenScrapes
    );

    log(`Found ${communities.length} communities to scrape`);

    if (communities.length === 0) {
      log('No communities due for scraping');
      return {
        success: true,
        signalsFound: 0,
        signalsStored: 0,
        trendsEvaluated: 0,
        trendsCreated: 0,
        errors: [],
        duration: Date.now() - startTime,
      };
    }

    // 3. Scrape each community
    const velocityConfig = VELOCITY_PRESETS[velocityPreset];
    const allScoredSignals = [];

    for (const community of communities) {
      if (!platforms.includes(community.platform)) continue;

      try {
        // Get or calculate baseline
        let baseline = await getCommunityBaseline(community.platform, community.name);

        if (community.platform === 'reddit') {
          const result = await scrapeRedditSubreddit(community.name, {
            maxPosts: maxSignalsPerCommunity,
            sortBy: 'hot',
          });

          if (result.success) {
            signalsFound += result.signals.length;

            // Use scraped data for baseline if none exists
            if (!baseline && result.baseline) {
              baseline = result.baseline;
            }

            // Score signals
            const filtered = filterByThresholds(result.signals, velocityConfig);
            const scored = scoreSignalsWithPreset(
              filtered,
              baseline || calculateDynamicBaseline(result.signals),
              velocityPreset
            );

            // Store signals
            const stored = await upsertSocialSignals(scored);
            signalsStored += stored;

            // Collect high-velocity signals for evaluation
            allScoredSignals.push(...scored.filter((s) => s.velocityTier !== 'normal'));

            // Update community
            await updateCommunityAfterScrape(
              community.platform,
              community.name,
              result.signals.length,
              result.baseline
            );
          } else {
            errors.push(`Failed to scrape r/${community.name}: ${result.error}`);
          }
        }

        // Small delay between communities
        await new Promise((resolve) => setTimeout(resolve, 500));

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`Error scraping ${community.platform}/${community.name}: ${message}`);
      }

      // Check total limit
      if (signalsFound >= maxTotalSignals) {
        log('Reached max total signals limit');
        break;
      }
    }

    // 4. Evaluate top signals for merch potential
    if (includeEvaluations && allScoredSignals.length > 0) {
      // Pre-filter obvious bad signals
      const filtered = quickFilter(allScoredSignals);

      // Take top N by velocity
      const toEvaluate = filtered
        .sort((a, b) => b.combinedScore - a.combinedScore)
        .slice(0, DISCOVERY_CONFIG.maxSignalsToEvaluate);

      log(`Evaluating ${toEvaluate.length} signals for merch potential`);

      // Evaluate with Claude
      const evaluations = await evaluateSignalsBatch(
        toEvaluate,
        undefined,
        DISCOVERY_CONFIG.evaluationBatchSize
      );

      trendsEvaluated = evaluations.size;

      // Create trends for viable evaluations
      for (const [signalId, evaluation] of evaluations) {
        if (evaluation && evaluation.isViable && evaluation.viabilityScore >= 0.6) {
          try {
            // Find the signal to get its DB id
            const signal = toEvaluate.find((s) => s.externalId === signalId);
            if (signal) {
              // We need to get the DB id, not the external id
              // For now, we'll use the external id as a lookup
              const dbSignal = await import('@/lib/prisma').then((m) =>
                m.prisma.socialSignal.findFirst({
                  where: {
                    platform: signal.platform,
                    externalId: signal.externalId,
                  },
                })
              );

              if (dbSignal) {
                await createEmergingTrend(dbSignal.id, evaluation);
                trendsCreated++;
              }
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(`Failed to create trend: ${message}`);
          }
        }
      }
    }

    // 5. Cleanup expired trends
    await deactivateExpiredTrends();

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('Discovery failed', error);
    errors.push(`Discovery failed: ${message}`);
  }

  const duration = Date.now() - startTime;

  log('Discovery complete', {
    signalsFound,
    signalsStored,
    trendsEvaluated,
    trendsCreated,
    duration,
    errors: errors.length,
  });

  return {
    success: errors.length === 0,
    signalsFound,
    signalsStored,
    trendsEvaluated,
    trendsCreated,
    errors,
    duration,
  };
}

/**
 * Quick health check for the emerging trends system
 */
export async function checkEmergingTrendsHealth(): Promise<{
  decodoConfigured: boolean;
  claudeConfigured: boolean;
  databaseConnected: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  const decodoConfigured = isDecodoConfigured();
  if (!decodoConfigured) {
    errors.push('Decodo API not configured');
  }

  const claudeConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  if (!claudeConfigured) {
    errors.push('Claude API not configured');
  }

  let databaseConnected = false;
  try {
    const { prisma } = await import('@/lib/prisma');
    await prisma.$queryRaw`SELECT 1`;
    databaseConnected = true;
  } catch {
    errors.push('Database not connected');
  }

  return {
    decodoConfigured,
    claudeConfigured,
    databaseConnected,
    errors,
  };
}
