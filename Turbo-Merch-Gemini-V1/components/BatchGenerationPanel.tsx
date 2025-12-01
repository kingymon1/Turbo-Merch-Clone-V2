'use client';

import React, { useState } from 'react';
import { Loader2, Zap, Target, Sparkles, AlertTriangle, CheckCircle, Play, Minus, Plus, Rocket, Layers } from 'lucide-react';
import { PRICING_TIERS, TierName } from '../lib/pricing';
import { PromptMode } from '../types';

interface BatchResult {
  id: string;
  success: boolean;
  listing?: any;
  imageUrl?: string;
  error?: string;
}

interface BatchGenerationPanelProps {
  userTier: TierName;
  remainingQuota: number;
  viralityLevel: number;
  promptMode: PromptMode;
  onBatchComplete: (results: BatchResult[]) => void;
  onNavigateToSubscription?: () => void;
  embedded?: boolean; // When true, hides the header (parent provides context)
}

type BatchMode = 'autopilot' | 'targeted';

const BatchGenerationPanel: React.FC<BatchGenerationPanelProps> = ({
  userTier,
  remainingQuota,
  viralityLevel,
  promptMode,
  onBatchComplete,
  onNavigateToSubscription,
  embedded = false,
}) => {
  const [mode, setMode] = useState<BatchMode>('targeted');
  const [niche, setNiche] = useState('');
  const [batchSize, setBatchSize] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [results, setResults] = useState<BatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const tierConfig = PRICING_TIERS[userTier];
  const maxBatchSize = Math.min(tierConfig.limits.maxPerRun, remainingQuota);
  const canBatch = maxBatchSize > 1;

  const handleGenerate = async () => {
    if (batchSize < 1 || batchSize > maxBatchSize) return;
    if (mode === 'targeted' && !niche.trim()) return;

    setIsGenerating(true);
    setError(null);
    setResults([]);
    setProgress(0);
    setProgressMessage(mode === 'autopilot'
      ? 'Launching parallel research agents...'
      : `Researching "${niche}" for batch generation...`);

    try {
      const response = await fetch('/api/designs/batch-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          niche: mode === 'targeted' ? niche.trim() : undefined,
          count: batchSize,
          viralityLevel,
          promptMode,
        }),
      });

      // Handle streaming progress updates if available
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Batch generation failed');
        setIsGenerating(false);
        return;
      }

      const data = await response.json();
      setResults(data.results || []);
      setProgress(100);
      setProgressMessage(`Generated ${data.results?.filter((r: BatchResult) => r.success).length || 0} of ${batchSize} designs`);

      // Notify parent
      if (data.results) {
        onBatchComplete(data.results.filter((r: BatchResult) => r.success));
      }
    } catch (err) {
      console.error('Batch generation error:', err);
      setError('An error occurred during batch generation');
    } finally {
      setIsGenerating(false);
    }
  };

  const incrementBatch = () => setBatchSize(prev => Math.min(prev + 1, maxBatchSize));
  const decrementBatch = () => setBatchSize(prev => Math.max(prev - 1, 1));

  // Show upgrade prompt for tiers that don't support batch (including free)
  if (!canBatch) {
    return (
      <div className={embedded ? '' : 'bg-dark-800/50 border border-white/5 rounded-xl p-6'}>
        {!embedded && (
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center border border-brand-500/30">
              <Layers className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Batch Generation</h3>
              <span className="text-xs text-gray-500">Generate multiple designs at once</span>
            </div>
          </div>
        )}
        <p className="text-sm text-gray-400 mb-4">
          Batch generation lets you create up to 10 designs simultaneously. Available on Pro and higher plans.
        </p>
        <div className="space-y-2 mb-4 text-sm">
          <div className="flex items-center gap-2 text-gray-500">
            <Target className="w-4 h-4" />
            <span><strong className="text-brand-400">Targeted Mode:</strong> One research, multiple unique outputs</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <Zap className="w-4 h-4" />
            <span><strong className="text-cyan-400">Autopilot Mode:</strong> Parallel research + generation</span>
          </div>
        </div>
        {onNavigateToSubscription && (
          <button
            onClick={onNavigateToSubscription}
            className="w-full py-3 bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold rounded-xl transition-all"
          >
            Upgrade to Pro
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={embedded ? 'space-y-5' : 'bg-dark-800/50 border border-white/5 rounded-xl p-5 space-y-5'}>
      {!embedded && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center border border-brand-500/30">
              <Layers className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Batch Generation</h3>
              <p className="text-xs text-gray-400">Generate up to {maxBatchSize} designs at once</p>
            </div>
          </div>
          <div className="text-xs text-gray-500 bg-dark-900/50 px-2 py-1 rounded">
            {remainingQuota} quota remaining
          </div>
        </div>
      )}

      {/* Quota indicator for embedded mode */}
      {embedded && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Generate up to {maxBatchSize} designs at once</span>
          <span className="text-xs text-gray-500 bg-dark-900/50 px-2 py-1 rounded">
            {remainingQuota} quota remaining
          </span>
        </div>
      )}

      {/* Mode Toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setMode('targeted')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === 'targeted'
              ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
              : 'bg-dark-900/50 text-gray-400 border border-white/5 hover:bg-dark-900'
          }`}
        >
          <Target className="w-4 h-4" />
          Targeted
        </button>
        <button
          onClick={() => setMode('autopilot')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            mode === 'autopilot'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : 'bg-dark-900/50 text-gray-400 border border-white/5 hover:bg-dark-900'
          }`}
        >
          <Rocket className="w-4 h-4" />
          Autopilot
        </button>
      </div>

      {/* Mode Description */}
      <div className="bg-dark-900/30 rounded-lg p-3 text-xs text-gray-400">
        {mode === 'targeted' ? (
          <>
            <strong className="text-brand-300">Targeted Mode:</strong> Enter a niche/topic and generate multiple similar designs. One research run, multiple unique outputs.
          </>
        ) : (
          <>
            <strong className="text-cyan-300">Autopilot Mode:</strong> Run {batchSize} independent research + generation jobs in parallel. Faster discovery across different niches.
          </>
        )}
      </div>

      {/* Niche Input (Targeted only) */}
      {mode === 'targeted' && (
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Target Niche</label>
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="e.g., funny cat mom, gym motivation, nurse humor..."
            className="w-full bg-dark-900/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500/50"
            disabled={isGenerating}
          />
        </div>
      )}

      {/* Batch Size Selector */}
      <div>
        <label className="text-xs text-gray-400 mb-1.5 block">Batch Size</label>
        <div className="flex items-center gap-4">
          <button
            onClick={decrementBatch}
            disabled={batchSize <= 1 || isGenerating}
            className="w-10 h-10 bg-dark-900/50 border border-white/10 rounded-lg flex items-center justify-center text-white hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <div className="flex-1 text-center">
            <span className="text-3xl font-bold text-white">{batchSize}</span>
            <span className="text-gray-500 text-sm ml-1">/ {maxBatchSize}</span>
          </div>
          <button
            onClick={incrementBatch}
            disabled={batchSize >= maxBatchSize || isGenerating}
            className="w-10 h-10 bg-dark-900/50 border border-white/10 rounded-lg flex items-center justify-center text-white hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quota Warning */}
      {batchSize > remainingQuota && (
        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-400">
            You only have {remainingQuota} designs remaining. Overage charges may apply.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Progress */}
      {isGenerating && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">{progressMessage}</span>
            <span className="text-brand-400 font-mono">{progress}%</span>
          </div>
          <div className="h-2 bg-dark-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-cyan-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Results Preview */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Results</span>
            <span className="text-green-400">
              {results.filter(r => r.success).length}/{results.length} successful
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {results.map((result, idx) => (
              <div
                key={idx}
                className={`aspect-[3/4] rounded-lg overflow-hidden border ${
                  result.success ? 'border-green-500/30' : 'border-red-500/30'
                }`}
              >
                {result.success && result.imageUrl ? (
                  <img src={result.imageUrl} alt={`Result ${idx + 1}`} className="w-full h-full object-cover bg-black" />
                ) : (
                  <div className="w-full h-full bg-red-500/10 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || (mode === 'targeted' && !niche.trim()) || batchSize < 1}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
          isGenerating
            ? 'bg-dark-700 text-gray-400 cursor-not-allowed'
            : mode === 'autopilot'
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/30'
              : 'bg-gradient-to-r from-brand-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white shadow-lg shadow-brand-900/30'
        }`}
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating {batchSize} Design{batchSize !== 1 ? 's' : ''}...
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Generate {batchSize} Design{batchSize !== 1 ? 's' : ''}
          </>
        )}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Each design counts as 1 toward your monthly quota
      </p>
    </div>
  );
};

export default BatchGenerationPanel;
