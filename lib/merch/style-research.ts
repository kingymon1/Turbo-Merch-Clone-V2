/**
 * Style Research Service
 *
 * Populates NicheStyleProfile database with style intelligence.
 * Two modes:
 * - Cron (bulk): Runs daily/weekly for top niches
 * - On-demand: Triggers on first generation for a niche
 *
 * This ensures the form-filler has style context for any niche.
 */

import { prisma } from '@/lib/prisma';
import { StyleContext } from './types';

// ============================================================================
// TOP NICHES (for cron job)
// ============================================================================

/**
 * Top niches to populate in cron job.
 * These are evergreen/popular niches that get regular traffic.
 */
export const TOP_NICHES = [
  // Professions
  'nurse',
  'teacher',
  'doctor',
  'engineer',
  'programmer',
  'accountant',
  'lawyer',
  'firefighter',
  'police',
  'military',
  'veteran',
  'truck driver',
  'electrician',
  'plumber',
  'construction',

  // Family
  'mom',
  'dad',
  'grandma',
  'grandpa',
  'sister',
  'brother',
  'aunt',
  'uncle',

  // Pets
  'dog lover',
  'cat lover',
  'pet mom',
  'pet dad',

  // Hobbies
  'fishing',
  'camping',
  'hiking',
  'hunting',
  'golf',
  'basketball',
  'football',
  'baseball',
  'soccer',
  'yoga',
  'gym',
  'running',
  'cycling',
  'gaming',

  // Interests
  'coffee',
  'beer',
  'wine',
  'music',
  'art',
  'reading',
  'anime',
  'gardening',

  // Seasonal
  'christmas',
  'halloween',
  'valentines',
  'easter',
  'thanksgiving',
  'mothers day',
  'fathers day',

  // Life events
  'birthday',
  'retirement',
  'graduation',
  'wedding',
];

// ============================================================================
// STYLE CONTEXT RETRIEVAL
// ============================================================================

/**
 * Get style context for a niche from database.
 * Returns null if not found.
 * Triggers background refresh if data is stale.
 *
 * @param niche - The niche to look up
 * @returns StyleContext or null
 */
export async function getStyleContext(
  niche: string
): Promise<StyleContext | null> {
  const normalizedNiche = niche.toLowerCase().trim();

  const profile = await prisma.nicheStyleProfile.findUnique({
    where: { niche: normalizedNiche },
  });

  if (!profile) {
    return null;
  }

  // Check freshness (older than 7 days = stale)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (profile.lastAnalyzedAt < weekAgo) {
    // Trigger background refresh (non-blocking)
    refreshStyleProfile(normalizedNiche).catch((error) => {
      console.error(`[StyleResearch] Background refresh failed for ${normalizedNiche}:`, error);
    });
  }

  // Extract style context from profile
  return extractStyleContext(profile);
}

/**
 * Get style context, researching if not found.
 * This is the main entry point for form-filler.
 *
 * @param niche - The niche to look up or research
 * @returns StyleContext (always returns something)
 */
export async function getOrResearchStyleContext(
  niche: string
): Promise<StyleContext> {
  const normalizedNiche = niche.toLowerCase().trim();

  // Try database first
  const existing = await getStyleContext(normalizedNiche);
  if (existing) {
    return existing;
  }

  // Not found - do on-demand research
  console.log(`[StyleResearch] On-demand research for: ${normalizedNiche}`);

  try {
    const result = await researchNicheStyle(normalizedNiche);
    await saveStyleProfile(result);

    return {
      dominantTypography: result.dominantTypography.primary,
      colorPalette: result.colorPalette.primary,
      moodAesthetic: result.moodAesthetic.primary,
      avoidStyles: result.moodAesthetic.avoid,
    };
  } catch (error) {
    console.error(`[StyleResearch] Research failed for ${normalizedNiche}:`, error);

    // Return minimal default if research fails
    return {
      dominantTypography: 'bold sans-serif',
      moodAesthetic: 'fun and engaging',
    };
  }
}

// ============================================================================
// STYLE RESEARCH
// ============================================================================

/**
 * Result of style research for a niche
 */
export interface StyleResearchResult {
  niche: string;
  dominantTypography: {
    primary: string;
    secondary?: string;
    examples: string[];
  };
  colorPalette: {
    primary: string[];
    accent: string[];
    background: string[];
  };
  layoutPatterns: {
    dominant: string;
    alternatives: string[];
    textPlacement: string;
    iconUsage: 'common' | 'rare' | 'none';
  };
  moodAesthetic: {
    primary: string;
    secondary?: string;
    avoid: string[];
  };
  confidence: number;
  sampleSize: number;
}

/**
 * Research style for a single niche.
 * Uses web search and/or image analysis.
 *
 * @param niche - The niche to research
 * @returns StyleResearchResult
 */
export async function researchNicheStyle(
  niche: string
): Promise<StyleResearchResult> {
  const normalizedNiche = niche.toLowerCase().trim();

  // Step 1: Search for style trends
  const webResults = await searchStyleTrends(normalizedNiche);

  // Step 2: Analyze marketplace images (if available)
  const imageAnalysis = await analyzeMarketplaceImages(normalizedNiche);

  // Step 3: Synthesize into style profile
  const profile = await synthesizeStyleProfile(
    normalizedNiche,
    webResults,
    imageAnalysis
  );

  return profile;
}

/**
 * Search for style trends using Perplexity or similar.
 * This is a placeholder - implement with actual API call.
 */
async function searchStyleTrends(niche: string): Promise<{
  typography?: string;
  colors?: string[];
  mood?: string;
  avoid?: string[];
}> {
  // TODO: Implement with Perplexity API
  // Search: "[niche] t-shirt design trends 2025 style typography colors"

  // For now, return niche-aware defaults
  const defaults = getNicheDefaults(niche);
  return {
    typography: defaults.typography,
    colors: defaults.colors,
    mood: defaults.mood,
    avoid: defaults.avoid,
  };
}

/**
 * Analyze marketplace images using Claude Vision.
 * This is a placeholder - implement with actual API call.
 */
async function analyzeMarketplaceImages(niche: string): Promise<{
  typographyObserved?: string[];
  colorsObserved?: string[];
  layoutObserved?: string;
}> {
  // TODO: Implement with Claude Vision API
  // Analyze top MBA products for this niche

  return {};
}

/**
 * Synthesize style profile from web and image data.
 */
async function synthesizeStyleProfile(
  niche: string,
  webResults: Awaited<ReturnType<typeof searchStyleTrends>>,
  imageAnalysis: Awaited<ReturnType<typeof analyzeMarketplaceImages>>
): Promise<StyleResearchResult> {
  const defaults = getNicheDefaults(niche);

  return {
    niche,
    dominantTypography: {
      primary: webResults.typography || defaults.typography,
      examples: imageAnalysis.typographyObserved || [],
    },
    colorPalette: {
      primary: webResults.colors || defaults.colors,
      accent: [],
      background: ['black', 'white', 'navy'],
    },
    layoutPatterns: {
      dominant: imageAnalysis.layoutObserved || 'centered',
      alternatives: ['stacked', 'arched'],
      textPlacement: 'center',
      iconUsage: defaults.iconUsage,
    },
    moodAesthetic: {
      primary: webResults.mood || defaults.mood,
      avoid: webResults.avoid || defaults.avoid,
    },
    confidence: 0.7,
    sampleSize: 0,
  };
}

// ============================================================================
// DATABASE OPERATIONS
// ============================================================================

/**
 * Save style profile to database
 */
export async function saveStyleProfile(
  result: StyleResearchResult
): Promise<void> {
  await prisma.nicheStyleProfile.upsert({
    where: { niche: result.niche },
    update: {
      typographyDominant: [result.dominantTypography.primary],
      typographySuccessful: result.dominantTypography.examples,
      colorPalettesCommon: result.colorPalette.primary,
      colorPalettesSuccessful: result.colorPalette.accent,
      moodPrimary: [result.moodAesthetic.primary],
      moodAvoided: result.moodAesthetic.avoid,
      layoutCompositions: [result.layoutPatterns.dominant, ...result.layoutPatterns.alternatives],
      layoutTextPlacements: [result.layoutPatterns.textPlacement],
      layoutIconUsage: result.layoutPatterns.iconUsage === 'common' ? 0.8 : result.layoutPatterns.iconUsage === 'rare' ? 0.2 : 0,
      confidence: result.confidence,
      sampleSize: result.sampleSize,
      lastAnalyzedAt: new Date(),
      analysisCount: { increment: 1 },
    },
    create: {
      niche: result.niche,
      typographyDominant: [result.dominantTypography.primary],
      typographySuccessful: result.dominantTypography.examples,
      colorPalettesCommon: result.colorPalette.primary,
      colorPalettesSuccessful: result.colorPalette.accent,
      moodPrimary: [result.moodAesthetic.primary],
      moodAvoided: result.moodAesthetic.avoid,
      layoutCompositions: [result.layoutPatterns.dominant, ...result.layoutPatterns.alternatives],
      layoutTextPlacements: [result.layoutPatterns.textPlacement],
      layoutIconUsage: result.layoutPatterns.iconUsage === 'common' ? 0.8 : result.layoutPatterns.iconUsage === 'rare' ? 0.2 : 0,
      confidence: result.confidence,
      sampleSize: result.sampleSize,
      lastAnalyzedAt: new Date(),
    },
  });
}

/**
 * Background refresh of a style profile
 */
async function refreshStyleProfile(niche: string): Promise<void> {
  console.log(`[StyleResearch] Refreshing style profile for: ${niche}`);
  const result = await researchNicheStyle(niche);
  await saveStyleProfile(result);
}

/**
 * Extract StyleContext from a NicheStyleProfile database record
 */
function extractStyleContext(profile: {
  typographyDominant: string[];
  colorPalettesCommon: string[];
  moodPrimary: string[];
  moodAvoided: string[];
}): StyleContext {
  return {
    dominantTypography: profile.typographyDominant?.[0],
    colorPalette: profile.colorPalettesCommon,
    moodAesthetic: profile.moodPrimary?.[0],
    avoidStyles: profile.moodAvoided,
  };
}

// ============================================================================
// NICHE DEFAULTS (Fallback when research unavailable)
// ============================================================================

interface NicheDefault {
  typography: string;
  colors: string[];
  mood: string;
  avoid: string[];
  iconUsage: 'common' | 'rare' | 'none';
}

/**
 * Get intelligent defaults for a niche.
 * These are used when research is unavailable.
 */
function getNicheDefaults(niche: string): NicheDefault {
  const normalized = niche.toLowerCase();

  // Profession niches
  if (['nurse', 'doctor', 'medical'].some((n) => normalized.includes(n))) {
    return {
      typography: 'bold sans-serif',
      colors: ['red', 'blue', 'white'],
      mood: 'proud and professional',
      avoid: ['childish', 'overly casual'],
      iconUsage: 'common',
    };
  }

  if (['teacher', 'education'].some((n) => normalized.includes(n))) {
    return {
      typography: 'friendly sans-serif',
      colors: ['red', 'apple green', 'yellow'],
      mood: 'inspiring and fun',
      avoid: ['corporate', 'boring'],
      iconUsage: 'common',
    };
  }

  if (['engineer', 'programmer', 'developer', 'tech'].some((n) => normalized.includes(n))) {
    return {
      typography: 'modern geometric sans-serif',
      colors: ['blue', 'green', 'black'],
      mood: 'clever and nerdy',
      avoid: ['cutesy', 'outdated'],
      iconUsage: 'common',
    };
  }

  // Outdoor/hobby niches
  if (['fishing', 'hunting', 'camping', 'outdoor'].some((n) => normalized.includes(n))) {
    return {
      typography: 'rugged distressed serif',
      colors: ['earth tones', 'forest green', 'brown'],
      mood: 'rustic and adventurous',
      avoid: ['urban', 'feminine'],
      iconUsage: 'common',
    };
  }

  // Family niches
  if (['mom', 'dad', 'grandma', 'grandpa', 'parent'].some((n) => normalized.includes(n))) {
    return {
      typography: 'warm friendly font',
      colors: ['soft pastels', 'earth tones'],
      mood: 'loving and heartfelt',
      avoid: ['edgy', 'aggressive'],
      iconUsage: 'common',
    };
  }

  // Pet niches
  if (['dog', 'cat', 'pet'].some((n) => normalized.includes(n))) {
    return {
      typography: 'playful rounded font',
      colors: ['bright colors', 'paw print themes'],
      mood: 'fun and loving',
      avoid: ['serious', 'corporate'],
      iconUsage: 'common',
    };
  }

  // Holiday niches
  if (['christmas', 'xmas', 'holiday'].some((n) => normalized.includes(n))) {
    return {
      typography: 'festive playful font',
      colors: ['red', 'green', 'gold', 'white'],
      mood: 'cheerful and festive',
      avoid: ['scary', 'dark'],
      iconUsage: 'common',
    };
  }

  if (['halloween', 'spooky'].some((n) => normalized.includes(n))) {
    return {
      typography: 'spooky distressed font',
      colors: ['orange', 'black', 'purple'],
      mood: 'fun-scary and playful',
      avoid: ['too cute', 'serious'],
      iconUsage: 'common',
    };
  }

  // Default fallback
  return {
    typography: 'bold sans-serif',
    colors: ['versatile colors'],
    mood: 'fun and engaging',
    avoid: ['generic', 'amateur'],
    iconUsage: 'rare',
  };
}

// ============================================================================
// BULK OPERATIONS (for cron)
// ============================================================================

/**
 * Research and save style profiles for multiple niches.
 * Used by cron job.
 *
 * @param niches - Array of niches to research
 * @param batchSize - How many to process in parallel
 * @returns Results summary
 */
export async function researchNichesBulk(
  niches: string[] = TOP_NICHES,
  batchSize: number = 5
): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  results: { niche: string; success: boolean; error?: string }[];
}> {
  const results: { niche: string; success: boolean; error?: string }[] = [];

  // Process in batches to avoid rate limits
  for (let i = 0; i < niches.length; i += batchSize) {
    const batch = niches.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (niche) => {
        try {
          const profile = await researchNicheStyle(niche);
          await saveStyleProfile(profile);
          results.push({ niche, success: true });
          console.log(`[StyleResearch] ✓ ${niche}`);
        } catch (error) {
          results.push({ niche, success: false, error: String(error) });
          console.error(`[StyleResearch] ✗ ${niche}:`, error);
        }
      })
    );

    // Small delay between batches
    if (i + batchSize < niches.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const succeeded = results.filter((r) => r.success).length;

  return {
    total: niches.length,
    succeeded,
    failed: niches.length - succeeded,
    results,
  };
}
