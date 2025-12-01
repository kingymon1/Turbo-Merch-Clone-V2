import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getTierConfig, type TierName } from '@/lib/pricing';

/**
 * Update UsageTracking allowance when tier changes
 * This ensures meters show the correct limit immediately after upgrade
 */
async function updateUsageAllowance(userId: string, tier: string) {
  if (tier === 'free') return;

  try {
    const tierConfig = getTierConfig(tier as TierName);
    const newAllowance = tierConfig.limits.designs;

    const result = await prisma.usageTracking.updateMany({
      where: {
        userId,
        billingPeriodEnd: { gte: new Date() },
      },
      data: {
        designsAllowance: newAllowance,
      },
    });

    console.log(`[Webhook] Updated UsageTracking allowance to ${newAllowance} for user ${userId} (${result.count} records)`);
  } catch (error) {
    console.error(`[Webhook] Failed to update UsageTracking for user ${userId}:`, error);
  }
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

/**
 * Map Stripe price IDs to subscription tiers
 * Price IDs are loaded from environment variables for security and flexibility
 * Fallback values provided for backward compatibility during migration
 */
const PRICE_ID_TO_TIER: Record<string, string> = {
  // Load from env vars, with fallback to legacy hardcoded values
  [process.env.STRIPE_PRICE_STARTER || 'price_1STqHMEKIZQ9UmMylIFu9Ge5']: 'starter',
  [process.env.STRIPE_PRICE_PRO || 'price_1STqJ1EKIZQ9UmMyD1lQmhos']: 'pro',
  [process.env.STRIPE_PRICE_BUSINESS || 'price_1STqK1EKIZQ9UmMyFl7dkknM']: 'business',
  [process.env.STRIPE_PRICE_ENTERPRISE || 'price_1STqL9EKIZQ9UmMyr8oWtfgt']: 'enterprise',
};

function getTierFromSubscription(subscription: Stripe.Subscription): string {
  // Priority 1: Check subscription metadata (set during checkout)
  if (subscription.metadata?.tier) {
    console.log(`Tier from subscription metadata: ${subscription.metadata.tier}`);
    return subscription.metadata.tier;
  }

  // Priority 2: Look up by price ID
  const priceId = subscription.items.data[0]?.price.id;
  if (priceId && PRICE_ID_TO_TIER[priceId]) {
    console.log(`Tier from price ID ${priceId}: ${PRICE_ID_TO_TIER[priceId]}`);
    return PRICE_ID_TO_TIER[priceId];
  }

  // Fallback: Default to 'pro' but log a warning
  console.warn(`⚠️  Could not determine tier for subscription ${subscription.id}, defaulting to 'pro'`, {
    priceId,
    metadata: subscription.metadata,
    items: subscription.items.data.length,
  });
  return 'pro';
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature provided' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session completed:', session.id);

        const clerkUserId = session.client_reference_id || session.metadata?.userId;
        const tier = session.metadata?.tier || 'starter';

        if (clerkUserId) {
          // Find or create user and update subscription
          const upsertedUser = await prisma.user.upsert({
            where: { clerkId: clerkUserId },
            create: {
              clerkId: clerkUserId,
              email: session.customer_email || '',
              subscriptionTier: tier,
              subscriptionStatus: 'active',
              stripeCustomerId: session.customer as string,
              subscribedAt: new Date(),
            },
            update: {
              subscriptionTier: tier,
              subscriptionStatus: 'active',
              stripeCustomerId: session.customer as string,
              subscribedAt: new Date(),
            },
          });

          // Update usage meters to reflect new tier allowance
          await updateUsageAllowance(upsertedUser.id, tier);

          console.log(`User ${clerkUserId} subscribed to ${tier} tier`);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Subscription ${event.type}:`, subscription.id);
        console.log('Subscription data:', JSON.stringify({
          id: subscription.id,
          status: subscription.status,
          customer: subscription.customer,
          current_period_end: subscription.current_period_end,
          created: subscription.created,
          items: subscription.items?.data?.length || 0,
        }));

        const tier = getTierFromSubscription(subscription);
        const customer = subscription.customer as string;

        // Safe date conversion - handle missing timestamps in test webhooks
        const periodEndDate = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default to 30 days from now
        const createdDate = subscription.created
          ? new Date(subscription.created * 1000)
          : new Date();

        // Update or create user with subscription info
        const user = await prisma.user.findUnique({
          where: { stripeCustomerId: customer },
        });

        if (user) {
          // SAFETY CHECK: Detect unexpected downgrades
          const tierHierarchy = ['free', 'starter', 'pro', 'business', 'enterprise'];
          const currentTierIndex = tierHierarchy.indexOf(user.subscriptionTier);
          const newTierIndex = tierHierarchy.indexOf(tier);

          // If we're downgrading and the subscription is active, log a warning
          // This might indicate a race condition or metadata issue
          if (newTierIndex < currentTierIndex && subscription.status === 'active') {
            console.warn(`⚠️  UNEXPECTED DOWNGRADE DETECTED for user ${user.id}:`, {
              from: user.subscriptionTier,
              to: tier,
              subscriptionId: subscription.id,
              priceId: subscription.items.data[0]?.price.id,
              metadata: subscription.metadata,
            });

            // Don't downgrade if the tier detection seems wrong
            // Keep the existing tier and only update status/dates
            console.log(`Preserving existing tier '${user.subscriptionTier}' to prevent accidental downgrade`);
            await prisma.user.update({
              where: { stripeCustomerId: customer },
              data: {
                subscriptionStatus: subscription.status,
                subscriptionEndsAt: periodEndDate,
              },
            });
            break;
          }

          // Update existing user
          await prisma.user.update({
            where: { stripeCustomerId: customer },
            data: {
              subscriptionTier: tier,
              subscriptionStatus: subscription.status,
              subscribedAt: user.subscribedAt || createdDate,
              subscriptionEndsAt: periodEndDate,
            },
          });

          // Update usage meters to reflect new tier allowance
          await updateUsageAllowance(user.id, tier);

          console.log(`Updated user ${user.id}: ${tier} tier, status ${subscription.status}`);
        } else {
          // Try to find user by email if stripeCustomerId not set
          try {
            const stripeCustomer = await stripe.customers.retrieve(customer);

            // Check if customer is deleted (Stripe.DeletedCustomer doesn't have email)
            if (stripeCustomer.deleted) {
              console.log(`Customer ${customer} has been deleted, skipping email lookup`);
              break;
            }

            const customerEmail = (stripeCustomer as Stripe.Customer).email;
            if (customerEmail) {
              const userByEmail = await prisma.user.findUnique({
                where: { email: customerEmail },
              });

              if (userByEmail) {
                // Same safety check for email-based lookup
                const tierHierarchy = ['free', 'starter', 'pro', 'business', 'enterprise'];
                const currentTierIndex = tierHierarchy.indexOf(userByEmail.subscriptionTier);
                const newTierIndex = tierHierarchy.indexOf(tier);

                if (newTierIndex < currentTierIndex && subscription.status === 'active') {
                  console.warn(`⚠️  UNEXPECTED DOWNGRADE DETECTED (email lookup) for user ${userByEmail.id}:`, {
                    from: userByEmail.subscriptionTier,
                    to: tier,
                    subscriptionId: subscription.id,
                    priceId: subscription.items.data[0]?.price.id,
                    metadata: subscription.metadata,
                  });

                  await prisma.user.update({
                    where: { email: customerEmail },
                    data: {
                      stripeCustomerId: customer,
                      subscriptionStatus: subscription.status,
                      subscriptionEndsAt: periodEndDate,
                    },
                  });
                  console.log(`Linked customer ID but preserved tier '${userByEmail.subscriptionTier}'`);
                  break;
                }

                await prisma.user.update({
                  where: { email: customerEmail },
                  data: {
                    stripeCustomerId: customer,
                    subscriptionTier: tier,
                    subscriptionStatus: subscription.status,
                    subscribedAt: userByEmail.subscribedAt || createdDate,
                    subscriptionEndsAt: periodEndDate,
                  },
                });

                // Update usage meters to reflect new tier allowance
                await updateUsageAllowance(userByEmail.id, tier);

                console.log(`Linked and updated user ${userByEmail.id} via email: ${tier} tier`);
              } else {
                console.log(`No user found for customer ${customer} (email: ${customerEmail})`);
              }
            } else {
              console.log(`Customer ${customer} has no email, cannot lookup user`);
            }
          } catch (customerError) {
            // Customer doesn't exist in Stripe (e.g., test webhook with fake customer ID)
            console.log(`Could not retrieve customer ${customer} from Stripe:`, customerError instanceof Error ? customerError.message : 'Unknown error');
            console.log('This is expected for test webhooks with fake customer IDs');
          }
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription cancelled:', subscription.id);

        // Downgrade user to free tier
        await prisma.user.updateMany({
          where: { stripeCustomerId: subscription.customer as string },
          data: {
            subscriptionTier: 'free',
            subscriptionStatus: 'cancelled',
            cancelledAt: new Date(),
            subscriptionEndsAt: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000)
              : new Date(),
          },
        });

        console.log(`Subscription cancelled for customer ${subscription.customer}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment succeeded:', invoice.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment failed:', invoice.id);

        // TODO: Notify user of payment failure
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    console.error('Error name:', error?.name);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    return NextResponse.json(
      { error: 'Webhook handler failed', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
