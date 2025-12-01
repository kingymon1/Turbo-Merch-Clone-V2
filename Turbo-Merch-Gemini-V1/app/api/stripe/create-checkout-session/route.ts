import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { CreateCheckoutSessionSchema, safeValidateRequest } from '@/lib/validations';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

/**
 * POST /api/stripe/create-checkout-session
 * Creates a Stripe checkout session for subscription purchase
 *
 * @param request.body.priceId - Stripe price ID for the subscription
 * @param request.body.tier - Optional tier name for metadata
 *
 * @returns 200 - Session ID and checkout URL
 * @returns 400 - Validation error
 * @returns 401 - Unauthorized
 * @returns 500 - Stripe error
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

    // Get the user's email from Clerk to pre-fill in Stripe checkout
    // This ensures the Stripe email matches Clerk, making subscription sync reliable
    const clerkUser = await currentUser();
    const userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress;

    // Parse and validate request body
    const body = await req.json();
    const validation = safeValidateRequest(CreateCheckoutSessionSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { priceId, tier } = validation.data;

    // Build metadata object, only including tier if provided
    const metadata: Record<string, string> = { userId };
    if (tier) {
      metadata.tier = tier;
    }
    if (userEmail) {
      metadata.email = userEmail;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?canceled=true`,
      client_reference_id: userId,
      // Pre-fill the customer's email from Clerk - this prevents email mismatch issues
      // where customers pay with a different email and their subscription doesn't sync
      customer_email: userEmail,
      metadata,
      subscription_data: {
        metadata,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout session error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
