import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import prisma from '@/lib/prisma';
import { getTierConfig, type TierName } from '@/lib/pricing';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

/**
 * Map Stripe price IDs to subscription tiers
 */
const PRICE_ID_TO_TIER: Record<string, string> = {
  [process.env.STRIPE_PRICE_STARTER || 'price_1STqHMEKIZQ9UmMylIFu9Ge5']: 'starter',
  [process.env.STRIPE_PRICE_PRO || 'price_1STqJ1EKIZQ9UmMyD1lQmhos']: 'pro',
  [process.env.STRIPE_PRICE_BUSINESS || 'price_1STqK1EKIZQ9UmMyFl7dkknM']: 'business',
  [process.env.STRIPE_PRICE_ENTERPRISE || 'price_1STqL9EKIZQ9UmMyr8oWtfgt']: 'enterprise',
};

/**
 * POST /api/stripe/sync-subscription
 * Syncs the user's subscription status directly from Stripe
 *
 * This searches for the user's subscription by:
 * 1. Checkout session ID (if provided)
 * 2. Existing stripeCustomerId
 * 3. Email address lookup in Stripe
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the current user from Clerk to get their email
    const clerkUser = await currentUser();
    const userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress;

    console.log(`[Sync] Starting sync for userId: ${userId}, email: ${userEmail}`);

    const body = await req.json().catch(() => ({}));
    const { sessionId } = body;

    // Find the user in our database
    let user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      user = await prisma.user.findUnique({
        where: { clerkId: userId },
      });
    }

    if (!user) {
      // User doesn't exist in our database yet - create them
      console.log(`[Sync] User not found, creating new user record`);
      user = await prisma.user.create({
        data: {
          id: userId,
          clerkId: userId,
          email: userEmail || '',
          subscriptionTier: 'free',
          subscriptionStatus: 'inactive',
        },
      });
    }

    let tier = 'free';
    let subscriptionStatus = 'inactive';
    let stripeCustomerId = user.stripeCustomerId;
    let foundSubscription = false;

    // Method 1: If we have a session ID, get the subscription from the checkout session
    if (sessionId) {
      console.log(`[Sync] Method 1: Retrieving checkout session: ${sessionId}`);
      try {
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['subscription'],
        });

        if (session.subscription) {
          const subscription = typeof session.subscription === 'string'
            ? await stripe.subscriptions.retrieve(session.subscription)
            : session.subscription;

          if (subscription.metadata?.tier) {
            tier = subscription.metadata.tier;
          } else if (session.metadata?.tier) {
            tier = session.metadata.tier;
          } else {
            const priceId = subscription.items.data[0]?.price.id;
            tier = PRICE_ID_TO_TIER[priceId] || 'pro';
          }

          subscriptionStatus = subscription.status;
          stripeCustomerId = subscription.customer as string;
          foundSubscription = true;

          console.log(`[Sync] Found subscription from session: tier=${tier}, status=${subscriptionStatus}`);
        }
      } catch (err) {
        console.error(`[Sync] Failed to retrieve session:`, err);
      }
    }

    // Method 2: Look up by existing customer ID
    if (!foundSubscription && stripeCustomerId) {
      console.log(`[Sync] Method 2: Looking up subscriptions for customer: ${stripeCustomerId}`);
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          status: 'active',
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const subscription = subscriptions.data[0];

          if (subscription.metadata?.tier) {
            tier = subscription.metadata.tier;
          } else {
            const priceId = subscription.items.data[0]?.price.id;
            tier = PRICE_ID_TO_TIER[priceId] || 'pro';
          }

          subscriptionStatus = subscription.status;
          foundSubscription = true;

          console.log(`[Sync] Found active subscription by customerId: tier=${tier}, status=${subscriptionStatus}`);
        }
      } catch (err) {
        console.error(`[Sync] Failed to list subscriptions by customerId:`, err);
      }
    }

    // Method 3: Search for customer by email in Stripe
    if (!foundSubscription && userEmail) {
      console.log(`[Sync] Method 3: Searching Stripe customers by email: ${userEmail}`);
      try {
        const customers = await stripe.customers.list({
          email: userEmail,
          limit: 5,
        });

        console.log(`[Sync] Found ${customers.data.length} Stripe customers with this email`);

        // Check each customer for active subscriptions
        for (const customer of customers.data) {
          console.log(`[Sync] Checking customer ${customer.id} for subscriptions...`);

          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'active',
            limit: 1,
          });

          if (subscriptions.data.length > 0) {
            const subscription = subscriptions.data[0];

            if (subscription.metadata?.tier) {
              tier = subscription.metadata.tier;
            } else {
              const priceId = subscription.items.data[0]?.price.id;
              tier = PRICE_ID_TO_TIER[priceId] || 'pro';
            }

            subscriptionStatus = subscription.status;
            stripeCustomerId = customer.id;
            foundSubscription = true;

            console.log(`[Sync] Found active subscription by email lookup: tier=${tier}, status=${subscriptionStatus}, customerId=${customer.id}`);
            break;
          }
        }
      } catch (err) {
        console.error(`[Sync] Failed to search customers by email:`, err);
      }
    }

    // Log the final result
    console.log(`[Sync] Final result: foundSubscription=${foundSubscription}, tier=${tier}, status=${subscriptionStatus}`);

    // Update the user in the database
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionTier: tier,
        subscriptionStatus: subscriptionStatus === 'active' ? 'active' : user.subscriptionStatus,
        stripeCustomerId: stripeCustomerId || user.stripeCustomerId,
        ...(subscriptionStatus === 'active' && !user.subscribedAt ? { subscribedAt: new Date() } : {}),
      },
    });

    console.log(`[Sync] Updated user ${user.id}: tier=${updatedUser.subscriptionTier}, status=${updatedUser.subscriptionStatus}`);

    // IMPORTANT: Also update the UsageTracking record's designsAllowance to match the new tier
    // Without this, the usage meters would show the old tier's limit
    if (foundSubscription && tier !== 'free') {
      const tierConfig = getTierConfig(tier as TierName);
      const newAllowance = tierConfig.limits.designs;

      console.log(`[Sync] Updating UsageTracking allowance to ${newAllowance} for tier ${tier}`);

      // Update all current/future usage records for this user
      const updateResult = await prisma.usageTracking.updateMany({
        where: {
          userId: user.id,
          billingPeriodEnd: { gte: new Date() },
        },
        data: {
          designsAllowance: newAllowance,
        },
      });

      console.log(`[Sync] Updated ${updateResult.count} UsageTracking record(s)`);
    }

    return NextResponse.json({
      success: true,
      foundSubscription,
      user: {
        id: updatedUser.id,
        email: userEmail,
        subscriptionTier: updatedUser.subscriptionTier,
        subscriptionStatus: updatedUser.subscriptionStatus,
        stripeCustomerId: updatedUser.stripeCustomerId,
      },
    });
  } catch (error: any) {
    console.error('[Sync] Error syncing subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync subscription' },
      { status: 500 }
    );
  }
}
