import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { recordDesignGeneration, canGenerateDesigns } from '@/lib/usage';
import prisma from '@/lib/prisma';
import { TrackDesignSchema, safeValidateRequest } from '@/lib/validations';

/**
 * POST /api/designs/track
 * Records a design generation and decrements user's design allowance
 *
 * @param request.body.designCount - Number of designs to track (1-10)
 * @param request.body.idempotencyKey - Optional UUID to prevent duplicate tracking
 *
 * @returns 200 - Successfully tracked with usage info
 * @returns 400 - Validation error
 * @returns 401 - Unauthorized
 * @returns 403 - Generation not allowed (quota exceeded)
 * @returns 404 - User not found
 * @returns 409 - Duplicate request (idempotency key already processed)
 * @returns 500 - Server error
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

    // Parse and validate request body
    const body = await request.json();
    const validation = safeValidateRequest(TrackDesignSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { designCount, idempotencyKey } = validation.data;

    // Fetch user to get their database ID
    // userId from Clerk is the Clerk ID, not database ID
    let user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    // Fallback: try as database ID (for backwards compatibility)
    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: userId },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check idempotency key to prevent duplicate tracking
    if (idempotencyKey) {
      const existingDesign = await prisma.designHistory.findUnique({
        where: { runId: idempotencyKey },
      });

      if (existingDesign) {
        console.log('[Track] Duplicate request detected, idempotencyKey:', idempotencyKey);
        return NextResponse.json(
          {
            success: true,
            duplicate: true,
            message: 'Request already processed',
            runId: idempotencyKey,
          },
          { status: 409 }
        );
      }
    }

    // Check if user is allowed to generate (prevents quota bypass via multiple tabs)
    const canGenerate = await canGenerateDesigns(user.id, designCount);

    if (!canGenerate.allowed) {
      console.log('[Track] User not allowed to generate:', canGenerate.reason);
      return NextResponse.json(
        {
          error: canGenerate.reason || 'Design generation not allowed',
          usage: {
            tier: user.subscriptionTier,
            allowance: canGenerate.allowance,
            used: canGenerate.designsUsed,
            remaining: canGenerate.remaining,
            overage: canGenerate.overageCount,
            overageCharge: canGenerate.overageCharge,
          },
          warning: canGenerate.warning,
        },
        { status: 403 }
      );
    }

    // Record the design generation (this will decrement the user's allowance)
    const runId = crypto.randomUUID();
    console.log('[Track] Recording design for user:', user.id, 'clerkId:', userId, 'count:', designCount);

    const result = await recordDesignGeneration(user.id, designCount, runId);

    console.log('[Track] Successfully recorded, new usage:', result);

    return NextResponse.json({
      success: true,
      usage: result,
      message: `Successfully tracked ${designCount} design(s)`,
    });
  } catch (error: any) {
    console.error('Error tracking design generation:', error);
    return NextResponse.json(
      {
        error: 'Failed to track design generation',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
