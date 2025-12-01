import { describe, it, expect } from 'vitest';
import {
  TrackDesignSchema,
  CheckQuotaSchema,
  CreateCheckoutSessionSchema,
  BraveSearchSchema,
  TierSchema,
  validateRequest,
  safeValidateRequest,
} from '@/lib/validations';

describe('Validation Schemas', () => {
  describe('TierSchema', () => {
    it('should accept valid tiers', () => {
      expect(TierSchema.parse('free')).toBe('free');
      expect(TierSchema.parse('starter')).toBe('starter');
      expect(TierSchema.parse('pro')).toBe('pro');
      expect(TierSchema.parse('business')).toBe('business');
      expect(TierSchema.parse('enterprise')).toBe('enterprise');
    });

    it('should reject invalid tiers', () => {
      expect(() => TierSchema.parse('invalid')).toThrow();
      expect(() => TierSchema.parse('')).toThrow();
      expect(() => TierSchema.parse(123)).toThrow();
    });
  });

  describe('TrackDesignSchema', () => {
    it('should accept valid design count', () => {
      const result = TrackDesignSchema.parse({ designCount: 5 });
      expect(result.designCount).toBe(5);
    });

    it('should default designCount to 1', () => {
      const result = TrackDesignSchema.parse({});
      expect(result.designCount).toBe(1);
    });

    it('should reject design count below 1', () => {
      expect(() => TrackDesignSchema.parse({ designCount: 0 })).toThrow();
      expect(() => TrackDesignSchema.parse({ designCount: -1 })).toThrow();
    });

    it('should reject design count above 10', () => {
      expect(() => TrackDesignSchema.parse({ designCount: 11 })).toThrow();
      expect(() => TrackDesignSchema.parse({ designCount: 100 })).toThrow();
    });

    it('should accept valid UUID idempotency key', () => {
      const result = TrackDesignSchema.parse({
        designCount: 1,
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.idempotencyKey).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should reject invalid idempotency key', () => {
      expect(() =>
        TrackDesignSchema.parse({ idempotencyKey: 'not-a-uuid' })
      ).toThrow();
    });
  });

  describe('CheckQuotaSchema', () => {
    it('should accept valid design count', () => {
      const result = CheckQuotaSchema.parse({ designCount: 3 });
      expect(result.designCount).toBe(3);
    });

    it('should default to 1', () => {
      const result = CheckQuotaSchema.parse({});
      expect(result.designCount).toBe(1);
    });
  });

  describe('CreateCheckoutSessionSchema', () => {
    it('should accept valid price ID', () => {
      const result = CreateCheckoutSessionSchema.parse({
        priceId: 'price_123abc',
      });
      expect(result.priceId).toBe('price_123abc');
    });

    it('should accept tier', () => {
      const result = CreateCheckoutSessionSchema.parse({
        priceId: 'price_123abc',
        tier: 'pro',
      });
      expect(result.tier).toBe('pro');
    });

    it('should reject empty price ID', () => {
      expect(() =>
        CreateCheckoutSessionSchema.parse({ priceId: '' })
      ).toThrow();
    });

    it('should reject missing price ID', () => {
      expect(() => CreateCheckoutSessionSchema.parse({})).toThrow();
    });
  });

  describe('BraveSearchSchema', () => {
    it('should accept valid query', () => {
      const result = BraveSearchSchema.parse({ query: 'test search' });
      expect(result.query).toBe('test search');
      expect(result.count).toBe(10); // default
    });

    it('should accept custom count', () => {
      const result = BraveSearchSchema.parse({
        query: 'test',
        count: 20,
      });
      expect(result.count).toBe(20);
    });

    it('should reject empty query', () => {
      expect(() => BraveSearchSchema.parse({ query: '' })).toThrow();
    });

    it('should reject count above 50', () => {
      expect(() =>
        BraveSearchSchema.parse({ query: 'test', count: 51 })
      ).toThrow();
    });

    it('should accept valid freshness values', () => {
      expect(BraveSearchSchema.parse({ query: 'test', freshness: 'pd' }).freshness).toBe('pd');
      expect(BraveSearchSchema.parse({ query: 'test', freshness: 'pw' }).freshness).toBe('pw');
      expect(BraveSearchSchema.parse({ query: 'test', freshness: 'pm' }).freshness).toBe('pm');
      expect(BraveSearchSchema.parse({ query: 'test', freshness: 'py' }).freshness).toBe('py');
    });
  });

  describe('validateRequest helper', () => {
    it('should return parsed data for valid input', () => {
      const result = validateRequest(TrackDesignSchema, { designCount: 5 });
      expect(result.designCount).toBe(5);
    });

    it('should throw for invalid input', () => {
      expect(() =>
        validateRequest(TrackDesignSchema, { designCount: 100 })
      ).toThrow('Validation failed');
    });
  });

  describe('safeValidateRequest helper', () => {
    it('should return success true for valid input', () => {
      const result = safeValidateRequest(TrackDesignSchema, { designCount: 5 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.designCount).toBe(5);
      }
    });

    it('should return success false for invalid input', () => {
      const result = safeValidateRequest(TrackDesignSchema, { designCount: 100 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('designCount');
      }
    });
  });
});
