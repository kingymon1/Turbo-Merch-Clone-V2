/**
 * POST /api/stripe/apply-overage-decision
 *
 * Applies the user's decision about overages during upgrade:
 * - 'credits': Mark overages as covered by new plan credits (reduce new allowance)
 * - 'pay': Charge overages immediately before proceeding with upgrade
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
});

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
    const { decision, newTier } = body;

    if (!decision || !['credits', 'pay'].includes(decision)) {
      return NextResponse.json(
        { error: 'Invalid decision. Must be "credits" or "pay".' },
        { status: 400 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        subscriptionTier: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get current usage record with overages
    const usageRecord = await prisma.usageTracking.findFirst({
      where: {
        userId: user.id,
        billingPeriodEnd: { gte: new Date() },
      },
      orderBy: { billingPeriodStart: 'desc' },
    });

    if (!usageRecord) {
      // No usage record, nothing to handle
      return NextResponse.json({
        success: true,
        decision,
        message: 'No overages to process',
      });
    }

    const overageCount = usageRecord.overageDesigns || 0;
    const overageCharge = Number(usageRecord.overageCharge || 0);

    if (overageCount === 0) {
      return NextResponse.json({
        success: true,
        decision,
        message: 'No overages to process',
      });
    }

    if (decision === 'credits') {
      // Option 1: Apply overages as credit reduction on new plan
      // We'll store this decision and apply it when the subscription is created
      await prisma.usageTracking.update({
        where: { id: usageRecord.id },
        data: {
          // Mark overages as covered by credits
          // These will be deducted from the new plan's allowance
          // @ts-ignore - adding custom field for credit offset tracking
          overageCreditOffset: overageCount,
          overageCharge: 0, // Clear the charge since credits will cover it
        },
      });

      // Store the credit offset in a metadata field on the user for the webhook to process
      // We'll use a temporary field that gets consumed during subscription creation
      await prisma.user.update({
        where: { id: user.id },
        data: {
          // @ts-ignore - storing pending credit offset
          pendingCreditOffset: overageCount,
        },
      });

      return NextResponse.json({
        success: true,
        decision: 'credits',
        overagesCovered: overageCount,
        message: `${overageCount} overages will be deducted from your new plan credits`,
      });

    } else {
      // Option 2: Charge overages immediately
      if (!user.stripeCustomerId) {
        return NextResponse.json(
          { error: 'No payment method on file. Please add a payment method first.' },
          { status: 400 }
        );
      }

      // Check if customer has a default payment method
      const customer = await stripe.customers.retrieve(user.stripeCustomerId);
      if ('deleted' in customer && customer.deleted) {
        return NextResponse.json(
          { error: 'Stripe customer not found' },
          { status: 400 }
        );
      }

      const defaultPaymentMethod = customer.invoice_settings?.default_payment_method;

      if (!defaultPaymentMethod) {
        // No default payment method - we'll charge during checkout instead
        // Store the decision to charge on next invoice
        await prisma.usageTracking.update({
          where: { id: usageRecord.id },
          data: {
            // Mark for immediate charge on upgrade checkout
            // @ts-ignore
            pendingOverageCharge: true,
          },
        });

        return NextResponse.json({
          success: true,
          decision: 'pay',
          willChargeOnCheckout: true,
          overageCharge,
          message: `$${overageCharge.toFixed(2)} will be added to your upgrade checkout`,
        });
      }

      // Create an invoice for the overage charge
      try {
        const invoice = await stripe.invoices.create({
          customer: user.stripeCustomerId,
          auto_advance: true,
          collection_method: 'charge_automatically',
          description: `Overage charge for ${overageCount} additional designs`,
          metadata: {
            type: 'overage_charge',
            userId: user.id,
            overageCount: String(overageCount),
          },
        });

        // Add the line item
        await stripe.invoiceItems.create({
          customer: user.stripeCustomerId,
          invoice: invoice.id,
          amount: Math.round(overageCharge * 100), // Convert to cents
          currency: 'usd',
          description: `Overage charge: ${overageCount} additional designs`,
        });

        // Finalize and pay the invoice
        const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
        const paidInvoice = await stripe.invoices.pay(finalizedInvoice.id);

        if (paidInvoice.status === 'paid') {
          // Clear the overage since it's been paid
          await prisma.usageTracking.update({
            where: { id: usageRecord.id },
            data: {
              overageDesigns: 0,
              overageCharge: 0,
            },
          });

          // Create billing record
          await prisma.billingRecord.create({
            data: {
              userId: user.id,
              periodStart: usageRecord.billingPeriodStart,
              periodEnd: usageRecord.billingPeriodEnd,
              subscriptionFee: 0,
              overageFee: overageCharge,
              totalAmount: overageCharge,
              designsIncluded: usageRecord.designsAllowance,
              designsUsed: usageRecord.designsUsedInPeriod,
              overageDesigns: overageCount,
              overageRate: Number(usageRecord.overageCharge) / overageCount,
              tier: user.subscriptionTier || 'free',
              stripeInvoiceId: paidInvoice.id,
              paymentStatus: 'paid',
              paidAt: new Date(),
            },
          });

          return NextResponse.json({
            success: true,
            decision: 'pay',
            charged: true,
            amount: overageCharge,
            invoiceId: paidInvoice.id,
            message: `$${overageCharge.toFixed(2)} charged successfully`,
          });
        } else {
          return NextResponse.json(
            { error: 'Payment failed. Please check your payment method.' },
            { status: 400 }
          );
        }
      } catch (stripeError) {
        console.error('Stripe charge error:', stripeError);
        return NextResponse.json(
          { error: 'Failed to process payment. Please try again.' },
          { status: 500 }
        );
      }
    }

  } catch (error) {
    console.error('[API] Apply overage decision error:', error);
    return NextResponse.json(
      { error: 'Failed to process decision' },
      { status: 500 }
    );
  }
}
