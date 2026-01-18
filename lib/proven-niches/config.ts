/**
 * Proven Niches Pipeline - Configuration
 *
 * Seed niches, scraping settings, and analysis thresholds.
 */

import { SeedNiche, CompetitionLevel } from './types';

// =============================================================================
// ENVIRONMENT
// =============================================================================

export const IS_DEV = process.env.NODE_ENV === 'development';

// =============================================================================
// LOGGING
// =============================================================================

const LOG_PREFIX = '[ProvenNiches]';

export function log(message: string, ...args: unknown[]): void {
  console.log(`${LOG_PREFIX} ${message}`, ...args);
}

export function logError(message: string, error?: unknown): void {
  console.error(`${LOG_PREFIX} ERROR: ${message}`, error);
}

export function logWarn(message: string, ...args: unknown[]): void {
  console.warn(`${LOG_PREFIX} WARN: ${message}`, ...args);
}

// =============================================================================
// SEED NICHES
// =============================================================================

/**
 * Initial niches to track for the Proven Niches Pipeline.
 * These are known high-potential merch niches with good demand/competition ratios.
 */
export const SEED_NICHES: SeedNiche[] = [
  // Profession niches - strong identity, high merch affinity
  {
    name: 'nurse',
    displayName: 'Nurses',
    searchKeywords: ['nurse t-shirt', 'nursing shirt', 'rn nurse tee'],
    category: 'profession',
    priority: 5,
  },
  {
    name: 'teacher',
    displayName: 'Teachers',
    searchKeywords: ['teacher t-shirt', 'teaching shirt', 'educator tee'],
    category: 'profession',
    priority: 5,
  },
  {
    name: 'firefighter',
    displayName: 'Firefighters',
    searchKeywords: ['firefighter t-shirt', 'fireman shirt', 'fire department tee'],
    category: 'profession',
    priority: 4,
  },
  {
    name: 'truck-driver',
    displayName: 'Truck Drivers',
    searchKeywords: ['trucker t-shirt', 'truck driver shirt', 'trucking tee'],
    category: 'profession',
    priority: 4,
  },
  {
    name: 'electrician',
    displayName: 'Electricians',
    searchKeywords: ['electrician t-shirt', 'electrical worker shirt'],
    category: 'profession',
    priority: 3,
  },

  // Family niches - evergreen, emotional connection
  {
    name: 'dad',
    displayName: 'Dads',
    searchKeywords: ['dad t-shirt', 'father shirt', 'daddy tee', 'papa shirt'],
    category: 'family',
    priority: 5,
  },
  {
    name: 'mom',
    displayName: 'Moms',
    searchKeywords: ['mom t-shirt', 'mother shirt', 'mama tee', 'mommy shirt'],
    category: 'family',
    priority: 5,
  },
  {
    name: 'grandpa',
    displayName: 'Grandpas',
    searchKeywords: ['grandpa t-shirt', 'grandfather shirt', 'grandad tee'],
    category: 'family',
    priority: 4,
  },
  {
    name: 'grandma',
    displayName: 'Grandmas',
    searchKeywords: ['grandma t-shirt', 'grandmother shirt', 'nana tee'],
    category: 'family',
    priority: 4,
  },

  // Hobby niches - passionate communities
  {
    name: 'fishing',
    displayName: 'Fishing',
    searchKeywords: ['fishing t-shirt', 'fisherman shirt', 'angler tee'],
    category: 'hobby',
    priority: 5,
  },
  {
    name: 'hunting',
    displayName: 'Hunting',
    searchKeywords: ['hunting t-shirt', 'hunter shirt', 'deer hunting tee'],
    category: 'hobby',
    priority: 4,
  },
  {
    name: 'camping',
    displayName: 'Camping',
    searchKeywords: ['camping t-shirt', 'camper shirt', 'outdoor tee'],
    category: 'hobby',
    priority: 4,
  },
  {
    name: 'hiking',
    displayName: 'Hiking',
    searchKeywords: ['hiking t-shirt', 'hiker shirt', 'trail tee'],
    category: 'hobby',
    priority: 3,
  },
  {
    name: 'gardening',
    displayName: 'Gardening',
    searchKeywords: ['gardening t-shirt', 'gardener shirt', 'plant lover tee'],
    category: 'hobby',
    priority: 3,
  },
  {
    name: 'woodworking',
    displayName: 'Woodworking',
    searchKeywords: ['woodworking t-shirt', 'woodworker shirt', 'carpenter hobby tee'],
    category: 'hobby',
    priority: 3,
  },

  // Pet niches - emotional, high engagement
  {
    name: 'dog-lover',
    displayName: 'Dog Lovers',
    searchKeywords: ['dog lover t-shirt', 'dog mom shirt', 'dog dad tee'],
    category: 'pets',
    priority: 5,
  },
  {
    name: 'cat-lover',
    displayName: 'Cat Lovers',
    searchKeywords: ['cat lover t-shirt', 'cat mom shirt', 'crazy cat lady tee'],
    category: 'pets',
    priority: 4,
  },

  // Sports niches
  {
    name: 'golf',
    displayName: 'Golf',
    searchKeywords: ['golf t-shirt', 'golfer shirt', 'golfing tee'],
    category: 'sports',
    priority: 4,
  },
  {
    name: 'pickleball',
    displayName: 'Pickleball',
    searchKeywords: ['pickleball t-shirt', 'pickleball player shirt'],
    category: 'sports',
    priority: 4,
  },

  // Craft niches
  {
    name: 'crochet',
    displayName: 'Crochet',
    searchKeywords: ['crochet t-shirt', 'crocheter shirt', 'yarn lover tee'],
    category: 'crafts',
    priority: 3,
  },
  {
    name: 'quilting',
    displayName: 'Quilting',
    searchKeywords: ['quilting t-shirt', 'quilter shirt', 'sewing tee'],
    category: 'crafts',
    priority: 3,
  },

  // Food/Drink niches
  {
    name: 'coffee',
    displayName: 'Coffee Lovers',
    searchKeywords: ['coffee t-shirt', 'coffee lover shirt', 'caffeine tee'],
    category: 'lifestyle',
    priority: 4,
  },
  {
    name: 'bbq',
    displayName: 'BBQ & Grilling',
    searchKeywords: ['bbq t-shirt', 'grill master shirt', 'barbecue tee'],
    category: 'lifestyle',
    priority: 3,
  },
];

// =============================================================================
// SCRAPING SETTINGS
// =============================================================================

export const SCRAPE_CONFIG = {
  // Maximum products to fetch per keyword search
  maxProductsPerSearch: 48,

  // Maximum products to store per niche
  maxProductsPerNiche: 100,

  // Minimum BSR to consider (filter out very low-performing products)
  maxBsr: 2000000,

  // Rate limiting
  delayBetweenRequests: 2000, // ms
  maxConcurrentRequests: 2,

  // Cache TTL for product data
  productCacheTtlHours: 24,

  // How often to refresh price history
  priceHistoryIntervalHours: 168, // 1 week
};

// =============================================================================
// ANALYSIS THRESHOLDS
// =============================================================================

export const ANALYSIS_CONFIG = {
  // Competition scoring thresholds
  competition: {
    // Average reviews thresholds
    veryLowReviewsMax: 50,
    lowReviewsMax: 200,
    mediumReviewsMax: 500,
    highReviewsMax: 1000,

    // Top brand dominance thresholds
    lowDominanceMax: 0.2, // Top brand has < 20% of top 10
    mediumDominanceMax: 0.4,
    highDominanceMax: 0.6,
  },

  // Demand scoring thresholds
  demand: {
    // BSR thresholds (lower = better)
    excellentBsrMax: 50000,
    goodBsrMax: 150000,
    moderateBsrMax: 500000,
    lowBsrMax: 1000000,
  },

  // Opportunity scoring weights
  opportunityWeights: {
    demand: 0.4,
    competition: 0.35,
    pricePoint: 0.15,
    reviewVelocity: 0.1,
  },

  // Minimum scores for opportunity creation
  minOpportunityScore: 0.5,
  minDemandScore: 0.3,
  maxCompetitionScore: 0.7,
};

// =============================================================================
// COMPETITION LEVEL MAPPING
// =============================================================================

export function getCompetitionLevel(score: number): CompetitionLevel {
  if (score < 0.2) return 'very_low';
  if (score < 0.4) return 'low';
  if (score < 0.6) return 'medium';
  if (score < 0.8) return 'high';
  return 'saturated';
}

// =============================================================================
// BSR TO SALES ESTIMATION
// =============================================================================

/**
 * Rough estimation of monthly sales based on BSR.
 * This is an approximation and varies by category.
 */
export function estimateMonthlySales(bsr: number): number {
  if (bsr <= 0) return 0;

  // Simplified estimation formula for clothing category
  // Based on industry estimates, not exact
  if (bsr <= 1000) return Math.round(3000 / Math.sqrt(bsr));
  if (bsr <= 10000) return Math.round(1000 / Math.pow(bsr / 1000, 0.7));
  if (bsr <= 100000) return Math.round(100 / Math.pow(bsr / 10000, 0.5));
  if (bsr <= 500000) return Math.round(20 / Math.pow(bsr / 100000, 0.4));
  return Math.round(5 / Math.pow(bsr / 500000, 0.3));
}

// =============================================================================
// SCAN SCHEDULE
// =============================================================================

export const SCAN_SCHEDULE = {
  // Priority 5 niches: scan daily
  highPriorityCron: '0 6 * * *', // 6 AM UTC daily

  // Priority 3-4 niches: scan every 3 days
  mediumPriorityCron: '0 6 */3 * *', // 6 AM UTC every 3 days

  // Priority 1-2 niches: scan weekly
  lowPriorityCron: '0 6 * * 0', // 6 AM UTC on Sundays

  // Opportunity analysis: run after each scan
  opportunityAnalysisCron: '0 8 * * *', // 8 AM UTC daily
};

// =============================================================================
// CRON CONFIGURATION
// =============================================================================

export const CRON_CONFIG = {
  // Enable/disable cron jobs
  enabled: process.env.PROVEN_NICHES_CRON_ENABLED !== 'false',

  // Cron secret for Vercel authentication
  secret: process.env.CRON_SECRET || '',

  // Default scan settings
  maxProductsPerNiche: 50,
  maxNichesPerRun: 10,
};
