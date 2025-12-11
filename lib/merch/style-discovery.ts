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
 * Fetch MBA products from database for a specific niche
 */
async function fetchMBAProductsForNiche(
  niche: string,
  options: {
    limit: number;
    prioritizeTopSellers: boolean;
    includeRecent: boolean;
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
  const where: any = {
    isMerchByAmazon: true,
    imageUrl: { not: null },
    OR: [
      { niche: { contains: niche, mode: 'insensitive' } },
      { title: { contains: niche, mode: 'insensitive' } },
      { category: { contains: niche, mode: 'insensitive' } }
    ]
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
      model: 'claude-3-5-sonnet-20241022',
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
            text: `Analyze this t-shirt design image. Extract style characteristics for a design system.

Return ONLY valid JSON with this exact structure:
{
  "typography": {
    "style": "description of typography style (e.g., 'bold sans-serif', 'vintage script', 'distressed block letters')",
    "weight": "bold|medium|light|varied",
    "effects": ["list", "of", "effects", "like distressed, shadow, outline, gradient"],
    "hasText": true/false,
    "extractedText": "the actual text on the design if readable"
  },
  "colors": {
    "primary": ["main colors used"],
    "accent": ["supporting colors"],
    "shirtColor": "detected shirt color",
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
    "primary": "main aesthetic (e.g., 'vintage americana', 'modern minimalist', 'playful cartoon')",
    "keywords": ["list", "of", "style", "keywords"],
    "mood": "the emotional feel (funny, serious, heartfelt, edgy, professional)",
    "quality": "professional|amateur|mixed"
  }
}

Be specific and descriptive. Focus on elements that could be replicated in new designs.`
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
 * Perform real-time style analysis for a niche during a generation request.
 *
 * This is a FAST, LIGHTWEIGHT version of style discovery designed to run
 * during user requests. It analyzes only 3-5 images in parallel and returns
 * quick style insights without storing to database.
 *
 * Use this when:
 * - No cached NicheStyleProfile exists
 * - Cached profile is stale but we need immediate results
 * - User needs style intelligence for an uncommon niche
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
  } = {}
): Promise<RealtimeStyleIntelligence | null> {
  const {
    maxImages = 5,
    timeoutMs = 8000,
    prioritizeTopSellers = true
  } = options;

  const startTime = Date.now();
  console.log(`[RealtimeStyle] Starting real-time analysis for niche: "${niche}"`);

  try {
    // Step 1: Fetch a small sample of MBA products (fast query)
    const products = await fetchMBAProductsForNiche(niche, {
      limit: maxImages,
      prioritizeTopSellers,
      includeRecent: true
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

    const elapsed = Date.now() - startTime;
    console.log(`[RealtimeStyle] Completed in ${elapsed}ms with ${intelligence.confidence * 100}% confidence`);

    return intelligence;

  } catch (error) {
    console.error(`[RealtimeStyle] Error analyzing "${niche}":`, error);
    return null;
  }
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
 * Smart style fetcher that uses cached profiles when fresh,
 * or performs real-time analysis when needed.
 *
 * Priority order:
 * 1. Fresh cached profile (< maxAgeHours old) - use directly
 * 2. No cache or stale cache - perform real-time analysis
 * 3. If real-time fails but stale cache exists - use stale cache
 * 4. Nothing available - return null
 */
export async function getSmartStyleProfile(
  niche: string,
  options: {
    maxCacheAgeHours?: number;
    enableRealtime?: boolean;
    maxRealtimeImages?: number;
  } = {}
): Promise<{
  profile: NicheStyleProfile | null;
  source: 'fresh-cache' | 'realtime' | 'stale-cache' | 'none';
  confidence: number;
}> {
  const {
    maxCacheAgeHours = 168, // 1 week
    enableRealtime = true,
    maxRealtimeImages = 5
  } = options;

  console.log(`[SmartStyle] Fetching style for niche: "${niche}"`);

  // Step 1: Check for cached profile
  const stored = await prisma.nicheStyleProfile.findUnique({
    where: { niche }
  });

  if (stored) {
    const ageMs = Date.now() - stored.lastAnalyzedAt.getTime();
    const maxAgeMs = maxCacheAgeHours * 60 * 60 * 1000;

    if (ageMs < maxAgeMs) {
      // Fresh cache - use it
      console.log(`[SmartStyle] Using fresh cached profile (age: ${Math.round(ageMs / 3600000)}h)`);
      const profile = await getNicheStyleProfile(niche);
      return {
        profile,
        source: 'fresh-cache',
        confidence: profile?.confidence || 0.5
      };
    }

    console.log(`[SmartStyle] Cache is stale (age: ${Math.round(ageMs / 3600000)}h)`);
  }

  // Step 2: Try real-time analysis
  if (enableRealtime) {
    console.log(`[SmartStyle] Attempting real-time analysis...`);
    const realtime = await analyzeNicheStyleRealtime(niche, {
      maxImages: maxRealtimeImages
    });

    if (realtime) {
      console.log(`[SmartStyle] Real-time analysis successful`);
      return {
        profile: realtimeToNicheStyleProfile(realtime),
        source: 'realtime',
        confidence: realtime.confidence
      };
    }
  }

  // Step 3: Fall back to stale cache if available
  if (stored) {
    console.log(`[SmartStyle] Falling back to stale cache`);
    const profile = await getNicheStyleProfile(niche);
    return {
      profile,
      source: 'stale-cache',
      confidence: (profile?.confidence || 0.5) * 0.7 // Reduce confidence for stale data
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
