/**
 * Niche Style Researcher
 *
 * Intelligent style inference that combines:
 * 1. LIVE RESEARCH (Perplexity) - Always runs, discovers fresh patterns
 * 2. STORED CONTEXT - Enriches research prompt, validates results
 * 3. WRITE-BACK - Persists new discoveries for future context
 *
 * Philosophy:
 * - Live research is PRIMARY (always discover fresh)
 * - Stored data is CONTEXT (informs, doesn't replace)
 * - System makes decisions autonomously
 * - Gets smarter over time without getting stale
 */

import { prisma } from '@/lib/prisma';

// Result structure matches what design-executor needs
export interface NicheStyleResult {
  typography: string;
  effects: string[];
  colorPalette: string[];
  mood: string;
  shirtColor: string;
  aesthetic: string;
  source: 'researched' | 'minimal-fallback';
  confidence: number;
  // Metadata for transparency
  _meta?: {
    storedContextUsed: boolean;
    storedDataAgreement: 'agrees' | 'disagrees' | 'novel' | 'no-stored-data';
    writtenToDb: boolean;
  };
}

// Stored context from database
interface StoredContext {
  nicheStyleProfile: {
    typography: string[];
    colors: string[];
    mood: string[];
    shirtColors: string[];
    confidence: number;
    lastAnalyzed: Date;
  } | null;
  nicheMarketData: {
    winningStyles: string[];
    saturationLevel: string;
    mbaProductCount: number;
  } | null;
  provenInsights: {
    styles: string[];
    confidence: number;
  } | null;
}

// Minimal fallback - used ONLY if everything fails
const MINIMAL_FALLBACK: NicheStyleResult = {
  typography: 'bold readable sans-serif',
  effects: [],
  colorPalette: ['adaptable neutral tones'],
  mood: 'versatile',
  shirtColor: 'black',
  aesthetic: 'clean professional',
  source: 'minimal-fallback',
  confidence: 0.3
};

// Session cache to avoid redundant API calls within same request
const sessionCache = new Map<string, { result: NicheStyleResult; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Get style patterns for a niche via intelligent research
 *
 * Flow:
 * 1. Fetch stored context (parallel, non-blocking)
 * 2. Build enriched research prompt with context
 * 3. Call Perplexity (live research - always)
 * 4. Compare results with stored data for confidence
 * 5. Write back new findings to database
 * 6. Return fresh result
 */
export async function getNicheStyleFromResearch(niche: string): Promise<NicheStyleResult> {
  const cacheKey = niche.toLowerCase().trim();

  // Check session cache first (very short-term, same-request dedup)
  const cached = sessionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[NicheStyleResearcher] Session cache hit for "${niche}"`);
    return cached.result;
  }

  console.log(`[NicheStyleResearcher] Starting intelligent research for "${niche}"...`);

  try {
    // Step 1: Fetch stored context (parallel, non-blocking)
    const storedContext = await fetchStoredContext(niche);

    // Step 2: Always do live research with enriched prompt
    const researchResult = await researchNicheStyle(niche, storedContext);

    // Step 3: Compare and score confidence
    const finalResult = scoreAndEnrich(researchResult, storedContext);

    // Step 4: Write back to database (fire and forget - don't block)
    writeBackToDatabase(niche, finalResult, storedContext).catch(err => {
      console.warn(`[NicheStyleResearcher] Write-back failed for "${niche}":`, err);
    });

    // Cache the result
    sessionCache.set(cacheKey, { result: finalResult, timestamp: Date.now() });

    return finalResult;
  } catch (error) {
    console.error(`[NicheStyleResearcher] Research failed for "${niche}":`, error);
    return MINIMAL_FALLBACK;
  }
}

/**
 * Fetch stored context from database (parallel queries)
 */
async function fetchStoredContext(niche: string): Promise<StoredContext> {
  const nicheLower = niche.toLowerCase().trim();

  try {
    const [styleProfile, marketData, insights] = await Promise.all([
      // NicheStyleProfile
      prisma.nicheStyleProfile.findUnique({
        where: { niche: nicheLower },
        select: {
          typographyDominant: true,
          typographySuccessful: true,
          colorPalettesCommon: true,
          colorPalettesSuccessful: true,
          moodPrimary: true,
          colorsByShirtColor: true,
          confidence: true,
          lastAnalyzedAt: true
        }
      }),
      // NicheMarketData
      prisma.nicheMarketData.findUnique({
        where: { niche: nicheLower },
        select: {
          winningDesignStyles: true,
          saturationLevel: true,
          mbaProducts: true
        }
      }),
      // ProvenInsight (style-effectiveness type)
      prisma.provenInsight.findMany({
        where: {
          OR: [
            { niche: nicheLower },
            { niches: { has: nicheLower } }
          ],
          insightType: 'style-effectiveness',
          stillRelevant: true,
          confidence: { gte: 0.7 }
        },
        select: {
          pattern: true,
          confidence: true
        },
        take: 5
      })
    ]);

    // Parse and structure the context
    const context: StoredContext = {
      nicheStyleProfile: styleProfile ? {
        typography: [...(styleProfile.typographyDominant || []), ...(styleProfile.typographySuccessful || [])],
        colors: [...(styleProfile.colorPalettesCommon || []), ...(styleProfile.colorPalettesSuccessful || [])],
        mood: styleProfile.moodPrimary || [],
        shirtColors: extractShirtColors(styleProfile.colorsByShirtColor),
        confidence: styleProfile.confidence,
        lastAnalyzed: styleProfile.lastAnalyzedAt
      } : null,
      nicheMarketData: marketData ? {
        winningStyles: parseJsonArray(marketData.winningDesignStyles),
        saturationLevel: marketData.saturationLevel || 'unknown',
        mbaProductCount: marketData.mbaProducts || 0
      } : null,
      provenInsights: insights.length > 0 ? {
        styles: insights.flatMap(i => extractStylesFromPattern(i.pattern)),
        confidence: Math.max(...insights.map(i => i.confidence))
      } : null
    };

    const hasContext = context.nicheStyleProfile || context.nicheMarketData || context.provenInsights;
    console.log(`[NicheStyleResearcher] Stored context for "${niche}": ${hasContext ? 'found' : 'none'}`);

    return context;
  } catch (error) {
    console.warn(`[NicheStyleResearcher] Failed to fetch stored context:`, error);
    return { nicheStyleProfile: null, nicheMarketData: null, provenInsights: null };
  }
}

/**
 * Core research function using Perplexity with enriched prompt
 */
async function researchNicheStyle(niche: string, context: StoredContext): Promise<NicheStyleResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    console.warn('[NicheStyleResearcher] PERPLEXITY_API_KEY not set, using minimal fallback');
    return MINIMAL_FALLBACK;
  }

  const prompt = buildEnrichedPrompt(niche, context);

  // Use fetch directly for Perplexity API (OpenAI-compatible)
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `You are a merchandise design researcher. Your job is to discover CURRENT visual style patterns for specific niches by analyzing what's selling in that market.

You may receive context about what has historically worked. Use it as background, but prioritize discovering what's CURRENTLY trending - styles evolve.

RESPOND ONLY WITH VALID JSON - no markdown, no explanation, just the JSON object.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.4,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    console.warn(`[NicheStyleResearcher] Perplexity API error: ${response.status}`);
    return MINIMAL_FALLBACK;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    console.warn('[NicheStyleResearcher] Empty response from Perplexity');
    return MINIMAL_FALLBACK;
  }

  return parseResearchResponse(content, niche);
}

/**
 * Build enriched research prompt with stored context
 */
function buildEnrichedPrompt(niche: string, context: StoredContext): string {
  let contextSection = '';

  // Add stored context as background (not as constraints)
  if (context.nicheStyleProfile || context.nicheMarketData || context.provenInsights) {
    contextSection = `
BACKGROUND CONTEXT (from our historical data - use as reference, not constraint):
`;

    if (context.nicheStyleProfile) {
      const sp = context.nicheStyleProfile;
      contextSection += `
- Typography that has worked: ${sp.typography.slice(0, 3).join(', ') || 'unknown'}
- Colors that have worked: ${sp.colors.slice(0, 4).join(', ') || 'unknown'}
- Mood/aesthetic that resonated: ${sp.mood.slice(0, 2).join(', ') || 'unknown'}
- Data confidence: ${Math.round(sp.confidence * 100)}%
- Last analyzed: ${sp.lastAnalyzed.toLocaleDateString()}
`;
    }

    if (context.nicheMarketData) {
      const md = context.nicheMarketData;
      contextSection += `
- Market saturation: ${md.saturationLevel}
- MBA products analyzed: ${md.mbaProductCount}
- Winning styles: ${md.winningStyles.slice(0, 3).join(', ') || 'unknown'}
`;
    }

    if (context.provenInsights) {
      contextSection += `
- Proven effective styles: ${context.provenInsights.styles.slice(0, 3).join(', ')}
`;
    }

    contextSection += `
NOTE: This is historical data. Current trends may differ. Prioritize what you find is selling NOW.
`;
  }

  return `Research CURRENT t-shirt design style patterns for the "${niche}" niche.

Look at what's ACTUALLY SELLING RIGHT NOW on Amazon Merch, Etsy, and POD marketplaces in 2024-2025.
${contextSection}
For the "${niche}" audience, discover:

1. TYPOGRAPHY: What font styles are currently popular? (bold sans-serif, vintage serif, script, etc.)
2. EFFECTS: What design effects are selling? (distressed, clean, gradient, halftone, etc.)
3. COLOR PALETTE: What colors work for this audience? (list 3-5 specific colors)
4. MOOD: What's the emotional tone? (rugged, playful, professional, rebellious, etc.)
5. SHIRT COLOR: What background color sells best? (black, white, navy, heather grey, etc.)
6. AESTHETIC: What's the overall vibe? (1-2 sentence description)

If you notice trends DIFFERENT from the historical context provided, include those - we want to catch emerging shifts.

Return JSON in this exact format:
{
  "typography": "description of typography that works for ${niche}",
  "effects": ["effect1", "effect2"],
  "colorPalette": ["color1", "color2", "color3"],
  "mood": "emotional tone description",
  "shirtColor": "recommended shirt color",
  "aesthetic": "overall visual aesthetic description"
}`;
}

/**
 * Score and enrich result based on stored data comparison
 */
function scoreAndEnrich(result: NicheStyleResult, context: StoredContext): NicheStyleResult {
  let confidence = 0.75; // Base confidence for live research
  let agreement: 'agrees' | 'disagrees' | 'novel' | 'no-stored-data' = 'no-stored-data';

  if (context.nicheStyleProfile || context.provenInsights) {
    // Compare research result with stored patterns
    const storedTypography = [
      ...(context.nicheStyleProfile?.typography || []),
      ...(context.provenInsights?.styles || [])
    ].map(s => s.toLowerCase());

    const storedMoods = context.nicheStyleProfile?.mood.map(m => m.toLowerCase()) || [];

    const researchTypo = result.typography.toLowerCase();
    const researchMood = result.mood.toLowerCase();

    // Check for agreement
    const typoMatch = storedTypography.some(t => researchTypo.includes(t) || t.includes(researchTypo));
    const moodMatch = storedMoods.some(m => researchMood.includes(m) || m.includes(researchMood));

    if (typoMatch && moodMatch) {
      agreement = 'agrees';
      confidence = 0.9; // High confidence when research confirms stored
      console.log(`[NicheStyleResearcher] Research AGREES with stored data`);
    } else if (!typoMatch && !moodMatch) {
      agreement = 'disagrees';
      confidence = 0.65; // Lower but still trust research - might be trend shift
      console.log(`[NicheStyleResearcher] Research DIFFERS from stored data (potential trend shift)`);
    } else {
      agreement = 'novel';
      confidence = 0.75; // Partial match - interesting discovery
      console.log(`[NicheStyleResearcher] Research shows MIXED signals vs stored data`);
    }
  }

  return {
    ...result,
    confidence,
    _meta: {
      storedContextUsed: !!(context.nicheStyleProfile || context.nicheMarketData || context.provenInsights),
      storedDataAgreement: agreement,
      writtenToDb: false // Will be updated by write-back
    }
  };
}

/**
 * Write back research findings to database
 */
async function writeBackToDatabase(
  niche: string,
  result: NicheStyleResult,
  context: StoredContext
): Promise<void> {
  const nicheLower = niche.toLowerCase().trim();

  try {
    // Upsert to NicheStyleProfile
    await prisma.nicheStyleProfile.upsert({
      where: { niche: nicheLower },
      create: {
        niche: nicheLower,
        typographyDominant: [result.typography],
        colorPalettesCommon: result.colorPalette,
        moodPrimary: [result.mood],
        moodReference: result.aesthetic,
        confidence: result.confidence * 0.5, // New data starts with lower confidence
        sampleSize: 1,
        lastAnalyzedAt: new Date()
      },
      update: {
        // Merge with existing - don't overwrite, append unique values
        typographyDominant: {
          push: result.typography
        },
        colorPalettesCommon: {
          set: mergeArrays(context.nicheStyleProfile?.colors || [], result.colorPalette)
        },
        moodPrimary: {
          push: result.mood
        },
        moodReference: result.aesthetic,
        // Blend confidence: existing * 0.7 + new * 0.3
        confidence: context.nicheStyleProfile
          ? context.nicheStyleProfile.confidence * 0.7 + result.confidence * 0.3
          : result.confidence * 0.6,
        lastAnalyzedAt: new Date(),
        analysisCount: { increment: 1 }
      }
    });

    console.log(`[NicheStyleResearcher] Written research results to database for "${niche}"`);
  } catch (error) {
    console.warn(`[NicheStyleResearcher] Database write failed:`, error);
  }
}

/**
 * Parse the research response into structured data
 */
function parseResearchResponse(content: string, niche: string): NicheStyleResult {
  try {
    let jsonStr = content.trim();

    // Handle markdown code blocks
    if (jsonStr.includes('```')) {
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        jsonStr = match[1].trim();
      }
    }

    const parsed = JSON.parse(jsonStr);

    const result: NicheStyleResult = {
      typography: typeof parsed.typography === 'string'
        ? parsed.typography
        : 'bold readable sans-serif',
      effects: Array.isArray(parsed.effects)
        ? parsed.effects.filter((e: unknown) => typeof e === 'string')
        : [],
      colorPalette: Array.isArray(parsed.colorPalette)
        ? parsed.colorPalette.filter((c: unknown) => typeof c === 'string')
        : ['versatile tones'],
      mood: typeof parsed.mood === 'string'
        ? parsed.mood
        : 'balanced',
      shirtColor: typeof parsed.shirtColor === 'string'
        ? parsed.shirtColor
        : 'black',
      aesthetic: typeof parsed.aesthetic === 'string'
        ? parsed.aesthetic
        : `${niche} community style`,
      source: 'researched',
      confidence: 0.75
    };

    console.log(`[NicheStyleResearcher] Parsed research for "${niche}":`, {
      typography: result.typography,
      mood: result.mood,
      shirtColor: result.shirtColor
    });

    return result;

  } catch (parseError) {
    console.warn(`[NicheStyleResearcher] Failed to parse response for "${niche}":`, parseError);
    return MINIMAL_FALLBACK;
  }
}

// Helper functions
function extractShirtColors(colorsByShirtColor: unknown): string[] {
  if (!colorsByShirtColor || typeof colorsByShirtColor !== 'object') return [];
  return Object.keys(colorsByShirtColor as object);
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(v => typeof v === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function extractStylesFromPattern(pattern: unknown): string[] {
  if (!pattern || typeof pattern !== 'object') return [];
  const p = pattern as Record<string, unknown>;
  const styles: string[] = [];
  if (typeof p.style === 'string') styles.push(p.style);
  if (Array.isArray(p.styles)) styles.push(...p.styles.filter((s: unknown) => typeof s === 'string'));
  if (typeof p.aesthetic === 'string') styles.push(p.aesthetic);
  return styles;
}

function mergeArrays(existing: string[], newItems: string[]): string[] {
  const combined = [...existing, ...newItems];
  return [...new Set(combined)].slice(0, 10); // Dedupe and limit
}

/**
 * Clear the session cache (useful for testing)
 */
export function clearNicheStyleCache(): void {
  sessionCache.clear();
  console.log('[NicheStyleResearcher] Cache cleared');
}

/**
 * Check if we have a cached result for a niche
 */
export function hasNicheStyleCached(niche: string): boolean {
  const cacheKey = niche.toLowerCase().trim();
  const cached = sessionCache.get(cacheKey);
  return cached !== undefined && Date.now() - cached.timestamp < CACHE_TTL_MS;
}

export default {
  getNicheStyleFromResearch,
  clearNicheStyleCache,
  hasNicheStyleCached
};
