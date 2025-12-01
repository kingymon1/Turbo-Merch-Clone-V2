'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, Loader2, Lock, Crown, RefreshCw, Sparkles, Infinity } from 'lucide-react';
import { SubscriptionPlan } from '../types';
import { PRICING_TIERS, getYearlySavings, BillingInterval, TierName } from '../lib/pricing';
import OverageCreditOfferModal from './OverageCreditOfferModal';

interface UserData {
  user: {
    id: string;
    subscriptionTier: string;
    subscriptionStatus: string;
  };
  usage: {
    tier: string;
    allowance: number;
    used: number;
    remaining: number;
  };
}

// Generate plans from pricing config
const getPlans = (billingInterval: BillingInterval): SubscriptionPlan[] => {
    const tierOrder: TierName[] = ['free', 'starter', 'pro', 'business', 'enterprise'];

    return tierOrder.map(tierId => {
        const tier = PRICING_TIERS[tierId];
        const isYearly = billingInterval === 'yearly';
        const savings = getYearlySavings(tierId);

        // Get the appropriate price and price ID
        const displayPrice = tierId === 'free'
            ? '$0'
            : isYearly
                ? `$${savings.monthlyEquivalent.toFixed(2)}`
                : `$${tier.price.toFixed(2)}`;

        const priceId = isYearly ? tier.stripeYearlyPriceId : tier.stripePriceId;

        // Build features list
        const features = getFeatures(tierId, isYearly);

        return {
            id: tierId,
            name: tier.name,
            price: displayPrice,
            description: tierId === 'free'
                ? '3 free designs'
                : `${tier.limits.designs} designs included`,
            priceId: priceId || '',
            buttonText: tier.display.cta,
            features,
            recommended: tier.display.popular,
            highlight: tier.display.popular ? 'MOST POPULAR' : undefined,
            comingSoon: tierId === 'enterprise',
        };
    });
};

// Feature lists for each tier
const getFeatures = (tierId: TierName, isYearly: boolean): string[] => {
    const tier = PRICING_TIERS[tierId];
    const baseFeatures: Record<TierName, string[]> = {
        free: [
            'Full HD image downloads',
            'USA Market only',
            'Basic AI research mode',
            '30d design history',
            'Email support'
        ],
        starter: [
            `${tier.limits.designs} designs/month`,
            'Access to 3 research strategies',
            'All international markets (US, UK, DE)',
            'Direct mode (custom ideas)',
            'CSV exports included'
        ],
        pro: [
            `${tier.limits.designs} designs/month (4x more than Starter)`,
            'Access to 4 research models',
            `Batch generation (up to ${tier.limits.maxPerRun} designs)`,
            `Basic concurrency (${tier.features.concurrentRuns} parallel jobs)`,
            'Email reports with insights',
            'Saved prompts & 90d history',
            'Faster queue position'
        ],
        business: [
            `${tier.limits.designs} designs/month`,
            `Batch generation (up to ${tier.limits.maxPerRun} designs)`,
            `Expanded concurrency (${tier.features.concurrentRuns} parallel jobs)`,
            'Speed priority (business queue)',
            'Unlimited saved templates (1y)',
            'Priority email support'
        ],
        enterprise: [
            `${tier.limits.designs} designs/month`,
            `Agency-level concurrency (${tier.features.concurrentRuns}+ jobs)`,
            'Fastest queue priority',
            'Premium model settings',
            'API access + White label branding',
            'Team/VA support (1-2 seats)',
            'Dedicated support channel'
        ],
    };

    const features = [...baseFeatures[tierId]];

    // Add yearly bonus for paid tiers
    if (isYearly && tierId !== 'free') {
        features.push('🎁 Unlimited storage & retention (yearly bonus)');
    }

    return features;
};

const PricingPlans: React.FC = () => {
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');

  // Overage credit offer state
  const [showOverageOffer, setShowOverageOffer] = useState(false);
  const [pendingUpgrade, setPendingUpgrade] = useState<{ plan: SubscriptionPlan; overageData: any } | null>(null);

  const plans = getPlans(billingInterval);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/user');
      if (response.ok) {
        const data = await response.json();
        setUserData(data);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sync subscription status from Stripe
  const handleSyncSubscription = async () => {
    setSyncing(true);
    setSyncMessage(null);

    try {
      const response = await fetch('/api/stripe/sync-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      console.log('[Sync] Response:', data);

      if (data.success) {
        if (data.foundSubscription && data.user.subscriptionTier !== 'free') {
          setSyncMessage(`Found your ${data.user.subscriptionTier.toUpperCase()} subscription! Refreshing...`);
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } else {
          setSyncMessage(`No active subscription found for ${data.user.email || 'your account'}. Ensure you used the same email for Stripe checkout.`);
        }
      } else {
        setSyncMessage(data.error || 'Sync failed. Please try again.');
      }
    } catch (error) {
      console.error('Sync error:', error);
      setSyncMessage('Sync failed. Please try again or contact support.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSubscribe = async (plan: SubscriptionPlan) => {
      if (plan.comingSoon || !plan.priceId) return;

      setLoadingPlanId(plan.id);

      try {
          // First, check if user has overages that need handling
          const overageCheck = await fetch('/api/stripe/check-upgrade-overages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ newTier: plan.id }),
          });

          if (overageCheck.ok) {
              const overageData = await overageCheck.json();

              if (overageData.hasOverages && overageData.overageCount > 0) {
                  // Show the overage credit offer modal
                  setPendingUpgrade({ plan, overageData });
                  setShowOverageOffer(true);
                  setLoadingPlanId(null);
                  return;
              }
          }

          // No overages, proceed with checkout
          await proceedToCheckout(plan);

      } catch (error) {
          console.error('Checkout error:', error);
          alert('An error occurred. Please try again or contact support.');
          setLoadingPlanId(null);
      }
  };

  const proceedToCheckout = async (plan: SubscriptionPlan) => {
      try {
          const response = await fetch('/api/stripe/create-checkout-session', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                  priceId: plan.priceId,
                  tier: plan.id,
                  billingInterval, // Pass the billing interval for metadata
              }),
          });

          if (!response.ok) {
              const errorData = await response.json();
              console.error('Checkout error response:', errorData);
              alert(`Error: ${errorData.error || 'Unable to start checkout'}`);
              return;
          }

          const data = await response.json();

          if (data.url) {
              window.location.href = data.url;
          } else {
              console.error('No checkout URL received');
              alert('Unable to start checkout. Please try again.');
          }
      } catch (error) {
          console.error('Checkout error:', error);
          alert('An error occurred. Please try again or contact support.');
      } finally {
          setLoadingPlanId(null);
      }
  };

  const handleAcceptCredits = async () => {
      if (!pendingUpgrade) return;

      await fetch('/api/stripe/apply-overage-decision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              decision: 'credits',
              newTier: pendingUpgrade.plan.id,
          }),
      });

      setShowOverageOffer(false);
      await proceedToCheckout(pendingUpgrade.plan);
      setPendingUpgrade(null);
  };

  const handleDeclineAndPay = async () => {
      if (!pendingUpgrade) return;

      await fetch('/api/stripe/apply-overage-decision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              decision: 'pay',
              newTier: pendingUpgrade.plan.id,
          }),
      });

      setShowOverageOffer(false);
      await proceedToCheckout(pendingUpgrade.plan);
      setPendingUpgrade(null);
  };

  const currentTier = userData?.user?.subscriptionTier || 'free';
  const isCurrentPlan = (planId: string) => currentTier === planId;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pt-6 animate-fade-in pb-12">
        <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Scale Your Merch Empire</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                Choose the production power you need. All plans include access to our Gemini-powered trend orchestration engine.
            </p>

            {/* Billing Toggle */}
            <div className="mt-8 flex items-center justify-center gap-4">
                <button
                    onClick={() => setBillingInterval('monthly')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        billingInterval === 'monthly'
                            ? 'bg-brand-600 text-white'
                            : 'bg-gray-100 dark:bg-dark-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                    Monthly
                </button>
                <button
                    onClick={() => setBillingInterval('yearly')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        billingInterval === 'yearly'
                            ? 'bg-brand-600 text-white'
                            : 'bg-gray-100 dark:bg-dark-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                    Yearly
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-600 dark:text-green-400 text-xs rounded-full border border-green-500/30">
                        2 months free
                    </span>
                </button>
            </div>

            {/* Yearly Benefits Banner */}
            {billingInterval === 'yearly' && (
                <div className="mt-6 inline-flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-xl">
                    <Infinity className="w-5 h-5 text-green-500 dark:text-green-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                        <span className="text-green-600 dark:text-green-400 font-semibold">Yearly Bonus:</span> Unlimited storage capacity & retention time
                    </span>
                </div>
            )}

            {userData && (
              <div className="mt-6 flex flex-col items-center gap-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500/10 border border-brand-500/20 rounded-lg">
                  <Crown className="w-4 h-4 text-brand-500 dark:text-brand-400" />
                  <span className="text-sm text-brand-600 dark:text-brand-400 font-medium">
                    Current Plan: <span className="font-bold capitalize">{currentTier}</span>
                  </span>
                  {userData.usage && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      ({userData.usage.used}/{userData.usage.allowance} designs used)
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={handleSyncSubscription}
                    disabled={syncing}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-dark-800 hover:bg-gray-200 dark:hover:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                    {syncing ? 'Syncing...' : 'Sync Subscription'}
                  </button>
                  {syncMessage && (
                    <span className={`text-xs ${syncMessage.includes('Synced') ? 'text-green-500 dark:text-green-400' : 'text-yellow-500 dark:text-yellow-400'}`}>
                      {syncMessage}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400 dark:text-gray-600">
                    Paid but still on Free? Click to sync with Stripe.
                  </span>
                </div>
              </div>
            )}
        </div>

        <div className="flex flex-wrap justify-center gap-6">
            {plans.map((plan) => {
                const isCurrent = isCurrentPlan(plan.id);
                const savings = plan.id !== 'free' ? getYearlySavings(plan.id as TierName) : null;

                return (
                <div
                    key={plan.id}
                    className={`
                        relative rounded-2xl p-6 w-full md:w-[350px] flex flex-col
                        transition-all duration-300
                        ${plan.comingSoon ? 'opacity-75' : 'hover:-translate-y-2'}
                        ${isCurrent
                            ? 'bg-white dark:bg-dark-800 border-2 border-green-500 shadow-[0_0_40px_rgba(34,197,94,0.15)] z-10'
                            : plan.recommended
                                ? 'bg-white dark:bg-dark-800 border-2 border-brand-500 shadow-[0_0_40px_rgba(14,165,233,0.15)] z-10'
                                : 'bg-gray-50 dark:bg-dark-800/60 border border-gray-200 dark:border-white/5 hover:bg-white dark:hover:bg-dark-800'
                        }
                    `}
                >
                    {isCurrent && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow-lg border border-white/10 flex items-center gap-1">
                            <Crown className="w-3 h-3" /> Current Plan
                        </div>
                    )}

                    {!isCurrent && plan.highlight && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-brand-500 to-cyan-600 text-white text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow-lg border border-white/10">
                            {plan.highlight}
                        </div>
                    )}

                    {plan.comingSoon && (
                         <div className="absolute -top-4 right-8 bg-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                            Coming Soon
                        </div>
                    )}

                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{plan.name}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{plan.id === 'free' ? 'Try Turbo Merch' : `For ${plan.name.toLowerCase()} creators`}</p>

                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
                            <span className="text-gray-500">
                                /{billingInterval === 'yearly' ? 'mo' : 'month'}
                            </span>
                        </div>

                        {/* Show yearly savings */}
                        {billingInterval === 'yearly' && savings && savings.savings > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-gray-500 line-through">
                                    ${PRICING_TIERS[plan.id as TierName].price}/mo
                                </span>
                                <span className="text-xs text-green-500 dark:text-green-400 font-medium">
                                    Save ${savings.savings.toFixed(2)}/year
                                </span>
                            </div>
                        )}

                        {billingInterval === 'yearly' && plan.id !== 'free' && (
                            <p className="text-xs text-gray-500 mt-1">
                                Billed ${PRICING_TIERS[plan.id as TierName].yearlyPrice.toFixed(2)}/year
                            </p>
                        )}

                        {plan.description && billingInterval === 'monthly' && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">{plan.description}</p>
                        )}
                    </div>

                    <div className="flex-grow">
                        <ul className="space-y-3 mb-8">
                            {plan.features.map((feature, idx) => (
                                <li key={idx} className="flex items-start gap-3 text-gray-600 dark:text-gray-300 text-xs leading-relaxed">
                                    <CheckCircle className={`w-4 h-4 shrink-0 ${
                                        feature.includes('🎁') ? 'text-green-500 dark:text-green-400' :
                                        plan.recommended ? 'text-brand-500 dark:text-brand-400' : 'text-gray-400 dark:text-gray-500'
                                    }`} />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <button
                        onClick={() => handleSubscribe(plan)}
                        disabled={loadingPlanId === plan.id || plan.comingSoon || isCurrent}
                        className={`
                            w-full py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2
                            ${isCurrent
                                ? 'bg-green-500/20 text-green-600 dark:text-green-400 cursor-default border border-green-500/30'
                                : plan.comingSoon
                                    ? 'bg-gray-100 dark:bg-white/5 text-gray-500 cursor-not-allowed border border-gray-200 dark:border-white/5'
                                    : plan.recommended
                                        ? 'bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white shadow-lg shadow-brand-900/20'
                                        : plan.id === 'free'
                                            ? 'bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-900 dark:text-white border border-gray-200 dark:border-white/5'
                                            : 'bg-gray-900 dark:bg-white text-white dark:text-dark-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                            }
                        `}
                    >
                        {loadingPlanId === plan.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isCurrent ? (
                            <>
                                <CheckCircle className="w-4 h-4" /> Current Plan
                            </>
                        ) : plan.comingSoon ? (
                            <>
                                <Lock className="w-3 h-3" /> Coming Soon
                            </>
                        ) : (
                            plan.buttonText
                        )}
                    </button>
                </div>
                );
            })}
        </div>

        <div className="text-center mt-12 text-xs text-gray-500">
            Secure payments powered by Stripe. You can cancel at any time.
        </div>

        {/* Overage Credit Offer Modal */}
        {pendingUpgrade && (
            <OverageCreditOfferModal
                isOpen={showOverageOffer}
                onClose={() => {
                    setShowOverageOffer(false);
                    setPendingUpgrade(null);
                }}
                currentTier={currentTier as TierName}
                newTier={pendingUpgrade.plan.id as TierName}
                overageCount={pendingUpgrade.overageData.overageCount}
                overageCharge={pendingUpgrade.overageData.overageCharge}
                onAcceptCredits={handleAcceptCredits}
                onDeclineAndPay={handleDeclineAndPay}
            />
        )}
    </div>
  );
};

export default PricingPlans;
