/**
 * POST /api/stripe/check-upgrade-overages
 *
 * Checks if the user has pending overages before upgrading.
 * Returns overage details so the UI can show the credit offset offer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { PRICING_TIERS, TierName } from '@/lib/pricing';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { newTier } = body;

    if (!newTier || !PRICING_TIERS[newTier as TierName]) {
      return NextResponse.json(
        { error: 'Invalid tier specified' },
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

    const currentTier = (user.subscriptionTier || 'free') as TierName;

    // Get current usage record
    const usageRecord = await prisma.usageTracking.findFirst({
      where: {
        userId: user.id,
        billingPeriodEnd: { gte: new Date() },
      },
      orderBy: { billingPeriodStart: 'desc' },
    });

    const overageCount = usageRecord?.overageDesigns || 0;
    const overageCharge = Number(usageRecord?.overageCharge || 0);

    return NextResponse.json({
      hasOverages: overageCount > 0,
      currentTier,
      newTier,
      overageCount,
      overageCharge,
      newTierAllowance: PRICING_TIERS[newTier as TierName].limits.designs,
    });

  } catch (error) {
    console.error('[API] Check upgrade overages error:', error);
    return NextResponse.json(
      { error: 'Failed to check overages' },
      { status: 500 }
    );
  }
}
