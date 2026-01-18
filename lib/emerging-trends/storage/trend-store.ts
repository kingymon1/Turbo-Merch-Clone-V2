/**
 * Emerging Trends Pipeline - Database Storage
 *
 * Handles all database operations for the emerging trends system.
 * Uses Prisma for type-safe database access.
 */

import { prisma } from '@/lib/prisma';
import {
  Platform,
  RawSocialSignal,
  ScoredSignal,
  MerchEvaluationResult,
  EmergingTrendData,
  DiscoveredCommunityData,
  CommunityBaseline,
  VelocityPreset,
  VELOCITY_PRESETS,
} from '../types';
import { TREND_LIFECYCLE, log, logError } from '../config';

// =============================================================================
// SOCIAL SIGNAL STORAGE
// =============================================================================

/**
 * Store or update a social signal
 */
export async function upsertSocialSignal(signal: ScoredSignal): Promise<string> {
  try {
    const result = await prisma.socialSignal.upsert({
      where: {
        platform_externalId: {
          platform: signal.platform,
          externalId: signal.externalId,
        },
      },
      create: {
        platform: signal.platform,
        externalId: signal.externalId,
        url: signal.url,
        community: signal.community,
        communitySize: signal.communitySize,
        title: signal.title,
        content: signal.content,
        author: signal.author,
        hashtags: signal.hashtags,
        postedAt: signal.postedAt,
        upvotes: signal.upvotes,
        downvotes: signal.downvotes,
        comments: signal.comments,
        shares: signal.shares,
        views: signal.views,
        saves: signal.saves,
        velocityScore: signal.velocityScore,
        recencyBonus: signal.recencyBonus,
        combinedScore: signal.combinedScore,
        velocityTier: signal.velocityTier,
      },
      update: {
        upvotes: signal.upvotes,
        downvotes: signal.downvotes,
        comments: signal.comments,
        shares: signal.shares,
        views: signal.views,
        saves: signal.saves,
        velocityScore: signal.velocityScore,
        recencyBonus: signal.recencyBonus,
        combinedScore: signal.combinedScore,
        velocityTier: signal.velocityTier,
      },
    });

    return result.id;
  } catch (error) {
    logError(`Failed to upsert signal ${signal.externalId}`, error);
    throw error;
  }
}

/**
 * Store multiple signals
 */
export async function upsertSocialSignals(signals: ScoredSignal[]): Promise<number> {
  let stored = 0;

  for (const signal of signals) {
    try {
      await upsertSocialSignal(signal);
      stored++;
    } catch {
      // Continue on individual failures
    }
  }

  log(`Stored ${stored}/${signals.length} signals`);
  return stored;
}

/**
 * Get unevaluated signals above a velocity threshold
 */
export async function getUnevaluatedSignals(
  limit: number = 50,
  minVelocityTier: string = 'steady'
): Promise<ScoredSignal[]> {
  const signals = await prisma.socialSignal.findMany({
    where: {
      evaluated: false,
      velocityTier: {
        in: ['exploding', 'rising', 'steady'].slice(
          0,
          ['exploding', 'rising', 'steady'].indexOf(minVelocityTier) + 1
        ),
      },
    },
    orderBy: { combinedScore: 'desc' },
    take: limit,
  });

  return signals.map(dbSignalToScored);
}

/**
 * Mark a signal as evaluated
 */
export async function markSignalEvaluated(
  signalId: string,
  skipReason?: string
): Promise<void> {
  await prisma.socialSignal.update({
    where: { id: signalId },
    data: {
      evaluated: true,
      evaluatedAt: new Date(),
      skipReason,
    },
  });
}

// =============================================================================
// EMERGING TREND STORAGE
// =============================================================================

/**
 * Create an emerging trend from evaluation result
 */
export async function createEmergingTrend(
  signalId: string,
  evaluation: MerchEvaluationResult
): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + TREND_LIFECYCLE.expirationHours);

  const trend = await prisma.emergingTrend.create({
    data: {
      signalId,
      topic: evaluation.topic,
      phrases: evaluation.phrases,
      keywords: evaluation.keywords,
      audience: evaluation.audience,
      audienceProfile: evaluation.audienceProfile,
      audienceSize: evaluation.audienceSize,
      velocityScore: evaluation.viabilityScore, // Use viability as proxy
      velocityTrend: 'rising', // Default, can be updated
      merchViability: evaluation.viabilityScore,
      viabilityReason: evaluation.viabilityReason,
      amazonSafe: evaluation.amazonSafe,
      amazonSafeNotes: evaluation.amazonSafeNotes,
      suggestedStyles: evaluation.suggestedStyles,
      colorHints: evaluation.colorHints,
      moodKeywords: evaluation.moodKeywords,
      designNotes: evaluation.designNotes,
      expiresAt,
    },
  });

  // Mark signal as evaluated
  await markSignalEvaluated(signalId);

  log(`Created emerging trend: ${trend.id} - ${evaluation.topic}`);
  return trend.id;
}

/**
 * Get active emerging trends
 */
export async function getActiveEmergingTrends(
  options: {
    limit?: number;
    minViability?: number;
    amazonSafeOnly?: boolean;
    unusedOnly?: boolean;
  } = {}
): Promise<EmergingTrendData[]> {
  const {
    limit = 50,
    minViability = 0.5,
    amazonSafeOnly = true,
    unusedOnly = false,
  } = options;

  const trends = await prisma.emergingTrend.findMany({
    where: {
      isActive: true,
      merchViability: { gte: minViability },
      ...(amazonSafeOnly ? { amazonSafe: true } : {}),
      ...(unusedOnly ? { usedInDesign: false } : {}),
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      signal: true,
    },
    orderBy: [
      { velocityScore: 'desc' },
      { merchViability: 'desc' },
    ],
    take: limit,
  });

  return trends.map(dbTrendToData);
}

/**
 * Mark a trend as used in a design
 */
export async function markTrendUsed(
  trendId: string,
  designId?: string
): Promise<void> {
  await prisma.emergingTrend.update({
    where: { id: trendId },
    data: {
      usedInDesign: true,
      usedAt: new Date(),
      designId,
      generationCount: { increment: 1 },
    },
  });
}

/**
 * Deactivate expired trends
 */
export async function deactivateExpiredTrends(): Promise<number> {
  const result = await prisma.emergingTrend.updateMany({
    where: {
      isActive: true,
      expiresAt: { lt: new Date() },
    },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
      deactivateReason: 'expired',
    },
  });

  if (result.count > 0) {
    log(`Deactivated ${result.count} expired trends`);
  }

  return result.count;
}

// =============================================================================
// COMMUNITY STORAGE
// =============================================================================

/**
 * Upsert a discovered community
 */
export async function upsertCommunity(
  community: DiscoveredCommunityData
): Promise<string> {
  const result = await prisma.discoveredCommunity.upsert({
    where: {
      platform_name: {
        platform: community.platform,
        name: community.name,
      },
    },
    create: {
      platform: community.platform,
      name: community.name,
      displayName: community.displayName,
      description: community.description,
      url: community.url,
      size: community.size,
      category: community.category,
      subCategory: community.subCategory,
      merchPotential: community.merchPotential,
      merchNotes: community.merchNotes,
      avgUpvotes: community.baseline?.avgUpvotes,
      avgComments: community.baseline?.avgComments,
      avgShares: community.baseline?.avgShares,
      baselineUpdatedAt: community.baseline?.updatedAt,
      baselineSampleSize: community.baseline?.sampleSize,
      discoveredBy: community.discoveredBy,
      discoveredFrom: community.discoveredFrom,
    },
    update: {
      displayName: community.displayName || undefined,
      description: community.description || undefined,
      size: community.size || undefined,
      category: community.category || undefined,
      merchPotential: community.merchPotential || undefined,
      avgUpvotes: community.baseline?.avgUpvotes || undefined,
      avgComments: community.baseline?.avgComments || undefined,
      avgShares: community.baseline?.avgShares || undefined,
      baselineUpdatedAt: community.baseline?.updatedAt || undefined,
      baselineSampleSize: community.baseline?.sampleSize || undefined,
    },
  });

  return result.id;
}

/**
 * Get communities due for scraping
 */
export async function getCommunitiesToScrape(
  limit: number = 20,
  minHoursSinceLastScrape: number = 12
): Promise<DiscoveredCommunityData[]> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - minHoursSinceLastScrape);

  const communities = await prisma.discoveredCommunity.findMany({
    where: {
      isActive: true,
      OR: [
        { lastScrapedAt: null },
        { lastScrapedAt: { lt: cutoff } },
      ],
    },
    orderBy: [
      { isPriority: 'desc' },
      { merchPotential: 'desc' },
      { lastScrapedAt: 'asc' },
    ],
    take: limit,
  });

  return communities.map(dbCommunityToData);
}

/**
 * Update community after scraping
 */
export async function updateCommunityAfterScrape(
  platform: Platform,
  name: string,
  signalCount: number,
  baseline?: CommunityBaseline
): Promise<void> {
  await prisma.discoveredCommunity.update({
    where: {
      platform_name: { platform, name },
    },
    data: {
      lastScrapedAt: new Date(),
      scrapeCount: { increment: 1 },
      lastSignalCount: signalCount,
      ...(baseline ? {
        avgUpvotes: baseline.avgUpvotes,
        avgComments: baseline.avgComments,
        avgShares: baseline.avgShares,
        baselineUpdatedAt: baseline.updatedAt,
        baselineSampleSize: baseline.sampleSize,
      } : {}),
    },
  });
}

/**
 * Get community baseline
 */
export async function getCommunityBaseline(
  platform: Platform,
  name: string
): Promise<CommunityBaseline | null> {
  const community = await prisma.discoveredCommunity.findUnique({
    where: {
      platform_name: { platform, name },
    },
    select: {
      avgUpvotes: true,
      avgComments: true,
      avgShares: true,
      avgViews: true,
      baselineSampleSize: true,
      baselineUpdatedAt: true,
    },
  });

  if (!community || !community.avgUpvotes) {
    return null;
  }

  return {
    avgUpvotes: community.avgUpvotes,
    avgComments: community.avgComments || 10,
    avgShares: community.avgShares || 0,
    avgViews: community.avgViews || undefined,
    sampleSize: community.baselineSampleSize || 0,
    updatedAt: community.baselineUpdatedAt || new Date(),
  };
}

// =============================================================================
// CONFIG STORAGE
// =============================================================================

/**
 * Get or create velocity config
 */
export async function getOrCreateVelocityConfig(
  preset: VelocityPreset
): Promise<string> {
  const config = VELOCITY_PRESETS[preset];

  const result = await prisma.emergingTrendsConfig.upsert({
    where: { name: preset },
    create: {
      name: preset,
      isDefault: preset === 'moderate',
      explodingThreshold: config.explodingThreshold,
      risingThreshold: config.risingThreshold,
      steadyThreshold: config.steadyThreshold,
      recencyHoursMax: config.recencyHoursMax,
      recencyDecayRate: config.recencyDecayRate,
      minUpvotes: config.minUpvotes,
      minComments: config.minComments,
      minCommunitySize: config.minCommunitySize,
      description: `${preset} velocity detection settings`,
    },
    update: {},
  });

  return result.id;
}

// =============================================================================
// HELPERS
// =============================================================================

function dbSignalToScored(db: {
  id: string;
  platform: string;
  externalId: string;
  url: string;
  community: string;
  communitySize: number | null;
  title: string | null;
  content: string | null;
  author: string | null;
  hashtags: string[];
  postedAt: Date | null;
  upvotes: number;
  downvotes: number | null;
  comments: number;
  shares: number;
  views: number | null;
  saves: number | null;
  velocityScore: number | null;
  recencyBonus: number | null;
  combinedScore: number | null;
  velocityTier: string | null;
}): ScoredSignal {
  return {
    platform: db.platform as Platform,
    externalId: db.externalId,
    url: db.url,
    community: db.community,
    communitySize: db.communitySize || undefined,
    title: db.title || undefined,
    content: db.content || undefined,
    author: db.author || undefined,
    hashtags: db.hashtags,
    postedAt: db.postedAt || undefined,
    upvotes: db.upvotes,
    downvotes: db.downvotes || undefined,
    comments: db.comments,
    shares: db.shares,
    views: db.views || undefined,
    saves: db.saves || undefined,
    velocityScore: db.velocityScore || 0,
    recencyBonus: db.recencyBonus || 0,
    combinedScore: db.combinedScore || 0,
    velocityTier: (db.velocityTier as ScoredSignal['velocityTier']) || 'normal',
  };
}

function dbTrendToData(db: {
  id: string;
  signalId: string;
  topic: string;
  phrases: string[];
  keywords: string[];
  audience: string;
  audienceProfile: string | null;
  audienceSize: string | null;
  velocityScore: number;
  velocityTrend: string;
  merchViability: number;
  viabilityReason: string | null;
  amazonSafe: boolean;
  amazonSafeNotes: string | null;
  suggestedStyles: string[];
  colorHints: string[];
  moodKeywords: string[];
  designNotes: string | null;
}): EmergingTrendData {
  return {
    signalId: db.signalId,
    topic: db.topic,
    phrases: db.phrases,
    keywords: db.keywords,
    audience: db.audience,
    audienceProfile: db.audienceProfile || undefined,
    audienceSize: db.audienceSize as EmergingTrendData['audienceSize'],
    velocityScore: db.velocityScore,
    velocityTrend: db.velocityTrend as EmergingTrendData['velocityTrend'],
    merchViability: db.merchViability,
    viabilityReason: db.viabilityReason || undefined,
    amazonSafe: db.amazonSafe,
    amazonSafeNotes: db.amazonSafeNotes || undefined,
    suggestedStyles: db.suggestedStyles,
    colorHints: db.colorHints,
    moodKeywords: db.moodKeywords,
    designNotes: db.designNotes || undefined,
  };
}

function dbCommunityToData(db: {
  platform: string;
  name: string;
  displayName: string | null;
  description: string | null;
  url: string | null;
  size: number | null;
  category: string | null;
  subCategory: string | null;
  merchPotential: number | null;
  merchNotes: string | null;
  avgUpvotes: number | null;
  avgComments: number | null;
  avgShares: number | null;
  avgViews: number | null;
  baselineSampleSize: number | null;
  baselineUpdatedAt: Date | null;
  discoveredBy: string | null;
  discoveredFrom: string | null;
}): DiscoveredCommunityData {
  return {
    platform: db.platform as Platform,
    name: db.name,
    displayName: db.displayName || undefined,
    description: db.description || undefined,
    url: db.url || undefined,
    size: db.size || undefined,
    category: db.category as DiscoveredCommunityData['category'],
    subCategory: db.subCategory || undefined,
    merchPotential: db.merchPotential || undefined,
    merchNotes: db.merchNotes || undefined,
    baseline: db.avgUpvotes ? {
      avgUpvotes: db.avgUpvotes,
      avgComments: db.avgComments || 10,
      avgShares: db.avgShares || 0,
      avgViews: db.avgViews || undefined,
      sampleSize: db.baselineSampleSize || 0,
      updatedAt: db.baselineUpdatedAt || new Date(),
    } : undefined,
    discoveredBy: db.discoveredBy || undefined,
    discoveredFrom: db.discoveredFrom || undefined,
  };
}
