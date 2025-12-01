import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { fetchResearchData } from '@/lib/r2-storage';

/**
 * GET /api/designs/[id]
 * Fetches a single design with full data (including listingData from R2)
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await props.params;
    const designId = params.id;

    // Find user
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { clerkId: userId } });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch design from database
    const design = await prisma.designHistory.findFirst({
      where: {
        id: designId,
        userId: user.id,
        deletedAt: null,
      },
    });

    if (!design) {
      return NextResponse.json({ error: 'Design not found' }, { status: 404 });
    }

    // Try to fetch full data from R2
    let fullListingData = design.listingData;
    let fullRunConfig = design.runConfig;

    try {
      const researchData = await fetchResearchData(user.id, designId);
      if (researchData) {
        // Use R2 data if available
        if (researchData.listingData) {
          fullListingData = researchData.listingData;
        }
        if (researchData.runConfig) {
          fullRunConfig = researchData.runConfig;
        }
      }
    } catch (error) {
      console.log('[GET Design] R2 fetch failed, using database data:', error);
      // Fall back to database data
    }

    // Transform to frontend format
    const listingData = fullListingData as any;
    const runConfig = fullRunConfig as any;

    return NextResponse.json({
      id: design.id,
      createdAt: design.createdAt.getTime(),
      expiresAt: design.expiresAt?.getTime() || Date.now() + (365 * 24 * 60 * 60 * 1000),
      tierAtCreation: runConfig?.tierAtCreation || 'free',
      trend: runConfig?.trend || {
        topic: design.niche || 'Unknown',
        platform: design.targetMarket || 'General',
        volume: 'Medium',
        sentiment: 'Positive',
        keywords: [],
        description: '',
        visualStyle: '',
        customerPhrases: [],
      },
      listing: {
        title: listingData?.title || design.slogan || 'Untitled Design',
        brand: listingData?.brand || 'Custom Brand',
        bullet1: listingData?.bullet1 || '',
        bullet2: listingData?.bullet2 || '',
        description: listingData?.description || '',
        keywords: listingData?.keywords || [],
        imagePrompt: listingData?.imagePrompt || '',
        designText: listingData?.designText || design.slogan || '',
        price: listingData?.price,
      },
      imageUrl: design.imageUrl || '',
      imageHistory: (design.imageHistory as any[]) || [],
      promptMode: design.promptMode || 'advanced',
    });
  } catch (error: any) {
    console.error('[GET Design] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch design',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/designs/[id]
 * Soft-deletes a design (sets deletedAt timestamp)
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user to get their database ID
    let user = await prisma.user.findUnique({
      where: { id: userId },
    });

    // Try clerkId if not found by id
    if (!user) {
      user = await prisma.user.findUnique({
        where: { clerkId: userId },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const params = await props.params;
    const designId = params.id;

    // Verify ownership and soft delete
    const design = await prisma.designHistory.findFirst({
      where: {
        id: designId,
        userId: user.id,
      },
    });

    if (!design) {
      return NextResponse.json(
        { error: 'Design not found or unauthorized' },
        { status: 404 }
      );
    }

    // Soft delete by setting deletedAt timestamp
    await prisma.designHistory.update({
      where: { id: designId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      message: 'Design deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting design:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete design',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/designs/[id]
 * Updates a design (for regeneration - updates image, imageHistory, analytics)
 */
export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user to get their database ID
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { clerkId: userId } });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const params = await props.params;
    const designId = params.id;

    // Verify ownership
    const design = await prisma.designHistory.findFirst({
      where: {
        id: designId,
        userId: user.id,
        deletedAt: null,
      },
    });

    if (!design) {
      return NextResponse.json(
        { error: 'Design not found or unauthorized' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { imageUrl, imageHistory, regenerationCount, wasRegenerated, promptMode } = body;

    // Build update data - only include fields that are provided
    const updateData: any = {};

    if (imageUrl !== undefined) {
      updateData.imageUrl = imageUrl;
    }

    if (imageHistory !== undefined) {
      updateData.imageHistory = imageHistory;
    }

    if (regenerationCount !== undefined) {
      updateData.regenerationCount = regenerationCount;
    }

    if (wasRegenerated !== undefined) {
      updateData.wasRegenerated = wasRegenerated;
    }

    if (promptMode !== undefined) {
      updateData.promptMode = promptMode;
    }

    // Update the design
    const updatedDesign = await prisma.designHistory.update({
      where: { id: designId },
      data: updateData,
    });

    console.log(`[PATCH Design] Updated design ${designId} with`, Object.keys(updateData).join(', '));

    return NextResponse.json({
      success: true,
      design: {
        id: updatedDesign.id,
        imageUrl: updatedDesign.imageUrl,
        imageHistory: updatedDesign.imageHistory,
        regenerationCount: updatedDesign.regenerationCount,
        promptMode: updatedDesign.promptMode,
      },
    });
  } catch (error: any) {
    console.error('[PATCH Design] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update design',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
