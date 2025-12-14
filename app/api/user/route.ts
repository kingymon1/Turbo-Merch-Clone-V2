import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getUserUsageSummary } from '@/lib/usage';
import prisma from '@/lib/prisma';

// Auto-admin emails - these users are automatically granted admin access
const AUTO_ADMIN_EMAILS = [
  'dave-king1@hotmail.co.uk',
];

/**
 * GET /api/user
 * Fetches current user's subscription and usage data
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

    // Fetch user data from database - try both id and clerkId for backwards compatibility
    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        subscribedAt: true,
        trialEndsAt: true,
        isAdmin: true,
      },
    });

    // If not found by id, try by clerkId (for legacy data)
    if (!user) {
      user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: {
          id: true,
          email: true,
          name: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          subscribedAt: true,
          trialEndsAt: true,
          isAdmin: true,
        },
      });
    }

    if (!user) {
      // User not found - create with free tier
      const clerkUser = await currentUser();
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress || `${userId}@temp.local`;
      const name = clerkUser?.firstName || clerkUser?.username || null;
      const shouldBeAdmin = AUTO_ADMIN_EMAILS.includes(email.toLowerCase());

      const newUser = await prisma.user.create({
        data: {
          id: userId,
          clerkId: userId,
          email,
          name,
          subscriptionTier: 'free',
          subscriptionStatus: 'active',
          isAdmin: shouldBeAdmin,
        },
      });

      return NextResponse.json({
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          subscriptionTier: newUser.subscriptionTier,
          subscriptionStatus: newUser.subscriptionStatus,
          subscribedAt: newUser.subscribedAt,
          trialEndsAt: newUser.trialEndsAt,
          isAdmin: newUser.isAdmin,
        },
        usage: {
          tier: 'Free',
          allowance: 3,
          used: 0,
          remaining: 3,
          overage: 0,
          overageCharge: 0,
          periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }

    // Auto-promote to admin if email is in the auto-admin list
    if (!user.isAdmin && AUTO_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isAdmin: true },
      });
      user.isAdmin = true;
    }

    // Fetch usage summary using the database user ID (not Clerk ID)
    const usage = await getUserUsageSummary(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        subscribedAt: user.subscribedAt,
        trialEndsAt: user.trialEndsAt,
        isAdmin: user.isAdmin,
      },
      usage,
    });
  } catch (error: any) {
    console.error('Error fetching user data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch user data',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
