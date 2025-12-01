'use client';

import React, { useState } from 'react';
import { Send, Loader2, Sparkles, AlertCircle, Gift, History, ChevronDown, ChevronUp } from 'lucide-react';

interface RefinementHistoryItem {
  instruction: string;
  imageUrl: string;
  timestamp: number;
}

interface ImageRefinementChatProps {
  currentImageUrl: string;
  designId?: string;
  onImageRefined: (newImageUrl: string, instruction: string) => void;
  refinementCount?: number;
  className?: string;
}

const ImageRefinementChat: React.FC<ImageRefinementChatProps> = ({
  currentImageUrl,
  designId,
  onImageRefined,
  refinementCount: initialRefinementCount = 0,
  className = '',
}) => {
  const [instruction, setInstruction] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refinementHistory, setRefinementHistory] = useState<RefinementHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [localRefinementCount, setLocalRefinementCount] = useState(initialRefinementCount);

  const isFirstRefinement = localRefinementCount === 0;

  const handleRefine = async () => {
    if (!instruction.trim() || isRefining) return;

    setIsRefining(true);
    setError(null);

    try {
      const response = await fetch('/api/gemini/refine-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: currentImageUrl,
          instruction: instruction.trim(),
          designId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.requiresUpgrade) {
          setError('Refinement limit reached. Please upgrade your plan to continue.');
        } else {
          setError(data.error || 'Failed to refine image. Please try again.');
        }
        return;
      }

      // Update local refinement count
      setLocalRefinementCount(data.refinementCount || localRefinementCount + 1);

      // Add to history
      setRefinementHistory(prev => [
        ...prev,
        {
          instruction: instruction.trim(),
          imageUrl: data.imageUrl,
          timestamp: Date.now(),
        },
      ]);

      // Notify parent of the refined image
      onImageRefined(data.imageUrl, instruction.trim());
      setInstruction('');
    } catch (err) {
      console.error('Refinement error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsRefining(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRefine();
    }
  };

  const exampleInstructions = [
    'Change the text color to green',
    'Make the text bigger',
    'Add a glow effect to the text',
    'Change the style to vintage',
    'Make the illustration more detailed',
  ];

  return (
    <div className={`bg-gray-50 dark:bg-dark-800/50 border border-gray-200 dark:border-white/5 rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-500 dark:text-brand-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Refine This Design</h3>
        </div>
        {isFirstRefinement ? (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-full">
            <Gift className="w-3 h-3 text-green-500 dark:text-green-400" />
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">First refinement free!</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded-full">
            <AlertCircle className="w-3 h-3 text-yellow-500 dark:text-yellow-400" />
            <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Uses 1 credit</span>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Tell the AI what to change. {!isFirstRefinement && <span className="text-yellow-600 dark:text-yellow-400">Each refinement after the first uses 1 design credit.</span>}
      </p>

      {/* Input */}
      <div className="relative">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., 'Change the text color to blue' or 'Make the design more vintage'"
          className="w-full bg-white dark:bg-dark-900/50 border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 pr-12 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-brand-500/50 resize-none"
          rows={2}
          disabled={isRefining}
        />
        <button
          onClick={handleRefine}
          disabled={!instruction.trim() || isRefining}
          className={`absolute right-2 bottom-2 p-2 rounded-lg transition-all ${
            instruction.trim() && !isRefining
              ? 'bg-brand-600 hover:bg-brand-500 text-white'
              : 'bg-gray-100 dark:bg-white/5 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isRefining ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-3 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Example Instructions */}
      {!instruction && (
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-2">Try:</p>
          <div className="flex flex-wrap gap-2">
            {exampleInstructions.slice(0, 3).map((example, idx) => (
              <button
                key={idx}
                onClick={() => setInstruction(example)}
                className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-dark-900/50 border border-gray-200 dark:border-white/5 rounded-lg hover:border-brand-500/30 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
              >
                "{example}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Refinement History */}
      {refinementHistory.length > 0 && (
        <div className="mt-4 border-t border-gray-200 dark:border-white/5 pt-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <History className="w-3 h-3" />
            <span>Refinement History ({refinementHistory.length})</span>
            {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showHistory && (
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {refinementHistory.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-white dark:bg-dark-900/30 border border-gray-100 dark:border-transparent rounded-lg text-xs"
                >
                  <span className="text-gray-500 w-5">{idx + 1}.</span>
                  <span className="text-gray-600 dark:text-gray-300 flex-1 truncate">"{item.instruction}"</span>
                  <button
                    onClick={() => onImageRefined(item.imageUrl, item.instruction)}
                    className="text-brand-500 dark:text-brand-400 hover:text-brand-400 dark:hover:text-brand-300 text-xs"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Usage Info */}
      {!isFirstRefinement && (
        <p className="mt-3 text-xs text-gray-500">
          {localRefinementCount} refinement{localRefinementCount !== 1 ? 's' : ''} used. Additional refinements count against your quota.
        </p>
      )}
    </div>
  );
};

export default ImageRefinementChat;
