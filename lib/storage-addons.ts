/**
 * Storage Addon Configuration
 * Paid extensions for cloud storage retention
 */

export interface StorageAddonConfig {
  id: string;
  name: string;
  price: number;
  stripePriceId?: string;
  extraRetentionDays: number | null; // null = unlimited
  description: string;
  popular?: boolean;
}

/**
 * Storage Addon Pricing Tiers
 */
export const STORAGE_ADDON_TIERS: Record<string, StorageAddonConfig> = {
  // Extend retention by 6 months (180 days)
  extended_6m: {
    id: 'extended_6m',
    name: 'Extended Storage (6 Months)',
    price: 9.99,
    stripePriceId: process.env.STRIPE_PRICE_STORAGE_6M,
    extraRetentionDays: 180,
    description: 'Extend design retention by 6 months beyond your plan limit',
  },

  // Extend retention by 1 year (365 days)
  extended_1y: {
    id: 'extended_1y',
    name: 'Extended Storage (1 Year)',
    price: 16.99,
    stripePriceId: process.env.STRIPE_PRICE_STORAGE_1Y,
    extraRetentionDays: 365,
    description: 'Extend design retention by 1 year beyond your plan limit',
    popular: true,
  },

  // Unlimited retention (never expire)
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited Storage',
    price: 29.99,
    stripePriceId: process.env.STRIPE_PRICE_STORAGE_UNLIMITED,
    extraRetentionDays: null, // null = unlimited
    description: 'Keep all designs forever with unlimited cloud storage',
  },
} as const;

/**
 * Get all available storage addon options
 */
export function getAvailableAddons(): StorageAddonConfig[] {
  return Object.values(STORAGE_ADDON_TIERS);
}

/**
 * Get a specific addon configuration by ID
 */
export function getAddonConfig(addonId: string): StorageAddonConfig | null {
  return STORAGE_ADDON_TIERS[addonId] || null;
}
