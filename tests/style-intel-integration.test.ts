/**
 * Tests for StyleIntel Integration Helpers
 *
 * These tests verify the behavior of the integration helpers including:
 * - maybeApplyStyleIntel function
 * - isStyleIntelEnabled function
 * - buildStyleContextFromForm function
 * - formatStyleRecipeForPrompt function
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  maybeApplyStyleIntel,
  isStyleIntelEnabled,
  buildStyleContextFromForm,
  formatStyleRecipeForPrompt,
} from '@/lib/merch/style-intel-integration';
import type { DesignBrief } from '@/lib/merch/types';
import type { StyleRecipe } from '@/lib/style-intel/types';

describe('StyleIntel Integration Helpers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('isStyleIntelEnabled', () => {
    it('should return false when env var is not set', () => {
      delete process.env.STYLE_INTEL_MERCH_ENABLED;
      expect(isStyleIntelEnabled()).toBe(false);
    });

    it('should return true when env var is set to "true"', () => {
      process.env.STYLE_INTEL_MERCH_ENABLED = 'true';
      expect(isStyleIntelEnabled()).toBe(true);
    });
  });

  describe('buildStyleContextFromForm', () => {
    it('should extract garment color from instructions', () => {
      const form = {
        exactText: 'Test Text',
        additionalInstructions: 'on white background',
      };

      const ctx = buildStyleContextFromForm(form);
      expect(ctx.garmentColor).toBe('white');
    });

    it('should default garment color to black', () => {
      const form = {
        exactText: 'Test Text',
      };

      const ctx = buildStyleContextFromForm(form);
      expect(ctx.garmentColor).toBe('black');
    });

    it('should normalize dark to black', () => {
      const form = {
        additionalInstructions: 'on dark background',
      };

      const ctx = buildStyleContextFromForm(form);
      expect(ctx.garmentColor).toBe('black');
    });

    it('should normalize light to white', () => {
      const form = {
        additionalInstructions: 'on light background',
      };

      const ctx = buildStyleContextFromForm(form);
      expect(ctx.garmentColor).toBe('white');
    });

    it('should estimate text length correctly', () => {
      // Short (1-3 words)
      let ctx = buildStyleContextFromForm({ exactText: 'Hi' });
      expect(ctx.textLength).toBe('short');

      ctx = buildStyleContextFromForm({ exactText: 'Hello World' });
      expect(ctx.textLength).toBe('short');

      // Medium (4-6 words)
      ctx = buildStyleContextFromForm({ exactText: 'This is a medium text' });
      expect(ctx.textLength).toBe('medium');

      // Long (7+ words)
      ctx = buildStyleContextFromForm({ exactText: 'This is a much longer text that has many words' });
      expect(ctx.textLength).toBe('long');
    });

    it('should set pipeline to merch', () => {
      const ctx = buildStyleContextFromForm({});
      expect(ctx.pipeline).toBe('merch');
    });

    it('should pass through niche and tone', () => {
      const form = {
        niche: 'fishing',
        tone: 'funny',
      };

      const ctx = buildStyleContextFromForm(form);
      expect(ctx.niche).toBe('fishing');
      expect(ctx.tone).toBe('funny');
    });
  });

  describe('formatStyleRecipeForPrompt', () => {
    it('should format typography correctly', () => {
      const recipe: StyleRecipe = {
        meta: {
          id: 'test',
          displayName: 'Test',
          category: 'test',
          nicheHints: [],
          complexity: 'simple',
        },
        typography: {
          fontCategory: 'sans-serif',
          fontWeight: 'bold',
          textTransform: 'uppercase',
        },
        layout: {
          composition: 'centered',
          textPlacement: 'center',
        },
        color: {
          schemeType: 'high-contrast',
        },
        effects: {},
      };

      const formatted = formatStyleRecipeForPrompt(recipe);
      expect(formatted.typography).toContain('sans-serif');
      expect(formatted.typography).toContain('bold');
      expect(formatted.typography).toContain('uppercase');
    });

    it('should format layout correctly', () => {
      const recipe: StyleRecipe = {
        meta: {
          id: 'test',
          displayName: 'Test',
          category: 'test',
          nicheHints: [],
          complexity: 'simple',
        },
        typography: {
          fontCategory: 'serif',
        },
        layout: {
          composition: 'badge',
          textPlacement: 'center',
          hierarchyType: 'single-level',
        },
        color: {
          schemeType: 'monochrome',
        },
        effects: {},
      };

      const formatted = formatStyleRecipeForPrompt(recipe);
      expect(formatted.layout).toContain('badge');
      expect(formatted.layout).toContain('single-level');
    });

    it('should format color hint correctly', () => {
      const recipe: StyleRecipe = {
        meta: {
          id: 'test',
          displayName: 'Test',
          category: 'test',
          nicheHints: [],
          complexity: 'simple',
        },
        typography: {
          fontCategory: 'serif',
        },
        layout: {
          composition: 'centered',
          textPlacement: 'center',
        },
        color: {
          schemeType: 'warm-palette',
          colorMood: 'nostalgic',
          primaryColors: ['red', 'orange', 'yellow'],
        },
        effects: {},
      };

      const formatted = formatStyleRecipeForPrompt(recipe);
      expect(formatted.colorHint).toContain('warm-palette');
      expect(formatted.colorHint).toContain('nostalgic');
      expect(formatted.colorHint).toContain('red');
    });

    it('should format effects correctly', () => {
      const recipe: StyleRecipe = {
        meta: {
          id: 'test',
          displayName: 'Test',
          category: 'test',
          nicheHints: [],
          complexity: 'moderate',
        },
        typography: {
          fontCategory: 'serif',
        },
        layout: {
          composition: 'centered',
          textPlacement: 'center',
        },
        color: {
          schemeType: 'high-contrast',
        },
        effects: {
          halftone: { enabled: true, density: 'medium' },
          texture: { enabled: true, type: 'distressed' },
          shadow: { enabled: true, type: 'drop' },
        },
      };

      const formatted = formatStyleRecipeForPrompt(recipe);
      expect(formatted.effectsHint).toContain('halftone');
      expect(formatted.effectsHint).toContain('distressed');
      expect(formatted.effectsHint).toContain('shadow');
    });

    it('should return clean effects when none enabled', () => {
      const recipe: StyleRecipe = {
        meta: {
          id: 'test',
          displayName: 'Test',
          category: 'test',
          nicheHints: [],
          complexity: 'simple',
        },
        typography: {
          fontCategory: 'serif',
        },
        layout: {
          composition: 'centered',
          textPlacement: 'center',
        },
        color: {
          schemeType: 'high-contrast',
        },
        effects: {},
      };

      const formatted = formatStyleRecipeForPrompt(recipe);
      expect(formatted.effectsHint).toContain('clean');
    });
  });

  describe('maybeApplyStyleIntel', () => {
    const sampleBrief: DesignBrief = {
      text: {
        exact: 'Test Design',
        preserveCase: true,
      },
      style: {
        source: 'researched',
        confidence: 0.8,
        typography: {
          required: 'bold sans-serif',
        },
        colorApproach: {
          palette: ['black', 'white'],
          mood: 'bold',
          shirtColor: 'black',
        },
        aesthetic: {
          primary: 'modern clean',
          keywords: ['modern', 'clean'],
        },
        layout: {
          composition: 'centered',
          textPlacement: 'center',
        },
      },
      context: {
        niche: 'fishing',
        audienceDescription: 'fishing enthusiasts',
        tone: 'funny',
      },
      _meta: {
        briefId: 'test-brief-123',
        createdAt: new Date(),
        researchSource: 'test',
        styleConfidence: 0.8,
      },
    };

    it('should add styleIntelMeta to brief', async () => {
      delete process.env.STYLE_INTEL_MERCH_ENABLED;

      const result = await maybeApplyStyleIntel(sampleBrief);

      expect(result.styleIntelMeta).toBeDefined();
      expect(result.styleIntelMeta?.attempted).toBe(true);
    });

    it('should preserve original brief properties', async () => {
      delete process.env.STYLE_INTEL_MERCH_ENABLED;

      const result = await maybeApplyStyleIntel(sampleBrief);

      expect(result.text.exact).toBe(sampleBrief.text.exact);
      expect(result.style.source).toBe(sampleBrief.style.source);
      expect(result.context.niche).toBe(sampleBrief.context.niche);
      expect(result._meta.briefId).toBe(sampleBrief._meta.briefId);
    });

    it('should set used=false when disabled', async () => {
      delete process.env.STYLE_INTEL_MERCH_ENABLED;

      const result = await maybeApplyStyleIntel(sampleBrief);

      expect(result.styleIntelMeta?.used).toBe(false);
      expect(result.styleIntelMeta?.fallbackReason).toBe('disabled_for_pipeline');
    });

    it('should have proper meta when enabled', async () => {
      process.env.STYLE_INTEL_MERCH_ENABLED = 'true';

      const result = await maybeApplyStyleIntel(sampleBrief);

      expect(result.styleIntelMeta?.attempted).toBe(true);
      // Either used or has fallback reason
      if (!result.styleIntelMeta?.used) {
        expect(result.styleIntelMeta?.fallbackReason).toBeDefined();
      }
    });
  });
});
