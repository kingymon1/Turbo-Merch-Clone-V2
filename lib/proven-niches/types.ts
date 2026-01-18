/**
 * Proven Niches Pipeline - Type Definitions
 *
 * This module is completely separate from existing pipelines.
 * Types for Amazon product discovery, competition analysis, and opportunity identification.
 */

// =============================================================================
// COMPETITION LEVELS
// =============================================================================

export type CompetitionLevel = 'very_low' | 'low' | 'medium' | 'high' | 'saturated';

export type OpportunityStatus = 'active' | 'pursued' | 'expired' | 'dismissed';

export type ScanFrequency = 'daily' | 'weekly' | 'manual';

// =============================================================================
// AMAZON PRODUCT TYPES
// =============================================================================

export interface AmazonProductData {
  asin: string;
  title: string;
  brand?: string;
  price?: number;
  bsr?: number; // Best Seller Rank
  bsrCategory?: string;
  reviewCount: number;
  rating?: number;
  keywords: string[];
  category?: string;
  imageUrl?: string;
  productUrl?: string;
  scrapedAt: Date;
}

export interface PriceHistoryEntry {
  price: number;
  bsr?: number;
  reviewCount?: number;
  recordedAt: Date;
}

// =============================================================================
// NICHE TYPES
// =============================================================================

export interface TrackedNicheData {
  name: string;
  displayName?: string;
  searchKeywords: string[];
  description?: string;
  productCount: number;
  avgBsr?: number;
  avgPrice?: number;
  avgReviews?: number;
  competitionScore?: number;
  competitionLevel?: CompetitionLevel;
  opportunityScore?: number;
  isActive: boolean;
  lastScannedAt?: Date;
}

export interface NicheMetrics {
  productCount: number;
  avgBsr: number;
  medianBsr: number;
  avgPrice: number;
  avgReviews: number;
  topSellerBsr: number;
  competitionScore: number; // 0-1, higher = more competition
  demandScore: number; // 0-1, higher = more demand
  opportunityScore: number; // 0-1, higher = better opportunity
}

// =============================================================================
// OPPORTUNITY TYPES
// =============================================================================

export interface NicheOpportunityData {
  nicheId: string;
  title: string;
  description: string;
  keywords: string[];
  opportunityScore: number; // 0-1
  demandScore: number; // 0-1
  competitionScore: number; // 0-1
  reasoning: string;
  suggestedPhrases: string[];
  status: OpportunityStatus;
  expiresAt?: Date;
}

export interface OpportunityAnalysis {
  isViable: boolean;
  opportunityScore: number;
  demandScore: number;
  competitionScore: number;
  reasoning: string;
  suggestedPhrases: string[];
  marketGaps: string[];
  riskFactors: string[];
}

// =============================================================================
// KEYWORD TYPES
// =============================================================================

export interface NicheKeywordData {
  keyword: string;
  searchVolume?: number;
  competition?: number; // 0-1
  amazonResults?: number;
  topBsr?: number;
  relatedKeywords?: string[];
  lastUpdatedAt: Date;
}

export interface KeywordAnalysis {
  keyword: string;
  searchVolume: number;
  competition: number;
  opportunity: number;
  relatedKeywords: string[];
  topProducts: AmazonProductData[];
}

// =============================================================================
// SCRAPING TYPES
// =============================================================================

export interface AmazonScrapeParams {
  keyword?: string;
  asin?: string;
  category?: string;
  maxResults?: number;
  sortBy?: 'relevance' | 'price_low' | 'price_high' | 'reviews' | 'newest';
}

export interface AmazonScrapeResult {
  success: boolean;
  products: AmazonProductData[];
  totalResults?: number;
  error?: string;
}

export interface ProductDetailResult {
  success: boolean;
  product?: AmazonProductData;
  error?: string;
}

// =============================================================================
// ANALYSIS TYPES
// =============================================================================

export interface CompetitionAnalysisInput {
  products: AmazonProductData[];
  niche: string;
}

export interface CompetitionAnalysisResult {
  competitionLevel: CompetitionLevel;
  competitionScore: number; // 0-1
  metrics: {
    totalProducts: number;
    avgReviews: number;
    avgBsr: number;
    topBrandShare: number; // % of top 10 held by top brand
    newEntrantsRatio: number; // % of products < 6 months old
  };
  insights: string[];
  recommendations: string[];
}

export interface DemandAnalysisResult {
  demandScore: number; // 0-1
  demandLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  metrics: {
    avgBsr: number;
    topPerformerBsr: number;
    estimatedMonthlySales: number;
    priceRange: { min: number; max: number; avg: number };
  };
  insights: string[];
}

// =============================================================================
// SCAN TYPES
// =============================================================================

export interface ScanOptions {
  niches?: string[]; // Specific niches to scan, or all if empty
  maxProductsPerNiche?: number;
  includeOpportunityAnalysis?: boolean;
  forceRefresh?: boolean;
}

export interface ScanResult {
  success: boolean;
  nichesScanned: number;
  productsFound: number;
  productsStored: number;
  opportunitiesFound: number;
  errors: string[];
  duration: number; // ms
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ProvenNichesApiResponse {
  success: boolean;
  data?: {
    niches: TrackedNicheData[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: string;
}

export interface OpportunitiesApiResponse {
  success: boolean;
  data?: {
    opportunities: NicheOpportunityData[];
    total: number;
  };
  error?: string;
}

export interface ScanApiResponse {
  success: boolean;
  result?: ScanResult;
  error?: string;
}

// =============================================================================
// SEED NICHE TYPE
// =============================================================================

export interface SeedNiche {
  name: string;
  displayName: string;
  searchKeywords: string[];
  category?: string;
  priority: number; // 1-5, higher = scan more frequently
}
