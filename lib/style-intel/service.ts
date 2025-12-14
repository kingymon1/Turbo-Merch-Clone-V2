/**
 * Style Intelligence Service
 *
 * Read-only, feature-flagged service that selects appropriate StyleRecipes
 * from the pre-mined database based on context (niche, tone, garment color, etc.)
 *
 * FEATURE FLAG: STYLE_INTEL_MERCH_ENABLED (default: false)
 *
 * This service NEVER throws - it always returns a StyleSpecResult with
 * fallbackReason if something goes wrong.
 */

import prisma from '../prisma';
import type { StyleRecipe, PrincipleContext } from './types';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Context for selecting a style specification
 */
export interface StyleContext {
  pipeline: string;           // "merch" initially
  niche?: string;
  tone?: string;
  garmentColor?: string;
  textLength?: 'short' | 'medium' | 'long';
  riskLevel?: number;         // 0-100
}

/**
 * Result of style specification selection
 */
export interface StyleSpecResult {
  styleSpec?: StyleRecipe;
  usedStyleIntel: boolean;
  fallbackReason?: string;    // e.g., "disabled_for_pipeline", "no_recipe_found", "db_error:..."
  logs: string[];             // short trace of decisions
}

/**
 * Style Intelligence Service interface
 */
export interface IStyleIntelService {
  isEnabledForPipeline(pipeline: string): boolean;
  selectStyleSpec(ctx: StyleContext): Promise<StyleSpecResult>;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Check if StyleIntel is enabled for a specific pipeline
 */
function getFeatureFlag(pipeline: string): boolean {
  const envVar = `STYLE_INTEL_${pipeline.toUpperCase()}_ENABLED`;
  const value = process.env[envVar];
  return value === 'true';
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Simple case-insensitive partial match
 */
function partialMatch(haystack: string | undefined | null, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Check if any item in an array partially matches
 */
function arrayPartialMatch(arr: string[] | undefined | null, needle: string): boolean {
  if (!arr || arr.length === 0) return false;
  return arr.some(item => partialMatch(item, needle));
}

/**
 * Score a recipe based on context match
 */
function scoreRecipe(recipe: StyleRecipe, ctx: StyleContext): number {
  let score = 0;

  // Niche match (highest weight)
  if (ctx.niche) {
    if (arrayPartialMatch(recipe.meta.nicheHints, ctx.niche)) {
      score += 30;
    }
    if (partialMatch(recipe.meta.displayName, ctx.niche)) {
      score += 10;
    }
    if (partialMatch(recipe.meta.category, ctx.niche)) {
      score += 5;
    }
  }

  // Tone match
  if (ctx.tone) {
    if (arrayPartialMatch(recipe.meta.tone, ctx.tone)) {
      score += 20;
    }
  }

  // Garment color match
  if (ctx.garmentColor && recipe.color?.recommendedGarmentColors) {
    if (arrayPartialMatch(recipe.color.recommendedGarmentColors, ctx.garmentColor)) {
      score += 10;
    }
  }

  // Text length consideration - prefer simpler recipes for longer text
  if (ctx.textLength === 'long') {
    // Prefer simpler recipes for long text
    if (recipe.meta.complexity === 'simple') {
      score += 15;
    } else if (recipe.meta.complexity === 'moderate') {
      score += 5;
    }
    // Prefer fewer effects for long text
    const effectCount = countEnabledEffects(recipe);
    if (effectCount <= 1) {
      score += 10;
    }
  } else if (ctx.textLength === 'short') {
    // Short text can handle more complexity
    if (recipe.meta.complexity === 'complex') {
      score += 5;
    }
  }

  // Risk level consideration
  if (ctx.riskLevel !== undefined) {
    if (ctx.riskLevel < 30) {
      // Low risk: prefer proven, simpler recipes
      if (recipe.meta.complexity === 'simple') {
        score += 10;
      }
    } else if (ctx.riskLevel > 70) {
      // High risk: allow more experimental recipes
      if (recipe.meta.complexity === 'complex') {
        score += 10;
      }
    }
  }

  return score;
}

/**
 * Count enabled effects in a recipe
 */
function countEnabledEffects(recipe: StyleRecipe): number {
  const effects = recipe.effects;
  if (!effects) return 0;

  let count = 0;
  if (effects.halftone?.enabled) count++;
  if (effects.gradient?.enabled) count++;
  if (effects.outline?.enabled) count++;
  if (effects.texture?.enabled) count++;
  if (effects.shadow?.enabled) count++;
  if (effects.aging?.enabled) count++;

  return count;
}

// =============================================================================
// MAIN SERVICE
// =============================================================================

/**
 * Select a style specification based on context
 */
async function selectStyleSpec(ctx: StyleContext): Promise<StyleSpecResult> {
  const logs: string[] = [];

  // Check feature flag
  const enabled = getFeatureFlag(ctx.pipeline);
  if (!enabled) {
    logs.push(`disabled_for_pipeline=${ctx.pipeline}`);
    console.log(`[StyleIntel] Disabled for pipeline: ${ctx.pipeline}`);
    return {
      usedStyleIntel: false,
      fallbackReason: 'disabled_for_pipeline',
      logs,
    };
  }

  logs.push(`enabled_for_pipeline=${ctx.pipeline}`);
  logs.push(`context: niche=${ctx.niche || 'none'}, tone=${ctx.tone || 'none'}, garment=${ctx.garmentColor || 'none'}`);

  try {
    // Build query filters
    const whereClause: any = {};

    // Try to narrow down with basic filters first
    // We use OR logic for flexible matching
    const orConditions: any[] = [];

    if (ctx.niche) {
      orConditions.push({
        nicheHints: {
          hasSome: [ctx.niche.toLowerCase()],
        },
      });
      orConditions.push({
        displayName: {
          contains: ctx.niche,
          mode: 'insensitive',
        },
      });
      orConditions.push({
        category: {
          contains: ctx.niche,
          mode: 'insensitive',
        },
      });
    }

    if (ctx.tone) {
      orConditions.push({
        tone: {
          hasSome: [ctx.tone.toLowerCase()],
        },
      });
    }

    // Query recipes - if we have filters use them, otherwise get all
    let recipes;
    if (orConditions.length > 0) {
      recipes = await prisma.styleRecipeLibrary.findMany({
        where: {
          OR: orConditions,
        },
        orderBy: [
          { confidence: 'desc' },
          { timesValidated: 'desc' },
        ],
        take: 50, // Get top 50 for scoring
      });

      logs.push(`found ${recipes.length} recipes matching filters`);
    }

    // If no filtered results, get top recipes by confidence
    if (!recipes || recipes.length === 0) {
      recipes = await prisma.styleRecipeLibrary.findMany({
        orderBy: [
          { confidence: 'desc' },
          { timesValidated: 'desc' },
        ],
        take: 20,
      });
      logs.push(`no filter matches, using top ${recipes.length} by confidence`);
    }

    if (recipes.length === 0) {
      logs.push('no_recipes_in_database');
      console.log('[StyleIntel] No recipes found in database');
      return {
        usedStyleIntel: false,
        fallbackReason: 'no_recipe_found',
        logs,
      };
    }

    // Score and rank recipes
    const scoredRecipes = recipes.map(r => {
      const rawJson = r.rawJson as unknown as StyleRecipe;

      // Reconstruct StyleRecipe from database fields if rawJson is incomplete
      const recipe: StyleRecipe = rawJson?.meta ? rawJson : {
        meta: {
          id: r.id,
          displayName: r.displayName,
          category: r.category,
          nicheHints: r.nicheHints,
          tone: r.tone,
          complexity: r.complexity as 'simple' | 'moderate' | 'complex',
        },
        typography: rawJson?.typography || {
          fontCategory: 'sans-serif',
          fontWeight: 'bold',
        },
        layout: rawJson?.layout || {
          composition: 'centered',
          textPlacement: 'center',
        },
        color: rawJson?.color || {
          schemeType: 'high-contrast',
        },
        effects: rawJson?.effects || {},
        imagery: rawJson?.imagery,
        printConstraints: rawJson?.printConstraints,
      };

      return {
        recipe,
        dbConfidence: r.confidence,
        timesValidated: r.timesValidated,
        score: scoreRecipe(recipe, ctx),
      };
    });

    // Sort by score (descending), then by confidence
    scoredRecipes.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.dbConfidence - a.dbConfidence;
    });

    // Select the best recipe
    const best = scoredRecipes[0];

    if (best.score === 0 && !ctx.niche && !ctx.tone) {
      // No context provided and no matches - just use highest confidence
      logs.push(`selected by confidence: "${best.recipe.meta.displayName}" (score=0, conf=${best.dbConfidence.toFixed(2)})`);
    } else {
      logs.push(`selected: "${best.recipe.meta.displayName}" (score=${best.score}, conf=${best.dbConfidence.toFixed(2)})`);
    }

    console.log(`[StyleIntel] Selected recipe: "${best.recipe.meta.displayName}" (score=${best.score}, confidence=${best.dbConfidence.toFixed(2)})`);

    return {
      styleSpec: best.recipe,
      usedStyleIntel: true,
      logs,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logs.push(`db_error: ${errorMsg}`);
    console.error('[StyleIntel] Database error:', error);
    return {
      usedStyleIntel: false,
      fallbackReason: `db_error:${errorMsg}`,
      logs,
    };
  }
}

/**
 * Check if StyleIntel is enabled for a pipeline
 */
function isEnabledForPipeline(pipeline: string): boolean {
  return getFeatureFlag(pipeline);
}

// =============================================================================
// EXPORTED SERVICE SINGLETON
// =============================================================================

export const styleIntelService: IStyleIntelService = {
  isEnabledForPipeline,
  selectStyleSpec,
};

export default styleIntelService;
