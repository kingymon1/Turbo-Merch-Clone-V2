/**
 * Variation Generator for "Dominate This Niche" Feature
 *
 * Generates multiple unique variations of a design using AI-powered strategies.
 * Each variation looks like it was designed by a different person.
 *
 * PERFORMANCE OPTIMIZATION (v2):
 * - Pre-generates all strategies upfront (fast, ~1s each)
 * - Processes image+listing in parallel batches
 * - Returns partial results if nearing timeout
 * - Uses fallback listings to speed up generation
 */

import { prisma } from '@/lib/prisma';
import { MerchDesign } from './types';
import { generateVariationStrategy, VariationStrategy } from './variation-strategy';
import { generateMerchImage, generatePlaceholderImage } from './image-generator';
import { generateMerchListing } from './listing-generator';

// Configuration
const PARALLEL_BATCH_SIZE = 3;  // Process 3 variations at a time
const MAX_GENERATION_TIME_MS = 250000; // 250 seconds - leave 50s buffer for response
const SINGLE_VARIATION_TIMEOUT_MS = 45000; // 45 seconds per variation max

export interface VariationResult {
  success: boolean;
  design?: MerchDesign;
  error?: string;
  strategy?: VariationStrategy;
}

export interface DominateProgress {
  current: number;
  total: number;
  status: 'generating_strategy' | 'generating_image' | 'generating_listing' | 'saving' | 'complete' | 'error';
  message: string;
}

/**
 * Wrap a promise with a timeout
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(errorMessage));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

/**
 * Create image prompt from AI-generated strategy
 */
function createPromptFromStrategy(
  strategy: VariationStrategy,
  niche: string
): string {
  return `T-shirt design for ${niche} niche.

Text: "${strategy.phraseVariation}"

Visual Direction: ${strategy.visualDirection}
Font Style: ${strategy.fontStyle}
Layout: ${strategy.layoutApproach}
Colors: ${strategy.colorScheme}
Graphics: ${strategy.graphicElements}
Overall Vibe: ${strategy.overallVibe}
Specific Details: ${strategy.specificDetails}

Requirements:
- Center composition optimized for t-shirt
- High contrast for visibility
- Transparent background
- Professional quality, ready for printing
- Readable in thumbnail size

Create a unique design following this exact visual direction.`;
}

/**
 * Generate a quick fallback listing (no AI call)
 */
function generateQuickFallbackListing(
  phrase: string,
  niche: string,
  style: string,
  vibe: string
): { title: string; bullets: string[]; description: string } {
  const capitalizedNiche = niche.charAt(0).toUpperCase() + niche.slice(1);
  return {
    title: `${phrase} - ${vibe} ${capitalizedNiche} Gift Shirt`,
    bullets: [
      `Perfect gift for ${niche} who appreciate ${vibe.toLowerCase()} designs`,
      'Premium quality fabric for maximum comfort',
      'Vibrant long-lasting print that won\'t fade',
      'Available in multiple sizes and colors',
      'Great for birthdays, holidays, or just because',
    ],
    description: `Show off your style with this ${style} design featuring "${phrase}". Perfect for ${niche}. Premium quality fabric ensures all-day comfort with a vibrant print that lasts.`,
  };
}

/**
 * Generate a single variation (image + listing)
 */
async function generateSingleVariation(
  original: MerchDesign,
  strategy: VariationStrategy,
  variationNumber: number,
  userId: string,
  useFallbackListing: boolean = false
): Promise<VariationResult> {
  try {
    // Create image prompt from strategy
    const imagePrompt = createPromptFromStrategy(strategy, original.niche);

    // Generate image with timeout
    let imageUrl: string;
    try {
      const imageResult = await withTimeout(
        generateMerchImage(
          imagePrompt,
          strategy.visualDirection,
          strategy.phraseVariation,
          'black',
          'simple'
        ),
        35000, // 35 second timeout for image
        'Image generation timed out'
      );
      imageUrl = imageResult.imageUrl;
    } catch (imageError) {
      console.error(`[Variation ${variationNumber + 1}] Image failed:`, imageError);
      imageUrl = generatePlaceholderImage(strategy.phraseVariation, strategy.visualDirection);
    }

    // Generate listing - use fallback for speed if requested
    let listing;
    if (useFallbackListing) {
      listing = generateQuickFallbackListing(
        strategy.phraseVariation,
        original.niche,
        strategy.visualDirection,
        strategy.overallVibe
      );
    } else {
      try {
        listing = await withTimeout(
          generateMerchListing(
            strategy.phraseVariation,
            original.niche,
            strategy.overallVibe,
            strategy.visualDirection
          ),
          10000, // 10 second timeout for listing
          'Listing generation timed out'
        );
      } catch (listingError) {
        console.error(`[Variation ${variationNumber + 1}] Listing failed:`, listingError);
        listing = generateQuickFallbackListing(
          strategy.phraseVariation,
          original.niche,
          strategy.visualDirection,
          strategy.overallVibe
        );
      }
    }

    // Save to database
    const savedDesign = await prisma.merchDesign.create({
      data: {
        userId,
        mode: 'dominate',
        phrase: strategy.phraseVariation,
        niche: original.niche,
        style: strategy.visualDirection,
        tone: strategy.overallVibe,
        imageUrl,
        imagePrompt,
        listingTitle: listing.title,
        listingBullets: listing.bullets,
        listingDesc: listing.description,
        isTest: false,
        parentId: original.id,
        sourceData: {
          variationStrategy: strategy,
          variationNumber: variationNumber + 1,
          originalDesignId: original.id,
        } as any,
      },
    });

    return {
      success: true,
      design: {
        id: savedDesign.id,
        createdAt: savedDesign.createdAt,
        updatedAt: savedDesign.updatedAt,
        userId: savedDesign.userId,
        mode: savedDesign.mode as 'autopilot' | 'manual',
        phrase: savedDesign.phrase,
        niche: savedDesign.niche,
        style: savedDesign.style ?? undefined,
        tone: savedDesign.tone ?? undefined,
        imageUrl: savedDesign.imageUrl,
        imagePrompt: savedDesign.imagePrompt,
        listingTitle: savedDesign.listingTitle,
        listingBullets: savedDesign.listingBullets,
        listingDesc: savedDesign.listingDesc,
        approved: savedDesign.approved,
        views: savedDesign.views,
        sales: savedDesign.sales,
        parentId: savedDesign.parentId ?? undefined,
      },
      strategy,
    };
  } catch (error) {
    console.error(`[Variation ${variationNumber + 1}] Error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      strategy,
    };
  }
}

/**
 * Process a batch of variations in parallel
 */
async function processBatch(
  original: MerchDesign,
  strategies: VariationStrategy[],
  startIndex: number,
  userId: string,
  useFallbackListings: boolean
): Promise<VariationResult[]> {
  const promises = strategies.map((strategy, idx) =>
    withTimeout(
      generateSingleVariation(
        original,
        strategy,
        startIndex + idx,
        userId,
        useFallbackListings
      ),
      SINGLE_VARIATION_TIMEOUT_MS,
      `Variation ${startIndex + idx + 1} timed out`
    ).catch(error => ({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      strategy,
    }))
  );

  return Promise.all(promises);
}

/**
 * Generate multiple variations of a design
 *
 * OPTIMIZED: Uses parallel batch processing
 *
 * @param original - The original design to create variations of
 * @param count - Number of variations to generate (1-20 recommended)
 * @param userId - User ID for ownership
 * @param onProgress - Optional callback for progress updates
 * @returns Array of generated variations
 */
export async function generateVariations(
  original: MerchDesign,
  count: number,
  userId: string,
  onProgress?: (progress: DominateProgress) => void
): Promise<{
  variations: MerchDesign[];
  failed: number;
  strategies: VariationStrategy[];
  timedOut?: boolean;
}> {
  const startTime = Date.now();
  const variations: MerchDesign[] = [];
  const strategies: VariationStrategy[] = [];
  let failedCount = 0;
  let timedOut = false;

  console.log(`[Dominate] Starting PARALLEL generation of ${count} variations for "${original.phrase}"`);

  // PHASE 1: Pre-generate all strategies upfront (fast, ~1-2s each)
  console.log(`[Dominate] Phase 1: Pre-generating ${count} strategies...`);

  if (onProgress) {
    onProgress({
      current: 0,
      total: count,
      status: 'generating_strategy',
      message: `Creating ${count} unique visual strategies...`,
    });
  }

  for (let i = 0; i < count; i++) {
    // Check time budget
    if (Date.now() - startTime > MAX_GENERATION_TIME_MS) {
      console.log(`[Dominate] Time limit reached during strategy generation`);
      timedOut = true;
      break;
    }

    try {
      const strategy = await withTimeout(
        generateVariationStrategy(original.phrase, original.niche, i, strategies),
        5000, // 5 second timeout for strategy
        'Strategy generation timed out'
      );
      strategies.push(strategy);
      console.log(`[Dominate] Strategy ${i + 1}: ${strategy.visualDirection}`);
    } catch (error) {
      console.error(`[Dominate] Strategy ${i + 1} failed:`, error);
      // Use fallback strategy
      const fallbackStrategy: VariationStrategy = {
        phraseVariation: original.phrase,
        visualDirection: ['Modern minimalist', 'Vintage retro', 'Bold streetwear', 'Hand-drawn'][i % 4],
        fontStyle: 'Bold sans-serif',
        layoutApproach: 'Center-aligned',
        colorScheme: 'High contrast',
        graphicElements: 'None - text only',
        overallVibe: 'Professional',
        specificDetails: `Variation ${i + 1} style`,
      };
      strategies.push(fallbackStrategy);
    }
  }

  console.log(`[Dominate] Generated ${strategies.length} strategies in ${Date.now() - startTime}ms`);

  // PHASE 2: Process variations in parallel batches
  console.log(`[Dominate] Phase 2: Generating images in batches of ${PARALLEL_BATCH_SIZE}...`);

  // Use fallback listings to speed up (skip AI listing calls)
  const useFallbackListings = count > 5;

  for (let batchStart = 0; batchStart < strategies.length; batchStart += PARALLEL_BATCH_SIZE) {
    // Check time budget before each batch
    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_GENERATION_TIME_MS) {
      console.log(`[Dominate] Time limit reached after ${variations.length} variations`);
      timedOut = true;
      break;
    }

    const batchStrategies = strategies.slice(batchStart, batchStart + PARALLEL_BATCH_SIZE);
    const batchNumber = Math.floor(batchStart / PARALLEL_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(strategies.length / PARALLEL_BATCH_SIZE);

    console.log(`[Dominate] Processing batch ${batchNumber}/${totalBatches} (${batchStrategies.length} variations)`);

    if (onProgress) {
      onProgress({
        current: batchStart,
        total: count,
        status: 'generating_image',
        message: `Generating designs batch ${batchNumber}/${totalBatches}...`,
      });
    }

    // Process batch in parallel
    const results = await processBatch(
      original,
      batchStrategies,
      batchStart,
      userId,
      useFallbackListings
    );

    // Collect results
    for (const result of results) {
      if (result.success && result.design) {
        variations.push(result.design);
        console.log(`[Dominate] Variation complete: ${result.design.id}`);
      } else {
        failedCount++;
        console.error(`[Dominate] Variation failed: ${result.error}`);
      }
    }

    // Update progress
    if (onProgress) {
      onProgress({
        current: Math.min(batchStart + PARALLEL_BATCH_SIZE, strategies.length),
        total: count,
        status: 'complete',
        message: `Completed ${Math.min(batchStart + PARALLEL_BATCH_SIZE, strategies.length)} of ${count}`,
      });
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`[Dominate] Complete in ${totalTime}ms: ${variations.length} successful, ${failedCount} failed${timedOut ? ' (timed out)' : ''}`);

  return {
    variations,
    failed: failedCount,
    strategies,
    timedOut,
  };
}

/**
 * Get all variations for a design
 */
export async function getVariationsForDesign(
  designId: string,
  userId: string
): Promise<MerchDesign[]> {
  const variations = await prisma.merchDesign.findMany({
    where: {
      parentId: designId,
      userId,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  return variations.map(d => ({
    id: d.id,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    userId: d.userId,
    mode: d.mode as 'autopilot' | 'manual',
    phrase: d.phrase,
    niche: d.niche,
    style: d.style ?? undefined,
    tone: d.tone ?? undefined,
    imageUrl: d.imageUrl,
    imagePrompt: d.imagePrompt,
    listingTitle: d.listingTitle,
    listingBullets: d.listingBullets,
    listingDesc: d.listingDesc,
    approved: d.approved,
    views: d.views,
    sales: d.sales,
    parentId: d.parentId ?? undefined,
  }));
}

/**
 * Get estimated time for variation generation
 * Updated for parallel processing
 */
export function estimateGenerationTime(count: number): string {
  // With parallel batches of 3, roughly 45 seconds per batch
  const batches = Math.ceil(count / PARALLEL_BATCH_SIZE);
  const seconds = batches * 45 + 10; // 10s for strategy generation
  const minutes = Math.ceil(seconds / 60);

  if (minutes < 2) {
    return 'about 1 minute';
  } else if (minutes < 5) {
    return `about ${minutes} minutes`;
  } else {
    return `${minutes}-${minutes + 1} minutes`;
  }
}
