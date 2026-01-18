/**
 * Emerging Trends Pipeline - Type Definitions
 *
 * This module is completely separate from existing pipelines.
 * Types for social signal discovery, velocity calculation, and trend evaluation.
 */

// =============================================================================
// PLATFORM TYPES
// =============================================================================

export type Platform = 'reddit' | 'tiktok';

export type VelocityTier = 'exploding' | 'rising' | 'steady' | 'normal';

export type AudienceSize = 'micro' | 'niche' | 'medium' | 'large' | 'massive';

export type CommunityCategory =
  | 'hobby'
  | 'profession'
  | 'lifestyle'
  | 'fandom'
  | 'sports'
  | 'pets'
  | 'family'
  | 'food'
  | 'fitness'
  | 'gaming'
  | 'crafts'
  | 'outdoors'
  | 'music'
  | 'art'
  | 'tech'
  | 'other';

export type ScrapeFrequency = 'hourly' | 'daily' | 'weekly';

export type VelocityPreset = 'conservative' | 'moderate' | 'aggressive';

// =============================================================================
// DECODO API TYPES
// =============================================================================

export interface DecodoCredentials {
  username: string;
  password: string;
}

export interface DecodoScrapeParams {
  url?: string;
  query?: string;
  target: string;
  parse?: boolean;
  geo?: string;
  headless?: 'html' | 'png';
  markdown?: boolean;
  domain?: string;
}

export interface DecodoScrapeResult {
  content: string | Record<string, unknown>;
  status_code: number;
  url: string;
  task_id: string;
  created_at: string;
  updated_at: string;
  parse_status?: string;
}

export interface DecodoResponse {
  results: DecodoScrapeResult[];
}

// =============================================================================
// REDDIT TYPES
// =============================================================================

export interface RedditPost {
  id: string;
  title: string;
  selftext?: string;
  author: string;
  subreddit: string;
  subreddit_subscribers?: number;
  score: number; // upvotes - downvotes
  upvote_ratio?: number;
  num_comments: number;
  created_utc: number;
  url: string;
  permalink: string;
  is_video?: boolean;
  thumbnail?: string;
}

export interface RedditSubredditInfo {
  display_name: string;
  title: string;
  public_description?: string;
  subscribers: number;
  active_user_count?: number;
  created_utc: number;
}

export interface ParsedRedditData {
  posts: RedditPost[];
  subreddit?: RedditSubredditInfo;
}

// =============================================================================
// TIKTOK TYPES
// =============================================================================

export interface TikTokVideo {
  id: string;
  description: string;
  author: {
    uniqueId: string;
    nickname: string;
    followerCount?: number;
  };
  stats: {
    playCount: number;
    likeCount: number;
    commentCount: number;
    shareCount: number;
    saveCount?: number;
  };
  hashtags: string[];
  createTime: number;
  url: string;
}

export interface ParsedTikTokData {
  video?: TikTokVideo;
  videos?: TikTokVideo[];
}

// =============================================================================
// SOCIAL SIGNAL TYPES
// =============================================================================

export interface RawSocialSignal {
  platform: Platform;
  externalId: string;
  url: string;
  community: string;
  communitySize?: number;
  title?: string;
  content?: string;
  author?: string;
  hashtags: string[];
  postedAt?: Date;
  upvotes: number;
  downvotes?: number;
  comments: number;
  shares: number;
  views?: number;
  saves?: number;
}

export interface ScoredSignal extends RawSocialSignal {
  velocityScore: number;
  recencyBonus: number;
  combinedScore: number;
  velocityTier: VelocityTier;
}

// =============================================================================
// VELOCITY CONFIGURATION
// =============================================================================

export interface VelocityConfig {
  // Thresholds for classification
  explodingThreshold: number; // e.g., 10.0 (10x average)
  risingThreshold: number;    // e.g., 5.0 (5x average)
  steadyThreshold: number;    // e.g., 2.0 (2x average)

  // Recency settings
  recencyHoursMax: number;    // Max hours old to consider
  recencyDecayRate: number;   // Exponential decay rate

  // Filtering
  minUpvotes: number;
  minComments: number;
  minCommunitySize: number;
}

export const VELOCITY_PRESETS: Record<VelocityPreset, VelocityConfig> = {
  conservative: {
    explodingThreshold: 10.0,
    risingThreshold: 7.0,
    steadyThreshold: 4.0,
    recencyHoursMax: 24,
    recencyDecayRate: 0.1,
    minUpvotes: 100,
    minComments: 20,
    minCommunitySize: 10000,
  },
  moderate: {
    explodingThreshold: 7.0,
    risingThreshold: 4.0,
    steadyThreshold: 2.0,
    recencyHoursMax: 48,
    recencyDecayRate: 0.05,
    minUpvotes: 50,
    minComments: 10,
    minCommunitySize: 5000,
  },
  aggressive: {
    explodingThreshold: 4.0,
    risingThreshold: 2.5,
    steadyThreshold: 1.5,
    recencyHoursMax: 72,
    recencyDecayRate: 0.03,
    minUpvotes: 20,
    minComments: 5,
    minCommunitySize: 1000,
  },
};

// =============================================================================
// COMMUNITY TYPES
// =============================================================================

export interface CommunityBaseline {
  avgUpvotes: number;
  avgComments: number;
  avgShares: number;
  avgViews?: number;
  sampleSize: number;
  updatedAt: Date;
}

export interface DiscoveredCommunityData {
  platform: Platform;
  name: string;
  displayName?: string;
  description?: string;
  url?: string;
  size?: number;
  category?: CommunityCategory;
  subCategory?: string;
  merchPotential?: number;
  merchNotes?: string;
  baseline?: CommunityBaseline;
}

// =============================================================================
// MERCH EVALUATION TYPES
// =============================================================================

export interface MerchEvaluationInput {
  signal: ScoredSignal;
  communityContext?: string;
}

export interface MerchEvaluationResult {
  isViable: boolean;
  viabilityScore: number; // 0-1
  viabilityReason: string;

  // Extracted data
  topic: string;
  phrases: string[];
  keywords: string[];

  // Audience
  audience: string;
  audienceProfile: string;
  audienceSize: AudienceSize;

  // Safety
  amazonSafe: boolean;
  amazonSafeNotes?: string;

  // Design hints
  suggestedStyles: string[];
  colorHints: string[];
  moodKeywords: string[];
  designNotes?: string;
}

// =============================================================================
// EMERGING TREND TYPES
// =============================================================================

export interface EmergingTrendData {
  signalId: string;
  topic: string;
  phrases: string[];
  keywords: string[];
  audience: string;
  audienceProfile?: string;
  audienceSize?: AudienceSize;
  velocityScore: number;
  velocityTrend: VelocityTier;
  merchViability: number;
  viabilityReason?: string;
  amazonSafe: boolean;
  amazonSafeNotes?: string;
  suggestedStyles: string[];
  colorHints: string[];
  moodKeywords: string[];
  designNotes?: string;
}

// =============================================================================
// DISCOVERY TYPES
// =============================================================================

export interface DiscoveryOptions {
  platforms: Platform[];
  velocityPreset: VelocityPreset;
  maxSignalsPerCommunity?: number;
  maxTotalSignals?: number;
  includeEvaluations?: boolean;
}

export interface DiscoveryResult {
  success: boolean;
  signalsFound: number;
  signalsStored: number;
  trendsEvaluated: number;
  trendsCreated: number;
  errors: string[];
  duration: number; // ms
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface EmergingTrendsApiResponse {
  success: boolean;
  data?: {
    trends: EmergingTrendData[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: string;
}

export interface DiscoveryApiResponse {
  success: boolean;
  result?: DiscoveryResult;
  error?: string;
}
