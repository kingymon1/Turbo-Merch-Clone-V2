/**
 * POST /api/merch/dominate
 *
 * Generate multiple unique variations of a design to "dominate" a niche.
 * Uses AI to create diverse visual strategies for each variation.
 *
 * PERFORMANCE NOTES:
 * - Uses parallel batch processing (3 at a time)
 * - 250s time budget with partial results on timeout
 * - Recommended: 5-10 variations for reliable completion
 * - Max: 20 variations per request
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import {
  generateVariations,
  getVariationsForDesign,
  estimateGenerationTime,
} from '@/lib/merch/variation-generator';
import { MerchDesign } from '@/lib/merch/types';

// Increase timeout for bulk generation (max 300s on Vercel Pro)
export const maxDuration = 300;

// Limits
const DEFAULT_COUNT = 5;
const MAX_COUNT = 20;  // Reduced from 50 to ensure completion within timeout

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { designId, count = DEFAULT_COUNT } = body;

    // Validate inputs
    if (!designId) {
      return NextResponse.json(
        { success: false, error: 'designId is required' },
        { status: 400 }
      );
    }

    if (typeof count !== 'number' || count < 1 || count > MAX_COUNT) {
      return NextResponse.json(
        { success: false, error: `count must be between 1 and ${MAX_COUNT}` },
        { status: 400 }
      );
    }

    // Get original design
    const originalDesign = await prisma.merchDesign.findUnique({
      where: {
        id: designId,
        userId,
      },
    });

    if (!originalDesign) {
      return NextResponse.json(
        { success: false, error: 'Design not found or access denied' },
        { status: 404 }
      );
    }

    console.log(`[Dominate API] Starting ${count} variations for design ${designId}`);
    console.log(`[Dominate API] Estimated time: ${estimateGenerationTime(count)}`);

    // Transform to MerchDesign type
    const original: MerchDesign = {
      id: originalDesign.id,
      createdAt: originalDesign.createdAt,
      updatedAt: originalDesign.updatedAt,
      userId: originalDesign.userId,
      mode: originalDesign.mode as 'autopilot' | 'manual',
      phrase: originalDesign.phrase,
      niche: originalDesign.niche,
      style: originalDesign.style ?? undefined,
      tone: originalDesign.tone ?? undefined,
      imageUrl: originalDesign.imageUrl,
      imagePrompt: originalDesign.imagePrompt,
      listingTitle: originalDesign.listingTitle,
      listingBullets: originalDesign.listingBullets,
      listingDesc: originalDesign.listingDesc,
      approved: originalDesign.approved,
      views: originalDesign.views,
      sales: originalDesign.sales,
      parentId: originalDesign.parentId ?? undefined,
    };

    // Generate variations
    const result = await generateVariations(original, count, userId);

    console.log(`[Dominate API] Complete: ${result.variations.length} successful, ${result.failed} failed${result.timedOut ? ' (timed out)' : ''}`);

    // Build response message
    let message: string;
    if (result.timedOut) {
      message = `Generated ${result.variations.length} of ${count} variations (timed out - try requesting fewer variations)`;
    } else if (result.failed > 0) {
      message = `Generated ${result.variations.length} of ${count} variations (${result.failed} failed)`;
    } else {
      message = `Successfully generated ${result.variations.length} variations`;
    }

    return NextResponse.json({
      success: true,
      count: result.variations.length,
      requested: count,
      failed: result.failed,
      timedOut: result.timedOut || false,
      variations: result.variations,
      strategies: result.strategies,
      message,
    });
  } catch (error) {
    console.error('[Dominate API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate variations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/merch/dominate?designId=xxx
 *
 * Get all existing variations for a design
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const designId = searchParams.get('designId');

    if (!designId) {
      return NextResponse.json(
        { success: false, error: 'designId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify original design exists and belongs to user
    const originalDesign = await prisma.merchDesign.findUnique({
      where: {
        id: designId,
        userId,
      },
    });

    if (!originalDesign) {
      return NextResponse.json(
        { success: false, error: 'Design not found or access denied' },
        { status: 404 }
      );
    }

    // Get variations
    const variations = await getVariationsForDesign(designId, userId);

    return NextResponse.json({
      success: true,
      count: variations.length,
      variations,
      original: {
        id: originalDesign.id,
        phrase: originalDesign.phrase,
        niche: originalDesign.niche,
        imageUrl: originalDesign.imageUrl,
      },
    });
  } catch (error) {
    console.error('[Dominate API] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch variations' },
      { status: 500 }
    );
  }
}
