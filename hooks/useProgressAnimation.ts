/**
 * useProgressAnimation Hook
 *
 * Provides smooth animated progress for long-running operations.
 * Extracted from ListingGenerator.tsx to enable reuse in TrendScanner
 * and other components.
 *
 * Features:
 * - Smooth progress increments with natural variation
 * - Rotating status messages
 * - Configurable max progress per stage
 * - Auto-reset when operation completes
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ProgressStage {
  name: string;
  messages: string[];
  startProgress: number;
  maxProgress: number;
}

export interface UseProgressAnimationOptions {
  /** Interval in ms between progress updates (default: 150) */
  progressInterval?: number;
  /** Interval in ms between message changes (default: 2500) */
  messageInterval?: number;
  /** Minimum progress increment per tick (default: 0.3) */
  minIncrement?: number;
  /** Maximum progress increment per tick (default: 1.5) */
  maxIncrement?: number;
}

const DEFAULT_OPTIONS: UseProgressAnimationOptions = {
  progressInterval: 150,
  messageInterval: 2500,
  minIncrement: 0.3,
  maxIncrement: 1.5,
};

// Default message sets for common operations
export const LISTING_GENERATION_MESSAGES = [
  'Analyzing trend data...',
  'Researching Amazon compliance...',
  'Generating SEO keywords...',
  'Crafting compelling title...',
  'Writing product description...',
  'Optimizing bullet points...',
  'Checking trademark database...',
  'Filtering prohibited words...',
  'Validating content structure...',
  'Finalizing listing copy...'
];

export const IMAGE_GENERATION_MESSAGES = [
  'Preparing design canvas...',
  'Analyzing visual style...',
  'Generating base composition...',
  'Applying typography...',
  'Rendering design elements...',
  'Optimizing color palette...',
  'Adding finishing touches...',
  'Enhancing visual clarity...',
  'Preparing high-res output...',
  'Finalizing artwork...'
];

export const TREND_SEARCH_MESSAGES = [
  'Initializing trend scanners...',
  'Analyzing market patterns...',
  'Scanning social platforms...',
  'Processing viral signals...',
  'Evaluating competition data...',
  'Ranking opportunities...',
  'Compiling results...'
];

export function useProgressAnimation(
  isActive: boolean,
  messages: string[],
  maxProgress: number = 95,
  startProgress: number = 0,
  options: UseProgressAnimationOptions = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [progress, setProgress] = useState(startProgress);
  const [currentMessage, setCurrentMessage] = useState(messages[0] || 'Processing...');
  const messageIndexRef = useRef(0);

  // Reset when becoming inactive
  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      messageIndexRef.current = 0;
      setCurrentMessage(messages[0] || 'Processing...');
    }
  }, [isActive, messages]);

  // Smooth progress animation
  useEffect(() => {
    if (!isActive) return;

    setProgress(startProgress);
    setCurrentMessage(messages[0] || 'Processing...');

    const progressTimer = setInterval(() => {
      setProgress(prev => {
        const remaining = maxProgress - prev;
        if (remaining <= 0) return prev;

        // Random increment for natural feel
        const baseIncrement = opts.minIncrement! + Math.random() * (opts.maxIncrement! - opts.minIncrement!);

        // Slow down as we approach max
        const adjustedIncrement = Math.min(baseIncrement, remaining * 0.1);

        return Math.min(prev + adjustedIncrement, maxProgress);
      });
    }, opts.progressInterval);

    const messageTimer = setInterval(() => {
      messageIndexRef.current = (messageIndexRef.current + 1) % messages.length;
      setCurrentMessage(messages[messageIndexRef.current]);
    }, opts.messageInterval);

    return () => {
      clearInterval(progressTimer);
      clearInterval(messageTimer);
    };
  }, [isActive, messages, maxProgress, startProgress, opts.progressInterval, opts.messageInterval, opts.minIncrement, opts.maxIncrement]);

  /**
   * Jump to a specific progress value (e.g., when stage changes)
   */
  const jumpTo = useCallback((value: number) => {
    setProgress(value);
  }, []);

  /**
   * Complete the progress (jump to 100%)
   */
  const complete = useCallback(() => {
    setProgress(100);
    setCurrentMessage('Complete!');
  }, []);

  /**
   * Reset progress to initial state
   */
  const reset = useCallback(() => {
    setProgress(0);
    messageIndexRef.current = 0;
    setCurrentMessage(messages[0] || 'Processing...');
  }, [messages]);

  /**
   * Set a custom message
   */
  const setMessage = useCallback((message: string) => {
    setCurrentMessage(message);
  }, []);

  return {
    progress,
    currentMessage,
    jumpTo,
    complete,
    reset,
    setMessage,
  };
}

/**
 * Hook for multi-stage progress (e.g., text generation then image generation)
 */
export function useMultiStageProgress(stages: ProgressStage[], currentStageIndex: number, isActive: boolean) {
  const currentStage = stages[currentStageIndex];

  const {
    progress,
    currentMessage,
    jumpTo,
    complete,
    reset,
    setMessage,
  } = useProgressAnimation(
    isActive && !!currentStage,
    currentStage?.messages || [],
    currentStage?.maxProgress || 100,
    currentStage?.startProgress || 0
  );

  // Jump when stage changes
  useEffect(() => {
    if (currentStage && isActive) {
      jumpTo(currentStage.startProgress);
    }
  }, [currentStageIndex, currentStage, isActive, jumpTo]);

  return {
    progress,
    currentMessage,
    currentStageName: currentStage?.name || '',
    jumpTo,
    complete,
    reset,
    setMessage,
    stageCount: stages.length,
    currentStageIndex,
  };
}

export default useProgressAnimation;
