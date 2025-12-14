/**
 * Style Discovery Engine
 *
 * Uses Claude Vision to analyze actual Merch by Amazon product images
 * and discover niche-specific style characteristics.
 *
 * This is the KEY INNOVATION: Instead of hardcoding "fishing = rustic" or
 * "nurses = medical blue", we DISCOVER what actually sells by analyzing
 * real successful products.
 *
 * ARCHITECTURE:
 * 1. Fetch MBA products for a niche from database
 * 2. Download/encode their images
 * 3. Use Claude Vision to analyze typography, colors, layouts, aesthetics
 * 4. Aggregate findings into a NicheStyleProfile
 * 5. Store profile for use during design generation
 *
 * STYLE INTELLIGENCE INTEGRATION:
 * This agent is a VISUAL PATTERN DISCOVERER, not the final style authority.
 * When STYLE_INTEL_MERCH_ENABLED is true:
 * - StyleIntelService uses our discovered patterns as input signals
 * - We provide evidence of what's working visually in the market
 * - StyleRecipes are pre-mined design templates with proven characteristics
 * - StyleIntelService matches our discoveries to appropriate recipes
 *
 * This agent should focus on:
 * - Extracting OBSERVABLE patterns from real product images
 * - Identifying dominant typography styles, color moods, layouts
 * - Building confidence scores based on consistency across samples
 * - Providing rich context that helps StyleIntel select better recipes
 *
 * It should NOT try to:
 * - Prescribe specific design specifications
 * - Override StyleRecipe decisions when STYLE_INTEL is enabled
 * - Make final decisions about halftone density, shadow parameters, etc.
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { NicheStyleProfile } from './types';

// Initialize Anthropic client
const getAnthropicClient = (): Anthropic => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }
  return new Anthropic({ apiKey });
};

/**
 * Result of analyzing a single product image
 */
interface ProductImageAnalysis {
  asin: string;
  success: boolean;

  // Extracted style information
  typography?: {
    style: string;        // e.g., "bold sans-serif", "vintage script"
    weight: string;       // e.g., "bold", "regular", "light"
    effects: string[];    // e.g., ["distressed", "shadow", "outline"]
    hasText: boolean;
    extractedText?: string;
  };

  colors?: {
    primary: string[];    // Main colors used in design
    accent: string[];     // Supporting/accent colors
    shirtColor: string;   // Detected shirt color
    mood: string;         // e.g., "warm", "cool", "neutral", "vibrant"
  };

  layout?: {
    composition: string;  // e.g., "centered", "left-aligned", "stacked"
    textPlacement: string;
    hasIllustration: boolean;
    illustrationStyle?: string;
    iconPresent: boolean;
    iconStyle?: string;
  };

  aesthetic?: {
    primary: string;      // Main aesthetic descriptor
    keywords: string[];   // Descriptive keywords
    mood: string;         // Emotional mood
    quality: 'professional' | 'amateur' | 'mixed';
  };

  // Error information if analysis failed
  error?: string;
}

/**
 * Aggregated style analysis for a niche
 */
interface AggregatedStyleAnalysis {
  niche: string;
  sampleSize: number;
  analyzedProducts: ProductImageAnalysis[];

  // Aggregated patterns
  typography: {
    dominant: string[];     // Most common typography styles
    successful: string[];   // Styles from top-performing products
    avoided: string[];      // Styles rarely seen
  };

  colors: {
    common: string[];
    successful: string[];
    byShirtColor: Record<string, string[]>;
    dominantMood: string;
  };

  layout: {
    compositions: string[];
    textPlacements: string[];
    iconUsageRate: number;
    iconStyles: string[];
    illustrationRate: number;
    illustrationStyles: string[];
  };

  aesthetic: {
    primary: string[];
    secondary: string[];
    avoided: string[];
    overallMood: string;
  };
}

/**
 * Discover style characteristics for a specific niche
 * by analyzing actual MBA product images
 */
export async function discoverNicheStyle(
  niche: string,
  options: {
    sampleSize?: number;
    prioritizeTopSellers?: boolean;
    includeRecent?: boolean;
  } = {}
): Promise<NicheStyleProfile | null> {
  const {
    sampleSize = 20,
    prioritizeTopSellers = true,
    includeRecent = true
  } = options;

  console.log(`[StyleDiscovery] Starting style discovery for niche: "${niche}"`);

  try {
    // Step 1: Fetch MBA products for this niche
    const products = await fetchMBAProductsForNiche(niche, {
      limit: sampleSize,
      prioritizeTopSellers,
      includeRecent
    });

    if (products.length === 0) {
      console.log(`[StyleDiscovery] No MBA products found for niche: "${niche}"`);
      return null;
    }

    console.log(`[StyleDiscovery] Found ${products.length} MBA products to analyze`);

    // Step 2: Analyze each product image
    const analyses = await analyzeProductImages(products);
    const successfulAnalyses = analyses.filter(a => a.success);

    if (successfulAnalyses.length < 3) {
      console.log(`[StyleDiscovery] Insufficient successful analyses (${successfulAnalyses.length})`);
      return null;
    }

    console.log(`[StyleDiscovery] Successfully analyzed ${successfulAnalyses.length} products`);

    // Step 3: Aggregate findings
    const aggregated = aggregateAnalyses(niche, successfulAnalyses);

    // Step 4: Build and store the NicheStyleProfile
    const profile = await buildAndStoreProfile(aggregated, products.map(p => p.externalId));

    console.log(`[StyleDiscovery] Created style profile for "${niche}" with ${profile.confidence * 100}% confidence`);

    return profile;

  } catch (error) {
    console.error(`[StyleDiscovery] Error discovering style for "${niche}":`, error);
    return null;
  }
}

/**
 * Fetch MBA products from database for a specific niche/phrase
 *
 * Priority:
 * 1. If phrase provided, search by phrase first (more specific)
 * 2. Fall back to niche search if phrase yields insufficient results
 * 3. Combine phrase + niche for maximum relevance
 */
async function fetchMBAProductsForNiche(
  niche: string,
  options: {
    limit: number;
    prioritizeTopSellers: boolean;
    includeRecent: boolean;
    phrase?: string;  // NEW: specific phrase/trend to search for
  }
): Promise<Array<{
  id: string;
  externalId: string;
  imageUrl: string | null;
  reviewCount: number;
  avgRating: any;
  salesRank: number | null;
  isTopSeller: boolean;
}>> {
  // Build search terms - prioritize phrase if provided
  const searchTerms: string[] = [];

  if (options.phrase) {
    // Extract key terms from phrase for more targeted search
    const phraseWords = options.phrase.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    searchTerms.push(options.phrase); // Full phrase
    // Add key combinations (e.g., "Fishing Dad" -> search for both together)
    if (phraseWords.length >= 2) {
      searchTerms.push(phraseWords.slice(0, 2).join(' ')); // First two words
    }
  }
  searchTerms.push(niche); // Always include niche as fallback

  // Build OR conditions for each search term
  const searchConditions = searchTerms.flatMap(term => [
    { title: { contains: term, mode: 'insensitive' as const } },
    { niche: { contains: term, mode: 'insensitive' as const } },
    { category: { contains: term, mode: 'insensitive' as const } }
  ]);

  const where: any = {
    isMerchByAmazon: true,
    imageUrl: { not: null },
    OR: searchConditions
  };

  // Build order by based on options
  const orderBy: any[] = [];
  if (options.prioritizeTopSellers) {
    orderBy.push({ isTopSeller: 'desc' });
    orderBy.push({ reviewCount: 'desc' });
  }
  if (options.includeRecent) {
    orderBy.push({ lastScrapedAt: 'desc' });
  }

  const products = await prisma.marketplaceProduct.findMany({
    where,
    orderBy,
    take: options.limit,
    select: {
      id: true,
      externalId: true,
      imageUrl: true,
      reviewCount: true,
      avgRating: true,
      salesRank: true,
      isTopSeller: true
    }
  });

  return products;
}

/**
 * Analyze multiple product images using Claude Vision
 */
async function analyzeProductImages(
  products: Array<{
    id: string;
    externalId: string;
    imageUrl: string | null;
    isTopSeller: boolean;
  }>
): Promise<ProductImageAnalysis[]> {
  const client = getAnthropicClient();
  const results: ProductImageAnalysis[] = [];

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    const batchPromises = batch.map(async (product) => {
      if (!product.imageUrl) {
        return {
          asin: product.externalId,
          success: false,
          error: 'No image URL available'
        };
      }

      try {
        const analysis = await analyzeSingleImage(client, product.imageUrl, product.externalId, product.isTopSeller);
        return analysis;
      } catch (error) {
        return {
          asin: product.externalId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Small delay between batches to be respectful of rate limits
    if (i + batchSize < products.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}

/**
 * Analyze a single product image using Claude Vision
 */
async function analyzeSingleImage(
  client: Anthropic,
  imageUrl: string,
  asin: string,
  isTopSeller: boolean
): Promise<ProductImageAnalysis> {
  console.log(`[StyleDiscovery] Analyzing image for ASIN: ${asin}`);

  try {
    // Fetch the image and convert to base64
    const imageData = await fetchImageAsBase64(imageUrl);

    if (!imageData) {
      return {
        asin,
        success: false,
        error: 'Failed to fetch image'
      };
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageData.mediaType,
              data: imageData.base64
            }
          },
          {
            type: 'text',
            text: `Analyze this t-shirt design image. Extract style PATTERNS and CHARACTERISTICS for a design intelligence system.

YOUR ROLE: You are discovering WHAT'S WORKING in the market, not making final design decisions.
Your observations will be aggregated across many products to identify patterns.
A downstream Style Intelligence system will use these patterns to select appropriate design recipes.

Focus on OBSERVABLE patterns, not prescriptive specifications.

Return ONLY valid JSON with this exact structure:
{
  "typography": {
    "style": "describe the typography approach (e.g., 'bold blocky sans-serif', 'vintage script with wear', 'distressed block letters')",
    "weight": "bold|medium|light|varied",
    "effects": ["list", "of", "observed effects", "like distressed, shadow, outline, gradient"],
    "hasText": true/false,
    "extractedText": "the actual text on the design if readable"
  },
  "colors": {
    "primary": ["main colors observed"],
    "accent": ["supporting colors observed"],
    "shirtColor": "detected shirt/background color",
    "mood": "warm|cool|neutral|vibrant|muted|earthy"
  },
  "layout": {
    "composition": "centered|left|right|full-width|stacked|diagonal",
    "textPlacement": "top|center|bottom|scattered",
    "hasIllustration": true/false,
    "illustrationStyle": "if present: simple line art|detailed|cartoon|realistic|none",
    "iconPresent": true/false,
    "iconStyle": "if present: minimal|detailed|integrated with text"
  },
  "aesthetic": {
    "primary": "main aesthetic observed (e.g., 'vintage americana', 'modern minimalist', 'playful cartoon')",
    "keywords": ["list", "of", "style", "keywords", "that describe what you see"],
    "mood": "the emotional feel (funny, serious, heartfelt, edgy, professional)",
    "quality": "professional|amateur|mixed"
  }
}

Be specific and descriptive about what you OBSERVE. Focus on patterns that could inform style recipe selection.`
          }
        ]
      }]
    });

    // Extract JSON from response
    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return {
        asin,
        success: false,
        error: 'No text response from Claude'
      };
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        asin,
        success: false,
        error: 'No JSON in response'
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      asin,
      success: true,
      typography: parsed.typography,
      colors: parsed.colors,
      layout: parsed.layout,
      aesthetic: parsed.aesthetic
    };

  } catch (error) {
    console.error(`[StyleDiscovery] Error analyzing image for ${asin}:`, error);
    return {
      asin,
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed'
    };
  }
}

/**
 * Fetch an image from URL and convert to base64
 */
async function fetchImageAsBase64(
  url: string
): Promise<{ base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[StyleDiscovery] Failed to fetch image: ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Determine media type
    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';
    if (contentType.includes('png')) mediaType = 'image/png';
    else if (contentType.includes('gif')) mediaType = 'image/gif';
    else if (contentType.includes('webp')) mediaType = 'image/webp';

    return { base64, mediaType };
  } catch (error) {
    console.error('[StyleDiscovery] Error fetching image:', error);
    return null;
  }
}

/**
 * Aggregate individual analyses into patterns
 */
function aggregateAnalyses(
  niche: string,
  analyses: ProductImageAnalysis[]
): AggregatedStyleAnalysis {
  // Count occurrences of various style elements
  const typographyStyles: Record<string, number> = {};
  const typographyEffects: Record<string, number> = {};
  const colorPrimary: Record<string, number> = {};
  const colorAccent: Record<string, number> = {};
  const shirtColors: Record<string, Record<string, string[]>> = {};
  const colorMoods: Record<string, number> = {};
  const compositions: Record<string, number> = {};
  const textPlacements: Record<string, number> = {};
  const iconStyles: Record<string, number> = {};
  const illustrationStyles: Record<string, number> = {};
  const aestheticPrimary: Record<string, number> = {};
  const aestheticKeywords: Record<string, number> = {};
  const aestheticMoods: Record<string, number> = {};

  let iconCount = 0;
  let illustrationCount = 0;

  for (const analysis of analyses) {
    // Typography
    if (analysis.typography) {
      increment(typographyStyles, analysis.typography.style);
      if (analysis.typography.effects) {
        for (const effect of analysis.typography.effects) {
          increment(typographyEffects, effect);
        }
      }
    }

    // Colors
    if (analysis.colors) {
      for (const color of analysis.colors.primary || []) {
        increment(colorPrimary, normalizeColor(color));
      }
      for (const color of analysis.colors.accent || []) {
        increment(colorAccent, normalizeColor(color));
      }
      increment(colorMoods, analysis.colors.mood);

      // Track colors by shirt color
      const shirtColor = normalizeColor(analysis.colors.shirtColor || 'unknown');
      if (!shirtColors[shirtColor]) {
        shirtColors[shirtColor] = {};
      }
      for (const color of analysis.colors.primary || []) {
        const normalizedColor = normalizeColor(color);
        if (!shirtColors[shirtColor][normalizedColor]) {
          shirtColors[shirtColor][normalizedColor] = [];
        }
        shirtColors[shirtColor][normalizedColor].push(analysis.asin);
      }
    }

    // Layout
    if (analysis.layout) {
      increment(compositions, analysis.layout.composition);
      increment(textPlacements, analysis.layout.textPlacement);

      if (analysis.layout.iconPresent) {
        iconCount++;
        if (analysis.layout.iconStyle) {
          increment(iconStyles, analysis.layout.iconStyle);
        }
      }

      if (analysis.layout.hasIllustration) {
        illustrationCount++;
        if (analysis.layout.illustrationStyle) {
          increment(illustrationStyles, analysis.layout.illustrationStyle);
        }
      }
    }

    // Aesthetic
    if (analysis.aesthetic) {
      increment(aestheticPrimary, analysis.aesthetic.primary);
      increment(aestheticMoods, analysis.aesthetic.mood);
      for (const keyword of analysis.aesthetic.keywords || []) {
        increment(aestheticKeywords, keyword.toLowerCase());
      }
    }
  }

  // Build aggregated result
  const total = analyses.length;

  return {
    niche,
    sampleSize: total,
    analyzedProducts: analyses,

    typography: {
      dominant: getTopItems(typographyStyles, 3),
      successful: getTopItems(typographyStyles, 5), // Could filter by isTopSeller
      avoided: [] // Styles not seen
    },

    colors: {
      common: getTopItems(colorPrimary, 5),
      successful: getTopItems(colorPrimary, 5),
      byShirtColor: Object.fromEntries(
        Object.entries(shirtColors).map(([shirt, colors]) => [
          shirt,
          Object.keys(colors).slice(0, 5)
        ])
      ),
      dominantMood: getTopItem(colorMoods) || 'neutral'
    },

    layout: {
      compositions: getTopItems(compositions, 3),
      textPlacements: getTopItems(textPlacements, 3),
      iconUsageRate: iconCount / total,
      iconStyles: getTopItems(iconStyles, 3),
      illustrationRate: illustrationCount / total,
      illustrationStyles: getTopItems(illustrationStyles, 3)
    },

    aesthetic: {
      primary: getTopItems(aestheticPrimary, 3),
      secondary: getTopItems(aestheticKeywords, 10),
      avoided: [], // Could be determined by what's NOT seen
      overallMood: getTopItem(aestheticMoods) || 'varied'
    }
  };
}

/**
 * Build NicheStyleProfile and store in database
 */
async function buildAndStoreProfile(
  aggregated: AggregatedStyleAnalysis,
  sampleAsins: string[]
): Promise<NicheStyleProfile> {
  const confidence = calculateConfidence(aggregated);

  // Build the profile object for the types.ts interface
  const profile: NicheStyleProfile = {
    niche: aggregated.niche,
    sampleSize: aggregated.sampleSize,
    lastAnalyzed: new Date(),
    confidence,

    dominantTypography: {
      primary: aggregated.typography.dominant[0] || 'bold sans-serif',
      secondary: aggregated.typography.dominant[1],
      examples: aggregated.typography.successful
    },

    colorPalette: {
      primary: aggregated.colors.common,
      accent: [], // Could be derived
      background: Object.keys(aggregated.colors.byShirtColor),
      seasonalVariants: undefined
    },

    layoutPatterns: {
      dominant: aggregated.layout.compositions[0] || 'centered',
      alternatives: aggregated.layout.compositions.slice(1),
      textPlacement: aggregated.layout.textPlacements[0] || 'centered',
      iconUsage: aggregated.layout.iconUsageRate > 0.5 ? 'common' :
                 aggregated.layout.iconUsageRate > 0.2 ? 'rare' : 'none'
    },

    illustrationStyle: {
      dominant: aggregated.layout.illustrationRate > 0.3
        ? (aggregated.layout.illustrationStyles[0] || 'simple')
        : 'none',
      subjectMatter: aggregated.aesthetic.secondary.slice(0, 5)
    },

    moodAesthetic: {
      primary: aggregated.aesthetic.primary[0] || 'modern',
      secondary: aggregated.aesthetic.primary[1],
      avoid: aggregated.aesthetic.avoided
    }
  };

  // Store in database
  await prisma.nicheStyleProfile.upsert({
    where: { niche: aggregated.niche },
    update: {
      version: { increment: 1 },
      sampleSize: aggregated.sampleSize,
      sourceSampleIds: sampleAsins,
      confidence,

      typographyDominant: aggregated.typography.dominant,
      typographySuccessful: aggregated.typography.successful,
      typographyAvoided: aggregated.typography.avoided,

      colorPalettesCommon: aggregated.colors.common,
      colorPalettesSuccessful: aggregated.colors.successful,
      colorsByShirtColor: aggregated.colors.byShirtColor,

      moodPrimary: aggregated.aesthetic.primary,
      moodSecondary: aggregated.aesthetic.secondary,
      moodAvoided: aggregated.aesthetic.avoided,
      moodReference: `${aggregated.aesthetic.overallMood} ${aggregated.niche} aesthetic`,

      layoutCompositions: aggregated.layout.compositions,
      layoutTextPlacements: aggregated.layout.textPlacements,
      layoutIconUsage: aggregated.layout.iconUsageRate,
      layoutIconStyles: aggregated.layout.iconStyles,

      lastAnalyzedAt: new Date(),
      analysisCount: { increment: 1 }
    },
    create: {
      niche: aggregated.niche,
      sampleSize: aggregated.sampleSize,
      sourceSampleIds: sampleAsins,
      confidence,

      typographyDominant: aggregated.typography.dominant,
      typographySuccessful: aggregated.typography.successful,
      typographyAvoided: aggregated.typography.avoided,

      colorPalettesCommon: aggregated.colors.common,
      colorPalettesSuccessful: aggregated.colors.successful,
      colorsByShirtColor: aggregated.colors.byShirtColor,

      moodPrimary: aggregated.aesthetic.primary,
      moodSecondary: aggregated.aesthetic.secondary,
      moodAvoided: aggregated.aesthetic.avoided,
      moodReference: `${aggregated.aesthetic.overallMood} ${aggregated.niche} aesthetic`,

      layoutCompositions: aggregated.layout.compositions,
      layoutTextPlacements: aggregated.layout.textPlacements,
      layoutIconUsage: aggregated.layout.iconUsageRate,
      layoutIconStyles: aggregated.layout.iconStyles,

      audienceMotivations: [],
      relatedNiches: [],
      nicheBlendOpportunities: []
    }
  });

  console.log(`[StyleDiscovery] Stored profile for "${aggregated.niche}"`);

  return profile;
}

/**
 * Calculate confidence score based on sample size and consistency
 */
function calculateConfidence(aggregated: AggregatedStyleAnalysis): number {
  let confidence = 0;

  // Base confidence from sample size (max 0.4)
  const sampleFactor = Math.min(aggregated.sampleSize / 20, 1) * 0.4;
  confidence += sampleFactor;

  // Consistency in typography (max 0.15)
  if (aggregated.typography.dominant.length > 0) {
    confidence += 0.15;
  }

  // Consistency in colors (max 0.15)
  if (aggregated.colors.common.length >= 2) {
    confidence += 0.15;
  }

  // Consistency in layout (max 0.15)
  if (aggregated.layout.compositions.length > 0) {
    confidence += 0.15;
  }

  // Consistency in aesthetic (max 0.15)
  if (aggregated.aesthetic.primary.length > 0) {
    confidence += 0.15;
  }

  return Math.min(confidence, 1);
}

/**
 * Get style profile for a niche from database
 */
export async function getNicheStyleProfile(niche: string): Promise<NicheStyleProfile | null> {
  const stored = await prisma.nicheStyleProfile.findUnique({
    where: { niche }
  });

  if (!stored) return null;

  // Convert database model to NicheStyleProfile type
  return {
    niche: stored.niche,
    sampleSize: stored.sampleSize,
    lastAnalyzed: stored.lastAnalyzedAt,
    confidence: stored.confidence,

    dominantTypography: {
      primary: stored.typographyDominant[0] || 'bold sans-serif',
      secondary: stored.typographyDominant[1],
      examples: stored.typographySuccessful
    },

    colorPalette: {
      primary: stored.colorPalettesCommon,
      accent: stored.colorPalettesSuccessful,
      background: Object.keys((stored.colorsByShirtColor as Record<string, any>) || {}),
      seasonalVariants: undefined
    },

    layoutPatterns: {
      dominant: stored.layoutCompositions[0] || 'centered',
      alternatives: stored.layoutCompositions.slice(1),
      textPlacement: stored.layoutTextPlacements[0] || 'centered',
      iconUsage: stored.layoutIconUsage > 0.5 ? 'common' :
                 stored.layoutIconUsage > 0.2 ? 'rare' : 'none'
    },

    illustrationStyle: {
      dominant: stored.layoutIconStyles[0] || 'none',
      subjectMatter: stored.moodSecondary.slice(0, 5)
    },

    moodAesthetic: {
      primary: stored.moodPrimary[0] || 'modern',
      secondary: stored.moodPrimary[1],
      avoid: stored.moodAvoided
    }
  };
}

/**
 * Get or discover style profile for a niche
 * Uses cached profile if fresh enough, otherwise discovers new one
 */
export async function getOrDiscoverNicheStyle(
  niche: string,
  maxAgeHours: number = 168 // 1 week default
): Promise<NicheStyleProfile | null> {
  // Check for existing profile
  const stored = await prisma.nicheStyleProfile.findUnique({
    where: { niche }
  });

  if (stored) {
    const ageMs = Date.now() - stored.lastAnalyzedAt.getTime();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    if (ageMs < maxAgeMs) {
      console.log(`[StyleDiscovery] Using cached profile for "${niche}" (age: ${Math.round(ageMs / 3600000)}h)`);
      return getNicheStyleProfile(niche);
    }

    console.log(`[StyleDiscovery] Profile for "${niche}" is stale, refreshing...`);
  }

  // Discover new profile
  return discoverNicheStyle(niche);
}

/**
 * Discover styles for multiple niches (batch operation)
 */
export async function discoverStylesForNiches(
  niches: string[],
  options: {
    sampleSize?: number;
    concurrency?: number;
  } = {}
): Promise<Map<string, NicheStyleProfile | null>> {
  const { sampleSize = 15, concurrency = 3 } = options;
  const results = new Map<string, NicheStyleProfile | null>();

  // Process in batches
  for (let i = 0; i < niches.length; i += concurrency) {
    const batch = niches.slice(i, i + concurrency);

    const batchPromises = batch.map(async niche => {
      const profile = await discoverNicheStyle(niche, { sampleSize });
      return { niche, profile };
    });

    const batchResults = await Promise.all(batchPromises);
    for (const { niche, profile } of batchResults) {
      results.set(niche, profile);
    }

    // Delay between batches
    if (i + concurrency < niches.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return results;
}

/**
 * Get all niches that need style discovery (no profile or stale)
 */
export async function getNichesNeedingStyleDiscovery(
  maxAgeHours: number = 168
): Promise<string[]> {
  const cutoffDate = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

  // Get niches from NicheMarketData that don't have fresh profiles
  const nicheData = await prisma.nicheMarketData.findMany({
    where: {
      mbaProducts: { gt: 5 } // Only niches with enough MBA products
    },
    select: { niche: true }
  });

  const allNiches = nicheData.map(n => n.niche);

  // Check which have fresh profiles
  const freshProfiles = await prisma.nicheStyleProfile.findMany({
    where: {
      niche: { in: allNiches },
      lastAnalyzedAt: { gte: cutoffDate }
    },
    select: { niche: true }
  });

  const freshNiches = new Set(freshProfiles.map(p => p.niche));

  // Return niches that need discovery
  return allNiches.filter(niche => !freshNiches.has(niche));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function increment(obj: Record<string, number>, key: string | undefined | null) {
  if (!key) return;
  const normalized = key.toLowerCase().trim();
  obj[normalized] = (obj[normalized] || 0) + 1;
}

function getTopItems(obj: Record<string, number>, n: number): string[] {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => key);
}

function getTopItem(obj: Record<string, number>): string | undefined {
  const items = getTopItems(obj, 1);
  return items[0];
}

function normalizeColor(color: string): string {
  return color.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

// ============================================================================
// REAL-TIME STYLE ANALYSIS (For Live Requests)
// ============================================================================

/**
 * Lightweight real-time style intelligence
 * Used during generation requests when no cached profile exists
 */
export interface RealtimeStyleIntelligence {
  niche: string;
  sampleSize: number;
  analysisTimestamp: Date;

  // Quick style insights extracted from images
  typography: {
    dominant: string;        // Most common typography style
    effects: string[];       // Common effects (distressed, shadow, etc.)
  };

  colors: {
    primary: string[];       // Most common design colors
    shirtColors: string[];   // Most common shirt colors
    mood: string;            // Dominant color mood
  };

  layout: {
    composition: string;     // Dominant composition
    hasIcons: boolean;       // Whether icons are common
    hasIllustrations: boolean;
  };

  aesthetic: {
    primary: string;         // Main aesthetic descriptor
    keywords: string[];      // Style keywords
    mood: string;            // Emotional mood
  };

  // Source tracking
  source: 'realtime-vision';
  confidence: number;
}

/**
 * Perform real-time style analysis for a niche/phrase during a generation request.
 *
 * This is a FAST, LIGHTWEIGHT version of style discovery designed to run
 * during user requests. It analyzes only 3-5 images in parallel and returns
 * quick style insights.
 *
 * IMPORTANT: Now searches by phrase (if provided) for trend-relevant results,
 * and writes back learnings to database for continuous improvement.
 *
 * Use this when:
 * - No cached NicheStyleProfile exists
 * - Cached profile is stale but we need immediate results
 * - User needs style intelligence for a specific trend/phrase
 *
 * @param niche - The niche to analyze
 * @param options - Configuration options
 * @returns Quick style intelligence or null if insufficient data
 */
export async function analyzeNicheStyleRealtime(
  niche: string,
  options: {
    maxImages?: number;      // Max images to analyze (default: 5)
    timeoutMs?: number;      // Timeout per image (default: 8000)
    prioritizeTopSellers?: boolean;
    phrase?: string;         // NEW: specific phrase/trend for targeted search
    writeBack?: boolean;     // NEW: whether to write learnings to DB (default: true)
  } = {}
): Promise<RealtimeStyleIntelligence | null> {
  const {
    maxImages = 5,
    timeoutMs = 8000,
    prioritizeTopSellers = true,
    phrase,
    writeBack = true
  } = options;

  const startTime = Date.now();
  const searchContext = phrase ? `"${phrase}" in ${niche}` : `niche: "${niche}"`;
  console.log(`[RealtimeStyle] Starting real-time analysis for ${searchContext}`);

  try {
    // Step 1: Fetch a small sample of MBA products (fast query)
    // Now searches by phrase first for more relevant results
    const products = await fetchMBAProductsForNiche(niche, {
      limit: maxImages,
      prioritizeTopSellers,
      includeRecent: true,
      phrase  // Pass phrase for targeted search
    });

    if (products.length < 2) {
      console.log(`[RealtimeStyle] Insufficient products for "${niche}" (found ${products.length})`);
      return null;
    }

    console.log(`[RealtimeStyle] Found ${products.length} products, analyzing images...`);

    // Step 2: Analyze images in parallel with timeout
    const client = getAnthropicClient();
    const analysisPromises = products.map(product =>
      analyzeImageWithTimeout(client, product, timeoutMs)
    );

    const analyses = await Promise.all(analysisPromises);
    const successful = analyses.filter(a => a.success);

    if (successful.length < 2) {
      console.log(`[RealtimeStyle] Insufficient successful analyses (${successful.length})`);
      return null;
    }

    console.log(`[RealtimeStyle] Successfully analyzed ${successful.length}/${products.length} images`);

    // Step 3: Quick aggregation (simplified for speed)
    const intelligence = aggregateRealtimeAnalyses(niche, successful);

    // Step 4: Write back learnings to database (fire-and-forget, non-blocking)
    // This ensures every analysis contributes to our knowledge base
    if (writeBack) {
      writeBackRealtimeLearnings(niche, intelligence, products.map(p => p.externalId), phrase)
        .catch(err => console.warn(`[RealtimeStyle] Write-back failed:`, err));
    }

    const elapsed = Date.now() - startTime;
    console.log(`[RealtimeStyle] Completed in ${elapsed}ms with ${intelligence.confidence * 100}% confidence`);

    return intelligence;

  } catch (error) {
    console.error(`[RealtimeStyle] Error analyzing "${niche}":`, error);
    return null;
  }
}

/**
 * Write back realtime analysis learnings to database
 * Fire-and-forget - doesn't block the response
 */
async function writeBackRealtimeLearnings(
  niche: string,
  intelligence: RealtimeStyleIntelligence,
  analyzedAsins: string[],
  phrase?: string
): Promise<void> {
  console.log(`[RealtimeStyle] Writing back learnings for "${niche}"${phrase ? ` (phrase: "${phrase}")` : ''}`);

  try {
    // Check if profile exists
    const existing = await prisma.nicheStyleProfile.findUnique({
      where: { niche }
    });

    if (existing) {
      // Merge new learnings with existing profile
      // Use weighted averaging - existing data has more weight if higher sample size
      const existingWeight = Math.min(existing.sampleSize / 20, 1);
      const newWeight = Math.min(intelligence.sampleSize / 10, 0.5);

      await prisma.nicheStyleProfile.update({
        where: { niche },
        data: {
          // Merge typography - add new if not present
          typographyDominant: mergeArraysUnique(
            existing.typographyDominant,
            [intelligence.typography.dominant],
            5
          ),
          typographySuccessful: mergeArraysUnique(
            existing.typographySuccessful,
            intelligence.typography.effects,
            8
          ),

          // Merge colors
          colorPalettesCommon: mergeArraysUnique(
            existing.colorPalettesCommon,
            intelligence.colors.primary,
            8
          ),

          // Merge mood
          moodPrimary: mergeArraysUnique(
            existing.moodPrimary,
            [intelligence.aesthetic.primary],
            5
          ),
          moodSecondary: mergeArraysUnique(
            existing.moodSecondary,
            intelligence.aesthetic.keywords,
            10
          ),

          // Update metadata
          sampleSize: existing.sampleSize + intelligence.sampleSize,
          sourceSampleIds: mergeArraysUnique(
            existing.sourceSampleIds,
            analyzedAsins,
            50
          ),
          lastAnalyzedAt: new Date(),
          analysisCount: { increment: 1 },

          // Blend confidence - weighted average
          confidence: (existing.confidence * existingWeight + intelligence.confidence * newWeight) /
                      (existingWeight + newWeight)
        }
      });

      console.log(`[RealtimeStyle] Updated existing profile for "${niche}"`);

    } else {
      // Create new profile from realtime analysis
      await prisma.nicheStyleProfile.create({
        data: {
          niche,
          sampleSize: intelligence.sampleSize,
          sourceSampleIds: analyzedAsins,
          confidence: intelligence.confidence * 0.8, // Slightly lower for realtime-only

          typographyDominant: [intelligence.typography.dominant],
          typographySuccessful: intelligence.typography.effects,
          typographyAvoided: [],

          colorPalettesCommon: intelligence.colors.primary,
          colorPalettesSuccessful: intelligence.colors.primary,
          colorsByShirtColor: {
            [intelligence.colors.shirtColors[0] || 'black']: intelligence.colors.primary
          },

          moodPrimary: [intelligence.aesthetic.primary],
          moodSecondary: intelligence.aesthetic.keywords,
          moodAvoided: [],
          moodReference: `${intelligence.aesthetic.mood} ${niche} aesthetic`,

          layoutCompositions: [intelligence.layout.composition],
          layoutTextPlacements: ['centered'],
          layoutIconUsage: intelligence.layout.hasIcons ? 0.5 : 0.1,
          layoutIconStyles: intelligence.layout.hasIcons ? ['integrated'] : [],

          audienceMotivations: [],
          relatedNiches: [],
          nicheBlendOpportunities: []
        }
      });

      console.log(`[RealtimeStyle] Created new profile for "${niche}"`);
    }
  } catch (error) {
    // Don't throw - this is fire-and-forget
    console.error(`[RealtimeStyle] Write-back error for "${niche}":`, error);
  }
}

/**
 * Merge two arrays keeping unique values, limited to maxItems
 */
function mergeArraysUnique(existing: string[], newItems: string[], maxItems: number): string[] {
  const combined = [...new Set([...existing, ...newItems])];
  return combined.slice(0, maxItems);
}

/**
 * Analyze a single image with timeout
 */
async function analyzeImageWithTimeout(
  client: Anthropic,
  product: { externalId: string; imageUrl: string | null; isTopSeller: boolean },
  timeoutMs: number
): Promise<ProductImageAnalysis> {
  if (!product.imageUrl) {
    return { asin: product.externalId, success: false, error: 'No image URL' };
  }

  try {
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise<ProductImageAnalysis>((_, reject) => {
      setTimeout(() => reject(new Error('Analysis timeout')), timeoutMs);
    });

    // Race the analysis against the timeout
    const analysisPromise = analyzeSingleImage(
      client,
      product.imageUrl,
      product.externalId,
      product.isTopSeller
    );

    return await Promise.race([analysisPromise, timeoutPromise]);

  } catch (error) {
    return {
      asin: product.externalId,
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed'
    };
  }
}

/**
 * Quick aggregation of realtime analyses into style intelligence
 */
function aggregateRealtimeAnalyses(
  niche: string,
  analyses: ProductImageAnalysis[]
): RealtimeStyleIntelligence {
  // Count occurrences
  const typographyStyles: Record<string, number> = {};
  const typographyEffects: Record<string, number> = {};
  const primaryColors: Record<string, number> = {};
  const shirtColors: Record<string, number> = {};
  const colorMoods: Record<string, number> = {};
  const compositions: Record<string, number> = {};
  const aestheticPrimary: Record<string, number> = {};
  const aestheticKeywords: Record<string, number> = {};
  const aestheticMoods: Record<string, number> = {};

  let iconCount = 0;
  let illustrationCount = 0;

  for (const analysis of analyses) {
    // Typography
    if (analysis.typography) {
      increment(typographyStyles, analysis.typography.style);
      for (const effect of analysis.typography.effects || []) {
        increment(typographyEffects, effect);
      }
    }

    // Colors
    if (analysis.colors) {
      for (const color of analysis.colors.primary || []) {
        increment(primaryColors, normalizeColor(color));
      }
      increment(shirtColors, normalizeColor(analysis.colors.shirtColor || 'black'));
      increment(colorMoods, analysis.colors.mood);
    }

    // Layout
    if (analysis.layout) {
      increment(compositions, analysis.layout.composition);
      if (analysis.layout.iconPresent) iconCount++;
      if (analysis.layout.hasIllustration) illustrationCount++;
    }

    // Aesthetic
    if (analysis.aesthetic) {
      increment(aestheticPrimary, analysis.aesthetic.primary);
      increment(aestheticMoods, analysis.aesthetic.mood);
      for (const keyword of analysis.aesthetic.keywords || []) {
        increment(aestheticKeywords, keyword.toLowerCase());
      }
    }
  }

  const total = analyses.length;

  // Calculate confidence based on consistency
  let confidence = 0.3; // Base confidence for having realtime data
  if (total >= 3) confidence += 0.1;
  if (total >= 5) confidence += 0.1;
  if (Object.keys(typographyStyles).length <= 2) confidence += 0.1; // Consistent typography
  if (Object.keys(aestheticPrimary).length <= 2) confidence += 0.1; // Consistent aesthetic

  return {
    niche,
    sampleSize: total,
    analysisTimestamp: new Date(),

    typography: {
      dominant: getTopItem(typographyStyles) || 'bold sans-serif',
      effects: getTopItems(typographyEffects, 3)
    },

    colors: {
      primary: getTopItems(primaryColors, 4),
      shirtColors: getTopItems(shirtColors, 2),
      mood: getTopItem(colorMoods) || 'neutral'
    },

    layout: {
      composition: getTopItem(compositions) || 'centered',
      hasIcons: iconCount / total > 0.3,
      hasIllustrations: illustrationCount / total > 0.3
    },

    aesthetic: {
      primary: getTopItem(aestheticPrimary) || 'modern',
      keywords: getTopItems(aestheticKeywords, 6),
      mood: getTopItem(aestheticMoods) || 'varied'
    },

    source: 'realtime-vision',
    confidence: Math.min(confidence, 0.7) // Cap at 0.7 since it's a quick analysis
  };
}

/**
 * Convert RealtimeStyleIntelligence to NicheStyleProfile format
 * for compatibility with the DesignBrief system
 */
export function realtimeToNicheStyleProfile(
  realtime: RealtimeStyleIntelligence
): NicheStyleProfile {
  return {
    niche: realtime.niche,
    sampleSize: realtime.sampleSize,
    lastAnalyzed: realtime.analysisTimestamp,
    confidence: realtime.confidence,

    dominantTypography: {
      primary: realtime.typography.dominant,
      secondary: undefined,
      examples: realtime.typography.effects
    },

    colorPalette: {
      primary: realtime.colors.primary,
      accent: [],
      background: realtime.colors.shirtColors,
      seasonalVariants: undefined
    },

    layoutPatterns: {
      dominant: realtime.layout.composition,
      alternatives: [],
      textPlacement: 'centered',
      iconUsage: realtime.layout.hasIcons ? 'common' : 'rare'
    },

    illustrationStyle: {
      dominant: realtime.layout.hasIllustrations ? 'simple' : 'none',
      subjectMatter: realtime.aesthetic.keywords
    },

    moodAesthetic: {
      primary: realtime.aesthetic.primary,
      secondary: realtime.aesthetic.mood,
      avoid: []
    }
  };
}

/**
 * Blend realtime and cached style profiles
 *
 * The realtime profile is the PRIMARY source (fresh analysis).
 * The cached profile provides CONTEXT and validation.
 *
 * Weights: 70% realtime, 30% cached (configurable)
 */
function blendStyleProfiles(
  realtime: NicheStyleProfile,
  cached: NicheStyleProfile | null,
  weights: { realtime: number; cached: number } = { realtime: 0.7, cached: 0.3 }
): NicheStyleProfile {
  // If no cache, just return realtime
  if (!cached) {
    console.log(`[StyleBlend] No cache available, using 100% realtime`);
    return realtime;
  }

  console.log(`[StyleBlend] Blending profiles (${weights.realtime * 100}% realtime, ${weights.cached * 100}% cached)`);

  // Blend arrays by taking from both, prioritizing realtime
  const blendArrays = (rt: string[], ca: string[], maxItems: number = 5): string[] => {
    const rtItems = rt.slice(0, Math.ceil(maxItems * weights.realtime));
    const caItems = ca.filter(item => !rtItems.includes(item)).slice(0, Math.floor(maxItems * weights.cached));
    return [...rtItems, ...caItems].slice(0, maxItems);
  };

  // Blend confidence - realtime weighted but boosted if consistent with cache
  const consistencyBonus = calculateConsistency(realtime, cached);
  const blendedConfidence = Math.min(
    1.0,
    (realtime.confidence * weights.realtime + cached.confidence * weights.cached) + (consistencyBonus * 0.1)
  );

  return {
    niche: realtime.niche,
    sampleSize: realtime.sampleSize + cached.sampleSize,
    lastAnalyzed: realtime.lastAnalyzed,
    confidence: blendedConfidence,

    dominantTypography: {
      // Realtime primary takes precedence
      primary: realtime.dominantTypography.primary,
      secondary: cached.dominantTypography.secondary || realtime.dominantTypography.secondary,
      examples: blendArrays(
        realtime.dominantTypography.examples,
        cached.dominantTypography.examples,
        5
      )
    },

    colorPalette: {
      primary: blendArrays(realtime.colorPalette.primary, cached.colorPalette.primary, 4),
      accent: blendArrays(realtime.colorPalette.accent, cached.colorPalette.accent, 4),
      background: blendArrays(realtime.colorPalette.background, cached.colorPalette.background, 3),
      seasonalVariants: cached.colorPalette.seasonalVariants // Preserve accumulated seasonal data
    },

    layoutPatterns: {
      dominant: realtime.layoutPatterns.dominant,
      alternatives: blendArrays(
        realtime.layoutPatterns.alternatives,
        cached.layoutPatterns.alternatives,
        4
      ),
      textPlacement: realtime.layoutPatterns.textPlacement,
      iconUsage: realtime.layoutPatterns.iconUsage
    },

    illustrationStyle: {
      dominant: realtime.illustrationStyle.dominant,
      subjectMatter: blendArrays(
        realtime.illustrationStyle.subjectMatter,
        cached.illustrationStyle.subjectMatter,
        6
      )
    },

    moodAesthetic: {
      primary: realtime.moodAesthetic.primary,
      secondary: realtime.moodAesthetic.secondary || cached.moodAesthetic.secondary,
      avoid: blendArrays(realtime.moodAesthetic.avoid, cached.moodAesthetic.avoid, 5)
    }
  };
}

/**
 * Calculate consistency between realtime and cached profiles
 * Returns 0-1 score (1 = highly consistent, 0 = completely different)
 */
function calculateConsistency(realtime: NicheStyleProfile, cached: NicheStyleProfile): number {
  let matches = 0;
  let checks = 0;

  // Check typography match
  checks++;
  if (realtime.dominantTypography.primary.toLowerCase().includes(cached.dominantTypography.primary.toLowerCase().split(' ')[0]) ||
      cached.dominantTypography.primary.toLowerCase().includes(realtime.dominantTypography.primary.toLowerCase().split(' ')[0])) {
    matches++;
  }

  // Check color overlap
  checks++;
  const rtColors = new Set(realtime.colorPalette.primary.map(c => c.toLowerCase()));
  const caColors = cached.colorPalette.primary.map(c => c.toLowerCase());
  if (caColors.some(c => rtColors.has(c))) {
    matches++;
  }

  // Check layout match
  checks++;
  if (realtime.layoutPatterns.dominant === cached.layoutPatterns.dominant) {
    matches++;
  }

  // Check mood match
  checks++;
  if (realtime.moodAesthetic.primary === cached.moodAesthetic.primary) {
    matches++;
  }

  return matches / checks;
}

/**
 * Smart style fetcher - ALWAYS does real-time analysis, uses cache as context.
 *
 * ARCHITECTURE (Updated):
 * - Cache is for LONG-TERM LEARNING, not quick answers
 * - Each generation does FRESH real-time analysis
 * - Cached data INFORMS and VALIDATES, doesn't replace research
 * - System learns over time but stays dynamic per-generation
 *
 * Flow:
 * 1. Fetch cached profile as background context (non-blocking)
 * 2. Perform real-time analysis (primary source)
 * 3. Blend real-time findings with cached knowledge (70/30 weight)
 * 4. Write back learnings to database (fire-and-forget)
 * 5. Return blended profile
 *
 * Fallback: If real-time fails, use cache with reduced confidence
 */
export async function getSmartStyleProfile(
  niche: string,
  options: {
    maxCacheAgeHours?: number;
    enableRealtime?: boolean;
    maxRealtimeImages?: number;
    phrase?: string;  // Specific phrase/trend for targeted image search
    blendWeights?: { realtime: number; cached: number };
  } = {}
): Promise<{
  profile: NicheStyleProfile | null;
  source: 'realtime-blended' | 'realtime-only' | 'cache-fallback' | 'none';
  confidence: number;
  consistency?: number;  // How consistent realtime was with cache
}> {
  const {
    enableRealtime = true,
    maxRealtimeImages = 5,
    phrase,
    blendWeights = { realtime: 0.7, cached: 0.3 }
  } = options;

  const searchContext = phrase ? `"${phrase}" in ${niche}` : `niche: "${niche}"`;
  console.log(`[SmartStyle] Fetching style for ${searchContext} (always-fresh mode)`);

  // Step 1: Fetch cached profile as CONTEXT (non-blocking fetch)
  // This is for blending, not as primary source
  let cachedProfile: NicheStyleProfile | null = null;
  try {
    cachedProfile = await getNicheStyleProfile(niche);
    if (cachedProfile) {
      console.log(`[SmartStyle] Loaded cached profile for context (samples: ${cachedProfile.sampleSize})`);
    }
  } catch (err) {
    console.warn(`[SmartStyle] Failed to load cached profile:`, err);
  }

  // Step 2: ALWAYS do real-time analysis (this is the PRIMARY source)
  if (enableRealtime) {
    console.log(`[SmartStyle] Performing real-time analysis (primary source)...`);
    const realtime = await analyzeNicheStyleRealtime(niche, {
      maxImages: maxRealtimeImages,
      phrase,  // Pass phrase for targeted search
      writeBack: true  // Always write back learnings
    });

    if (realtime) {
      const realtimeProfile = realtimeToNicheStyleProfile(realtime);

      // Step 3: Blend realtime with cached context
      const blendedProfile = blendStyleProfiles(realtimeProfile, cachedProfile, blendWeights);

      // Calculate consistency for debugging/tracking
      const consistency = cachedProfile ? calculateConsistency(realtimeProfile, cachedProfile) : 0;

      console.log(`[SmartStyle] Real-time analysis successful, blended with cache (consistency: ${Math.round(consistency * 100)}%)`);

      return {
        profile: blendedProfile,
        source: cachedProfile ? 'realtime-blended' : 'realtime-only',
        confidence: blendedProfile.confidence,
        consistency
      };
    }
  }

  // Step 3: Fallback - If real-time fails, use cache with reduced confidence
  if (cachedProfile) {
    console.log(`[SmartStyle] Real-time failed, falling back to cached profile`);
    return {
      profile: cachedProfile,
      source: 'cache-fallback',
      confidence: cachedProfile.confidence * 0.6 // Significant reduction - we wanted fresh data
    };
  }

  // Step 4: Nothing available
  console.log(`[SmartStyle] No style data available for "${niche}"`);
  return {
    profile: null,
    source: 'none',
    confidence: 0
  };
}

// Export for use in cron jobs
export default {
  discoverNicheStyle,
  getNicheStyleProfile,
  getOrDiscoverNicheStyle,
  discoverStylesForNiches,
  getNichesNeedingStyleDiscovery,
  // New real-time exports
  analyzeNicheStyleRealtime,
  realtimeToNicheStyleProfile,
  getSmartStyleProfile
};
