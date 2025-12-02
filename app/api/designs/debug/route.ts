import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

/**
 * Debug endpoint to check raw design data
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Find user
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { clerkId: userId } });
    }

    if (!user) {
      return NextResponse.json({
        debug: 'User not found in database',
        clerkUserId: userId,
      });
    }

    // Get design count
    const totalDesigns = await prisma.designHistory.count({
      where: { userId: user.id },
    });

    const activeDesigns = await prisma.designHistory.count({
      where: {
        userId: user.id,
        deletedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
    });

    // Get first design (raw)
    const firstDesign = await prisma.designHistory.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      debug: 'Debug info',
      user: {
        id: user.id,
        email: user.email,
        tier: user.subscriptionTier,
      },
      counts: {
        total: totalDesigns,
        active: activeDesigns,
        expired: totalDesigns - activeDesigns,
      },
      sampleDesign: firstDesign ? {
        id: firstDesign.id,
        createdAt: firstDesign.createdAt,
        expiresAt: firstDesign.expiresAt,
        hasListingData: !!firstDesign.listingData,
        hasRunConfig: !!firstDesign.runConfig,
        hasImageUrl: !!firstDesign.imageUrl,
      } : null,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
