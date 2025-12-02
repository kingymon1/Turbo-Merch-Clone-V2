import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

/**
 * DELETE /api/storage-addons/[id]
 * Cancel a storage addon subscription
 */
export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user
    let user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      user = await prisma.user.findUnique({
        where: { clerkId: userId },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const params = await props.params;
    const addonId = params.id;

    // Check if StorageAddon table exists
    if (!(prisma as any).storageAddon) {
      return NextResponse.json(
        {
          error: 'Storage addon feature not available',
          message: 'Database migration required. Please contact support.',
        },
        { status: 503 }
      );
    }

    // Verify ownership and get addon
    const addon = await (prisma as any).storageAddon.findFirst({
      where: {
        id: addonId,
        userId: user.id,
      },
    });

    if (!addon) {
      return NextResponse.json(
        { error: 'Storage addon not found or unauthorized' },
        { status: 404 }
      );
    }

    // Cancel addon (keep active until end of current period)
    const now = new Date();
    await (prisma as any).storageAddon.update({
      where: { id: addonId },
      data: {
        status: 'cancelled',
        cancelledAt: now,
        expiresAt: addon.periodEnd, // Expires at end of paid period
      },
    });

    // TODO: Cancel Stripe subscription
    // if (addon.stripeSubId) {
    //   await stripe.subscriptions.cancel(addon.stripeSubId, {
    //     at_period_end: true, // Don't cancel immediately, wait for period end
    //   });
    // }

    return NextResponse.json({
      success: true,
      message: 'Storage addon cancelled. You can continue using it until the end of your current billing period.',
      expiresAt: addon.periodEnd.toISOString(),
    });
  } catch (error: any) {
    console.error('Error cancelling storage addon:', error);
    return NextResponse.json(
      {
        error: 'Failed to cancel storage addon',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
