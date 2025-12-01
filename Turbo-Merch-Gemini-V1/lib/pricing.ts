/**
 * Pricing Configuration - Single Source of Truth
 *
 * Change prices, limits, and features here - everything else updates automatically
 * Supports overage billing: users can exceed monthly allowance at per-design cost
 */

export type TierName = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';
export type TierStatus = 'active' | 'hidden' | 'deprecated';

export type BillingInterval = 'monthly' | 'yearly';

export interface PricingTier {
  id: TierName;
  name: string;
  status: TierStatus;
  price: number; // USD per month
  yearlyPrice: number; // USD per year (10x monthly = 2 months free)
  stripePriceId?: string; // Monthly Stripe price ID
  stripeYearlyPriceId?: string; // Yearly Stripe price ID

  limits: {
    designs: number; // Monthly allowance
    maxPerRun: number; // Max designs per single run
    cooldown: string | null; // e.g., '24h', null = no cooldown
    historyRetention: string; // e.g., '7d', '30d', '1y'
  };

  overage: {
    enabled: boolean; // Can user exceed monthly allowance?
    pricePerDesign: number; // USD per design after allowance used
    softCap?: number; // Warn user at this many overages
    hardCap?: number; // Block further usage at this many overages
  };

  features: {
    markets: 'us_only' | 'all';
    directMode: boolean;
    apiAccess: boolean;
    priorityProcessing: boolean;
    whiteLabel: boolean;
    designHistory: boolean;
    imageQuality: 'low' | 'standard' | 'high'; // Free tier gets low-res
    canDownloadImages: boolean; // Free tier: text only
    canDownloadCSV: boolean; // All tiers can download CSV
    concurrentRuns: number; // How many parallel runs allowed
    emailReports: boolean; // Email reports after each generation (Pro+)
  };

  display: {
    color: string; // For UI badges
    popular?: boolean; // Show "Most Popular" badge
    description: string;
    cta: string; // Call-to-action button text
  };
}

/**
 * PRICING_TIERS - Master Configuration
 *
 * IMPORTANT: Keep this as the single source of truth
 * All rate limiting, billing, and feature checks read from here
 */
export const PRICING_TIERS: Record<TierName, PricingTier> = {
  free: {
    id: 'free',
    name: 'Free',
    status: 'active',
    price: 0,
    yearlyPrice: 0,

    limits: {
      designs: 3, // 3 free designs per month
      maxPerRun: 1, // Can only generate 1 design at a time
      cooldown: null, // No cooldown
      historyRetention: '30d',
    },

    overage: {
      enabled: false, // No overage allowed for free tier
      pricePerDesign: 0, // N/A - no overage
      softCap: 0, // Hard stop at monthly limit
      hardCap: 0, // No additional designs allowed
    },

    features: {
      markets: 'us_only', // USA Market only (upgrade for international)
      directMode: false, // No advanced features
      apiAccess: false,
      priorityProcessing: false,
      whiteLabel: false,
      designHistory: true, // Keep basic history for testing
      imageQuality: 'high', // Full quality for testing
      canDownloadImages: true, // Allow downloads to test product
      canDownloadCSV: true,
      concurrentRuns: 1,
      emailReports: false, // No email reports (upgrade for reports)
    },

    display: {
      color: 'gray',
      description: 'Try Turbo Merch with 3 free designs per month',
      cta: 'Get Started Free',
    },
  },

  starter: {
    id: 'starter',
    name: 'Starter',
    status: 'active',
    price: 19.99,
    yearlyPrice: 199.90, // 10x monthly = 2 months free ($39.98 savings)
    stripePriceId: process.env.STRIPE_PRICE_STARTER,
    stripeYearlyPriceId: process.env.STRIPE_PRICE_STARTER_YEARLY,

    limits: {
      designs: 15, // 15 designs included per month
      maxPerRun: 1, // No batch generation (1 design at a time)
      cooldown: null, // No cooldown
      historyRetention: '30d',
    },

    overage: {
      enabled: true,
      pricePerDesign: 2.00, // $2 per additional design
      softCap: 10, // Warn after 10 overage designs (25 total)
      hardCap: 10, // Block after 10 overage designs (max 25 total)
    },

    features: {
      markets: 'all', // All international markets (US, UK, DE)
      directMode: true, // Custom ideas mode
      apiAccess: false,
      priorityProcessing: false,
      whiteLabel: false,
      designHistory: true,
      imageQuality: 'high',
      canDownloadImages: true, // Full resolution downloads
      canDownloadCSV: true, // CSV export included
      concurrentRuns: 1,
      emailReports: false, // No email reports (upgrade for reports)
    },

    display: {
      color: 'blue',
      description: 'For beginners & intermediates (Tier 10-200)',
      cta: 'Subscribe Now',
    },
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    status: 'active',
    price: 59.99,
    yearlyPrice: 599.90, // 10x monthly = 2 months free ($119.98 savings)
    stripePriceId: process.env.STRIPE_PRICE_PRO,
    stripeYearlyPriceId: process.env.STRIPE_PRICE_PRO_YEARLY,

    limits: {
      designs: 60, // 60 designs included per month
      maxPerRun: 5, // Up to 5 designs per run (batch generation)
      cooldown: null,
      historyRetention: '90d',
    },

    overage: {
      enabled: true,
      pricePerDesign: 1.50, // $1.50 per additional design (volume discount)
      softCap: 20, // Warn after 20 overage designs (80 total)
      hardCap: 20, // Block after 20 overage designs (max 80 total)
    },

    features: {
      markets: 'all', // All international markets
      directMode: true, // Custom ideas mode
      apiAccess: false,
      priorityProcessing: true, // Faster queue position
      whiteLabel: false,
      designHistory: true, // Saved prompts / prompt history
      imageQuality: 'high',
      canDownloadImages: true,
      canDownloadCSV: true, // CSV export included
      concurrentRuns: 2, // Basic concurrency (2 parallel jobs)
      emailReports: true, // Email reports after each generation
    },

    display: {
      color: 'brand',
      popular: true,
      description: 'For serious creators (Tier 500-4,000)',
      cta: 'Subscribe Now',
    },
  },

  business: {
    id: 'business',
    name: 'Business',
    status: 'active',
    price: 99.99,
    yearlyPrice: 999.90, // 10x monthly = 2 months free ($199.98 savings)
    stripePriceId: process.env.STRIPE_PRICE_BUSINESS,
    stripeYearlyPriceId: process.env.STRIPE_PRICE_BUSINESS_YEARLY,

    limits: {
      designs: 110, // 110 designs included per month
      maxPerRun: 10, // Batch generation mode (5-10 designs per run)
      cooldown: null,
      historyRetention: '1y', // Unlimited saved templates (1 year retention)
    },

    overage: {
      enabled: true,
      pricePerDesign: 1.25, // $1.25 per additional design (volume discount)
      softCap: 30, // Warn after 30 overage designs (140 total)
      hardCap: 30, // Block after 30 overage designs (max 140 total)
    },

    features: {
      markets: 'all', // All international markets
      directMode: true, // Custom ideas mode
      apiAccess: false,
      priorityProcessing: true, // Speed priority (business queue)
      whiteLabel: false,
      designHistory: true, // Unlimited saved templates with 1y retention
      imageQuality: 'high',
      canDownloadImages: true,
      canDownloadCSV: true,
      concurrentRuns: 4, // Expanded concurrency (3-4 parallel jobs)
      emailReports: true, // Email reports after each generation
    },

    display: {
      color: 'teal',
      description: 'For Tier 5k-10k uploaders & small teams',
      cta: 'Subscribe Now',
    },
  },

  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    status: 'active',
    price: 199.99,
    yearlyPrice: 1999.90, // 10x monthly = 2 months free ($399.98 savings)
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE,
    stripeYearlyPriceId: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,

    limits: {
      designs: 250, // 250 designs included per month
      maxPerRun: 10, // Agency-level batch generation
      cooldown: null,
      historyRetention: '1y', // Unlimited saved templates
    },

    overage: {
      enabled: true,
      pricePerDesign: 1.00, // $1.00 per additional design (maximum volume discount)
      softCap: 100, // Warn after 100 overage designs (350 total)
      hardCap: 100, // Soft limit at 100 overage designs (max 350 total, can be increased on request)
    },

    features: {
      markets: 'all',
      directMode: true,
      apiAccess: true, // API access for automation
      priorityProcessing: true, // Fastest queue priority
      whiteLabel: true, // Remove Turbo Merch branding
      designHistory: true, // Unlimited saved templates with 1y retention
      imageQuality: 'high',
      canDownloadImages: true,
      canDownloadCSV: true,
      concurrentRuns: 5, // Agency-level concurrency (5+ parallel jobs)
      emailReports: true, // Email reports after each generation
    },

    display: {
      color: 'gold',
      description: 'For Tier 10k-20k uploaders & automation agencies',
      cta: 'Subscribe Now',
    },
  },
} as const;

/**
 * Get active tiers (shown in pricing page)
 */
export function getActiveTiers(): PricingTier[] {
  return Object.values(PRICING_TIERS).filter(tier => tier.status === 'active');
}

/**
 * Calculate yearly savings for a tier
 */
export function getYearlySavings(tierName: TierName): { savings: number; monthlyEquivalent: number } {
  const tier = PRICING_TIERS[tierName];
  const fullYearlyPrice = tier.price * 12;
  const savings = fullYearlyPrice - tier.yearlyPrice;
  const monthlyEquivalent = tier.yearlyPrice / 12;
  return { savings: Math.round(savings * 100) / 100, monthlyEquivalent: Math.round(monthlyEquivalent * 100) / 100 };
}

/**
 * Get the appropriate Stripe price ID based on billing interval
 */
export function getStripePriceId(tierName: TierName, interval: BillingInterval): string | undefined {
  const tier = PRICING_TIERS[tierName];
  return interval === 'yearly' ? tier.stripeYearlyPriceId : tier.stripePriceId;
}

/**
 * Get tier configuration for a user
 */
export function getTierConfig(tierName: TierName | string): PricingTier {
  // Handle unknown tier names (from database migrations, etc.)
  if (!PRICING_TIERS[tierName as TierName]) {
    console.warn(`Unknown tier "${tierName}", defaulting to free tier`);
    return PRICING_TIERS.free;
  }
  return PRICING_TIERS[tierName as TierName];
}

/**
 * Check if user can use a specific feature
 */
export function canUseFeature(tierName: TierName, feature: keyof PricingTier['features']): boolean {
  const tier = PRICING_TIERS[tierName];
  return tier.features[feature] as boolean;
}

/**
 * Calculate overage charges for a billing period
 */
export interface OverageCalculation {
  allowance: number;
  used: number;
  overage: number;
  overageCharge: number;
  withinAllowance: boolean;
  approachingSoftCap: boolean;
  atHardCap: boolean;
}

export function calculateOverage(
  tierName: TierName,
  designsUsed: number
): OverageCalculation {
  const tier = PRICING_TIERS[tierName];
  const overage = Math.max(0, designsUsed - tier.limits.designs);
  const overageCharge = overage * tier.overage.pricePerDesign;

  return {
    allowance: tier.limits.designs,
    used: designsUsed,
    overage,
    overageCharge,
    withinAllowance: designsUsed <= tier.limits.designs,
    approachingSoftCap: tier.overage.softCap
      ? overage >= (tier.overage.softCap * 0.8)
      : false,
    atHardCap: tier.overage.hardCap
      ? overage >= tier.overage.hardCap
      : false,
  };
}

/**
 * Get image quality settings based on tier
 */
export interface ImageQualitySettings {
  resolution: { width: number; height: number };
  quality: number; // 1-100 for compression
  watermark: boolean;
  format: 'png' | 'jpg';
}

export function getImageQuality(tierName: TierName): ImageQualitySettings {
  const tier = PRICING_TIERS[tierName];

  switch (tier.features.imageQuality) {
    case 'low':
      return {
        resolution: { width: 1125, height: 1350 }, // 25% of original 4500x5400
        quality: 70,
        watermark: true, // Add "Upgrade to download full resolution" watermark
        format: 'jpg',
      };

    case 'standard':
      return {
        resolution: { width: 4500, height: 5400 }, // Full resolution
        quality: 90,
        watermark: false,
        format: 'png',
      };

    case 'high':
      return {
        resolution: { width: 4500, height: 5400 }, // Full resolution
        quality: 100, // Lossless
        watermark: false,
        format: 'png',
      };

    default:
      return {
        resolution: { width: 1125, height: 1350 },
        quality: 70,
        watermark: true,
        format: 'jpg',
      };
  }
}

/**
 * Pricing version for grandfathering legacy users
 * Increment this when making breaking changes to pricing
 */
export const CURRENT_PRICING_VERSION = 1;

/**
 * Legacy pricing configurations (for grandfathered users)
 * Add old pricing here when you update PRICING_TIERS
 */
export const LEGACY_PRICING: Record<number, typeof PRICING_TIERS> = {
  // 1: PRICING_TIERS_V1, // When you update pricing, move old config here
};

/**
 * Get pricing for a user (respects grandfathering)
 */
export function getUserPricing(pricingVersion: number = CURRENT_PRICING_VERSION) {
  return LEGACY_PRICING[pricingVersion] || PRICING_TIERS;
}

/**
 * Parse historyRetention string to days
 * Examples: '7d' => 7, '30d' => 30, '1y' => 365
 */
export function parseRetentionDays(retention: string): number {
  const match = retention.match(/^(\d+)([dmy])$/);
  if (!match) {
    console.warn(`Invalid retention format: ${retention}, defaulting to 30 days`);
    return 30;
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'd':
      return value;
    case 'm':
      return value * 30;
    case 'y':
      return value * 365;
    default:
      return 30;
  }
}
