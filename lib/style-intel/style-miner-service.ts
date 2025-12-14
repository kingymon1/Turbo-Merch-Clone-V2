/**
 * Style Miner Service
 *
 * Core business logic for mining style intelligence from URLs.
 * Used by both the CLI script and the API route.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import prisma from '../prisma';
import type {
  StyleRecipe,
  StylePrinciple,
  StyleIntelSources,
  SourceGroup,
  LLMMiningResponse,
} from './types';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG_PATH = join(process.cwd(), 'config', 'style-intel-sources.json');
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const PERPLEXITY_MODEL = 'sonar';
const API_TIMEOUT_MS = 120000;
const REQUEST_DELAY_MS = 2000;

// =============================================================================
// SCHEMA DEFINITIONS FOR LLM
// =============================================================================

const RECIPE_SCHEMA = `{
  "meta": {
    "id": "string (unique kebab-case identifier)",
    "displayName": "string (human-readable name)",
    "category": "string (e.g., 'typography-focused', 'minimalist', 'vintage')",
    "nicheHints": ["array of niche names this works for"],
    "tone": ["array of tone keywords like 'bold', 'playful', 'elegant'"],
    "complexity": "'simple' | 'moderate' | 'complex'",
    "description": "string (optional brief description)"
  },
  "typography": {
    "fontCategory": "'serif' | 'sans-serif' | 'script' | 'display' | 'monospace'",
    "fontWeight": "'light' | 'regular' | 'medium' | 'bold' | 'black'",
    "fontFamilySuggestions": ["optional font style suggestions"],
    "letterSpacing": "'tight' | 'normal' | 'wide' | 'extra-wide'",
    "textTransform": "'uppercase' | 'lowercase' | 'capitalize' | 'mixed'",
    "lineHeight": "'tight' | 'normal' | 'relaxed'",
    "alignment": "'left' | 'center' | 'right'",
    "maxWordCount": "number (optional)"
  },
  "layout": {
    "composition": "'centered' | 'asymmetric' | 'stacked' | 'diagonal' | 'circular'",
    "textPlacement": "'top' | 'center' | 'bottom' | 'split'",
    "hierarchyType": "'single-line' | 'two-line' | 'three-line' | 'badge' | 'emblem'",
    "whiteSpace": "'minimal' | 'balanced' | 'generous'",
    "visualWeight": "'top-heavy' | 'bottom-heavy' | 'balanced' | 'asymmetric'",
    "iconUsage": "'none' | 'accent' | 'supporting' | 'dominant'",
    "iconStyle": "string (optional)"
  },
  "color": {
    "schemeType": "'monochromatic' | 'complementary' | 'analogous' | 'triadic' | 'high-contrast'",
    "primaryColors": ["color family names"],
    "accentColors": ["color family names"],
    "recommendedGarmentColors": ["garment colors this works on"],
    "contrastLevel": "'high' | 'medium' | 'low'",
    "colorMood": "'warm' | 'cool' | 'neutral' | 'vibrant' | 'muted'"
  },
  "effects": {
    "halftone": { "enabled": boolean, "style": "string", "density": "string" },
    "gradient": { "enabled": boolean, "type": "string", "subtlety": "string" },
    "outline": { "enabled": boolean, "weight": "string", "style": "string" },
    "texture": { "enabled": boolean, "type": "string", "intensity": "string" },
    "shadow": { "enabled": boolean, "type": "string", "intensity": "string" },
    "aging": { "enabled": boolean, "style": "string" }
  },
  "imagery": {
    "illustrationStyle": "string (optional)",
    "iconStyle": "string (optional)",
    "subjectPlacement": "string (optional)",
    "detailLevel": "string (optional)"
  },
  "printConstraints": {
    "maxColors": "number (optional)",
    "minTextSize": "number (optional)",
    "printAreaSize": "'small' | 'medium' | 'large' | 'full-front'",
    "printTechnique": "'screen-print-friendly' | 'dtg-preferred' | 'either'"
  }
}`;

const PRINCIPLE_SCHEMA = `{
  "id": "string (stable kebab-case identifier, e.g., 'contrast-readability-rule')",
  "context": {
    "textLength": "'short' | 'medium' | 'long' | 'any'",
    "garmentColors": ["array of garment colors this applies to"] (optional),
    "nicheRisk": "'low' | 'medium' | 'high' | 'any'",
    "niches": ["specific niches"] (optional),
    "complexity": "'simple' | 'moderate' | 'complex' | 'any'"
  },
  "recommendations": {
    "typography": { ... partial typography recommendations },
    "layout": { ... partial layout recommendations },
    "color": { ... partial color recommendations },
    "effects": { ... partial effects recommendations },
    "dos": ["array of things to do"],
    "donts": ["array of things to avoid"],
    "priority": "'critical' | 'important' | 'suggested'"
  },
  "rationale": "string (why this principle matters)",
  "sourceReferences": ["URLs that support this principle"]
}`;

// =============================================================================
// TYPES
// =============================================================================

export interface MiningProgress {
  pass: number;
  totalPasses: number;
  urlIndex: number;
  totalUrls: number;
  currentUrl: string;
  currentGroup: string;
  recipesFound: number;
  principlesFound: number;
  error?: string;
}

export interface MiningResult {
  totalRecipes: number;
  totalPrinciples: number;
  totalErrors: number;
  duration: number;
  dbTotals: {
    recipes: number;
    principles: number;
  };
}

export type ProgressCallback = (progress: MiningProgress) => void;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Load source configuration from JSON file
 */
export function loadSources(): StyleIntelSources {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as StyleIntelSources;
  } catch (error) {
    console.error(`[StyleMiner] Failed to load sources from ${CONFIG_PATH}:`, error);
    throw new Error(`Failed to load style sources config: ${error}`);
  }
}

/**
 * Get URLs for selected groups
 */
export function getUrlsForGroups(
  sources: StyleIntelSources,
  group: string
): Array<{ url: string; group: SourceGroup }> {
  const allGroups: SourceGroup[] = ['design_guides', 'template_galleries', 'inspiration_galleries', 'market_examples'];
  const selectedGroups = group === 'all' ? allGroups : [group as SourceGroup];

  const urls: Array<{ url: string; group: SourceGroup }> = [];
  for (const g of selectedGroups) {
    if (sources[g]) {
      for (const url of sources[g]) {
        urls.push({ url, group: g });
      }
    }
  }
  return urls;
}

// =============================================================================
// PERPLEXITY API
// =============================================================================

async function mineUrlWithPerplexity(
  url: string,
  groupName: string
): Promise<LLMMiningResponse> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY not set');
  }

  const systemPrompt = `You are a T-shirt style mining assistant. Given a URL's content, extract reusable T-shirt design styles (StyleRecipe) and global design rules (StylePrinciple).

Output ONLY a valid JSON object with this structure:
{
  "recipes": [StyleRecipe array],
  "principles": [StylePrinciple array]
}

StyleRecipe schema:
${RECIPE_SCHEMA}

StylePrinciple schema:
${PRINCIPLE_SCHEMA}

Rules:
1. Extract concrete, actionable design guidance
2. Focus on typography, layout, color, and visual effects for T-shirt designs
3. Generate unique IDs using kebab-case
4. If the content is not about T-shirt design, typography, graphics, or composition, return empty arrays
5. Do not hallucinate - only extract what's actually in the source
6. Include the source URL in sourceReferences for principles`;

  const userPrompt = `Analyze this URL and extract T-shirt design intelligence:

URL: ${url}
Source Type: ${groupName}

Please read the content and extract:
1. StyleRecipe objects - reusable design directions/templates
2. StylePrinciple objects - contextual design rules and best practices

If the page is not accessible or not relevant to T-shirt design, return:
{ "recipes": [], "principles": [] }`;

  const response = await fetchWithTimeout(
    PERPLEXITY_API_URL,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: PERPLEXITY_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    },
    API_TIMEOUT_MS
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Empty response from Perplexity');
  }

  // Parse JSON from response (may be wrapped in markdown code blocks)
  let jsonContent = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonContent = jsonMatch[1];
  }

  try {
    const parsed = JSON.parse(jsonContent.trim());
    return {
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
      principles: Array.isArray(parsed.principles) ? parsed.principles : [],
    };
  } catch {
    console.warn(`[StyleMiner] Failed to parse JSON from response for ${url}`);
    return { recipes: [], principles: [] };
  }
}

// =============================================================================
// VALIDATION & UPSERT
// =============================================================================

function validateRecipe(recipe: StyleRecipe): StyleRecipe | null {
  if (!recipe.meta?.id || !recipe.meta?.displayName || !recipe.meta?.category) {
    return null;
  }
  if (!recipe.typography?.fontCategory || !recipe.layout?.composition || !recipe.color?.schemeType) {
    return null;
  }

  return {
    ...recipe,
    meta: {
      ...recipe.meta,
      id: recipe.meta.id.toLowerCase().replace(/\s+/g, '-'),
      nicheHints: recipe.meta.nicheHints || [],
      tone: recipe.meta.tone || [],
      complexity: recipe.meta.complexity || 'moderate',
    },
    effects: recipe.effects || {},
  };
}

function validatePrinciple(principle: StylePrinciple, url: string): StylePrinciple | null {
  if (!principle.id || !principle.context || !principle.recommendations) {
    return null;
  }

  const sources = principle.sourceReferences || [];
  if (!sources.includes(url)) {
    sources.push(url);
  }

  return {
    ...principle,
    id: principle.id.toLowerCase().replace(/\s+/g, '-'),
    sourceReferences: sources,
  };
}

async function upsertRecipes(
  recipes: StyleRecipe[],
  sourceType: string,
  url: string
): Promise<number> {
  let count = 0;

  for (const recipe of recipes) {
    const validated = validateRecipe(recipe);
    if (!validated) continue;

    try {
      const existing = await prisma.styleRecipeLibrary.findFirst({
        where: {
          displayName: validated.meta.displayName,
          category: validated.meta.category,
        },
      });

      if (existing) {
        const existingRefs = existing.references || [];
        const newRefs = [...new Set([...existingRefs, url])];
        const existingSourceTypes = existing.sourceTypes || [];
        const newSourceTypes = [...new Set([...existingSourceTypes, sourceType])];

        await prisma.styleRecipeLibrary.update({
          where: { id: existing.id },
          data: {
            rawJson: validated as unknown as object,
            references: newRefs,
            sourceTypes: newSourceTypes,
            timesValidated: existing.timesValidated + 1,
            confidence: Math.min(0.95, existing.confidence + 0.1),
            lastValidated: new Date(),
          },
        });
      } else {
        await prisma.styleRecipeLibrary.create({
          data: {
            displayName: validated.meta.displayName,
            category: validated.meta.category,
            nicheHints: validated.meta.nicheHints,
            tone: validated.meta.tone,
            complexity: validated.meta.complexity,
            rawJson: validated as unknown as object,
            sourceTypes: [sourceType],
            references: [url],
            confidence: 0.5,
          },
        });
      }
      count++;
    } catch (error) {
      console.warn(`[StyleMiner] Failed to upsert recipe ${validated.meta.displayName}:`, error);
    }
  }

  return count;
}

async function upsertPrinciples(
  principles: StylePrinciple[],
  url: string
): Promise<number> {
  let count = 0;

  for (const principle of principles) {
    const validated = validatePrinciple(principle, url);
    if (!validated) continue;

    try {
      const existing = await prisma.stylePrinciple.findUnique({
        where: { id: validated.id },
      });

      if (existing) {
        const existingRefs = existing.sourceReferences || [];
        const newRefs = [...new Set([...existingRefs, ...validated.sourceReferences])];

        await prisma.stylePrinciple.update({
          where: { id: validated.id },
          data: {
            contextJson: validated.context as unknown as object,
            recommendations: validated.recommendations as unknown as object,
            rationale: validated.rationale || existing.rationale,
            sourceReferences: newRefs,
            timesValidated: existing.timesValidated + 1,
            lastValidated: new Date(),
          },
        });
      } else {
        await prisma.stylePrinciple.create({
          data: {
            id: validated.id,
            contextJson: validated.context as unknown as object,
            recommendations: validated.recommendations as unknown as object,
            rationale: validated.rationale,
            sourceReferences: validated.sourceReferences,
          },
        });
      }
      count++;
    } catch (error) {
      console.warn(`[StyleMiner] Failed to upsert principle ${validated.id}:`, error);
    }
  }

  return count;
}

// =============================================================================
// MAIN MINING FUNCTION
// =============================================================================

async function mineUrl(
  url: string,
  groupName: string
): Promise<{ recipesCount: number; principlesCount: number; error?: string }> {
  try {
    console.log(`[StyleMiner] Mining: ${url}`);

    const result = await mineUrlWithPerplexity(url, groupName);

    const recipesCount = await upsertRecipes(result.recipes, groupName, url);
    const principlesCount = await upsertPrinciples(result.principles, url);

    return { recipesCount, principlesCount };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return { recipesCount: 0, principlesCount: 0, error: errorMsg };
  }
}

/**
 * Run the style miner
 * @param passes Number of passes over all URLs
 * @param group Source group to mine ('all', 'design_guides', 'template_galleries', 'market_examples')
 * @param onProgress Optional callback for progress updates
 */
export async function runStyleMiner(
  passes: number = 1,
  group: string = 'all',
  onProgress?: ProgressCallback
): Promise<MiningResult> {
  console.log(`[StyleMiner] Starting mining (${passes} passes, group: ${group})`);

  // Check API key
  if (!process.env.PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY environment variable is not set');
  }

  const sources = loadSources();
  const urls = getUrlsForGroups(sources, group);

  if (urls.length === 0) {
    throw new Error(`No URLs found for group: ${group}`);
  }

  console.log(`[StyleMiner] Found ${urls.length} URLs to mine`);

  const startTime = Date.now();
  let totalRecipes = 0;
  let totalPrinciples = 0;
  let totalErrors = 0;

  for (let pass = 1; pass <= passes; pass++) {
    console.log(`[StyleMiner] Pass ${pass}/${passes}`);

    for (let i = 0; i < urls.length; i++) {
      const { url, group: urlGroup } = urls[i];

      // Report progress
      if (onProgress) {
        onProgress({
          pass,
          totalPasses: passes,
          urlIndex: i + 1,
          totalUrls: urls.length,
          currentUrl: url,
          currentGroup: urlGroup,
          recipesFound: totalRecipes,
          principlesFound: totalPrinciples,
        });
      }

      const result = await mineUrl(url, urlGroup);

      if (result.error) {
        console.error(`[StyleMiner] Error mining ${url}: ${result.error}`);
        totalErrors++;
        if (onProgress) {
          onProgress({
            pass,
            totalPasses: passes,
            urlIndex: i + 1,
            totalUrls: urls.length,
            currentUrl: url,
            currentGroup: urlGroup,
            recipesFound: totalRecipes,
            principlesFound: totalPrinciples,
            error: result.error,
          });
        }
      } else {
        console.log(`[StyleMiner] ${url}: +${result.recipesCount} recipes, +${result.principlesCount} principles`);
        totalRecipes += result.recipesCount;
        totalPrinciples += result.principlesCount;
      }

      // Rate limiting between requests
      if (i < urls.length - 1) {
        await delay(REQUEST_DELAY_MS);
      }
    }
  }

  // Get final database counts
  const finalRecipeCount = await prisma.styleRecipeLibrary.count();
  const finalPrincipleCount = await prisma.stylePrinciple.count();

  const duration = Date.now() - startTime;
  console.log(`[StyleMiner] Complete in ${duration}ms. DB totals: ${finalRecipeCount} recipes, ${finalPrincipleCount} principles`);

  return {
    totalRecipes,
    totalPrinciples,
    totalErrors,
    duration,
    dbTotals: {
      recipes: finalRecipeCount,
      principles: finalPrincipleCount,
    },
  };
}

/**
 * Get current status of style intelligence database
 */
export async function getStyleMinerStatus(): Promise<{
  recipeCount: number;
  principleCount: number;
  avgConfidence: number;
  categoryBreakdown: Array<{ category: string; count: number }>;
  sourceConfig: { design_guides: number; template_galleries: number; inspiration_galleries: number; market_examples: number };
  recommendation: string;
}> {
  const recipeCount = await prisma.styleRecipeLibrary.count();
  const principleCount = await prisma.stylePrinciple.count();

  const avgConfidenceResult = await prisma.styleRecipeLibrary.aggregate({
    _avg: { confidence: true },
  });

  const categoryBreakdown = await prisma.styleRecipeLibrary.groupBy({
    by: ['category'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  let sourceConfig = { design_guides: 0, template_galleries: 0, inspiration_galleries: 0, market_examples: 0 };
  try {
    const sources = loadSources();
    sourceConfig = {
      design_guides: sources.design_guides.length,
      template_galleries: sources.template_galleries.length,
      inspiration_galleries: sources.inspiration_galleries?.length || 0,
      market_examples: sources.market_examples.length,
    };
  } catch {
    // Config not found, use defaults
  }

  let recommendation: string;
  if (recipeCount < 10) {
    recommendation = 'Run style-miner:warmup to populate the database';
  } else if (recipeCount < 50) {
    recommendation = 'Good start! Consider running more passes for better coverage';
  } else {
    recommendation = 'Database is well-populated. Periodic refreshes recommended.';
  }

  return {
    recipeCount,
    principleCount,
    avgConfidence: avgConfidenceResult._avg.confidence || 0,
    categoryBreakdown: categoryBreakdown.map(c => ({
      category: c.category,
      count: c._count.id,
    })),
    sourceConfig,
    recommendation,
  };
}
