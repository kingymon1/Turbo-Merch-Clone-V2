import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

/**
 * GET /api/user/debug-subscription
 * Debug endpoint to see exactly what Stripe has for your subscription
 */
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find user in database
    let user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      user = await prisma.user.findUnique({
        where: { clerkId: userId },
      });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const clerkUser = await currentUser();
    const email = user.email || clerkUser?.emailAddresses?.[0]?.emailAddress;

    // Search Stripe by customer ID and email
    let stripeData: any = {
      searchedByCustomerId: !!user.stripeCustomerId,
      searchedByEmail: !!email,
      customers: [],
      subscriptions: [],
    };

    // Search by customer ID
    if (user.stripeCustomerId) {
      try {
        const customer = await stripe.customers.retrieve(user.stripeCustomerId);
        stripeData.customers.push({
          source: 'database_customer_id',
          customer: {
            id: customer.id,
            email: (customer as any).email,
            metadata: (customer as any).metadata,
          },
        });

        // Get ALL subscriptions (including cancelled, incomplete, etc.)
        const subs = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          limit: 10,
          // Don't filter by status - get all
        });

        for (const sub of subs.data) {
          stripeData.subscriptions.push({
            id: sub.id,
            status: sub.status,
            created: new Date(sub.created * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
            cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
            items: sub.items.data.map(item => ({
              priceId: item.price.id,
              productId: item.price.product,
              amount: item.price.unit_amount,
            })),
            metadata: sub.metadata,
          });
        }

        // Get recent checkout sessions to see upgrade attempts
        const sessions = await stripe.checkout.sessions.list({
          customer: user.stripeCustomerId,
          limit: 10,
        });

        stripeData.checkoutSessions = sessions.data.map(session => ({
          id: session.id,
          status: session.status,
          paymentStatus: session.payment_status,
          mode: session.mode,
          created: new Date(session.created * 1000),
          metadata: session.metadata,
          subscription: session.subscription,
        }));
      } catch (err: any) {
        stripeData.customerIdError = err.message;
      }
    }

    // Search by email
    if (email) {
      try {
        const customers = await stripe.customers.list({
          email,
          limit: 5,
        });

        for (const customer of customers.data) {
          stripeData.customers.push({
            source: 'email_search',
            customer: {
              id: customer.id,
              email: customer.email,
              metadata: customer.metadata,
            },
          });

          const subs = await stripe.subscriptions.list({
            customer: customer.id,
            limit: 10,
          });

          for (const sub of subs.data) {
            // Avoid duplicates
            if (!stripeData.subscriptions.find((s: any) => s.id === sub.id)) {
              stripeData.subscriptions.push({
                id: sub.id,
                status: sub.status,
                created: new Date(sub.created * 1000),
                currentPeriodEnd: new Date(sub.current_period_end * 1000),
                items: sub.items.data.map(item => ({
                  priceId: item.price.id,
                  productId: item.price.product,
                  amount: item.price.unit_amount,
                })),
                metadata: sub.metadata,
              });
            }
          }
        }
      } catch (err: any) {
        stripeData.emailSearchError = err.message;
      }
    }

    return NextResponse.json({
      database: {
        userId: user.id,
        clerkId: user.clerkId,
        email: user.email,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        stripeCustomerId: user.stripeCustomerId,
        subscribedAt: user.subscribedAt,
        subscriptionEndsAt: user.subscriptionEndsAt,
      },
      stripe: stripeData,
      priceIdMapping: {
        'price_1STqHMEKIZQ9UmMylIFu9Ge5': 'starter',
        'price_1STqJ1EKIZQ9UmMyD1lQmhos': 'pro',
        'price_1STqK1EKIZQ9UmMyFl7dkknM': 'business',
        'price_1STqL9EKIZQ9UmMyr8oWtfgt': 'enterprise',
      },
    });
  } catch (error: any) {
    console.error('Debug error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch debug info',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
