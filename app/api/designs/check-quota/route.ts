import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { canGenerateDesigns } from '@/lib/usage';
import prisma from '@/lib/prisma';
import { CheckQuotaSchema, safeValidateRequest } from '@/lib/validations';
import { checkRateLimit, RATE_LIMITS, rateLimitHeaders } from '@/lib/rateLimit';

/**
 * POST /api/designs/check-quota
 * Checks if user can generate designs without recording usage
 *
 * @param request.body.designCount - Number of designs to check quota for (1-10)
 *
 * @returns 200 - Quota check result with usage info
 * @returns 400 - Validation error
 * @returns 401 - Unauthorized
 * @returns 403 - Generation not allowed (quota exceeded)
 * @returns 404 - User not found
 * @returns 429 - Rate limit exceeded
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
    const validation = safeValidateRequest(CheckQuotaSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { designCount } = validation.data;

    // Fetch user to get their database ID
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

    // Check rate limit for API requests
    const rateLimitResult = await checkRateLimit(user.id, RATE_LIMITS.api);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: rateLimitHeaders(rateLimitResult),
        }
      );
    }

    // Check if user is allowed to generate
    const canGenerate = await canGenerateDesigns(user.id, designCount);

    if (!canGenerate.allowed) {
      return NextResponse.json(
        {
          allowed: false,
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

    return NextResponse.json({
      allowed: true,
      usage: {
        tier: user.subscriptionTier,
        allowance: canGenerate.allowance,
        used: canGenerate.designsUsed,
        remaining: canGenerate.remaining,
        overage: canGenerate.overageCount,
        overageCharge: canGenerate.overageCharge,
        inOverage: canGenerate.inOverage,
      },
      warning: canGenerate.warning, // Include warning for overage charges
    });
  } catch (error: any) {
    console.error('Error checking quota:', error);
    return NextResponse.json(
      {
        error: 'Failed to check quota',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
