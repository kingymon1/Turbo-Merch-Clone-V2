import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

// Map Stripe price IDs to subscription tiers
const PRICE_ID_TO_TIER: Record<string, string> = {
  'price_1STqHMEKIZQ9UmMylIFu9Ge5': 'starter',
  'price_1STqJ1EKIZQ9UmMyD1lQmhos': 'pro',
  'price_1STqK1EKIZQ9UmMyFl7dkknM': 'business',
  'price_1STqL9EKIZQ9UmMyr8oWtfgt': 'enterprise',
};

/**
 * POST /api/admin/sync-all-users
 * One-time migration to sync all users with their Stripe subscriptions
 *
 * This endpoint:
 * 1. Fetches all users from database
 * 2. Searches Stripe for active subscriptions by email
 * 3. Updates database with correct subscription info
 * 4. Links stripeCustomerId if missing
 */
export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const admin = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (!admin?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        subscriptionTier: true,
        subscriptionStatus: true,
      },
    });

    const results = {
      total: users.length,
      updated: 0,
      linked: 0,
      noChange: 0,
      errors: [] as Array<{ email: string; error: string }>,
      updates: [] as Array<{
        email: string;
        before: { tier: string; status: string };
        after: { tier: string; status: string };
      }>,
    };

    for (const user of users) {
      try {
        let customerId = user.stripeCustomerId;
        let subscription: Stripe.Subscription | null = null;

        // If we have a customer ID, get their subscription
        if (customerId) {
          const subscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: 'active',
            limit: 1,
          });
          subscription = subscriptions.data[0] || null;
        }

        // If no subscription found and we have an email, search by email
        if (!subscription && user.email) {
          const customers = await stripe.customers.list({
            email: user.email,
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

            // Link customer ID if we found one
            if (customerId && !user.stripeCustomerId) {
              await prisma.user.update({
                where: { id: user.id },
                data: { stripeCustomerId: customerId },
              });
              results.linked++;
            }
          }
        }

        // Update user if we found a subscription
        if (subscription) {
          const priceId = subscription.items.data[0]?.price.id;
          const tier = PRICE_ID_TO_TIER[priceId] || subscription.metadata?.tier || 'pro';
          const status = subscription.status;

          // Only update if something changed
          if (tier !== user.subscriptionTier || status !== user.subscriptionStatus) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                subscriptionTier: tier,
                subscriptionStatus: status,
                subscribedAt: new Date(subscription.created * 1000),
                subscriptionEndsAt: new Date(subscription.current_period_end * 1000),
              },
            });

            results.updated++;
            results.updates.push({
              email: user.email,
              before: { tier: user.subscriptionTier, status: user.subscriptionStatus },
              after: { tier, status },
            });
          } else {
            results.noChange++;
          }
        } else {
          results.noChange++;
        }
      } catch (error: any) {
        results.errors.push({
          email: user.email,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sync complete: ${results.updated} updated, ${results.linked} linked, ${results.noChange} unchanged`,
      results,
    });
  } catch (error: any) {
    console.error('Sync all users error:', error);
    return NextResponse.json(
      { error: 'Failed to sync users', message: error.message },
      { status: 500 }
    );
  }
}
