import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { getAvailableAddons, getAddonConfig } from '@/lib/storage-addons';

/**
 * GET /api/storage-addons
 * Get user's active storage addons and available options
 */
export async function GET() {
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

    // Fetch active addons - fail gracefully if table doesn't exist
    let activeAddons: any[] = [];
    try {
      activeAddons = await (prisma as any).storageAddon?.findMany({
        where: {
          userId: user.id,
          status: 'active',
          periodEnd: { gte: new Date() },
        },
      }) || [];
    } catch (error) {
      console.warn('StorageAddon table not found - migration required');
    }

    // Calculate total extra retention
    const totalExtraRetention = activeAddons.reduce((sum, addon) => {
      if (addon.extraRetentionDays === null) return Infinity;
      return sum + addon.extraRetentionDays;
    }, 0);

    const hasUnlimitedStorage = activeAddons.some(
      addon => addon.extraRetentionDays === null
    );

    return NextResponse.json({
      activeAddons: activeAddons.map(addon => ({
        id: addon.id,
        type: addon.addonType,
        monthlyPrice: parseFloat(addon.monthlyPrice.toString()),
        extraRetentionDays: addon.extraRetentionDays,
        currentStorageGB: parseFloat(addon.currentStorageGB.toString()),
        maxStorageGB: addon.maxStorageGB
          ? parseFloat(addon.maxStorageGB.toString())
          : null,
        periodStart: addon.periodStart.toISOString(),
        periodEnd: addon.periodEnd.toISOString(),
      })),
      totalExtraRetention: hasUnlimitedStorage ? null : totalExtraRetention,
      hasUnlimitedStorage,
      availableAddons: getAvailableAddons(),
    });
  } catch (error: any) {
    console.error('Error fetching storage addons:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch storage addons',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/storage-addons
 * Purchase a storage addon
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

    const body = await request.json();
    const { addonId } = body;

    // Validate addon type
    const addon = getAddonConfig(addonId);
    if (!addon) {
      return NextResponse.json(
        { error: 'Invalid addon type' },
        { status: 400 }
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

    // Create storage addon record
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const storageAddon = await (prisma as any).storageAddon.create({
      data: {
        userId: user.id,
        addonType: addon.id,
        status: 'active',
        monthlyPrice: addon.price,
        stripePriceId: addon.stripePriceId,
        extraRetentionDays: addon.extraRetentionDays,
        periodStart: now,
        periodEnd,
      },
    });

    // TODO: Create Stripe subscription for recurring billing
    // const stripeSubscription = await stripe.subscriptions.create({
    //   customer: user.stripeCustomerId,
    //   items: [{ price: addon.stripePriceId }],
    //   metadata: {
    //     storageAddonId: storageAddon.id,
    //     userId: user.id,
    //   },
    // });
    //
    // await prisma.storageAddon.update({
    //   where: { id: storageAddon.id },
    //   data: { stripeSubId: stripeSubscription.id },
    // });

    return NextResponse.json({
      success: true,
      addon: {
        id: storageAddon.id,
        type: storageAddon.addonType,
        monthlyPrice: parseFloat(storageAddon.monthlyPrice.toString()),
        extraRetentionDays: storageAddon.extraRetentionDays,
        periodStart: storageAddon.periodStart.toISOString(),
        periodEnd: storageAddon.periodEnd.toISOString(),
      },
      message: `Successfully activated ${addon.name}`,
    });
  } catch (error: any) {
    console.error('Error purchasing storage addon:', error);
    return NextResponse.json(
      {
        error: 'Failed to purchase storage addon',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
