/**
 * Style Intelligence Integration
 *
 * Helper functions to integrate StyleIntel service with the merch generator pipeline.
 * This module provides the maybeApplyStyleIntel function that enriches DesignBriefs
 * with pre-mined style recipes when the feature is enabled.
 *
 * FEATURE FLAG: STYLE_INTEL_MERCH_ENABLED (default: false)
 */

import { DesignBrief, StyleIntelMeta } from './types';
import { styleIntelService, StyleContext } from '../style-intel/service';
import type { StyleRecipe } from '../style-intel/types';

/**
 * Estimate text length category based on the brief's text
 */
function estimateTextLength(text: string): 'short' | 'medium' | 'long' {
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  if (words <= 3) return 'short';
  if (words <= 6) return 'medium';
  return 'long';
}

/**
 * Apply StyleIntel to a DesignBrief if enabled
 *
 * This function:
 * 1. Checks if StyleIntel is enabled for the merch pipeline
 * 2. If enabled, queries for a matching StyleRecipe
 * 3. Attaches the styleSpec and styleIntelMeta to the brief
 * 4. If disabled or fails, leaves the brief unchanged but adds tracking metadata
 *
 * The brief remains functionally valid regardless of StyleIntel status.
 *
 * @param brief - The DesignBrief to potentially enrich
 * @returns The same brief with styleSpec and styleIntelMeta populated
 */
export async function maybeApplyStyleIntel(brief: DesignBrief): Promise<DesignBrief> {
  // Build context from the brief
  const ctx: StyleContext = {
    pipeline: 'merch',
    niche: brief.context.niche,
    tone: brief.context.tone,
    garmentColor: brief.style.colorApproach.shirtColor,
    textLength: estimateTextLength(brief.text.exact),
    riskLevel: undefined, // Could be passed in if available
  };

  // Query StyleIntel service
  const result = await styleIntelService.selectStyleSpec(ctx);

  // Build metadata
  const styleIntelMeta: StyleIntelMeta = {
    attempted: true,
    used: result.usedStyleIntel,
    fallbackReason: result.fallbackReason,
    logs: result.logs,
    recipeId: result.styleSpec?.meta?.id,
    recipeName: result.styleSpec?.meta?.displayName,
  };

  // Return enriched brief
  return {
    ...brief,
    styleSpec: result.styleSpec ?? brief.styleSpec, // Preserve existing if no new one
    styleIntelMeta,
  };
}

/**
 * Apply StyleIntel with explicit risk level
 *
 * Same as maybeApplyStyleIntel but accepts a risk level parameter
 * for more accurate recipe selection.
 *
 * @param brief - The DesignBrief to potentially enrich
 * @param riskLevel - Risk level 0-100 (affects recipe selection)
 * @returns The same brief with styleSpec and styleIntelMeta populated
 */
export async function applyStyleIntelWithRisk(
  brief: DesignBrief,
  riskLevel: number
): Promise<DesignBrief> {
  const ctx: StyleContext = {
    pipeline: 'merch',
    niche: brief.context.niche,
    tone: brief.context.tone,
    garmentColor: brief.style.colorApproach.shirtColor,
    textLength: estimateTextLength(brief.text.exact),
    riskLevel,
  };

  const result = await styleIntelService.selectStyleSpec(ctx);

  const styleIntelMeta: StyleIntelMeta = {
    attempted: true,
    used: result.usedStyleIntel,
    fallbackReason: result.fallbackReason,
    logs: result.logs,
    recipeId: result.styleSpec?.meta?.id,
    recipeName: result.styleSpec?.meta?.displayName,
  };

  return {
    ...brief,
    styleSpec: result.styleSpec ?? brief.styleSpec,
    styleIntelMeta,
  };
}

/**
 * Check if StyleIntel is enabled for merch pipeline
 */
export function isStyleIntelEnabled(): boolean {
  return styleIntelService.isEnabledForPipeline('merch');
}

/**
 * Extract style context from a DesignForm for StyleIntel lookup
 * Used when working with the simple prompt system
 */
export function buildStyleContextFromForm(form: {
  exactText?: string | null;
  style?: string;
  niche?: string;
  tone?: string;
  additionalInstructions?: string | null;
}): StyleContext {
  // Extract garment color from instructions if present
  let garmentColor = 'black'; // default
  if (form.additionalInstructions) {
    const match = form.additionalInstructions.match(
      /on\s+(black|white|transparent|dark|light)\s+background/i
    );
    if (match) {
      garmentColor = match[1].toLowerCase();
      if (garmentColor === 'dark') garmentColor = 'black';
      if (garmentColor === 'light') garmentColor = 'white';
    }
  }

  // Estimate text length
  let textLength: 'short' | 'medium' | 'long' = 'medium';
  if (form.exactText) {
    const words = form.exactText.split(/\s+/).filter(w => w.length > 0).length;
    textLength = words <= 3 ? 'short' : words <= 6 ? 'medium' : 'long';
  }

  return {
    pipeline: 'merch',
    niche: form.niche,
    tone: form.tone,
    garmentColor,
    textLength,
  };
}

/**
 * Format StyleRecipe for use in prompt building
 *
 * Extracts the most relevant information from a StyleRecipe
 * for direct inclusion in prompts.
 */
export function formatStyleRecipeForPrompt(recipe: StyleRecipe): {
  typography: string;
  layout: string;
  colorHint: string;
  effectsHint: string;
} {
  // Typography hint
  const typoParts: string[] = [];
  if (recipe.typography.fontCategory) {
    typoParts.push(recipe.typography.fontCategory);
  }
  if (recipe.typography.fontWeight && recipe.typography.fontWeight !== 'regular') {
    typoParts.push(recipe.typography.fontWeight);
  }
  if (recipe.typography.textTransform && recipe.typography.textTransform !== 'mixed') {
    typoParts.push(recipe.typography.textTransform);
  }
  const typography = typoParts.join(' ') || 'bold sans-serif';

  // Layout hint
  const layoutParts: string[] = [];
  if (recipe.layout.composition) {
    layoutParts.push(`${recipe.layout.composition} composition`);
  }
  if (recipe.layout.hierarchyType) {
    layoutParts.push(recipe.layout.hierarchyType);
  }
  const layout = layoutParts.join(', ') || 'centered composition';

  // Color hint
  let colorHint = '';
  if (recipe.color.schemeType) {
    colorHint = recipe.color.schemeType;
    if (recipe.color.colorMood) {
      colorHint += ` ${recipe.color.colorMood}`;
    }
  }
  if (recipe.color.primaryColors?.length) {
    colorHint += ` (${recipe.color.primaryColors.slice(0, 2).join(', ')})`;
  }
  colorHint = colorHint || 'high-contrast';

  // Effects hint
  const effectsList: string[] = [];
  if (recipe.effects.halftone?.enabled) {
    effectsList.push(`${recipe.effects.halftone.density || 'subtle'} halftone`);
  }
  if (recipe.effects.texture?.enabled) {
    effectsList.push(`${recipe.effects.texture.type || 'distressed'} texture`);
  }
  if (recipe.effects.shadow?.enabled) {
    effectsList.push(`${recipe.effects.shadow.type || 'drop'} shadow`);
  }
  if (recipe.effects.outline?.enabled) {
    effectsList.push('text outline');
  }
  if (recipe.effects.aging?.enabled) {
    effectsList.push('vintage aging');
  }
  const effectsHint = effectsList.length > 0
    ? effectsList.join(', ')
    : 'clean without excessive effects';

  return {
    typography,
    layout,
    colorHint,
    effectsHint,
  };
}

export default {
  maybeApplyStyleIntel,
  applyStyleIntelWithRisk,
  isStyleIntelEnabled,
  buildStyleContextFromForm,
  formatStyleRecipeForPrompt,
};
