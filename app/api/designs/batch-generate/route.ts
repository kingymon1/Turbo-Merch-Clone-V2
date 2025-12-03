/**
 * POST /api/designs/batch-generate
 *
 * Batch generates multiple designs based on mode:
 * - Autopilot: Independent research runs in parallel (each design gets its own trend research)
 * - Targeted: Single research run, multiple design variations (same niche, different outputs)
 */

import { NextRequest, NextResponse } from 'next/server';

// Increase timeout for AI generation (requires Vercel Pro plan for >10s)
export const maxDuration = 60;
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { PRICING_TIERS, TierName } from '@/lib/pricing';
import { canGenerateDesigns, recordDesignGeneration } from '@/lib/usage';
import { searchTrends, generateListing, generateDesignImage, generateListingVariation } from '@/services/geminiService';
import { uploadImage, uploadResearchData } from '@/lib/r2-storage';
import { randomUUID } from 'crypto';
import { TREND_CONFIG } from '@/config';
import { PromptMode } from '@/types';

interface BatchGenerateRequest {
  mode: 'autopilot' | 'targeted';
  niche?: string; // Required for targeted mode
  count: number; // Number of designs to generate (1-10)
  viralityLevel?: number;
  promptMode?: PromptMode;
}

interface BatchResult {
  id: string;
  success: boolean;
  listing?: any;
  imageUrl?: string;
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

    const body: BatchGenerateRequest = await request.json();
    const { mode, niche, count, viralityLevel = 50, promptMode = 'advanced' } = body;

    // Validation
    if (!mode || !['autopilot', 'targeted'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "autopilot" or "targeted".' },
        { status: 400 }
      );
    }

    if (mode === 'targeted' && !niche?.trim()) {
      return NextResponse.json(
        { error: 'Niche is required for targeted mode.' },
        { status: 400 }
      );
    }

    if (!count || count < 1 || count > 10) {
      return NextResponse.json(
        { error: 'Count must be between 1 and 10.' },
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

    // Check if tier supports this batch size
    if (count > tierConfig.limits.maxPerRun) {
      return NextResponse.json({
        error: `Your ${tier} plan supports up to ${tierConfig.limits.maxPerRun} designs per batch. Upgrade for larger batches.`,
        maxAllowed: tierConfig.limits.maxPerRun,
        requiresUpgrade: true,
      }, { status: 403 });
    }

    // Check quota
    const quotaCheck = await canGenerateDesigns(user.id, count);
    if (!quotaCheck.allowed) {
      return NextResponse.json({
        error: quotaCheck.reason || 'Insufficient quota',
        usage: {
          used: quotaCheck.designsUsed,
          allowance: quotaCheck.allowance,
          overage: quotaCheck.overageCount,
        }
      }, { status: 403 });
    }

    console.log(`[Batch] Starting ${mode} batch of ${count} designs for user ${userId}`);

    const results: BatchResult[] = [];

    if (mode === 'autopilot') {
      // AUTOPILOT MODE: Run independent research+generation in parallel
      const discoveryQueries = TREND_CONFIG.globalDiscoveryQueries || [
        'trending t-shirt designs',
        'viral memes to put on shirts',
        'popular niche interests',
      ];

      // Create promises for parallel execution
      const promises: Promise<BatchResult>[] = [];

      for (let i = 0; i < count; i++) {
        // Each run gets a random discovery query for variety
        const query = discoveryQueries[Math.floor(Math.random() * discoveryQueries.length)];
        promises.push(generateSingleDesign(user.id, query, viralityLevel, promptMode, tierConfig, i));
      }

      // Execute in parallel (limited by tier's concurrent runs)
      const maxConcurrent = tierConfig.features?.concurrentRuns || 2;
      for (let i = 0; i < promises.length; i += maxConcurrent) {
        const batch = promises.slice(i, i + maxConcurrent);
        const batchResults = await Promise.all(batch);
        results.push(...batchResults);
      }

    } else {
      // TARGETED MODE: Single research, multiple variations
      console.log(`[Batch] Targeted mode: researching "${niche}"`);

      // 1. Research the niche once
      const trends = await searchTrends(niche!, viralityLevel);
      const bestTrend = trends.find(t => t.volume === 'High' || t.volume === 'Breakout') || trends[0];

      if (!bestTrend) {
        return NextResponse.json({
          error: 'Could not find viable trends for this niche. Try a different search term.',
        }, { status: 400 });
      }

      // 2. Generate first design fully
      const firstListing = await generateListing(bestTrend);
      const shirtColor = bestTrend.recommendedShirtColor || 'black';
      const prompt = firstListing.imagePrompt || `${bestTrend.topic} graphic`;
      const firstImage = await generateDesignImage(prompt, bestTrend.visualStyle || 'Modern', firstListing.designText, bestTrend.typographyStyle, shirtColor, promptMode);

      // Save first design
      const firstResult = await saveDesign(user.id, bestTrend, firstListing, firstImage, promptMode, shirtColor, tierConfig);
      results.push(firstResult);

      // 3. Generate variations in parallel
      if (count > 1) {
        const variationPromises: Promise<BatchResult>[] = [];

        for (let i = 1; i < count; i++) {
          variationPromises.push(generateVariation(user.id, bestTrend, firstListing, i + 1, promptMode, shirtColor, tierConfig));
        }

        // Execute variations in parallel
        const maxConcurrent = tierConfig.features?.concurrentRuns || 2;
        for (let i = 0; i < variationPromises.length; i += maxConcurrent) {
          const batch = variationPromises.slice(i, i + maxConcurrent);
          const batchResults = await Promise.all(batch);
          results.push(...batchResults);
        }
      }
    }

    // Record usage for successful generations
    const successCount = results.filter(r => r.success).length;
    if (successCount > 0) {
      await recordDesignGeneration(user.id, successCount, tier);
    }

    console.log(`[Batch] Completed: ${successCount}/${count} successful`);

    return NextResponse.json({
      success: true,
      mode,
      requested: count,
      generated: successCount,
      results,
    });

  } catch (error) {
    console.error('[API] Batch generate error:', error);
    const message = error instanceof Error ? error.message : 'Batch generation failed';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// Generate a single design (for autopilot mode)
async function generateSingleDesign(
  userId: string,
  query: string,
  viralityLevel: number,
  promptMode: PromptMode,
  tierConfig: any,
  index: number
): Promise<BatchResult> {
  const designId = randomUUID();

  try {
    console.log(`[Batch] Autopilot #${index + 1}: researching "${query}"`);

    // Research
    const trends = await searchTrends(query, viralityLevel);
    const bestTrend = trends.find(t => t.volume === 'High' || t.volume === 'Breakout') || trends[0];

    if (!bestTrend) {
      return { id: designId, success: false, error: 'No trends found' };
    }

    // Generate listing
    const listing = await generateListing(bestTrend);
    const shirtColor = bestTrend.recommendedShirtColor || 'black';

    // Generate image
    const prompt = listing.imagePrompt || `${bestTrend.topic} graphic`;
    const imageUrl = await generateDesignImage(prompt, bestTrend.visualStyle || 'Modern', listing.designText, bestTrend.typographyStyle, shirtColor, promptMode);

    // Save to database
    return await saveDesign(userId, bestTrend, listing, imageUrl, promptMode, shirtColor, tierConfig);

  } catch (error) {
    console.error(`[Batch] Autopilot #${index + 1} failed:`, error);
    return { id: designId, success: false, error: error instanceof Error ? error.message : 'Generation failed' };
  }
}

// Generate a variation (for targeted mode)
async function generateVariation(
  userId: string,
  baseTrend: any,
  sourceListing: any,
  variationIndex: number,
  promptMode: PromptMode,
  shirtColor: string,
  tierConfig: any
): Promise<BatchResult> {
  const designId = randomUUID();

  try {
    console.log(`[Batch] Generating variation #${variationIndex}`);

    // Generate varied listing
    const listing = await generateListingVariation(baseTrend, sourceListing, variationIndex);

    // Generate varied image
    const prompt = listing.imagePrompt || `${baseTrend.topic} graphic variation`;
    const imageUrl = await generateDesignImage(prompt, baseTrend.visualStyle || 'Modern', listing.designText, baseTrend.typographyStyle, shirtColor, promptMode);

    // Save to database
    return await saveDesign(userId, baseTrend, listing, imageUrl, promptMode, shirtColor, tierConfig);

  } catch (error) {
    console.error(`[Batch] Variation #${variationIndex} failed:`, error);
    return { id: designId, success: false, error: error instanceof Error ? error.message : 'Variation failed' };
  }
}

// Save design to database and R2
async function saveDesign(
  userId: string,
  trend: any,
  listing: any,
  imageUrl: string,
  promptMode: PromptMode,
  shirtColor: string,
  tierConfig: any
): Promise<BatchResult> {
  const designId = randomUUID();

  try {
    // Calculate retention
    const retentionDays = parseInt(tierConfig.limits.historyRetention) || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);

    // Save to database
    const design = await prisma.designHistory.create({
      data: {
        userId,
        runId: designId,
        runConfig: { type: 'batch', trend: trend.topic },
        niche: trend.topic,
        slogan: listing.designText,
        designCount: 1,
        targetMarket: trend.platform || 'General',
        listingData: JSON.parse(JSON.stringify(listing)),
        artPrompt: JSON.parse(JSON.stringify({ prompt: listing.imagePrompt, style: trend.visualStyle })),
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

    // Upload research data to R2 for variations feature
    try {
      await uploadResearchData(userId, design.id, { trend, listing });
    } catch (e) {
      console.warn('Failed to upload research data:', e);
    }

    return {
      id: design.id,
      success: true,
      listing,
      imageUrl,
    };

  } catch (error) {
    console.error('[Batch] Save design failed:', error);
    return { id: designId, success: false, error: 'Failed to save design' };
  }
}
