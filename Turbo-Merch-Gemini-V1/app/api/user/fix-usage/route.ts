import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { calculateOverage, type TierName } from '@/lib/pricing';

/**
 * POST /api/user/fix-usage
 * One-time fix to recalculate overage for users affected by the double-counting bug
 */
export async function POST() {
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

    // Get current usage tracking record
    const currentUsage = await prisma.usageTracking.findFirst({
      where: {
        userId: user.id,
        billingPeriodEnd: { gte: new Date() },
      },
      orderBy: { billingPeriodStart: 'desc' },
    });

    if (!currentUsage) {
      return NextResponse.json({
        message: 'No current usage record found - nothing to fix',
      });
    }

    // Recalculate overage based on the ACTUAL usage count
    const correctOverageCalc = calculateOverage(
      user.subscriptionTier as TierName,
      currentUsage.designsUsedInPeriod
    );

    // Update the record with correct values
    const updated = await prisma.usageTracking.update({
      where: { id: currentUsage.id },
      data: {
        overageDesigns: correctOverageCalc.overage,
        overageCharge: correctOverageCalc.overageCharge,
        softCapReached: correctOverageCalc.approachingSoftCap,
        hardCapReached: correctOverageCalc.atHardCap,
      },
    });

    return NextResponse.json({
      message: 'Usage record fixed successfully',
      before: {
        designsUsed: currentUsage.designsUsedInPeriod,
        allowance: currentUsage.designsAllowance,
        overage: currentUsage.overageDesigns,
        overageCharge: currentUsage.overageCharge.toString(),
        hardCapReached: currentUsage.hardCapReached,
      },
      after: {
        designsUsed: updated.designsUsedInPeriod,
        allowance: updated.designsAllowance,
        overage: updated.overageDesigns,
        overageCharge: updated.overageCharge.toString(),
        hardCapReached: updated.hardCapReached,
      },
      calculation: correctOverageCalc,
    });
  } catch (error: any) {
    console.error('Fix usage error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fix usage',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
