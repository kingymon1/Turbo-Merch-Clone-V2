/**
 * Tests for StyleIntelService
 *
 * These tests verify the behavior of the StyleIntel service including:
 * - Feature flag checking
 * - Style spec selection
 * - Fallback handling
 * - Error cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { styleIntelService, StyleContext, StyleSpecResult } from '@/lib/style-intel/service';

describe('StyleIntelService', () => {
  // Store original env
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('isEnabledForPipeline', () => {
    it('should return false when env var is not set', () => {
      delete process.env.STYLE_INTEL_MERCH_ENABLED;
      expect(styleIntelService.isEnabledForPipeline('merch')).toBe(false);
    });

    it('should return false when env var is set to "false"', () => {
      process.env.STYLE_INTEL_MERCH_ENABLED = 'false';
      expect(styleIntelService.isEnabledForPipeline('merch')).toBe(false);
    });

    it('should return true when env var is set to "true"', () => {
      process.env.STYLE_INTEL_MERCH_ENABLED = 'true';
      expect(styleIntelService.isEnabledForPipeline('merch')).toBe(true);
    });

    it('should check pipeline-specific env var', () => {
      process.env.STYLE_INTEL_MERCH_ENABLED = 'true';
      process.env.STYLE_INTEL_OTHER_ENABLED = 'false';

      expect(styleIntelService.isEnabledForPipeline('merch')).toBe(true);
      expect(styleIntelService.isEnabledForPipeline('other')).toBe(false);
    });
  });

  describe('selectStyleSpec', () => {
    describe('when disabled', () => {
      beforeEach(() => {
        delete process.env.STYLE_INTEL_MERCH_ENABLED;
      });

      it('should return usedStyleIntel=false when disabled', async () => {
        const ctx: StyleContext = {
          pipeline: 'merch',
          niche: 'fishing',
          tone: 'funny',
        };

        const result = await styleIntelService.selectStyleSpec(ctx);

        expect(result.usedStyleIntel).toBe(false);
        expect(result.fallbackReason).toBe('disabled_for_pipeline');
        expect(result.styleSpec).toBeUndefined();
        expect(result.logs).toContain('disabled_for_pipeline=merch');
      });

      it('should include pipeline name in logs', async () => {
        const ctx: StyleContext = { pipeline: 'merch' };
        const result = await styleIntelService.selectStyleSpec(ctx);

        expect(result.logs.some(log => log.includes('merch'))).toBe(true);
      });
    });

    describe('when enabled', () => {
      beforeEach(() => {
        process.env.STYLE_INTEL_MERCH_ENABLED = 'true';
      });

      it('should return a result object with proper structure', async () => {
        const ctx: StyleContext = {
          pipeline: 'merch',
          niche: 'fishing',
          tone: 'funny',
        };

        const result = await styleIntelService.selectStyleSpec(ctx);

        // Result should always have these fields
        expect(result).toHaveProperty('usedStyleIntel');
        expect(result).toHaveProperty('logs');
        expect(Array.isArray(result.logs)).toBe(true);

        // Either has styleSpec and usedStyleIntel=true, or has fallbackReason
        if (result.usedStyleIntel) {
          expect(result.styleSpec).toBeDefined();
          expect(result.fallbackReason).toBeUndefined();
        } else {
          expect(result.fallbackReason).toBeDefined();
        }
      });

      it('should include context in logs', async () => {
        const ctx: StyleContext = {
          pipeline: 'merch',
          niche: 'fishing',
          tone: 'funny',
          garmentColor: 'black',
        };

        const result = await styleIntelService.selectStyleSpec(ctx);

        // Should have logs about enabled state and context
        expect(result.logs.some(log => log.includes('enabled_for_pipeline'))).toBe(true);
        expect(result.logs.some(log => log.includes('context'))).toBe(true);
      });

      it('should never throw - always returns a result', async () => {
        const ctx: StyleContext = { pipeline: 'merch' };

        // Should not throw even with minimal context
        await expect(
          styleIntelService.selectStyleSpec(ctx)
        ).resolves.toBeDefined();
      });

      it('should handle empty niche and tone gracefully', async () => {
        const ctx: StyleContext = {
          pipeline: 'merch',
          niche: undefined,
          tone: undefined,
        };

        const result = await styleIntelService.selectStyleSpec(ctx);

        // Should still return a valid result
        expect(result).toHaveProperty('usedStyleIntel');
        expect(result).toHaveProperty('logs');
      });
    });

    describe('text length handling', () => {
      beforeEach(() => {
        process.env.STYLE_INTEL_MERCH_ENABLED = 'true';
      });

      it('should accept short text length', async () => {
        const ctx: StyleContext = {
          pipeline: 'merch',
          textLength: 'short',
        };

        const result = await styleIntelService.selectStyleSpec(ctx);
        expect(result).toHaveProperty('usedStyleIntel');
      });

      it('should accept medium text length', async () => {
        const ctx: StyleContext = {
          pipeline: 'merch',
          textLength: 'medium',
        };

        const result = await styleIntelService.selectStyleSpec(ctx);
        expect(result).toHaveProperty('usedStyleIntel');
      });

      it('should accept long text length', async () => {
        const ctx: StyleContext = {
          pipeline: 'merch',
          textLength: 'long',
        };

        const result = await styleIntelService.selectStyleSpec(ctx);
        expect(result).toHaveProperty('usedStyleIntel');
      });
    });

    describe('risk level handling', () => {
      beforeEach(() => {
        process.env.STYLE_INTEL_MERCH_ENABLED = 'true';
      });

      it('should accept low risk level', async () => {
        const ctx: StyleContext = {
          pipeline: 'merch',
          riskLevel: 10,
        };

        const result = await styleIntelService.selectStyleSpec(ctx);
        expect(result).toHaveProperty('usedStyleIntel');
      });

      it('should accept medium risk level', async () => {
        const ctx: StyleContext = {
          pipeline: 'merch',
          riskLevel: 50,
        };

        const result = await styleIntelService.selectStyleSpec(ctx);
        expect(result).toHaveProperty('usedStyleIntel');
      });

      it('should accept high risk level', async () => {
        const ctx: StyleContext = {
          pipeline: 'merch',
          riskLevel: 90,
        };

        const result = await styleIntelService.selectStyleSpec(ctx);
        expect(result).toHaveProperty('usedStyleIntel');
      });
    });
  });
});

describe('StyleSpecResult interface', () => {
  it('should have expected properties for success case', () => {
    const successResult: StyleSpecResult = {
      styleSpec: {
        meta: {
          id: 'test-recipe',
          displayName: 'Test Recipe',
          category: 'test',
          nicheHints: ['test'],
          complexity: 'simple',
        },
        typography: {
          fontCategory: 'sans-serif',
          fontWeight: 'bold',
        },
        layout: {
          composition: 'centered',
          textPlacement: 'center',
        },
        color: {
          schemeType: 'high-contrast',
        },
        effects: {},
      },
      usedStyleIntel: true,
      logs: ['test log'],
    };

    expect(successResult.usedStyleIntel).toBe(true);
    expect(successResult.styleSpec).toBeDefined();
    expect(successResult.fallbackReason).toBeUndefined();
  });

  it('should have expected properties for fallback case', () => {
    const fallbackResult: StyleSpecResult = {
      usedStyleIntel: false,
      fallbackReason: 'no_recipe_found',
      logs: ['test log'],
    };

    expect(fallbackResult.usedStyleIntel).toBe(false);
    expect(fallbackResult.fallbackReason).toBe('no_recipe_found');
    expect(fallbackResult.styleSpec).toBeUndefined();
  });
});
