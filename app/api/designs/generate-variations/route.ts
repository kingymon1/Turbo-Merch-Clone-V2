/**
 * POST /api/designs/generate-variations
 *
 * Generates multiple variations of an existing design using stored research data.
 * Each variation counts as 1 design against the user's quota.
 */

import { NextRequest, NextResponse } from 'next/server';

// Increase timeout for AI generation (requires Vercel Pro plan for >10s)
export const maxDuration = 60;
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { fetchResearchData } from '@/lib/r2-storage';
import { generateListingVariation, generateDesignImage } from '@/services/geminiService';
import { PRICING_TIERS, TierName } from '@/lib/pricing';
import { canGenerateDesigns, recordDesignGeneration } from '@/lib/usage';
import { randomUUID } from 'crypto';

interface GenerateVariationsRequest {
  designId: string; // Source design to create variations from
  count: number; // Number of variations to generate (1-10)
}

interface VariationResult {
  id: string;
  listing: any;
  imageUrl: string;
  success: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: GenerateVariationsRequest = await request.json();
    const { designId, count } = body;

    if (!designId || !count || count < 1 || count > 10) {
      return NextResponse.json(
        { error: 'Invalid request. designId required, count must be 1-10.' },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        subscriptionTier: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const tier = (user.subscriptionTier || 'free') as TierName;
    const tierConfig = PRICING_TIERS[tier];

    // Check quota for all variations
    const quotaCheck = await canGenerateDesigns(user.id, count);
    if (!quotaCheck.allowed) {
      return NextResponse.json({
        error: quotaCheck.reason || 'Insufficient quota for variations',
        usage: {
          used: quotaCheck.designsUsed,
          allowance: quotaCheck.allowance,
          overage: quotaCheck.overageCount,
        }
      }, { status: 403 });
    }

    // Get the source design
    const sourceDesign = await prisma.designHistory.findUnique({
      where: { id: designId },
      select: {
        id: true,
        userId: true,
        listingData: true,
        artPrompt: true,
        niche: true,
        targetMarket: true,
        shirtColor: true,
        promptMode: true,
      },
    });

    if (!sourceDesign) {
      return NextResponse.json(
        { error: 'Source design not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (sourceDesign.userId !== user.id) {
      return NextResponse.json(
        { error: 'You can only create variations of your own designs' },
        { status: 403 }
      );
    }

    // Fetch research data from R2
    let researchData = null;
    try {
      researchData = await fetchResearchData(user.id, designId);
    } catch (e) {
      console.warn('Could not fetch research data:', e);
    }

    // If no research data, use the listing data to construct a basic trend
    const sourceListing = sourceDesign.listingData as any;
    const sourcePrompt = sourceDesign.artPrompt as any;

    // Construct trend data for variations
    const baseTrend = researchData?.trend || {
      topic: sourceDesign.niche || sourceListing?.title?.split(' ').slice(0, 3).join(' ') || 'Design',
      platform: 'Library',
      volume: 'Established',
      sentiment: 'Positive',
      keywords: sourceListing?.keywords || [],
      description: sourceListing?.description || '',
      visualStyle: sourcePrompt?.style || 'Modern graphic',
      typographyStyle: sourcePrompt?.typography || 'Bold sans-serif',
      customerPhrases: [],
      designText: sourceListing?.designText || '',
      recommendedShirtColor: sourceDesign.shirtColor || 'black',
    };

    console.log(`[Variations] Generating ${count} variations for design ${designId}`);

    // Generate variations in parallel (up to tier's maxPerRun)
    const maxParallel = tierConfig.limits.maxPerRun;
    const results: VariationResult[] = [];

    // Process in batches based on tier's parallel limit
    for (let i = 0; i < count; i += maxParallel) {
      const batchSize = Math.min(maxParallel, count - i);
      const batchPromises: Promise<VariationResult>[] = [];

      for (let j = 0; j < batchSize; j++) {
        const variationIndex = i + j + 1;
        batchPromises.push(generateSingleVariation(
          user.id,
          baseTrend,
          sourceListing,
          variationIndex,
          sourceDesign.shirtColor || 'black',
          (sourceDesign.promptMode as 'simple' | 'advanced') || 'advanced',
          tierConfig
        ));
      }

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Record usage for successful generations
    const successCount = results.filter(r => r.success).length;
    if (successCount > 0) {
      await recordDesignGeneration(user.id, successCount, tier);
    }

    return NextResponse.json({
      success: true,
      generated: successCount,
      requested: count,
      variations: results,
    });

  } catch (error) {
    console.error('[API] Generate variations error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate variations';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

async function generateSingleVariation(
  userId: string,
  baseTrend: any,
  sourceListing: any,
  variationIndex: number,
  shirtColor: string,
  promptMode: 'simple' | 'advanced',
  tierConfig: any
): Promise<VariationResult> {
  const variationId = randomUUID();

  try {
    // Modify the trend slightly for variation
    const variedTrend = {
      ...baseTrend,
      _variationIndex: variationIndex,
      _variationNote: `Create a DIFFERENT but related design. This is variation #${variationIndex}. Use the same theme but vary the visual approach, typography, and exact text.`,
    };

    // Generate varied listing
    const listing = await generateListingVariation(variedTrend, sourceListing, variationIndex);

    // Generate varied image
    const imageUrl = await generateDesignImage(
      listing.imagePrompt || baseTrend.visualStyle,
      baseTrend.visualStyle,
      listing.designText,
      baseTrend.typographyStyle,
      shirtColor,
      promptMode
    );

    // Calculate retention
    const retentionDays = parseInt(tierConfig.limits.historyRetention) || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);

    // Save to database
    const design = await prisma.designHistory.create({
      data: {
        userId,
        runId: variationId,
        runConfig: { type: 'variation', sourceDesignId: baseTrend.sourceDesignId, variationIndex },
        niche: baseTrend.topic,
        slogan: listing.designText,
        designCount: 1,
        targetMarket: baseTrend.platform,
        listingData: JSON.parse(JSON.stringify(listing)),
        artPrompt: JSON.parse(JSON.stringify({ prompt: listing.imagePrompt, style: baseTrend.visualStyle })),
        imageUrl,
        imageHistory: [{
          imageUrl,
          promptMode,
          generatedAt: Date.now(),
          regenerationIndex: 0,
        }],
        imageQuality: 'high',
        canDownload: true,
        promptMode,
        shirtColor,
        expiresAt,
      },
    });

    return {
      id: design.id,
      listing,
      imageUrl,
      success: true,
    };
  } catch (error) {
    console.error(`[Variations] Failed to generate variation ${variationIndex}:`, error);
    return {
      id: variationId,
      listing: null,
      imageUrl: '',
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed',
    };
  }
}
