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
 * IMPORTANT: All price IDs must be set in environment variables.
 * If a price ID is not found, tier detection will FAIL (not default to 'pro').
 */
const PRICE_ID_TO_TIER: Record<string, string> = {};

// Only add mappings for price IDs that are actually configured
if (process.env.STRIPE_PRICE_STARTER) {
  PRICE_ID_TO_TIER[process.env.STRIPE_PRICE_STARTER] = 'starter';
}
if (process.env.STRIPE_PRICE_PRO) {
  PRICE_ID_TO_TIER[process.env.STRIPE_PRICE_PRO] = 'pro';
}
if (process.env.STRIPE_PRICE_BUSINESS) {
  PRICE_ID_TO_TIER[process.env.STRIPE_PRICE_BUSINESS] = 'business';
}
if (process.env.STRIPE_PRICE_ENTERPRISE) {
  PRICE_ID_TO_TIER[process.env.STRIPE_PRICE_ENTERPRISE] = 'enterprise';
}

// Log configured price IDs on startup (without exposing full IDs)
console.log('[Webhook] Configured price ID mappings:', Object.keys(PRICE_ID_TO_TIER).map(id => `${id.slice(0, 10)}...`));

/**
 * Get tier from subscription - FAILS LOUDLY if tier cannot be determined
 * Returns { tier, error } - if error is set, tier detection failed
 */
function getTierFromSubscription(subscription: Stripe.Subscription): { tier: string | null; error: string | null } {
  // Priority 1: Check subscription metadata (set during checkout)
  if (subscription.metadata?.tier) {
    const tier = subscription.metadata.tier;
    const validTiers = ['starter', 'pro', 'business', 'enterprise'];
    if (validTiers.includes(tier)) {
      console.log(`[Webhook] Tier from subscription metadata: ${tier}`);
      return { tier, error: null };
    } else {
      console.warn(`[Webhook] Invalid tier in metadata: ${tier}`);
    }
  }

  // Priority 2: Look up by price ID
  const priceId = subscription.items.data[0]?.price.id;
  if (priceId) {
    const tier = PRICE_ID_TO_TIER[priceId];
    if (tier) {
      console.log(`[Webhook] Tier from price ID ${priceId.slice(0, 10)}...: ${tier}`);
      return { tier, error: null };
    }
  }

  // FAIL LOUDLY - do not default to 'pro'
  const errorMsg = `Could not determine tier for subscription ${subscription.id}. ` +
    `Price ID: ${priceId || 'none'}, Metadata: ${JSON.stringify(subscription.metadata)}. ` +
    `Check STRIPE_PRICE_* environment variables.`;
  console.error(`[Webhook] ❌ TIER DETECTION FAILED: ${errorMsg}`);

  return { tier: null, error: errorMsg };
}

/**
 * Check if an event has already been processed (idempotency)
 */
async function isEventProcessed(stripeEventId: string): Promise<boolean> {
  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { stripeEventId },
  });
  return existing?.status === 'processed';
}

/**
 * Log webhook event to database
 */
async function logWebhookEvent(
  stripeEventId: string,
  eventType: string,
  status: 'received' | 'processed' | 'failed' | 'ignored',
  options: {
    stripeCustomerId?: string;
    userId?: string;
    errorMessage?: string;
    payload?: object;
    processingMs?: number;
  } = {}
) {
  try {
    await prisma.stripeWebhookEvent.upsert({
      where: { stripeEventId },
      create: {
        stripeEventId,
        eventType,
        status,
        stripeCustomerId: options.stripeCustomerId,
        userId: options.userId,
        errorMessage: options.errorMessage,
        payload: options.payload,
        processedAt: status === 'processed' ? new Date() : null,
        processingMs: options.processingMs,
      },
      update: {
        status,
        errorMessage: options.errorMessage,
        processedAt: status === 'processed' ? new Date() : undefined,
        processingMs: options.processingMs,
      },
    });
  } catch (error) {
    console.error('[Webhook] Failed to log event:', error);
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
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
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Webhook] Signature verification failed: ${errorMessage}`);
    return NextResponse.json(
      { error: `Webhook Error: ${errorMessage}` },
      { status: 400 }
    );
  }

  // Check for idempotency - don't process the same event twice
  if (await isEventProcessed(event.id)) {
    console.log(`[Webhook] Event ${event.id} already processed, skipping`);
    return NextResponse.json({ received: true, status: 'already_processed' });
  }

  // Log that we received the event
  await logWebhookEvent(event.id, event.type, 'received');

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('[Webhook] Checkout session completed:', session.id);

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

          console.log(`[Webhook] User ${clerkUserId} subscribed to ${tier} tier`);

          await logWebhookEvent(event.id, event.type, 'processed', {
            stripeCustomerId: session.customer as string,
            userId: upsertedUser.id,
            processingMs: Date.now() - startTime,
          });
        } else {
          console.warn('[Webhook] No clerkUserId in checkout session');
          await logWebhookEvent(event.id, event.type, 'failed', {
            errorMessage: 'No clerkUserId in checkout session metadata',
            stripeCustomerId: session.customer as string,
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`[Webhook] Subscription ${event.type}:`, subscription.id);

        const { tier, error: tierError } = getTierFromSubscription(subscription);
        const customer = subscription.customer as string;

        // If tier detection failed, log error but don't crash
        if (tierError || !tier) {
          await logWebhookEvent(event.id, event.type, 'failed', {
            errorMessage: tierError || 'Tier detection returned null',
            stripeCustomerId: customer,
          });
          // Still return 200 to Stripe (so they don't retry forever)
          // but the user's tier won't be updated
          console.error(`[Webhook] ❌ Skipping subscription update due to tier detection failure`);
          break;
        }

        // Safe date conversion - handle missing timestamps in test webhooks
        const periodEndDate = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
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
          if (newTierIndex < currentTierIndex && subscription.status === 'active') {
            console.warn(`[Webhook] ⚠️ UNEXPECTED DOWNGRADE DETECTED for user ${user.id}:`, {
              from: user.subscriptionTier,
              to: tier,
              subscriptionId: subscription.id,
            });

            // Don't downgrade if the tier detection seems wrong
            console.log(`[Webhook] Preserving existing tier '${user.subscriptionTier}' to prevent accidental downgrade`);
            await prisma.user.update({
              where: { stripeCustomerId: customer },
              data: {
                subscriptionStatus: subscription.status,
                subscriptionEndsAt: periodEndDate,
              },
            });

            await logWebhookEvent(event.id, event.type, 'processed', {
              stripeCustomerId: customer,
              userId: user.id,
              processingMs: Date.now() - startTime,
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

          console.log(`[Webhook] Updated user ${user.id}: ${tier} tier, status ${subscription.status}`);

          await logWebhookEvent(event.id, event.type, 'processed', {
            stripeCustomerId: customer,
            userId: user.id,
            processingMs: Date.now() - startTime,
          });
        } else {
          // Try to find user by email if stripeCustomerId not set
          try {
            const stripeCustomer = await stripe.customers.retrieve(customer);

            if (stripeCustomer.deleted) {
              console.log(`[Webhook] Customer ${customer} has been deleted, skipping`);
              await logWebhookEvent(event.id, event.type, 'ignored', {
                stripeCustomerId: customer,
                errorMessage: 'Customer deleted in Stripe',
              });
              break;
            }

            const customerEmail = (stripeCustomer as Stripe.Customer).email;
            if (customerEmail) {
              const userByEmail = await prisma.user.findUnique({
                where: { email: customerEmail },
              });

              if (userByEmail) {
                // Safety check for email-based lookup
                const tierHierarchy = ['free', 'starter', 'pro', 'business', 'enterprise'];
                const currentTierIndex = tierHierarchy.indexOf(userByEmail.subscriptionTier);
                const newTierIndex = tierHierarchy.indexOf(tier);

                if (newTierIndex < currentTierIndex && subscription.status === 'active') {
                  console.warn(`[Webhook] ⚠️ UNEXPECTED DOWNGRADE DETECTED (email lookup) for user ${userByEmail.id}`);
                  await prisma.user.update({
                    where: { email: customerEmail },
                    data: {
                      stripeCustomerId: customer,
                      subscriptionStatus: subscription.status,
                      subscriptionEndsAt: periodEndDate,
                    },
                  });
                  console.log(`[Webhook] Linked customer ID but preserved tier '${userByEmail.subscriptionTier}'`);

                  await logWebhookEvent(event.id, event.type, 'processed', {
                    stripeCustomerId: customer,
                    userId: userByEmail.id,
                    processingMs: Date.now() - startTime,
                  });
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

                await updateUsageAllowance(userByEmail.id, tier);

                console.log(`[Webhook] Linked and updated user ${userByEmail.id} via email: ${tier} tier`);

                await logWebhookEvent(event.id, event.type, 'processed', {
                  stripeCustomerId: customer,
                  userId: userByEmail.id,
                  processingMs: Date.now() - startTime,
                });
              } else {
                console.warn(`[Webhook] No user found for customer ${customer} (email: ${customerEmail})`);
                await logWebhookEvent(event.id, event.type, 'failed', {
                  stripeCustomerId: customer,
                  errorMessage: `No user found with email ${customerEmail}`,
                });
              }
            } else {
              console.warn(`[Webhook] Customer ${customer} has no email`);
              await logWebhookEvent(event.id, event.type, 'failed', {
                stripeCustomerId: customer,
                errorMessage: 'Customer has no email, cannot lookup user',
              });
            }
          } catch (customerError) {
            const errorMsg = customerError instanceof Error ? customerError.message : 'Unknown error';
            console.log(`[Webhook] Could not retrieve customer ${customer}: ${errorMsg}`);
            await logWebhookEvent(event.id, event.type, 'failed', {
              stripeCustomerId: customer,
              errorMessage: `Could not retrieve customer: ${errorMsg}`,
            });
          }
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('[Webhook] Subscription cancelled:', subscription.id);

        const customer = subscription.customer as string;

        // Downgrade user to free tier
        const result = await prisma.user.updateMany({
          where: { stripeCustomerId: customer },
          data: {
            subscriptionTier: 'free',
            subscriptionStatus: 'cancelled',
            cancelledAt: new Date(),
            subscriptionEndsAt: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000)
              : new Date(),
          },
        });

        console.log(`[Webhook] Subscription cancelled for customer ${customer} (${result.count} users updated)`);

        await logWebhookEvent(event.id, event.type, 'processed', {
          stripeCustomerId: customer,
          processingMs: Date.now() - startTime,
        });
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('[Webhook] Payment succeeded:', invoice.id);

        await logWebhookEvent(event.id, event.type, 'processed', {
          stripeCustomerId: invoice.customer as string,
          processingMs: Date.now() - startTime,
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('[Webhook] ⚠️ Payment failed:', invoice.id);

        const customer = invoice.customer as string;

        // Update user's subscription status to past_due
        const result = await prisma.user.updateMany({
          where: { stripeCustomerId: customer },
          data: {
            subscriptionStatus: 'past_due',
          },
        });

        if (result.count > 0) {
          console.log(`[Webhook] Updated ${result.count} user(s) to past_due status for customer ${customer}`);
        }

        // Log the failure with details for debugging
        await logWebhookEvent(event.id, event.type, 'processed', {
          stripeCustomerId: customer,
          payload: {
            invoiceId: invoice.id,
            amountDue: invoice.amount_due,
            attemptCount: invoice.attempt_count,
            nextPaymentAttempt: invoice.next_payment_attempt,
          },
          processingMs: Date.now() - startTime,
        });
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
        await logWebhookEvent(event.id, event.type, 'ignored', {
          errorMessage: 'Unhandled event type',
        });
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error('[Webhook] Handler error:', error);
    console.error('[Webhook] Error message:', errorMessage);
    if (errorStack) console.error('[Webhook] Error stack:', errorStack);

    // Log the failure
    await logWebhookEvent(event.id, event.type, 'failed', {
      errorMessage: errorMessage,
    });

    return NextResponse.json(
      { error: 'Webhook handler failed', details: errorMessage },
      { status: 500 }
    );
  }
}
