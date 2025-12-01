import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/designs/export
 * Export all user's designs as JSON for backup/download
 *
 * Returns comprehensive data including:
 * - All design metadata
 * - Trend research data
 * - Listing copy
 * - Image URLs
 * - Creation/expiration dates
 */
export async function GET(request: NextRequest) {
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
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionTier: true,
      },
    });

    // Try clerkId if not found by id
    if (!user) {
      user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: {
          id: true,
          email: true,
          name: true,
          subscriptionTier: true,
        },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get format parameter (json or csv)
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const includeExpired = searchParams.get('includeExpired') === 'true';

    // Fetch all designs (including expired if requested)
    const whereClause: any = {
      userId: user.id,
      deletedAt: null,
    };

    if (!includeExpired) {
      whereClause.OR = [
        { expiresAt: null },
        { expiresAt: { gte: new Date() } },
      ];
    }

    const designs = await prisma.designHistory.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform to export format
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        email: user.email,
        name: user.name,
        tier: user.subscriptionTier,
      },
      totalDesigns: designs.length,
      designs: designs.map(design => ({
        id: design.id,
        createdAt: design.createdAt.toISOString(),
        expiresAt: design.expiresAt?.toISOString() || null,
        tier: (design.runConfig as any)?.tierAtCreation || user.subscriptionTier,

        // Trend data
        trend: {
          topic: design.niche,
          platform: design.targetMarket,
          ...(design.runConfig as any)?.trend,
        },

        // Listing data
        listing: design.listingData,

        // Design details
        slogan: design.slogan,
        designCount: design.designCount,

        // Files
        imageUrl: design.imageUrl,
        csvUrl: design.zipUrl,

        // Art prompt
        artPrompt: design.artPrompt,

        // Quality settings
        imageQuality: design.imageQuality,
        canDownload: design.canDownload,
      })),
    };

    if (format === 'csv') {
      // Generate CSV format
      const csvHeaders = [
        'ID',
        'Created At',
        'Expires At',
        'Tier',
        'Topic',
        'Platform',
        'Title',
        'Brand',
        'Description',
        'Slogan',
        'Image URL',
      ];

      const csvRows = designs.map(design => {
        const listing = design.listingData as any;
        return [
          design.id,
          design.createdAt.toISOString(),
          design.expiresAt?.toISOString() || '',
          (design.runConfig as any)?.tierAtCreation || user.subscriptionTier,
          design.niche,
          design.targetMarket,
          listing?.title || '',
          listing?.brand || '',
          (listing?.description || '').replace(/"/g, '""'), // Escape quotes
          design.slogan || '',
          design.imageUrl || '',
        ].map(value => `"${value}"`).join(',');
      });

      const csv = [csvHeaders.join(','), ...csvRows].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="turbo-merch-designs-${Date.now()}.csv"`,
        },
      });
    }

    // Return JSON format
    return NextResponse.json(exportData, {
      headers: {
        'Content-Disposition': `attachment; filename="turbo-merch-designs-${Date.now()}.json"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting designs:', error);
    return NextResponse.json(
      {
        error: 'Failed to export designs',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
