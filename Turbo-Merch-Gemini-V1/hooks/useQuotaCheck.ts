/**
 * useQuotaCheck Hook
 *
 * Consolidates duplicated quota checking logic from App.tsx, TrendScanner.tsx,
 * and ListingGenerator.tsx into a single reusable hook.
 *
 * Handles:
 * - Checking quota before design generation
 * - Detecting overage situations
 * - Tracking design slot reservations
 * - Managing overage dialog state
 */

import { useState, useRef, useCallback } from 'react';

export interface QuotaUsage {
  remaining: number;
  overage: number;
  inOverage: boolean;
  designsUsed: number;
  allowance: number;
}

export interface OverageDialogData {
  charge: number;
  count: number;
  pendingAction: () => void;
  isHardCap?: boolean;
}

export interface QuotaCheckResult {
  allowed: boolean;
  requiresOverageApproval: boolean;
  isHardCap: boolean;
  usage: QuotaUsage | null;
  perDesignCharge: number;
  error?: string;
}

interface UseQuotaCheckOptions {
  onOverageApproved?: () => void;
  onHardCapReached?: () => void;
}

export function useQuotaCheck(options: UseQuotaCheckOptions = {}) {
  const [overageDialogOpen, setOverageDialogOpen] = useState(false);
  const [overageDialogData, setOverageDialogData] = useState<OverageDialogData | null>(null);
  const designSlotReservedRef = useRef(false);

  /**
   * Check if user can generate designs
   * Returns immediately if allowed, or sets up overage dialog if needed
   */
  const checkQuota = useCallback(async (designCount: number = 1): Promise<QuotaCheckResult> => {
    try {
      const response = await fetch('/api/designs/check-quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designCount }),
      });

      if (!response.ok) {
        const error = await response.json();

        if (response.status === 403) {
          // Hard cap reached
          return {
            allowed: false,
            requiresOverageApproval: false,
            isHardCap: true,
            usage: error.usage || null,
            perDesignCharge: 0,
            error: error.error,
          };
        }

        return {
          allowed: false,
          requiresOverageApproval: false,
          isHardCap: false,
          usage: null,
          perDesignCharge: 0,
          error: error.error || 'Failed to check quota',
        };
      }

      const data = await response.json();
      const usage: QuotaUsage = {
        remaining: data.usage?.remaining || 0,
        overage: data.usage?.overage || 0,
        inOverage: data.usage?.inOverage || false,
        designsUsed: data.usage?.designsUsed || 0,
        allowance: data.usage?.allowance || 0,
      };

      // Check if overage approval is needed
      const requiresOverageApproval = usage.remaining === 0 || usage.inOverage;

      // Extract charge from warning message or default to $2.00
      const perDesignCharge = data.warning?.message?.match(/\$(\d+\.\d+)/)?.[1]
        ? parseFloat(data.warning.message.match(/\$(\d+\.\d+)/)[1])
        : 2.00;

      return {
        allowed: !requiresOverageApproval,
        requiresOverageApproval,
        isHardCap: false,
        usage,
        perDesignCharge,
      };
    } catch (error) {
      console.error('Failed to check quota:', error);
      // Continue in offline mode
      return {
        allowed: true,
        requiresOverageApproval: false,
        isHardCap: false,
        usage: null,
        perDesignCharge: 0,
      };
    }
  }, []);

  /**
   * Reserve a design slot (track usage before generation)
   * Called after user approves overage charge
   */
  const reserveDesignSlot = useCallback(async (designCount: number = 1): Promise<boolean> => {
    try {
      const response = await fetch('/api/designs/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designCount }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to reserve design slot:', error);
        return false;
      }

      designSlotReservedRef.current = true;
      return true;
    } catch (error) {
      console.error('Failed to reserve design slot:', error);
      return false;
    }
  }, []);

  /**
   * Track usage after design is saved (for non-overage cases)
   */
  const trackUsageOnSave = useCallback(async (designCount: number = 1): Promise<boolean> => {
    // Skip if slot was already reserved during overage approval
    if (designSlotReservedRef.current) {
      designSlotReservedRef.current = false; // Reset for next design
      return true;
    }

    try {
      const response = await fetch('/api/designs/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designCount }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to track design generation:', error);
        return response.status !== 403; // Only fail on quota exceeded
      }

      return true;
    } catch (error) {
      console.error('Failed to track design generation:', error);
      return true; // Continue in offline mode
    }
  }, []);

  /**
   * Show overage confirmation dialog
   */
  const showOverageDialog = useCallback((data: Omit<OverageDialogData, 'pendingAction'>, onApprove: () => void) => {
    setOverageDialogData({
      ...data,
      pendingAction: async () => {
        const reserved = await reserveDesignSlot(1);
        if (reserved) {
          onApprove();
        }
      },
    });
    setOverageDialogOpen(true);
  }, [reserveDesignSlot]);

  /**
   * Show hard cap reached dialog
   */
  const showHardCapDialog = useCallback(() => {
    setOverageDialogData({
      charge: 0,
      count: 0,
      pendingAction: () => {},
      isHardCap: true,
    });
    setOverageDialogOpen(true);
    options.onHardCapReached?.();
  }, [options]);

  /**
   * Close the overage dialog
   */
  const closeOverageDialog = useCallback(() => {
    setOverageDialogOpen(false);
    setOverageDialogData(null);
  }, []);

  /**
   * Handle overage dialog confirmation
   */
  const confirmOverage = useCallback(() => {
    if (overageDialogData?.pendingAction) {
      overageDialogData.pendingAction();
    }
    closeOverageDialog();
  }, [overageDialogData, closeOverageDialog]);

  /**
   * Check quota and handle all scenarios (allowed, overage, hard cap)
   * Returns true if generation can proceed immediately
   */
  const checkAndHandleQuota = useCallback(async (
    designCount: number,
    onProceed: () => void
  ): Promise<boolean> => {
    const result = await checkQuota(designCount);

    if (result.isHardCap) {
      showHardCapDialog();
      return false;
    }

    if (result.requiresOverageApproval && result.usage) {
      showOverageDialog(
        {
          charge: result.perDesignCharge,
          count: (result.usage.overage || 0) + 1,
        },
        onProceed
      );
      return false;
    }

    // Allowed - proceed immediately
    return true;
  }, [checkQuota, showHardCapDialog, showOverageDialog]);

  return {
    // State
    overageDialogOpen,
    overageDialogData,
    isSlotReserved: designSlotReservedRef.current,

    // Actions
    checkQuota,
    checkAndHandleQuota,
    reserveDesignSlot,
    trackUsageOnSave,
    showOverageDialog,
    showHardCapDialog,
    closeOverageDialog,
    confirmOverage,

    // Reset slot reservation (call when starting fresh)
    resetSlotReservation: () => { designSlotReservedRef.current = false; },
  };
}

export default useQuotaCheck;
