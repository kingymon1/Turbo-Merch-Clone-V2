/**
 * Emerging Trends Pipeline - Velocity Calculator
 *
 * Calculates relative velocity of social signals within their communities.
 * The key insight: A post with 500 upvotes in a 30k subreddit is a bigger
 * signal than 5,000 upvotes in a 5M subreddit.
 *
 * Velocity = (relative engagement) * (recency bonus) * (community size factor)
 */

import {
  RawSocialSignal,
  ScoredSignal,
  VelocityConfig,
  VelocityTier,
  CommunityBaseline,
  VelocityPreset,
  VELOCITY_PRESETS,
} from '../types';
import { log } from '../config';

// =============================================================================
// VELOCITY CALCULATION
// =============================================================================

/**
 * Calculate velocity score for a single signal
 */
export function calculateVelocity(
  signal: RawSocialSignal,
  baseline: CommunityBaseline,
  config: VelocityConfig
): ScoredSignal {
  // 1. Calculate relative engagement (vs community average)
  const relativeUpvotes = baseline.avgUpvotes > 0
    ? signal.upvotes / baseline.avgUpvotes
    : signal.upvotes / 100; // Default baseline

  const relativeComments = baseline.avgComments > 0
    ? signal.comments / baseline.avgComments
    : signal.comments / 10; // Default baseline

  const relativeShares = baseline.avgShares > 0
    ? signal.shares / baseline.avgShares
    : 1; // Ignore if no baseline

  // 2. Calculate engagement depth (comments per upvote = deeper engagement)
  const engagementDepth = signal.upvotes > 0
    ? Math.min(signal.comments / signal.upvotes, 1) // Cap at 1
    : 0;

  // 3. Calculate recency bonus (exponential decay)
  const hoursOld = signal.postedAt
    ? (Date.now() - signal.postedAt.getTime()) / (1000 * 60 * 60)
    : config.recencyHoursMax; // Assume max age if unknown

  // Skip signals older than max hours
  if (hoursOld > config.recencyHoursMax) {
    return {
      ...signal,
      velocityScore: 0,
      recencyBonus: 0,
      combinedScore: 0,
      velocityTier: 'normal',
    };
  }

  // Exponential decay: e^(-decay_rate * hours)
  const recencyBonus = Math.exp(-config.recencyDecayRate * hoursOld);

  // 4. Calculate community size factor (smaller = higher signal value)
  // Sweet spot is around 10k-100k subscribers
  let sizeFactor = 1;
  if (signal.communitySize) {
    if (signal.communitySize < 1000) {
      sizeFactor = 0.5; // Too small, might be noise
    } else if (signal.communitySize < 10000) {
      sizeFactor = 0.8;
    } else if (signal.communitySize < 100000) {
      sizeFactor = 1.2; // Sweet spot
    } else if (signal.communitySize < 1000000) {
      sizeFactor = 1.0;
    } else {
      sizeFactor = 0.7; // Very large, harder to stand out
    }
  }

  // 5. Combine scores
  // Weighted average of relative metrics
  const velocityScore =
    relativeUpvotes * 0.5 +
    relativeComments * 0.3 +
    relativeShares * 0.1 +
    engagementDepth * 0.1;

  // Apply recency and size factors
  const combinedScore = velocityScore * recencyBonus * sizeFactor;

  // 6. Determine velocity tier
  const velocityTier = classifyVelocityTier(combinedScore, config);

  return {
    ...signal,
    velocityScore,
    recencyBonus,
    combinedScore,
    velocityTier,
  };
}

/**
 * Classify a velocity score into a tier
 */
function classifyVelocityTier(score: number, config: VelocityConfig): VelocityTier {
  if (score >= config.explodingThreshold) {
    return 'exploding';
  } else if (score >= config.risingThreshold) {
    return 'rising';
  } else if (score >= config.steadyThreshold) {
    return 'steady';
  }
  return 'normal';
}

/**
 * Score multiple signals with a given config
 */
export function scoreSignals(
  signals: RawSocialSignal[],
  baseline: CommunityBaseline,
  config: VelocityConfig
): ScoredSignal[] {
  return signals
    .map((signal) => calculateVelocity(signal, baseline, config))
    .filter((signal) => signal.combinedScore > 0) // Remove expired/invalid
    .sort((a, b) => b.combinedScore - a.combinedScore); // Sort by score desc
}

/**
 * Score signals using a preset configuration
 */
export function scoreSignalsWithPreset(
  signals: RawSocialSignal[],
  baseline: CommunityBaseline,
  preset: VelocityPreset = 'moderate'
): ScoredSignal[] {
  const config = VELOCITY_PRESETS[preset];
  return scoreSignals(signals, baseline, config);
}

/**
 * Filter signals by minimum engagement thresholds
 */
export function filterByThresholds(
  signals: RawSocialSignal[],
  config: VelocityConfig
): RawSocialSignal[] {
  return signals.filter((signal) => {
    // Check minimum upvotes
    if (signal.upvotes < config.minUpvotes) {
      return false;
    }

    // Check minimum comments
    if (signal.comments < config.minComments) {
      return false;
    }

    // Check minimum community size
    if (signal.communitySize && signal.communitySize < config.minCommunitySize) {
      return false;
    }

    return true;
  });
}

/**
 * Calculate a dynamic baseline from a set of signals
 */
export function calculateDynamicBaseline(signals: RawSocialSignal[]): CommunityBaseline {
  if (signals.length === 0) {
    return {
      avgUpvotes: 100,
      avgComments: 10,
      avgShares: 5,
      sampleSize: 0,
      updatedAt: new Date(),
    };
  }

  // Use median instead of mean to reduce outlier impact
  const sortedUpvotes = signals.map((s) => s.upvotes).sort((a, b) => a - b);
  const sortedComments = signals.map((s) => s.comments).sort((a, b) => a - b);
  const sortedShares = signals.map((s) => s.shares).sort((a, b) => a - b);

  const medianIndex = Math.floor(signals.length / 2);

  return {
    avgUpvotes: sortedUpvotes[medianIndex] || 100,
    avgComments: sortedComments[medianIndex] || 10,
    avgShares: sortedShares[medianIndex] || 5,
    sampleSize: signals.length,
    updatedAt: new Date(),
  };
}

/**
 * Get top N signals by velocity score
 */
export function getTopSignals(
  signals: ScoredSignal[],
  count: number,
  minTier?: VelocityTier
): ScoredSignal[] {
  let filtered = signals;

  if (minTier) {
    const tierOrder: VelocityTier[] = ['exploding', 'rising', 'steady', 'normal'];
    const minTierIndex = tierOrder.indexOf(minTier);

    filtered = signals.filter((s) => {
      const tierIndex = tierOrder.indexOf(s.velocityTier);
      return tierIndex <= minTierIndex;
    });
  }

  return filtered.slice(0, count);
}

/**
 * Group signals by velocity tier
 */
export function groupByTier(signals: ScoredSignal[]): Record<VelocityTier, ScoredSignal[]> {
  const groups: Record<VelocityTier, ScoredSignal[]> = {
    exploding: [],
    rising: [],
    steady: [],
    normal: [],
  };

  for (const signal of signals) {
    groups[signal.velocityTier].push(signal);
  }

  return groups;
}

/**
 * Log velocity analysis summary
 */
export function logVelocitySummary(signals: ScoredSignal[], community: string): void {
  const groups = groupByTier(signals);

  log(`Velocity summary for ${community}:`, {
    total: signals.length,
    exploding: groups.exploding.length,
    rising: groups.rising.length,
    steady: groups.steady.length,
    normal: groups.normal.length,
    topScore: signals[0]?.combinedScore.toFixed(2) || 'N/A',
  });
}
