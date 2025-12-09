/**
 * Variation Generator for "Dominate This Niche" Feature
 *
 * Generates multiple unique variations of a design using AI-powered strategies.
 * Each variation looks like it was designed by a different person.
 */

import { prisma } from '@/lib/prisma';
import { MerchDesign } from './types';
import { generateVariationStrategy, VariationStrategy } from './variation-strategy';
import { generateMerchImage, generatePlaceholderImage } from './image-generator';
import { generateMerchListing } from './listing-generator';

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
 * Generate a single variation
 */
async function generateSingleVariation(
  original: MerchDesign,
  strategy: VariationStrategy,
  variationNumber: number,
  userId: string
): Promise<VariationResult> {
  try {
    // Create image prompt from strategy
    const imagePrompt = createPromptFromStrategy(strategy, original.niche);

    // Generate image
    let imageUrl: string;
    try {
      const imageResult = await generateMerchImage(
        imagePrompt,
        strategy.visualDirection,
        strategy.phraseVariation,
        'black',
        'simple'
      );
      imageUrl = imageResult.imageUrl;
    } catch (imageError) {
      console.error(`[Variation ${variationNumber}] Image generation failed:`, imageError);
      imageUrl = generatePlaceholderImage(strategy.phraseVariation, strategy.visualDirection);
    }

    // Generate listing variation
    let listing;
    try {
      listing = await generateMerchListing(
        strategy.phraseVariation,
        original.niche,
        strategy.overallVibe,
        strategy.visualDirection
      );
    } catch (listingError) {
      console.error(`[Variation ${variationNumber}] Listing generation failed:`, listingError);
      // Fallback listing
      listing = {
        title: `${strategy.phraseVariation} - ${original.niche} Gift Shirt`,
        bullets: [
          `Perfect gift for ${original.niche}`,
          'Premium quality fabric',
          'Vibrant long-lasting print',
          'Available in multiple sizes',
          'Great for any occasion',
        ],
        description: `Show off your style with this ${strategy.visualDirection} design featuring "${strategy.phraseVariation}". Perfect for ${original.niche}.`,
      };
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
    console.error(`[Variation ${variationNumber}] Error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      strategy,
    };
  }
}

/**
 * Generate multiple variations of a design
 *
 * @param original - The original design to create variations of
 * @param count - Number of variations to generate (1-50)
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
}> {
  const variations: MerchDesign[] = [];
  const strategies: VariationStrategy[] = [];
  let failedCount = 0;

  console.log(`[Dominate] Starting generation of ${count} variations for "${original.phrase}"`);

  for (let i = 0; i < count; i++) {
    try {
      // Update progress: generating strategy
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: count,
          status: 'generating_strategy',
          message: `Creating unique visual strategy for variation ${i + 1}...`,
        });
      }

      // Generate unique strategy using AI
      const strategy = await generateVariationStrategy(
        original.phrase,
        original.niche,
        i,
        strategies
      );
      strategies.push(strategy);

      console.log(`[Dominate] Variation ${i + 1} strategy: ${strategy.visualDirection}`);

      // Update progress: generating image
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: count,
          status: 'generating_image',
          message: `Generating ${strategy.visualDirection} design...`,
        });
      }

      // Generate the variation
      const result = await generateSingleVariation(
        original,
        strategy,
        i,
        userId
      );

      if (result.success && result.design) {
        variations.push(result.design);
        console.log(`[Dominate] Variation ${i + 1} complete: ${result.design.id}`);
      } else {
        failedCount++;
        console.error(`[Dominate] Variation ${i + 1} failed: ${result.error}`);
      }

      // Update progress: complete for this variation
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: count,
          status: 'complete',
          message: `Completed variation ${i + 1} of ${count}`,
        });
      }

      // Small delay between variations to avoid rate limiting
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`[Dominate] Error on variation ${i + 1}:`, error);
      failedCount++;

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: count,
          status: 'error',
          message: `Error on variation ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }
  }

  console.log(`[Dominate] Complete: ${variations.length} successful, ${failedCount} failed`);

  return {
    variations,
    failed: failedCount,
    strategies,
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
 */
export function estimateGenerationTime(count: number): string {
  // Roughly 15 seconds per variation
  const seconds = count * 15;
  const minutes = Math.ceil(seconds / 60);

  if (minutes < 2) {
    return 'about 1 minute';
  } else if (minutes < 5) {
    return `about ${minutes} minutes`;
  } else {
    return `${minutes}-${minutes + 2} minutes`;
  }
}
