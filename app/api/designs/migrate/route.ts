import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { uploadImage, uploadResearchData } from '@/lib/r2-storage';

/**
 * POST /api/designs/migrate
 * Migrates existing designs from database to R2
 *
 * This is a one-time migration endpoint that:
 * 1. Finds all designs with base64 images
 * 2. Uploads them to R2
 * 3. Updates database with R2 URLs
 *
 * Call from browser: POST https://turbomerch.ai/api/designs/migrate
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { clerkId: userId } });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(`[Migration] Starting for user: ${user.id} (${user.email})`);

    // First, get IDs of designs with base64 images (without fetching large fields)
    const designIds = await prisma.designHistory.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        imageUrl: {
          startsWith: 'data:',
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`[Migration] Found ${designIds.length} designs to migrate`);

    if (designIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No designs to migrate',
        migrated: 0,
      });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each design individually to avoid 5MB query limit
    for (const { id } of designIds) {
      try {
        console.log(`[Migration] Processing design ${id}...`);

        // Fetch this design's full data individually
        const design = await prisma.designHistory.findUnique({
          where: { id },
          select: {
            id: true,
            userId: true,
            imageUrl: true,
            runConfig: true,
            listingData: true,
            niche: true,
            slogan: true,
          },
        });

        if (!design) {
          console.log(`[Migration] Design ${id} not found, skipping`);
          continue;
        }

        let r2ImageUrl: string | null = null;
        let r2ResearchUrl: string | null = null;

        // Upload image to R2
        if (design.imageUrl && design.imageUrl.startsWith('data:')) {
          const imageSize = Math.round(design.imageUrl.length / 1024);
          console.log(`[Migration] Image size: ${imageSize}KB`);

          r2ImageUrl = await uploadImage(design.userId!, design.id!, design.imageUrl!);
          console.log(`[Migration] Image uploaded: ${r2ImageUrl}`);
        }

        // Upload research data to R2
        const researchData = {
          runConfig: design.runConfig,
          listingData: design.listingData,
        };

        const researchSize = Math.round(JSON.stringify(researchData).length / 1024);
        console.log(`[Migration] Research size: ${researchSize}KB`);

        r2ResearchUrl = await uploadResearchData(design.userId!, design.id!, researchData);
        console.log(`[Migration] Research uploaded: ${r2ResearchUrl}`);

        // Update database
        const updateData: any = {
          imageUrl: r2ImageUrl || design.imageUrl,
        };

        if (r2ResearchUrl) {
          updateData.runConfig = {
            researchUrl: r2ResearchUrl,
            migratedAt: new Date().toISOString(),
          };
        }

        await prisma.designHistory.update({
          where: { id: design.id! },
          data: updateData,
        });

        console.log(`[Migration] ✅ Design ${id} migrated successfully`);
        successCount++;

        results.push({
          id: id,
          success: true,
        });
      } catch (error: any) {
        console.error(`[Migration] ❌ Error migrating design ${id}:`, error);
        errorCount++;

        results.push({
          id: id,
          success: false,
          error: error.message,
        });
      }
    }

    console.log(`[Migration] Complete: ${successCount} succeeded, ${errorCount} failed`);

    return NextResponse.json({
      success: true,
      message: `Migrated ${successCount} of ${designIds.length} designs`,
      total: designIds.length,
      succeeded: successCount,
      failed: errorCount,
      results,
    });
  } catch (error: any) {
    console.error('[Migration] Fatal error:', error);
    return NextResponse.json(
      {
        error: 'Migration failed',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/designs/migrate
 * Check migration status (how many designs need migration)
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { clerkId: userId } });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const needMigration = await prisma.designHistory.count({
      where: {
        userId: user.id,
        deletedAt: null,
        imageUrl: {
          startsWith: 'data:',
        },
      },
    });

    const alreadyMigrated = await prisma.designHistory.count({
      where: {
        userId: user.id,
        deletedAt: null,
        imageUrl: {
          startsWith: 'https://',
        },
      },
    });

    return NextResponse.json({
      needsMigration: needMigration,
      alreadyMigrated: alreadyMigrated,
      total: needMigration + alreadyMigrated,
    });
  } catch (error: any) {
    console.error('[Migration Check] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check migration status',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
