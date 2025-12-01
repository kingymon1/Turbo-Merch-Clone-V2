/**
 * POST /api/gemini/refine-image
 *
 * Server-side endpoint for refining/editing existing images using Gemini's image-to-image capabilities.
 * Sends the original image + modification instructions to get a refined version.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { refineDesignImage } from '@/services/geminiService';
import prisma from '@/lib/prisma';
import { PRICING_TIERS, TierName } from '@/lib/pricing';

interface RefineImageRequest {
  imageUrl: string; // Base64 data URL of the image to refine
  instruction: string; // User's refinement instruction (e.g., "change text to green")
  designId?: string; // Optional design ID for tracking refinements
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: RefineImageRequest = await request.json();

    if (!body.imageUrl || !body.instruction) {
      return NextResponse.json(
        { error: 'Missing required fields: imageUrl and instruction' },
        { status: 400 }
      );
    }

    // Get user and their refinement count for this design
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

    const tier = (user.subscriptionTier || 'free') as TierName;

    // Check refinement quota if designId is provided
    let isFirstRefinement = true;
    let refinementCount = 0;

    if (body.designId) {
      // Get the design to check refinement count
      const design = await prisma.designHistory.findUnique({
        where: { id: body.designId },
        select: { refinementCount: true },
      });

      if (design) {
        refinementCount = design.refinementCount || 0;
        isFirstRefinement = refinementCount === 0;
      }
    }

    // First refinement is free, subsequent ones count against quota
    if (!isFirstRefinement) {
      // Check if user has quota remaining (or can use overage)
      const usageRecord = await prisma.usageTracking.findFirst({
        where: {
          userId: user.id,
          billingPeriodEnd: { gte: new Date() },
        },
        orderBy: { billingPeriodStart: 'desc' },
      });

      const tierConfig = PRICING_TIERS[tier];
      const used = usageRecord?.designsUsedInPeriod || 0;
      const allowance = tierConfig.limits.designs;
      const overage = usageRecord?.overageDesigns || 0;
      const hardCap = tierConfig.overage.hardCap || 0;

      // Check if at hard cap
      if (tier === 'free' && used >= allowance) {
        return NextResponse.json({
          error: 'Free tier refinement limit reached. Upgrade to continue.',
          requiresUpgrade: true,
          quotaExceeded: true,
        }, { status: 403 });
      }

      if (tierConfig.overage.enabled && overage >= hardCap) {
        return NextResponse.json({
          error: 'Monthly limit reached. Please upgrade or wait for next billing cycle.',
          requiresUpgrade: true,
          quotaExceeded: true,
        }, { status: 403 });
      }
    }

    console.log(`[API] Refining image for user ${userId}, instruction: "${body.instruction.substring(0, 50)}..."`);

    // Call the refinement function
    const refinedImageUrl = await refineDesignImage(body.imageUrl, body.instruction);

    // Update refinement count if designId provided and not first refinement
    if (body.designId) {
      await prisma.designHistory.update({
        where: { id: body.designId },
        data: {
          refinementCount: refinementCount + 1,
          imageHistory: {
            push: {
              imageUrl: refinedImageUrl,
              type: 'refinement',
              instruction: body.instruction,
              generatedAt: Date.now(),
            },
          },
        },
      });

      // Increment usage if not first refinement
      if (!isFirstRefinement) {
        await incrementUsage(user.id, tier);
      }
    }

    return NextResponse.json({
      success: true,
      imageUrl: refinedImageUrl,
      isFirstRefinement,
      refinementCount: refinementCount + 1,
    });

  } catch (error) {
    console.error('[API] Refine image error:', error);

    const message = error instanceof Error ? error.message : 'Failed to refine image';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// Helper to increment usage for refinements
async function incrementUsage(userId: string, tier: TierName) {
  const tierConfig = PRICING_TIERS[tier];
  const now = new Date();

  // Find or create usage record
  let usageRecord = await prisma.usageTracking.findFirst({
    where: {
      userId,
      billingPeriodEnd: { gte: now },
    },
    orderBy: { billingPeriodStart: 'desc' },
  });

  if (!usageRecord) {
    // Create new usage record for this billing period
    const periodStart = now;
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    usageRecord = await prisma.usageTracking.create({
      data: {
        userId,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        designsUsedInPeriod: 0,
        designsAllowance: tierConfig.limits.designs,
        overageDesigns: 0,
        overageCharge: 0,
      },
    });
  }

  const newUsed = usageRecord.designsUsedInPeriod + 1;
  const isOverage = newUsed > tierConfig.limits.designs;

  await prisma.usageTracking.update({
    where: { id: usageRecord.id },
    data: {
      designsUsedInPeriod: newUsed,
      overageDesigns: isOverage
        ? (usageRecord.overageDesigns || 0) + 1
        : usageRecord.overageDesigns,
      overageCharge: isOverage
        ? Number(usageRecord.overageCharge || 0) + tierConfig.overage.pricePerDesign
        : usageRecord.overageCharge,
    },
  });
}
