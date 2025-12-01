import { describe, it, expect } from 'vitest';
import {
  PRICING_TIERS,
  getTierConfig,
  getActiveTiers,
  canUseFeature,
  calculateOverage,
  getImageQuality,
  type TierName,
} from '@/lib/pricing';

describe('Pricing Module', () => {
  describe('PRICING_TIERS', () => {
    it('should have all expected tiers defined', () => {
      const expectedTiers: TierName[] = ['free', 'starter', 'pro', 'business', 'enterprise'];
      expectedTiers.forEach((tier) => {
        expect(PRICING_TIERS[tier]).toBeDefined();
      });
    });

    it('should have valid prices for each tier', () => {
      expect(PRICING_TIERS.free.price).toBe(0);
      expect(PRICING_TIERS.starter.price).toBeGreaterThan(0);
      expect(PRICING_TIERS.pro.price).toBeGreaterThan(PRICING_TIERS.starter.price);
      expect(PRICING_TIERS.business.price).toBeGreaterThan(PRICING_TIERS.pro.price);
      expect(PRICING_TIERS.enterprise.price).toBeGreaterThan(PRICING_TIERS.business.price);
    });

    it('should have valid design limits for each tier', () => {
      expect(PRICING_TIERS.free.limits.designs).toBeGreaterThan(0);
      expect(PRICING_TIERS.starter.limits.designs).toBeGreaterThan(PRICING_TIERS.free.limits.designs);
      expect(PRICING_TIERS.pro.limits.designs).toBeGreaterThan(PRICING_TIERS.starter.limits.designs);
    });
  });

  describe('getTierConfig', () => {
    it('should return correct tier for valid tier names', () => {
      expect(getTierConfig('free').name).toBe('Free');
      expect(getTierConfig('pro').name).toBe('Pro');
      expect(getTierConfig('enterprise').name).toBe('Enterprise');
    });

    it('should default to free tier for unknown tier names', () => {
      const result = getTierConfig('invalid');
      expect(result.id).toBe('free');
    });
  });

  describe('getActiveTiers', () => {
    it('should return only active tiers', () => {
      const activeTiers = getActiveTiers();
      activeTiers.forEach((tier) => {
        expect(tier.status).toBe('active');
      });
    });

    it('should return at least one tier', () => {
      const activeTiers = getActiveTiers();
      expect(activeTiers.length).toBeGreaterThan(0);
    });
  });

  describe('canUseFeature', () => {
    it('should correctly check feature availability', () => {
      // Free tier limitations
      expect(canUseFeature('free', 'apiAccess')).toBe(false);
      expect(canUseFeature('free', 'whiteLabel')).toBe(false);

      // Enterprise tier features
      expect(canUseFeature('enterprise', 'apiAccess')).toBe(true);
      expect(canUseFeature('enterprise', 'whiteLabel')).toBe(true);

      // Common features
      expect(canUseFeature('free', 'designHistory')).toBe(true);
      expect(canUseFeature('pro', 'designHistory')).toBe(true);
    });
  });

  describe('calculateOverage', () => {
    it('should return zero overage when within allowance', () => {
      const result = calculateOverage('free', 2);
      expect(result.overage).toBe(0);
      expect(result.overageCharge).toBe(0);
      expect(result.withinAllowance).toBe(true);
    });

    it('should calculate correct overage when exceeding allowance', () => {
      const freeAllowance = PRICING_TIERS.starter.limits.designs;
      const overageAmount = 5;
      const result = calculateOverage('starter', freeAllowance + overageAmount);

      expect(result.overage).toBe(overageAmount);
      expect(result.overageCharge).toBe(
        overageAmount * PRICING_TIERS.starter.overage.pricePerDesign
      );
      expect(result.withinAllowance).toBe(false);
    });

    it('should correctly detect soft cap approach', () => {
      // Pro tier has softCap of 20
      const proAllowance = PRICING_TIERS.pro.limits.designs;
      const softCap = PRICING_TIERS.pro.overage.softCap!;

      // At 80% of soft cap
      const nearSoftCap = Math.ceil(softCap * 0.8);
      const result = calculateOverage('pro', proAllowance + nearSoftCap);

      expect(result.approachingSoftCap).toBe(true);
    });

    it('should correctly detect hard cap', () => {
      const proAllowance = PRICING_TIERS.pro.limits.designs;
      const hardCap = PRICING_TIERS.pro.overage.hardCap!;

      const result = calculateOverage('pro', proAllowance + hardCap);
      expect(result.atHardCap).toBe(true);
    });

    it('should handle free tier with no overage allowed', () => {
      const freeAllowance = PRICING_TIERS.free.limits.designs;
      const result = calculateOverage('free', freeAllowance + 5);

      // Free tier doesn't have overage pricing
      expect(result.overage).toBe(5);
      expect(result.overageCharge).toBe(0); // $0 per design for free tier
      expect(result.withinAllowance).toBe(false);
    });
  });

  describe('getImageQuality', () => {
    it('should return appropriate quality settings for each tier', () => {
      const freeQuality = getImageQuality('free');
      const proQuality = getImageQuality('pro');
      const enterpriseQuality = getImageQuality('enterprise');

      // All tiers should have valid settings
      expect(freeQuality.resolution.width).toBeGreaterThan(0);
      expect(freeQuality.resolution.height).toBeGreaterThan(0);

      // Higher tiers should have better or equal quality
      expect(proQuality.quality).toBeGreaterThanOrEqual(freeQuality.quality);
      expect(enterpriseQuality.quality).toBeGreaterThanOrEqual(proQuality.quality);
    });
  });

  describe('Tier feature consistency', () => {
    it('should have all required properties for each tier', () => {
      Object.values(PRICING_TIERS).forEach((tier) => {
        expect(tier.id).toBeDefined();
        expect(tier.name).toBeDefined();
        expect(tier.status).toBeDefined();
        expect(tier.price).toBeDefined();
        expect(tier.limits).toBeDefined();
        expect(tier.limits.designs).toBeDefined();
        expect(tier.limits.maxPerRun).toBeDefined();
        expect(tier.overage).toBeDefined();
        expect(tier.features).toBeDefined();
        expect(tier.display).toBeDefined();
      });
    });

    it('should have valid maxPerRun values', () => {
      Object.values(PRICING_TIERS).forEach((tier) => {
        expect(tier.limits.maxPerRun).toBeGreaterThanOrEqual(1);
        expect(tier.limits.maxPerRun).toBeLessThanOrEqual(10);
      });
    });

    it('should have valid concurrent runs values', () => {
      Object.values(PRICING_TIERS).forEach((tier) => {
        expect(tier.features.concurrentRuns).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
