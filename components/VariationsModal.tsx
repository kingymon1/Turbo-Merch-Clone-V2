'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Copy, AlertTriangle, CheckCircle, Sparkles, Minus, Plus } from 'lucide-react';
import { PRICING_TIERS, TierName } from '../lib/pricing';

interface VariationResult {
  id: string;
  listing: any;
  imageUrl: string;
  success: boolean;
  error?: string;
}

interface VariationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  designId: string;
  designTitle: string;
  design?: any; // Full design object for guest mode
  userTier: TierName;
  remainingQuota?: number; // Now optional - we'll fetch fresh data
  onVariationsGenerated?: (variations: VariationResult[]) => void;
}

const VariationsModal: React.FC<VariationsModalProps> = ({
  isOpen,
  onClose,
  designId,
  designTitle,
  design,
  userTier,
  remainingQuota: propQuota,
  onVariationsGenerated,
}) => {
  const [count, setCount] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<VariationResult[]>([]);
  const [stage, setStage] = useState<'input' | 'generating' | 'complete'>('input');

  // Fetch fresh quota when modal opens instead of relying on potentially stale props
  const [fetchedQuota, setFetchedQuota] = useState<number | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);

  // Fetch fresh quota data when modal opens
  useEffect(() => {
    if (isOpen && fetchedQuota === null) {
      const fetchQuota = async () => {
        setQuotaLoading(true);
        try {
          const response = await fetch('/api/user');
          if (response.ok) {
            const data = await response.json();
            const remaining = data.usage?.remaining ?? 0;
            console.log('[VariationsModal] Fetched fresh quota:', remaining);
            setFetchedQuota(remaining);
          }
        } catch (err) {
          console.log('[VariationsModal] Could not fetch quota:', err);
          // Fall back to prop value if fetch fails
          setFetchedQuota(propQuota ?? 0);
        } finally {
          setQuotaLoading(false);
        }
      };
      fetchQuota();
    }
  }, [isOpen, fetchedQuota, propQuota]);

  // Reset fetched quota when modal closes so we refetch next time
  useEffect(() => {
    if (!isOpen) {
      setFetchedQuota(null);
    }
  }, [isOpen]);

  // Use fetched quota if available, otherwise fall back to prop (or 0)
  const remainingQuota = fetchedQuota ?? propQuota ?? 0;

  const tierConfig = PRICING_TIERS[userTier];
  const maxVariations = Math.min(10, tierConfig.limits.maxPerRun, Math.max(remainingQuota, 1));

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (count < 1 || count > maxVariations) return;

    setIsGenerating(true);
    setError(null);
    setStage('generating');

    try {
      const response = await fetch('/api/designs/generate-variations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designId,
          count,
          guestDesign: design, // Send full design for guest mode
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.requiresUpgrade) {
          setError('Upgrade required to generate more variations.');
        } else {
          setError(data.error || 'Failed to generate variations');
        }
        setStage('input');
        return;
      }

      setResults(data.variations || []);
      setStage('complete');

      if (onVariationsGenerated && data.variations) {
        onVariationsGenerated(data.variations.filter((v: VariationResult) => v.success));
      }
    } catch (err) {
      console.error('Variations error:', err);
      setError('An error occurred. Please try again.');
      setStage('input');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setStage('input');
    setResults([]);
    setError(null);
    setCount(1);
    onClose();
  };

  const incrementCount = () => setCount(prev => Math.min(prev + 1, maxVariations));
  const decrementCount = () => setCount(prev => Math.max(prev - 1, 1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-dark-800 border border-gray-200 dark:border-white/10 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-brand-500/20 rounded-xl flex items-center justify-center border border-brand-500/30">
            <Copy className="w-5 h-5 text-brand-500 dark:text-brand-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Generate Variations</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Create similar designs from "{designTitle}"</p>
          </div>
        </div>

        {stage === 'input' && (
          <>
            {/* Quota Loading/Warning */}
            {quotaLoading ? (
              <div className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-dark-900/50 border border-gray-200 dark:border-white/10 rounded-lg mb-4">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin flex-shrink-0" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Checking available quota...</p>
              </div>
            ) : remainingQuota < 5 && (
              <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-500 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">Low quota remaining</p>
                  <p className="text-xs text-yellow-500/70 dark:text-yellow-400/70">
                    You have {remainingQuota} design{remainingQuota !== 1 ? 's' : ''} left this billing period.
                  </p>
                </div>
              </div>
            )}

            {/* Count Selector */}
            <div className="bg-gray-50 dark:bg-dark-900/50 border border-gray-200 dark:border-white/5 rounded-xl p-4 mb-4">
              <label className="text-sm text-gray-500 dark:text-gray-400 mb-3 block">Number of Variations</label>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={decrementCount}
                  disabled={count <= 1}
                  className="w-10 h-10 bg-gray-100 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg flex items-center justify-center text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="w-20 text-center">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">{count}</span>
                </div>
                <button
                  onClick={incrementCount}
                  disabled={count >= maxVariations}
                  className="w-10 h-10 bg-gray-100 dark:bg-dark-700 border border-gray-200 dark:border-white/10 rounded-lg flex items-center justify-center text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-dark-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 text-center mt-2">
                Max {maxVariations} (based on your {userTier} plan)
              </p>
            </div>

            {/* Info */}
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
                <span>Uses same research, creates unique designs</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
                <span>Each variation counts as 1 design</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
                <span>Saved automatically to your library</span>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
                <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={quotaLoading || count < 1 || count > maxVariations || remainingQuota < 1}
              className="w-full py-3 bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {quotaLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate {count} Variation{count !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </>
        )}

        {stage === 'generating' && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 text-brand-500 dark:text-brand-400 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Generating Variations</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Creating {count} unique design{count !== 1 ? 's' : ''} based on your original...
            </p>
            <div className="mt-4 w-full bg-gray-200 dark:bg-dark-900 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-brand-500 to-cyan-500 animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        )}

        {stage === 'complete' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-500 dark:text-green-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {results.filter(r => r.success).length} Variation{results.filter(r => r.success).length !== 1 ? 's' : ''} Created!
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Your new designs have been saved to your library.</p>
            </div>

            {/* Results Preview */}
            <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto">
              {results.map((result, idx) => (
                <div
                  key={result.id}
                  className={`relative rounded-lg overflow-hidden border ${result.success ? 'border-green-500/30' : 'border-red-500/30'
                    }`}
                >
                  {result.success && result.imageUrl ? (
                    <img
                      src={result.imageUrl}
                      alt={`Variation ${idx + 1}`}
                      className="w-full aspect-[3/4] object-cover bg-black"
                    />
                  ) : (
                    <div className="w-full aspect-[3/4] bg-red-500/10 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-red-500 dark:text-red-400" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs text-center py-1">
                    <span className={result.success ? 'text-green-400' : 'text-red-400'}>
                      {result.success ? `v${idx + 1}` : 'Failed'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleClose}
              className="w-full py-3 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 text-gray-900 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/10 transition-colors"
            >
              View in Library
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VariationsModal;
