'use client';

import React, { useState } from 'react';
import { X, Loader2, CreditCard, Gift, AlertTriangle, ArrowRight, Check } from 'lucide-react';
import { PRICING_TIERS, TierName } from '../lib/pricing';

interface OverageCreditOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: TierName;
  newTier: TierName;
  overageCount: number;
  overageCharge: number;
  onAcceptCredits: () => Promise<void>; // Apply credits and proceed
  onDeclineAndPay: () => Promise<void>; // Pay overage and proceed
}

const OverageCreditOfferModal: React.FC<OverageCreditOfferModalProps> = ({
  isOpen,
  onClose,
  currentTier,
  newTier,
  overageCount,
  overageCharge,
  onAcceptCredits,
  onDeclineAndPay,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'credits' | 'pay' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const newTierConfig = PRICING_TIERS[newTier];
  const newAllowance = newTierConfig.limits.designs;

  if (!isOpen) return null;

  const handleAction = async (action: 'credits' | 'pay') => {
    setSelectedOption(action);
    setIsProcessing(true);
    setError(null);

    try {
      if (action === 'credits') {
        await onAcceptCredits();
      } else {
        await onDeclineAndPay();
      }
    } catch (err) {
      console.error('Overage action error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-dark-800 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl flex items-center justify-center border border-yellow-500/30">
            <Gift className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Overage Credits Available</h2>
            <p className="text-sm text-gray-400">One-time offer on upgrade</p>
          </div>
        </div>

        {/* Current Status */}
        <div className="bg-dark-900/50 border border-white/5 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-400">Outstanding Overages</span>
            <span className="text-white font-semibold">{overageCount} designs</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Overage Charge</span>
            <span className="text-red-400 font-semibold">${overageCharge.toFixed(2)}</span>
          </div>
        </div>

        {/* Explanation */}
        <p className="text-sm text-gray-300 mb-5 leading-relaxed">
          You have <strong className="text-white">{overageCount} overage designs</strong> from your current billing period.
          Since you're upgrading to <strong className="text-brand-400">{newTierConfig.name}</strong>, you can choose to:
        </p>

        {/* Option 1: Use Credits */}
        <div
          onClick={() => !isProcessing && setSelectedOption('credits')}
          className={`relative bg-dark-900/50 border rounded-xl p-4 mb-3 cursor-pointer transition-all ${
            selectedOption === 'credits'
              ? 'border-green-500/50 ring-2 ring-green-500/20'
              : 'border-white/5 hover:border-green-500/30'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
              selectedOption === 'credits' ? 'border-green-500 bg-green-500' : 'border-gray-500'
            }`}>
              {selectedOption === 'credits' && <Check className="w-3 h-3 text-white" />}
            </div>
            <div className="flex-1">
              <h4 className="text-white font-semibold mb-1 flex items-center gap-2">
                <Gift className="w-4 h-4 text-green-400" />
                Use New Plan Credits
              </h4>
              <p className="text-xs text-gray-400 mb-2">
                Apply {overageCount} of your {newAllowance} monthly credits to cover overages.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 bg-green-500/10 text-green-400 rounded border border-green-500/20">
                  No extra charge
                </span>
                <span className="text-xs text-gray-500">
                  {newAllowance - overageCount} credits remaining
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Option 2: Pay Now */}
        <div
          onClick={() => !isProcessing && setSelectedOption('pay')}
          className={`relative bg-dark-900/50 border rounded-xl p-4 mb-5 cursor-pointer transition-all ${
            selectedOption === 'pay'
              ? 'border-yellow-500/50 ring-2 ring-yellow-500/20'
              : 'border-white/5 hover:border-yellow-500/30'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
              selectedOption === 'pay' ? 'border-yellow-500 bg-yellow-500' : 'border-gray-500'
            }`}>
              {selectedOption === 'pay' && <Check className="w-3 h-3 text-white" />}
            </div>
            <div className="flex-1">
              <h4 className="text-white font-semibold mb-1 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-yellow-400" />
                Pay Overages Now
              </h4>
              <p className="text-xs text-gray-400 mb-2">
                Charge ${overageCharge.toFixed(2)} now and keep all {newAllowance} credits for new designs.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded border border-yellow-500/20">
                  Full credits available
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-5">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Confirm Button */}
        <button
          onClick={() => selectedOption && handleAction(selectedOption)}
          disabled={!selectedOption || isProcessing}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            !selectedOption || isProcessing
              ? 'bg-dark-700 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Continue to Upgrade
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 text-center mt-4">
          This offer is only available during upgrade. Your choice is final.
        </p>
      </div>
    </div>
  );
};

export default OverageCreditOfferModal;
