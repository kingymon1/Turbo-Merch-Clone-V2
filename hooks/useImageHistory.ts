/**
 * useImageHistory Hook
 *
 * Manages versioned image history for design regeneration.
 * Extracted from ListingGenerator.tsx for reusability.
 *
 * Features:
 * - Track all image versions with metadata
 * - Navigate between versions
 * - Add new versions on regeneration
 * - Persist history with design data
 */

import { useState, useCallback, useMemo } from 'react';
import { PromptMode } from '../types';

export interface ImageVersion {
  imageUrl: string;
  promptMode: PromptMode;
  generatedAt: number;
  regenerationIndex: number;
}

export interface UseImageHistoryOptions {
  /** Initial image URL (creates first version) */
  initialImageUrl?: string;
  /** Initial prompt mode */
  initialPromptMode?: PromptMode;
  /** Initial generation timestamp */
  initialGeneratedAt?: number;
  /** Pre-existing image history */
  initialHistory?: ImageVersion[];
}

export function useImageHistory(options: UseImageHistoryOptions = {}) {
  const {
    initialImageUrl,
    initialPromptMode = 'advanced',
    initialGeneratedAt,
    initialHistory,
  } = options;

  // Build initial history from options
  const getInitialHistory = (): ImageVersion[] => {
    if (initialHistory && initialHistory.length > 0) {
      return initialHistory;
    }
    if (initialImageUrl) {
      return [{
        imageUrl: initialImageUrl,
        promptMode: initialPromptMode,
        generatedAt: initialGeneratedAt || Date.now(),
        regenerationIndex: 0,
      }];
    }
    return [];
  };

  const [history, setHistory] = useState<ImageVersion[]>(getInitialHistory);
  const [selectedIndex, setSelectedIndex] = useState(0);

  /**
   * Current selected image version
   */
  const currentVersion = useMemo(() => {
    return history[selectedIndex] || null;
  }, [history, selectedIndex]);

  /**
   * Current image URL
   */
  const currentImageUrl = useMemo(() => {
    return currentVersion?.imageUrl || null;
  }, [currentVersion]);

  /**
   * Add a new image version to history
   */
  const addVersion = useCallback((imageUrl: string, promptMode: PromptMode): ImageVersion => {
    const newVersion: ImageVersion = {
      imageUrl,
      promptMode,
      generatedAt: Date.now(),
      regenerationIndex: history.length,
    };

    setHistory(prev => [...prev, newVersion]);
    setSelectedIndex(history.length); // Select the new version

    return newVersion;
  }, [history.length]);

  /**
   * Navigate to a specific version by index
   */
  const selectVersion = useCallback((index: number) => {
    if (index >= 0 && index < history.length) {
      setSelectedIndex(index);
    }
  }, [history.length]);

  /**
   * Navigate to previous version
   */
  const previousVersion = useCallback(() => {
    if (selectedIndex > 0) {
      setSelectedIndex(prev => prev - 1);
    }
  }, [selectedIndex]);

  /**
   * Navigate to next version
   */
  const nextVersion = useCallback(() => {
    if (selectedIndex < history.length - 1) {
      setSelectedIndex(prev => prev + 1);
    }
  }, [selectedIndex, history.length]);

  /**
   * Navigate to latest version
   */
  const selectLatest = useCallback(() => {
    setSelectedIndex(history.length - 1);
  }, [history.length]);

  /**
   * Clear all history
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
    setSelectedIndex(0);
  }, []);

  /**
   * Reset history with new initial image
   */
  const resetWithImage = useCallback((imageUrl: string, promptMode: PromptMode) => {
    const newVersion: ImageVersion = {
      imageUrl,
      promptMode,
      generatedAt: Date.now(),
      regenerationIndex: 0,
    };
    setHistory([newVersion]);
    setSelectedIndex(0);
  }, []);

  /**
   * Get full history for persistence
   */
  const getHistory = useCallback(() => {
    return history;
  }, [history]);

  /**
   * Check navigation availability
   */
  const canGoBack = selectedIndex > 0;
  const canGoForward = selectedIndex < history.length - 1;
  const hasMultipleVersions = history.length > 1;
  const versionCount = history.length;
  const regenerationCount = Math.max(0, history.length - 1);

  return {
    // State
    history,
    selectedIndex,
    currentVersion,
    currentImageUrl,
    versionCount,
    regenerationCount,

    // Navigation
    canGoBack,
    canGoForward,
    hasMultipleVersions,
    selectVersion,
    previousVersion,
    nextVersion,
    selectLatest,

    // Mutations
    addVersion,
    clearHistory,
    resetWithImage,
    getHistory,
  };
}

export default useImageHistory;
