import React from 'react';
import { X, Zap, TrendingUp, Crown, AlertTriangle } from 'lucide-react';
import { PRICING_TIERS } from '../lib/pricing';

interface OverageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
  onUpgrade: (tier: string) => void;
  currentTier: string;
  overageCharge: number;
  overageCount: number;
  isHardCap?: boolean; // If true, hide "Pay & Continue" option - hard limit reached
}

const OverageDialog: React.FC<OverageDialogProps> = ({
  isOpen,
  onClose,
  onContinue,
  onUpgrade,
  currentTier,
  overageCharge,
  overageCount,
  isHardCap = false,
}) => {
  if (!isOpen) return null;

  // Get next 2 tiers to show
  const tierOrder = ['free', 'starter', 'pro', 'business', 'enterprise'];
  const currentIndex = tierOrder.indexOf(currentTier);
  const nextTiers = tierOrder.slice(currentIndex + 1, currentIndex + 3);

  const currentTierConfig = PRICING_TIERS[currentTier as keyof typeof PRICING_TIERS];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-dark-800 border border-white/10 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-dark-800/95 backdrop-blur-sm border-b border-white/10 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {isHardCap ? 'Maximum Limit Reached' : 'Design Limit Reached'}
              </h2>
              <p className="text-sm text-gray-400 mt-0.5">
                {isHardCap ? 'Upgrade required to continue' : 'Choose how to proceed'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Status */}
          <div className="bg-dark-900/50 border border-orange-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5" />
              <div>
                <h3 className="text-white font-semibold mb-1">
                  {isHardCap
                    ? `You've Reached the Maximum (${currentTierConfig.limits.designs + (currentTierConfig.overage.hardCap || 0)} Designs)`
                    : `You've Used All ${currentTierConfig.limits.designs} Designs`
                  }
                </h3>
                <p className="text-gray-400 text-sm">
                  You're on the <span className="text-white font-medium capitalize">{currentTier}</span> plan.
                  {isHardCap ? (
                    <>
                      {' '}You've reached the maximum overage limit of{' '}
                      <span className="text-orange-400 font-bold">{currentTierConfig.overage.hardCap}</span> additional designs.
                      <span className="text-white font-medium"> Upgrade to continue creating.</span>
                    </>
                  ) : (
                    <>
                      {' '}Creating this design will incur an overage charge of{' '}
                      <span className="text-orange-400 font-bold">${overageCharge.toFixed(2)}</span>.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold text-lg">
              {isHardCap ? 'Upgrade to Continue:' : 'Choose an Option:'}
            </h3>

            {/* Option 1: Pay Overage - Only show if NOT hard cap */}
            {!isHardCap && (
              <div className="bg-dark-700/50 border border-white/10 hover:border-orange-500/30 rounded-xl p-5 transition-all cursor-pointer group"
                   onClick={onContinue}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-orange-400" />
                      <h4 className="text-white font-bold">Continue with Overage</h4>
                    </div>
                    <p className="text-gray-400 text-sm mb-3">
                      Pay ${currentTierConfig.overage.pricePerDesign.toFixed(2)} for this design.
                      You can create up to {currentTierConfig.overage.hardCap} additional designs this month.
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                      <span className="text-orange-400 font-bold text-lg">${overageCharge.toFixed(2)}</span>
                      <span className="text-orange-300 text-xs">one-time charge</span>
                    </div>
                  </div>
                  <button
                    onClick={onContinue}
                    className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-all group-hover:scale-105 shadow-lg shadow-orange-900/30 whitespace-nowrap"
                  >
                    Pay & Continue
                  </button>
                </div>
              </div>
            )}

            {/* Upgrade Options */}
            {nextTiers.map((tierKey, index) => {
              const tier = PRICING_TIERS[tierKey as keyof typeof PRICING_TIERS];
              if (!tier || tier.status !== 'active') return null;

              const monthlySavings = (currentTierConfig.overage.pricePerDesign *
                (tier.limits.designs - currentTierConfig.limits.designs)).toFixed(2);

              const Icon = index === 0 ? TrendingUp : Crown;
              const gradient = index === 0
                ? 'from-brand-600 to-cyan-600'
                : 'from-brand-600 to-teal-600';
              const hoverGradient = index === 0
                ? 'hover:from-brand-500 hover:to-cyan-500'
                : 'hover:from-brand-500 hover:to-teal-500';

              return (
                <div
                  key={tierKey}
                  className={`bg-gradient-to-br ${gradient.replace('from-', 'from-').replace('to-', 'to-')}/10 border-2 border-transparent hover:border-${index === 0 ? 'brand' : 'teal'}-500/50 rounded-xl p-5 transition-all cursor-pointer group relative overflow-hidden`}
                  onClick={() => onUpgrade(tierKey)}
                >
                  {index === 0 && (
                    <div className="absolute top-3 right-3 px-2 py-1 bg-brand-500 text-white text-[10px] font-bold uppercase rounded">
                      Recommended
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-5 h-5 ${index === 0 ? 'text-brand-400' : 'text-teal-400'}`} />
                        <h4 className="text-white font-bold text-lg">Upgrade to {tier.name}</h4>
                        <span className="text-2xl font-bold text-white">${tier.price}<span className="text-sm text-gray-400">/mo</span></span>
                      </div>

                      <p className="text-gray-300 text-sm mb-3">
                        {tier.display.description}
                      </p>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                          <span className="text-sm text-gray-300">
                            <span className="text-white font-bold">{tier.limits.designs} designs/month</span>
                            {tier.limits.maxPerRun > 1 && ` + batch generation (${tier.limits.maxPerRun} at once)`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                          <span className="text-sm text-gray-300">
                            Overage: <span className="text-white font-bold">${tier.overage.pricePerDesign}/design</span>
                            {tier.overage.pricePerDesign < currentTierConfig.overage.pricePerDesign &&
                              <span className="text-green-400 ml-1">(${(currentTierConfig.overage.pricePerDesign - tier.overage.pricePerDesign).toFixed(2)} cheaper)</span>
                            }
                          </span>
                        </div>
                        {tier.features.priorityProcessing && (
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                            <span className="text-sm text-gray-300">Priority processing</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                          <span className="text-sm text-gray-300">
                            {tier.limits.historyRetention} design retention
                          </span>
                        </div>
                      </div>

                      {monthlySavings > '0.00' && (
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg`}>
                          <span className="text-green-400 font-bold text-sm">Save ~${monthlySavings}/month</span>
                          <span className="text-green-300 text-xs">vs overage charges</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => onUpgrade(tierKey)}
                      className={`px-6 py-2.5 bg-gradient-to-r ${gradient} ${hoverGradient} text-white font-bold rounded-lg transition-all group-hover:scale-105 shadow-lg whitespace-nowrap`}
                    >
                      Upgrade Now
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="text-center text-xs text-gray-500 pt-4 border-t border-white/5">
            You can change or cancel your plan anytime. Upgrades are prorated.
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverageDialog;
