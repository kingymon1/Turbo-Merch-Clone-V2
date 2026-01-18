/**
 * Emerging Trends Pipeline - Configuration
 *
 * Centralized configuration for the emerging trends discovery system.
 * Completely separate from existing pipeline configurations.
 */

import { Platform, CommunityCategory, VelocityPreset, VELOCITY_PRESETS } from './types';

// =============================================================================
// ENVIRONMENT CONFIGURATION
// =============================================================================

export const DECODO_CONFIG = {
  baseUrl: 'https://scraper-api.decodo.com/v2',
  username: process.env.DECODO_USERNAME || '',
  password: process.env.DECODO_PASSWORD || '',
  timeout: 150000, // 150 seconds (Decodo's max)
  maxRetries: 3,
  retryDelayMs: 2000,
};

export function isDecodoConfigured(): boolean {
  return Boolean(DECODO_CONFIG.username && DECODO_CONFIG.password);
}

// =============================================================================
// SEED COMMUNITIES
// =============================================================================

/**
 * Initial communities to monitor for emerging trends.
 * These are selected for high merch potential and active communities.
 * The system will dynamically discover more communities over time.
 */
export const SEED_COMMUNITIES: Array<{
  platform: Platform;
  name: string;
  category: CommunityCategory;
  merchPotential: number;
}> = [
  // Hobbies & Crafts
  { platform: 'reddit', name: 'crochet', category: 'crafts', merchPotential: 0.9 },
  { platform: 'reddit', name: 'knitting', category: 'crafts', merchPotential: 0.9 },
  { platform: 'reddit', name: 'woodworking', category: 'crafts', merchPotential: 0.85 },
  { platform: 'reddit', name: 'quilting', category: 'crafts', merchPotential: 0.85 },
  { platform: 'reddit', name: 'embroidery', category: 'crafts', merchPotential: 0.8 },

  // Outdoor & Sports
  { platform: 'reddit', name: 'kayakfishing', category: 'outdoors', merchPotential: 0.9 },
  { platform: 'reddit', name: 'flyfishing', category: 'outdoors', merchPotential: 0.9 },
  { platform: 'reddit', name: 'hiking', category: 'outdoors', merchPotential: 0.85 },
  { platform: 'reddit', name: 'camping', category: 'outdoors', merchPotential: 0.85 },
  { platform: 'reddit', name: 'kayaking', category: 'outdoors', merchPotential: 0.8 },
  { platform: 'reddit', name: 'hunting', category: 'outdoors', merchPotential: 0.85 },
  { platform: 'reddit', name: 'archery', category: 'outdoors', merchPotential: 0.8 },

  // Pets
  { platform: 'reddit', name: 'dogs', category: 'pets', merchPotential: 0.9 },
  { platform: 'reddit', name: 'cats', category: 'pets', merchPotential: 0.9 },
  { platform: 'reddit', name: 'goldenretrievers', category: 'pets', merchPotential: 0.85 },
  { platform: 'reddit', name: 'germanshepherds', category: 'pets', merchPotential: 0.85 },
  { platform: 'reddit', name: 'chickens', category: 'pets', merchPotential: 0.8 },
  { platform: 'reddit', name: 'beekeeping', category: 'pets', merchPotential: 0.8 },

  // Professions
  { platform: 'reddit', name: 'nursing', category: 'profession', merchPotential: 0.9 },
  { platform: 'reddit', name: 'Teachers', category: 'profession', merchPotential: 0.9 },
  { platform: 'reddit', name: 'Firefighting', category: 'profession', merchPotential: 0.85 },
  { platform: 'reddit', name: 'ems', category: 'profession', merchPotential: 0.85 },
  { platform: 'reddit', name: 'Truckers', category: 'profession', merchPotential: 0.85 },
  { platform: 'reddit', name: 'electricians', category: 'profession', merchPotential: 0.8 },
  { platform: 'reddit', name: 'plumbing', category: 'profession', merchPotential: 0.8 },

  // Family & Lifestyle
  { platform: 'reddit', name: 'daddit', category: 'family', merchPotential: 0.9 },
  { platform: 'reddit', name: 'Mommit', category: 'family', merchPotential: 0.9 },
  { platform: 'reddit', name: 'grandparents', category: 'family', merchPotential: 0.85 },
  { platform: 'reddit', name: 'breakingmom', category: 'family', merchPotential: 0.8 },

  // Food & Beverage
  { platform: 'reddit', name: 'Coffee', category: 'food', merchPotential: 0.9 },
  { platform: 'reddit', name: 'BBQ', category: 'food', merchPotential: 0.85 },
  { platform: 'reddit', name: 'Homebrewing', category: 'food', merchPotential: 0.85 },
  { platform: 'reddit', name: 'gardening', category: 'food', merchPotential: 0.8 },

  // Fitness
  { platform: 'reddit', name: 'running', category: 'fitness', merchPotential: 0.85 },
  { platform: 'reddit', name: 'crossfit', category: 'fitness', merchPotential: 0.85 },
  { platform: 'reddit', name: 'yoga', category: 'fitness', merchPotential: 0.8 },
  { platform: 'reddit', name: 'powerlifting', category: 'fitness', merchPotential: 0.85 },
  { platform: 'reddit', name: 'homegym', category: 'fitness', merchPotential: 0.8 },

  // Gaming (select niche)
  { platform: 'reddit', name: 'DnD', category: 'gaming', merchPotential: 0.9 },
  { platform: 'reddit', name: 'boardgames', category: 'gaming', merchPotential: 0.85 },
  { platform: 'reddit', name: 'retrogaming', category: 'gaming', merchPotential: 0.8 },

  // Music
  { platform: 'reddit', name: 'drums', category: 'music', merchPotential: 0.85 },
  { platform: 'reddit', name: 'guitars', category: 'music', merchPotential: 0.85 },
  { platform: 'reddit', name: 'vinyl', category: 'music', merchPotential: 0.8 },
];

// =============================================================================
// DISCOVERY SETTINGS
// =============================================================================

export const DISCOVERY_CONFIG = {
  // How many communities to scrape per run
  maxCommunitiesPerRun: 20,

  // How many signals to collect per community
  maxSignalsPerCommunity: 50,

  // How many total signals to process per run
  maxTotalSignals: 500,

  // Minimum hours between scraping the same community
  minHoursBetweenScrapes: 12,

  // How many top signals to evaluate with Claude
  maxSignalsToEvaluate: 50,

  // Batch size for Claude evaluations
  evaluationBatchSize: 5,
};

// =============================================================================
// VELOCITY DEFAULTS
// =============================================================================

export const DEFAULT_VELOCITY_PRESET: VelocityPreset = 'moderate';

export function getVelocityConfig(preset?: VelocityPreset) {
  return VELOCITY_PRESETS[preset || DEFAULT_VELOCITY_PRESET];
}

// =============================================================================
// TREND LIFECYCLE
// =============================================================================

export const TREND_LIFECYCLE = {
  // How long a trend stays "active" before needing revalidation (hours)
  activeHours: 168, // 7 days

  // How long before a trend expires completely (hours)
  expirationHours: 336, // 14 days

  // Minimum velocity score to create a trend
  minVelocityForTrend: 2.0,

  // Minimum merch viability score to create a trend
  minMerchViability: 0.6,
};

// =============================================================================
// CRON SCHEDULE
// =============================================================================

export const CRON_CONFIG = {
  // Secret for authenticating cron requests
  secret: process.env.CRON_SECRET || '',

  // Default velocity preset for cron runs
  defaultPreset: 'moderate' as VelocityPreset,

  // Platforms to scrape in cron
  platforms: ['reddit'] as Platform[], // TikTok can be added later

  // Enable/disable the cron job
  enabled: true,
};

// =============================================================================
// LOGGING
// =============================================================================

export const LOG_PREFIX = '[EmergingTrends]';

export function log(message: string, data?: unknown) {
  console.log(`${LOG_PREFIX} ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

export function logError(message: string, error?: unknown) {
  console.error(`${LOG_PREFIX} ERROR: ${message}`, error);
}

export function logWarn(message: string, data?: unknown) {
  console.warn(`${LOG_PREFIX} WARN: ${message}`, data || '');
}
