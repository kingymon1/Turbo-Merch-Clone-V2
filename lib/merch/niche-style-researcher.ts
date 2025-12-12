/**
 * Niche Style Researcher
 *
 * REPLACES hardcoded niche defaults with agent-based style inference.
 * When research data is incomplete, this module makes a targeted web search
 * to discover current style patterns for the specific niche.
 *
 * Philosophy: "We have access to all the information on the internet - use it."
 */

import OpenAI from 'openai';

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
}

// Minimal fallback - used ONLY if agent call fails completely
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

// Cache to avoid redundant API calls for same niche in same session
const sessionCache = new Map<string, { result: NicheStyleResult; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Get style patterns for a niche via agent research
 *
 * This replaces the hardcoded NICHE_STYLE_DEFAULTS approach.
 * Instead of a static map, we ask an agent to research current
 * style patterns for this specific niche from the web.
 */
export async function getNicheStyleFromResearch(niche: string): Promise<NicheStyleResult> {
  const cacheKey = niche.toLowerCase().trim();

  // Check session cache first
  const cached = sessionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[NicheStyleResearcher] Cache hit for "${niche}"`);
    return cached.result;
  }

  console.log(`[NicheStyleResearcher] Researching style patterns for "${niche}"...`);

  try {
    const result = await researchNicheStyle(niche);

    // Cache the result
    sessionCache.set(cacheKey, { result, timestamp: Date.now() });

    return result;
  } catch (error) {
    console.error(`[NicheStyleResearcher] Research failed for "${niche}":`, error);
    return MINIMAL_FALLBACK;
  }
}

/**
 * Core research function using Perplexity for web-grounded answers
 */
async function researchNicheStyle(niche: string): Promise<NicheStyleResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    console.warn('[NicheStyleResearcher] PERPLEXITY_API_KEY not set, using minimal fallback');
    return MINIMAL_FALLBACK;
  }

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.perplexity.ai'
  });

  const prompt = buildNicheResearchPrompt(niche);

  const response = await client.chat.completions.create({
    model: 'sonar', // Fast model for quick lookups
    messages: [
      {
        role: 'system',
        content: `You are a merchandise design researcher. Your job is to discover current visual style patterns for specific niches by analyzing what's selling in that market.

RESPOND ONLY WITH VALID JSON - no markdown, no explanation, just the JSON object.`
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.3, // Lower temp for more consistent structured output
    max_tokens: 800
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    console.warn('[NicheStyleResearcher] Empty response from Perplexity');
    return MINIMAL_FALLBACK;
  }

  return parseResearchResponse(content, niche);
}

/**
 * Build the research prompt for niche style discovery
 */
function buildNicheResearchPrompt(niche: string): string {
  return `Research current t-shirt design style patterns for the "${niche}" niche.

Look at what's actually selling on Amazon Merch, Etsy, and POD marketplaces in 2024-2025.

For the "${niche}" audience, discover:

1. TYPOGRAPHY: What font styles are popular? (bold sans-serif, vintage serif, script, etc.)
2. EFFECTS: What design effects sell? (distressed, clean, gradient, halftone, etc.)
3. COLOR PALETTE: What colors work for this audience? (list 3-5 specific colors)
4. MOOD: What's the emotional tone? (rugged, playful, professional, rebellious, etc.)
5. SHIRT COLOR: What background color sells best? (black, white, navy, heather grey, etc.)
6. AESTHETIC: What's the overall vibe? (1-2 sentence description)

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
 * Parse the research response into structured data
 */
function parseResearchResponse(content: string, niche: string): NicheStyleResult {
  try {
    // Try to extract JSON from the response
    let jsonStr = content.trim();

    // Handle markdown code blocks
    if (jsonStr.includes('```')) {
      const match = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        jsonStr = match[1].trim();
      }
    }

    const parsed = JSON.parse(jsonStr);

    // Validate and normalize the response
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
      confidence: 0.75 // Agent research gets good confidence
    };

    console.log(`[NicheStyleResearcher] Successfully researched style for "${niche}":`, {
      typography: result.typography,
      shirtColor: result.shirtColor,
      aesthetic: result.aesthetic
    });

    return result;

  } catch (parseError) {
    console.warn(`[NicheStyleResearcher] Failed to parse response for "${niche}":`, parseError);
    console.warn('[NicheStyleResearcher] Raw response:', content);
    return MINIMAL_FALLBACK;
  }
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
