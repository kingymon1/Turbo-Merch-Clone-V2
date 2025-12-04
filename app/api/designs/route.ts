import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { getTierConfig, parseRetentionDays } from '@/lib/pricing';
import type { TierName } from '@/lib/pricing';
import { uploadImage, uploadResearchData } from '@/lib/r2-storage';

/**
 * GET /api/designs
 * Fetches user's saved designs (excluding expired/deleted)
 * Supports pagination with ?limit=N&offset=M query parameters
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    console.log('[GET /api/designs] Clerk userId:', userId);

    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 50); // Max 50
    const offset = parseInt(searchParams.get('offset') || '0', 10);

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

    console.log('[GET /api/designs] User found by id:', user ? `${user.id} (${user.email})` : 'null');

    // Try clerkId if not found by id
    if (!user) {
      user = await prisma.user.findUnique({
        where: { clerkId: userId },
      });
      console.log('[GET /api/designs] User found by clerkId:', user ? `${user.id} (${user.email})` : 'null');
    }

    if (!user) {
      console.log('[GET /api/designs] No user found - returning empty array');
      return NextResponse.json({ designs: [] });
    }

    // Define the where clause for active (non-expired, non-deleted) designs
    const whereClause = {
      userId: user.id,
      deletedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gte: new Date() } },
      ],
    };

    // Get total count of active designs for pagination
    const totalActive = await prisma.designHistory.count({
      where: whereClause,
    });
    console.log(`[GET /api/designs] Total active designs for user ${user.id}: ${totalActive}`);

    // Fetch paginated designs
    const designs = await prisma.designHistory.findMany({
      where: whereClause,
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        niche: true,
        slogan: true,
        targetMarket: true,
        imageUrl: true,
        imageHistory: true, // All image versions
        promptMode: true,
        runConfig: true, // Now safe to include - contains only tierAtCreation and researchUrl after R2 migration
        // listingData still excluded - fetched on-demand from R2 when needed
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: offset,
      take: limit,
    });

    console.log(`[GET /api/designs] Returning ${designs.length} designs (offset: ${offset}, limit: ${limit}, total: ${totalActive})`);

    // Transform to frontend format (SavedListing)
    console.log('[GET /api/designs] Starting transformation...');
    const savedListings = designs.map((design, index) => {
      try {
        // Note: listingData excluded from query (stored in R2), runConfig now contains only small metadata
        console.log(`[GET /api/designs] Transforming design ${index + 1}/${designs.length}: ${design.id}`);

        // Extract tierAtCreation from runConfig
        const runConfig = design.runConfig as any;
        const tierAtCreation = runConfig?.tierAtCreation || 'free';

        return {
          id: design.id,
          createdAt: design.createdAt.getTime(),
          expiresAt: design.expiresAt?.getTime() || Date.now() + (365 * 24 * 60 * 60 * 1000),
          tierAtCreation,
          trend: {
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
            title: design.slogan || 'Untitled Design',
            brand: 'Custom Brand',
            bullet1: '',
            bullet2: '',
            description: '',
            keywords: [],
            imagePrompt: '',
            designText: design.slogan || '',
            price: undefined,
          },
          imageUrl: design.imageUrl || '',
          imageHistory: (design as any).imageHistory || [],
          promptMode: (design as any).promptMode || 'advanced',
        };
      } catch (transformError: any) {
        console.error(`[GET /api/designs] Error transforming design ${design.id}:`, transformError);
        // Return a minimal valid object to prevent the whole request from failing
        return {
          id: design.id,
          createdAt: design.createdAt.getTime(),
          expiresAt: design.expiresAt?.getTime() || Date.now() + (365 * 24 * 60 * 60 * 1000),
          tierAtCreation: 'free',
          trend: {
            topic: 'Unknown',
            platform: 'General',
            volume: 'Medium',
            sentiment: 'Positive',
            keywords: [],
            description: '',
            visualStyle: '',
            customerPhrases: [],
          },
          listing: {
            title: 'Error Loading Design',
            brand: 'Unknown',
            bullet1: '',
            bullet2: '',
            description: '',
            keywords: [],
            imagePrompt: '',
            designText: '',
          },
          imageUrl: '',
        };
      }
    });

    console.log('[GET /api/designs] Transformation complete, returning response');
    return NextResponse.json({
      designs: savedListings,
      total: totalActive,
      hasMore: offset + designs.length < totalActive,
    });
  } catch (error: any) {
    console.error('[GET /api/designs] FATAL ERROR:', error);
    console.error('[GET /api/designs] Error stack:', error?.stack);
    return NextResponse.json(
      {
        error: 'Failed to fetch designs',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/designs
 * Saves a new design to the database
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user to get their database ID and tier
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

    const body = await request.json();
    const { trend, listing, imageUrl, imageHistory, tierAtCreation, runConfig, promptMode } = body;

    // Generate design ID early so we can use it for R2 uploads
    const designId = crypto.randomUUID();

    // Upload image to R2 if it's a base64 data URI
    let r2ImageUrl = imageUrl;
    let uploadedResearchUrl: string | null = null;

    try {
      if (imageUrl && imageUrl.startsWith('data:')) {
        console.log('[POST /api/designs] Uploading image to R2...');
        r2ImageUrl = await uploadImage(user.id, designId, imageUrl);
        console.log('[POST /api/designs] Image uploaded to R2:', r2ImageUrl);
      }

      // Upload research data to R2 if provided
      if (runConfig) {
        console.log('[POST /api/designs] Uploading research data to R2...');
        uploadedResearchUrl = await uploadResearchData(user.id, designId, runConfig);
        console.log('[POST /api/designs] Research data uploaded to R2:', uploadedResearchUrl);
      }
    } catch (r2Error) {
      console.error('[POST /api/designs] R2 upload failed, falling back to database storage:', r2Error);
      // Continue with database storage as fallback
      r2ImageUrl = imageUrl;
    }

    // Calculate retention period based on tier
    const tier = getTierConfig((tierAtCreation || user.subscriptionTier) as TierName);
    let retentionDays = parseRetentionDays(tier.limits.historyRetention);

    // Check for active storage addons to extend retention
    // Note: This will fail gracefully if StorageAddon table doesn't exist yet
    let hasUnlimitedStorage = false;
    try {
      const activeAddons = await (prisma as any).storageAddon?.findMany({
        where: {
          userId: user.id,
          status: 'active',
          periodEnd: { gte: new Date() },
        },
      });

      // Calculate total extra retention from addons
      if (activeAddons) {
        for (const addon of activeAddons) {
          if (addon.extraRetentionDays === null) {
            hasUnlimitedStorage = true;
            break;
          }
          retentionDays += addon.extraRetentionDays;
        }
      }
    } catch (error) {
      // StorageAddon table doesn't exist yet - migration not applied
      console.warn('StorageAddon feature not available - migration required');
    }

    const now = new Date();
    const expiresAt = hasUnlimitedStorage
      ? null // Unlimited storage - never expires
      : new Date(now.getTime() + (retentionDays * 24 * 60 * 60 * 1000));

    // Create design record
    const design = await prisma.designHistory.create({
      data: {
        id: designId, // Use pre-generated ID that matches R2 uploads
        userId: user.id,
        runId: crypto.randomUUID(),
        // Store minimal runConfig if research was uploaded to R2, otherwise store full
        runConfig: uploadedResearchUrl
          ? {
              tierAtCreation: tierAtCreation || user.subscriptionTier,
              savedAt: now.toISOString(),
              researchUrl: uploadedResearchUrl, // Reference to R2
            }
          : {
              tierAtCreation: tierAtCreation || user.subscriptionTier,
              trend,
              savedAt: now.toISOString(),
            },
        niche: trend?.topic || 'Unknown',
        slogan: listing?.designText || listing?.title || null,
        designCount: 1,
        targetMarket: trend?.platform || 'General',
        listingData: listing,
        artPrompt: {
          prompt: listing?.imagePrompt || '',
          style: trend?.visualStyle || '',
        },
        imageUrl: r2ImageUrl || null, // Use R2 URL instead of base64
        imageHistory: imageHistory || null, // Array of all image versions
        imageQuality: 'standard',
        canDownload: true,
        promptMode: promptMode || null, // 'advanced' | 'simple'
        expiresAt,
      },
    });

    // Return in SavedListing format
    return NextResponse.json({
      success: true,
      design: {
        id: design.id,
        createdAt: design.createdAt.getTime(),
        expiresAt: design.expiresAt ? design.expiresAt.getTime() : (expiresAt ? expiresAt.getTime() : Date.now() + (365 * 24 * 60 * 60 * 1000)),
        tierAtCreation: tierAtCreation || user.subscriptionTier,
        trend,
        listing,
        imageUrl: imageUrl || '',
        imageHistory: imageHistory || [], // All image versions
        promptMode: promptMode || 'advanced',
      },
    });
  } catch (error: any) {
    console.error('Error saving design:', error);
    return NextResponse.json(
      {
        error: 'Failed to save design',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
