import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

const PRICE_ID_TO_TIER: Record<string, string> = {
  'price_1STqHMEKIZQ9UmMylIFu9Ge5': 'starter',
  'price_1STqJ1EKIZQ9UmMyD1lQmhos': 'pro',
  'price_1STqK1EKIZQ9UmMyFl7dkknM': 'business',
  'price_1STqL9EKIZQ9UmMyr8oWtfgt': 'enterprise',
};

/**
 * POST /api/user/sync-stripe
 * Manually sync current user's Stripe subscription with database
 * Useful for troubleshooting or when webhooks haven't fired yet
 */
export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Try to find user by id first, then by clerkId (for legacy data)
    let user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        subscribedAt: true,
      },
    });

    if (!user) {
      user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: {
          id: true,
          email: true,
          stripeCustomerId: true,
          subscriptionTier: true,
          subscriptionStatus: true,
          subscribedAt: true,
        },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    let subscription: Stripe.Subscription | null = null;
    let customerId = user.stripeCustomerId;

    // Try to find subscription by customer ID
    if (customerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1,
      });
      subscription = subscriptions.data[0] || null;
    }

    // If no subscription found, search by email
    if (!subscription) {
      const clerkUser = await currentUser();
      const email = user.email || clerkUser?.emailAddresses?.[0]?.emailAddress;

      if (email) {
        const customers = await stripe.customers.list({
          email,
          limit: 1,
        });

        if (customers.data.length > 0) {
          const customer = customers.data[0];
          customerId = customer.id;

          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'active',
            limit: 1,
          });

          subscription = subscriptions.data[0] || null;
        }
      }
    }

    if (!subscription) {
      // No active subscription found - if user has a paid tier, downgrade to free
      if (user.subscriptionTier !== 'free') {
        console.log(`No active subscription found for user ${user.id}, downgrading from ${user.subscriptionTier} to free`);

        const downgradedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            subscriptionTier: 'free',
            subscriptionStatus: 'cancelled',
            cancelledAt: new Date(),
          },
        });

        return NextResponse.json({
          success: true,
          message: 'No active subscription found - downgraded to free tier',
          before: {
            tier: user.subscriptionTier,
            status: user.subscriptionStatus,
            stripeCustomerId: user.stripeCustomerId,
          },
          after: {
            tier: downgradedUser.subscriptionTier,
            status: downgradedUser.subscriptionStatus,
            stripeCustomerId: downgradedUser.stripeCustomerId,
          },
        });
      }

      // User already on free tier
      return NextResponse.json({
        success: true,
        message: 'No active subscription found (already on free tier)',
        details: {
          searchedByCustomerId: !!user.stripeCustomerId,
          searchedByEmail: !!user.email,
          email: user.email,
          currentTier: user.subscriptionTier,
        },
      });
    }

    // Get tier from subscription - prioritize metadata over price ID
    const priceId = subscription.items.data[0]?.price.id;
    const tier = subscription.metadata?.tier || PRICE_ID_TO_TIER[priceId] || 'pro';

    // Update user in database - use the database ID, not Clerk ID
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeCustomerId: customerId,
        subscriptionTier: tier,
        subscriptionStatus: subscription.status,
        subscribedAt: user.subscribedAt || new Date(subscription.created * 1000),
        subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription synced successfully',
      before: {
        tier: user.subscriptionTier,
        status: user.subscriptionStatus,
        stripeCustomerId: user.stripeCustomerId,
      },
      after: {
        tier: updatedUser.subscriptionTier,
        status: updatedUser.subscriptionStatus,
        stripeCustomerId: updatedUser.stripeCustomerId,
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync subscription',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
