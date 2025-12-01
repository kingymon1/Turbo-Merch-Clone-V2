import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/user/debug-usage
 * Debug endpoint to see exactly what's in the UsageTracking table
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find user in database
    let user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      user = await prisma.user.findUnique({
        where: { clerkId: userId },
      });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get ALL usage tracking records for this user
    const usageRecords = await prisma.usageTracking.findMany({
      where: { userId: user.id },
      orderBy: { billingPeriodStart: 'desc' },
    });

    // Get design history count for current period
    const currentUsage = usageRecords[0];
    let designHistory = null;

    if (currentUsage) {
      const designs = await prisma.designHistory.findMany({
        where: {
          userId: user.id,
          createdAt: {
            gte: currentUsage.billingPeriodStart,
            lte: currentUsage.billingPeriodEnd,
          },
        },
        select: {
          id: true,
          createdAt: true,
          designCount: true,
          wasOverage: true,
          chargeAmount: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const totalDesignCount = designs.reduce((sum, d) => sum + d.designCount, 0);

      designHistory = {
        totalRecords: designs.length,
        totalDesigns: totalDesignCount,
        designs: designs,
      };
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        subscribedAt: user.subscribedAt,
      },
      usageTracking: usageRecords.map(record => ({
        id: record.id,
        billingPeriodStart: record.billingPeriodStart,
        billingPeriodEnd: record.billingPeriodEnd,
        designsUsedInPeriod: record.designsUsedInPeriod,
        designsAllowance: record.designsAllowance,
        overageDesigns: record.overageDesigns,
        overageCharge: record.overageCharge.toString(),
        lastGenerationAt: record.lastGenerationAt,
        softCapReached: record.softCapReached,
        hardCapReached: record.hardCapReached,
      })),
      designHistory,
      analysis: currentUsage ? {
        recordedInUsageTracking: currentUsage.designsUsedInPeriod,
        actualDesignsInHistory: designHistory?.totalDesigns,
        discrepancy: designHistory ? currentUsage.designsUsedInPeriod - designHistory.totalDesigns : 'N/A',
        calculatedOverage: Math.max(0, currentUsage.designsUsedInPeriod - currentUsage.designsAllowance),
        storedOverage: currentUsage.overageDesigns,
        overageMismatch: currentUsage.overageDesigns !== Math.max(0, currentUsage.designsUsedInPeriod - currentUsage.designsAllowance),
      } : null,
    });
  } catch (error: any) {
    console.error('Debug usage error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch usage debug info',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
