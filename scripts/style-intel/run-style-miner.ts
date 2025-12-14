#!/usr/bin/env npx tsx
/**
 * Style Miner CLI
 *
 * A standalone job that mines design knowledge from configured URLs and populates
 * the StyleRecipeLibrary and StylePrinciple tables.
 *
 * Run from console:
 *   npx tsx scripts/style-intel/run-style-miner.ts
 *   npx tsx scripts/style-intel/run-style-miner.ts --passes=3
 *   npx tsx scripts/style-intel/run-style-miner.ts --group=design_guides
 *   npx tsx scripts/style-intel/run-style-miner.ts --status
 *
 * Or with npm script:
 *   npm run style-miner:warmup    # 3 passes, all groups
 *   npm run style-miner:once      # 1 pass, all groups
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { prisma } from '../../lib/prisma';
import type {
  StyleRecipe,
  StylePrinciple,
  StyleIntelSources,
  SourceGroup,
  LLMMiningResponse,
} from '../../lib/style-intel/types';

// =============================================================================
// CLI UTILITIES
// =============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}[StyleMiner]${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}[StyleMiner]${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}[StyleMiner]${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}[StyleMiner]${colors.reset} ${msg}`),
  header: (msg: string) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
  dim: (msg: string) => console.log(`${colors.dim}[StyleMiner] ${msg}${colors.reset}`),
};

// Parse CLI arguments
const args = process.argv.slice(2);

function getArg(name: string, defaultValue: string): string {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : defaultValue;
}

const isHelp = args.includes('--help') || args.includes('-h');
const isStatus = args.includes('--status') || args.includes('-s');
const passes = parseInt(getArg('passes', '1'), 10);
const groupArg = getArg('group', 'all');

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG_PATH = join(process.cwd(), 'config', 'style-intel-sources.json');
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const PERPLEXITY_MODEL = 'sonar'; // Fast, cost-effective model

// Timeout for API calls (2 minutes)
const API_TIMEOUT_MS = 120000;

// Rate limiting between requests (ms)
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
// CORE FUNCTIONS
// =============================================================================

/**
 * Load source configuration from JSON file
 */
function loadSources(): StyleIntelSources {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as StyleIntelSources;
  } catch (error) {
    log.error(`Failed to load sources from ${CONFIG_PATH}: ${error}`);
    process.exit(1);
  }
}

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout
 */
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
 * Call Perplexity API to mine a URL for style intelligence
 */
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
        temperature: 0.3, // Lower temperature for more consistent structured output
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
    log.warn(`Failed to parse JSON from response for ${url}`);
    return { recipes: [], principles: [] };
  }
}

/**
 * Validate and normalize a StyleRecipe
 */
function validateRecipe(recipe: StyleRecipe, url: string): StyleRecipe | null {
  // Basic validation
  if (!recipe.meta?.id || !recipe.meta?.displayName || !recipe.meta?.category) {
    return null;
  }
  if (!recipe.typography?.fontCategory || !recipe.layout?.composition || !recipe.color?.schemeType) {
    return null;
  }

  // Normalize
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

/**
 * Validate and normalize a StylePrinciple
 */
function validatePrinciple(principle: StylePrinciple, url: string): StylePrinciple | null {
  // Basic validation
  if (!principle.id || !principle.context || !principle.recommendations) {
    return null;
  }

  // Normalize and ensure source reference includes the mined URL
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

/**
 * Upsert recipes to database
 */
async function upsertRecipes(
  recipes: StyleRecipe[],
  sourceType: string,
  url: string
): Promise<number> {
  let count = 0;

  for (const recipe of recipes) {
    const validated = validateRecipe(recipe, url);
    if (!validated) continue;

    try {
      // Check if recipe already exists by category + displayName
      const existing = await prisma.styleRecipeLibrary.findFirst({
        where: {
          displayName: validated.meta.displayName,
          category: validated.meta.category,
        },
      });

      if (existing) {
        // Update existing - merge references and increment validation count
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
            confidence: Math.min(0.95, existing.confidence + 0.1), // Increase confidence on validation
            lastValidated: new Date(),
          },
        });
      } else {
        // Create new
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
      log.warn(`Failed to upsert recipe ${validated.meta.displayName}: ${error}`);
    }
  }

  return count;
}

/**
 * Upsert principles to database
 */
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
        // Merge source references
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
      log.warn(`Failed to upsert principle ${validated.id}: ${error}`);
    }
  }

  return count;
}

/**
 * Mine a single URL and store results
 */
async function mineUrl(
  url: string,
  groupName: string
): Promise<{ recipesCount: number; principlesCount: number; error?: string }> {
  try {
    log.dim(`Mining: ${url}`);

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
 * Get URLs for selected groups
 */
function getUrlsForGroups(
  sources: StyleIntelSources,
  group: string
): Array<{ url: string; group: SourceGroup }> {
  const allGroups: SourceGroup[] = ['design_guides', 'template_galleries', 'market_examples'];
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
// STATUS COMMAND
// =============================================================================

async function showStatus(): Promise<void> {
  log.header('Style Intelligence Database Status');

  try {
    const recipeCount = await prisma.styleRecipeLibrary.count();
    const principleCount = await prisma.stylePrinciple.count();

    const recipeCategoryCounts = await prisma.styleRecipeLibrary.groupBy({
      by: ['category'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const avgRecipeConfidence = await prisma.styleRecipeLibrary.aggregate({
      _avg: { confidence: true },
    });

    console.log(`${colors.bright}Database Stats:${colors.reset}`);
    console.log(`  Total Recipes: ${recipeCount}`);
    console.log(`  Total Principles: ${principleCount}`);
    console.log(`  Avg Recipe Confidence: ${(avgRecipeConfidence._avg.confidence || 0).toFixed(2)}`);

    if (recipeCategoryCounts.length > 0) {
      console.log(`\n${colors.bright}Recipes by Category:${colors.reset}`);
      for (const cat of recipeCategoryCounts) {
        console.log(`  ${cat.category.padEnd(25)} ${cat._count.id}`);
      }
    }

    // Show recent updates
    const recentRecipes = await prisma.styleRecipeLibrary.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { displayName: true, updatedAt: true, confidence: true },
    });

    if (recentRecipes.length > 0) {
      console.log(`\n${colors.bright}Recently Updated Recipes:${colors.reset}`);
      for (const r of recentRecipes) {
        const date = r.updatedAt.toISOString().split('T')[0];
        console.log(`  ${r.displayName.padEnd(30)} ${date} (conf: ${r.confidence.toFixed(2)})`);
      }
    }

    // Load sources and show coverage
    const sources = loadSources();
    const totalUrls =
      sources.design_guides.length +
      sources.template_galleries.length +
      sources.market_examples.length;

    console.log(`\n${colors.bright}Source Configuration:${colors.reset}`);
    console.log(`  Design Guides: ${sources.design_guides.length} URLs`);
    console.log(`  Template Galleries: ${sources.template_galleries.length} URLs`);
    console.log(`  Market Examples: ${sources.market_examples.length} URLs`);
    console.log(`  Total: ${totalUrls} URLs`);

    console.log(`\n${colors.bright}Recommendation:${colors.reset}`);
    if (recipeCount < 10) {
      console.log(`  ${colors.yellow}Run 'npm run style-miner:warmup' to populate the database${colors.reset}`);
    } else if (recipeCount < 50) {
      console.log(`  ${colors.blue}Good start! Consider running more passes for better coverage${colors.reset}`);
    } else {
      console.log(`  ${colors.green}Database is well-populated. Periodic refreshes recommended.${colors.reset}`);
    }
  } catch (error) {
    log.error(`Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// =============================================================================
// HELP COMMAND
// =============================================================================

function showHelp(): void {
  console.log(`
${colors.bright}Style Miner CLI${colors.reset}

Mines design knowledge from configured URLs and populates the style intelligence database.
This is a standalone job that can be run multiple times safely.

${colors.bright}Usage:${colors.reset}
  npx tsx scripts/style-intel/run-style-miner.ts [options]

${colors.bright}Options:${colors.reset}
  --status, -s           Show database status (no mining)
  --passes=N             Number of passes over all URLs (default: 1)
  --group=GROUP          Mine only specific group: design_guides | template_galleries | market_examples | all
  --help, -h             Show this help message

${colors.bright}Examples:${colors.reset}
  # Check database status
  npx tsx scripts/style-intel/run-style-miner.ts --status

  # Single pass over all sources
  npx tsx scripts/style-intel/run-style-miner.ts

  # Warmup with 3 passes (recommended for initial population)
  npx tsx scripts/style-intel/run-style-miner.ts --passes=3

  # Mine only design guides
  npx tsx scripts/style-intel/run-style-miner.ts --group=design_guides

${colors.bright}npm Scripts:${colors.reset}
  npm run style-miner:warmup    # 3 passes, all groups
  npm run style-miner:once      # 1 pass, all groups
`);
}

// =============================================================================
// MAIN MINING LOGIC
// =============================================================================

async function runMiner(): Promise<void> {
  log.header(`Style Miner (${passes} pass${passes > 1 ? 'es' : ''}, group: ${groupArg})`);

  // Check API key
  if (!process.env.PERPLEXITY_API_KEY) {
    log.error('PERPLEXITY_API_KEY environment variable is not set');
    process.exit(1);
  }

  const sources = loadSources();
  const urls = getUrlsForGroups(sources, groupArg);

  if (urls.length === 0) {
    log.warn(`No URLs found for group: ${groupArg}`);
    return;
  }

  log.info(`Found ${urls.length} URLs to mine`);
  log.info(`Estimated time: ${Math.ceil((urls.length * passes * (API_TIMEOUT_MS / 1000 + REQUEST_DELAY_MS / 1000)) / 60)} minutes (max)\n`);

  const startTime = Date.now();
  let totalRecipes = 0;
  let totalPrinciples = 0;
  let totalErrors = 0;

  for (let pass = 1; pass <= passes; pass++) {
    log.header(`Pass ${pass}/${passes}`);

    for (let i = 0; i < urls.length; i++) {
      const { url, group } = urls[i];
      const progress = `[${i + 1}/${urls.length}]`;

      process.stdout.write(`\r${colors.dim}${progress} Processing...${colors.reset}`.padEnd(80));

      const result = await mineUrl(url, group);

      if (result.error) {
        console.log(`\r${colors.red}${progress}${colors.reset} ${group}: ${url}`);
        console.log(`    ${colors.red}Error: ${result.error}${colors.reset}`);
        totalErrors++;
      } else {
        console.log(
          `\r${colors.green}${progress}${colors.reset} ${group}: ${colors.dim}${url.substring(0, 50)}...${colors.reset}`
        );
        console.log(
          `    ${colors.green}+${result.recipesCount} recipes, +${result.principlesCount} principles${colors.reset}`
        );
        totalRecipes += result.recipesCount;
        totalPrinciples += result.principlesCount;
      }

      // Rate limiting
      if (i < urls.length - 1) {
        await delay(REQUEST_DELAY_MS);
      }
    }
  }

  // Summary
  const duration = Math.round((Date.now() - startTime) / 1000);
  const finalRecipeCount = await prisma.styleRecipeLibrary.count();
  const finalPrincipleCount = await prisma.stylePrinciple.count();

  log.header('Mining Complete');
  console.log(`${colors.bright}Results:${colors.reset}`);
  console.log(`  Recipes upserted this run: ${totalRecipes}`);
  console.log(`  Principles upserted this run: ${totalPrinciples}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log(`  Duration: ${duration}s`);
  console.log(`\n${colors.bright}Database Totals:${colors.reset}`);
  console.log(`  Total Recipes: ${finalRecipeCount}`);
  console.log(`  Total Principles: ${finalPrincipleCount}`);

  if (totalErrors > 0) {
    log.warn(`${totalErrors} URLs failed. Consider re-running to retry.`);
  }

  log.success('Done!');
}

// =============================================================================
// ENTRY POINT
// =============================================================================

async function main(): Promise<void> {
  if (isHelp) {
    showHelp();
    return;
  }

  if (isStatus) {
    await showStatus();
    return;
  }

  await runMiner();
}

main()
  .catch(error => {
    log.error(`Fatal error: ${error.message}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
