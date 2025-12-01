import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/designs/cleanup
 * Cron job endpoint to hard-delete expired designs and free up storage
 *
 * This should be called by a scheduled job (Vercel Cron, GitHub Actions, etc.)
 * Add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/designs/cleanup",
 *     "schedule": "0 2 * * *"  // Run daily at 2 AM UTC
 *   }]
 * }
 *
 * Or protect with a secret token:
 * Authorization: Bearer YOUR_CRON_SECRET
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET;

    if (expectedToken) {
      if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const now = new Date();

    // Find all expired designs that haven't been hard-deleted yet
    const expiredDesigns = await prisma.designHistory.findMany({
      where: {
        expiresAt: {
          lt: now,
        },
        deletedAt: null, // Not yet hard-deleted
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        imageUrl: true,
        zipUrl: true,
      },
    });

    if (expiredDesigns.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired designs to clean up',
        deletedCount: 0,
      });
    }

    // Soft delete expired designs (set deletedAt timestamp)
    const result = await prisma.designHistory.updateMany({
      where: {
        id: {
          in: expiredDesigns.map(d => d.id),
        },
      },
      data: {
        deletedAt: now,
      },
    });

    // TODO: Delete associated files from storage (R2, S3, etc.)
    // For each design:
    // - Delete imageUrl file
    // - Delete zipUrl file
    // Example:
    // for (const design of expiredDesigns) {
    //   if (design.imageUrl) {
    //     await deleteFromR2(design.imageUrl);
    //   }
    //   if (design.zipUrl) {
    //     await deleteFromR2(design.zipUrl);
    //   }
    // }

    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up ${result.count} expired designs`,
      deletedCount: result.count,
      designs: expiredDesigns.map(d => ({
        id: d.id,
        userId: d.userId,
        expiresAt: d.expiresAt,
      })),
    });
  } catch (error: any) {
    console.error('Error cleaning up expired designs:', error);
    return NextResponse.json(
      {
        error: 'Failed to clean up expired designs',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/designs/cleanup
 * Check how many designs are pending cleanup (for monitoring)
 */
export async function GET() {
  try {
    const now = new Date();

    const expiredCount = await prisma.designHistory.count({
      where: {
        expiresAt: {
          lt: now,
        },
        deletedAt: null,
      },
    });

    const soonToExpire = await prisma.designHistory.count({
      where: {
        expiresAt: {
          lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
          gte: now,
        },
        deletedAt: null,
      },
    });

    return NextResponse.json({
      expiredCount,
      soonToExpireCount: soonToExpire,
      lastChecked: now.toISOString(),
    });
  } catch (error: any) {
    console.error('Error checking cleanup status:', error);
    return NextResponse.json(
      {
        error: 'Failed to check cleanup status',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
