/**
 * Usage Tracking & Rate Limiting Module
 *
 * Provides server-side enforcement of tier limits, overage billing, and cooldowns.
 * This is the core module for managing user design quotas and billing.
 *
 * Key Features:
 * - Monthly design allowance tracking
 * - Overage billing calculations
 * - Soft and hard cap enforcement
 * - Auto-correction of usage mismatches
 * - Admin bypass for unlimited access
 *
 * @module lib/usage
 * @requires @prisma/client - Database ORM
 * @requires ./pricing - Tier configuration and overage calculations
 *
 * @example
 * // Check if user can generate designs
 * const status = await canGenerateDesigns(userId, 3);
 * if (!status.allowed) {
 *   console.log(status.reason);
 * }
 *
 * @example
 * // Record a design generation
 * const result = await recordDesignGeneration(userId, 3, runId);
 * console.log(`Overage charge: $${result.overageCharge}`);
 */

import {
  getTierConfig,
  calculateOverage,
  type TierName,
  type OverageCalculation,
} from './pricing';

// Conditional import - only load if packages are installed
let prisma: any;

try {
  prisma = require('./prisma').default;
} catch (e) {
  // Package not installed - provide stub
  prisma = null;
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

export interface UsageStatus {
  allowed: boolean;
  reason?: string;

  // Current usage
  designsUsed: number;
  allowance: number;
  remaining: number;

  // Overage info
  inOverage: boolean;
  overageCount: number;
  overageCharge: number;

  // Warnings
  warning?: {
    type: 'soft_cap' | 'hard_cap' | 'cooldown' | 'concurrent_limit';
    message: string;
  };
}

/**
 * Check if user can generate designs
 *
 * This is the MAIN rate limiting function - call before every generation.
 * It performs multiple checks in sequence:
 * 1. User existence and admin bypass
 * 2. Max designs per run limit
 * 3. Cooldown period (for free tier)
 * 4. Hard cap check
 * 5. Projected usage against hard cap
 *
 * Also auto-corrects any overage mismatches found in the database.
 *
 * @param userId - The database user ID (not Clerk ID)
 * @param requestedCount - Number of designs the user wants to generate
 * @returns UsageStatus object with allowed flag and usage details
 *
 * @example
 * const status = await canGenerateDesigns(user.id, 3);
 * if (!status.allowed) {
 *   return { error: status.reason, status: 403 };
 * }
 * if (status.warning) {
 *   // Show warning to user about approaching limits
 * }
 */
export async function canGenerateDesigns(
  userId: string,
  requestedCount: number
): Promise<UsageStatus> {
  // Get user and their tier config
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      usage: {
        where: {
          billingPeriodEnd: { gte: new Date() },
        },
        orderBy: { billingPeriodStart: 'desc' },
        take: 1,
      },
    },
  });

  if (!user) {
    return {
      allowed: false,
      reason: 'User not found',
      designsUsed: 0,
      allowance: 0,
      remaining: 0,
      inOverage: false,
      overageCount: 0,
      overageCharge: 0,
    };
  }

  // ADMIN BYPASS: Admins have unlimited generation capabilities
  if (user.isAdmin) {
    return {
      allowed: true,
      designsUsed: 0,
      allowance: 999999, // Effectively unlimited
      remaining: 999999,
      inOverage: false,
      overageCount: 0,
      overageCharge: 0,
    };
  }

  const tier = getTierConfig(user.subscriptionTier as TierName);
  let currentUsage = user.usage[0];

  // Initialize usage tracking for new billing period if needed
  if (!currentUsage) {
    await initializeBillingPeriod(userId, user.subscriptionTier as TierName);
    return canGenerateDesigns(userId, requestedCount); // Retry with initialized usage
  }

  // AUTO-FIX: Detect and correct overage mismatch from previous bug
  const correctOverage = Math.max(0, currentUsage.designsUsedInPeriod - tier.limits.designs);
  if (currentUsage.overageDesigns !== correctOverage) {
    console.warn(`⚠️  Overage mismatch detected for user ${userId}:`, {
      stored: currentUsage.overageDesigns,
      correct: correctOverage,
      designsUsed: currentUsage.designsUsedInPeriod,
      allowance: tier.limits.designs,
    });

    // Recalculate with correct values
    const correctOverageCalc = calculateOverage(
      user.subscriptionTier as TierName,
      currentUsage.designsUsedInPeriod
    );

    // Fix the database record
    const fixed = await prisma.usageTracking.update({
      where: { id: currentUsage.id },
      data: {
        overageDesigns: correctOverageCalc.overage,
        overageCharge: correctOverageCalc.overageCharge,
        softCapReached: correctOverageCalc.approachingSoftCap,
        hardCapReached: correctOverageCalc.atHardCap,
      },
    });

    console.log('✅ Overage mismatch auto-fixed:', {
      before: currentUsage.overageDesigns,
      after: fixed.overageDesigns,
    });

    // Use the fixed record for the rest of the checks
    currentUsage = fixed;
  }

  // Check 1: Max designs per run
  if (requestedCount > tier.limits.maxPerRun) {
    return {
      allowed: false,
      reason: `Your ${tier.name} plan allows maximum ${tier.limits.maxPerRun} designs per run. You requested ${requestedCount}.`,
      designsUsed: currentUsage.designsUsedInPeriod,
      allowance: tier.limits.designs,
      remaining: Math.max(0, tier.limits.designs - currentUsage.designsUsedInPeriod),
      inOverage: currentUsage.designsUsedInPeriod > tier.limits.designs,
      overageCount: currentUsage.overageDesigns,
      overageCharge: parseFloat(currentUsage.overageCharge.toString()),
    };
  }

  // Check 2: Cooldown period (for free tier)
  if (tier.limits.cooldown) {
    const cooldownHours = parseCooldown(tier.limits.cooldown);
    const hoursSinceLastGen = (Date.now() - currentUsage.lastGenerationAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastGen < cooldownHours) {
      const remainingHours = Math.ceil(cooldownHours - hoursSinceLastGen);
      return {
        allowed: false,
        reason: `Free tier has a ${tier.limits.cooldown} cooldown. Please wait ${remainingHours} more hour(s).`,
        designsUsed: currentUsage.designsUsedInPeriod,
        allowance: tier.limits.designs,
        remaining: Math.max(0, tier.limits.designs - currentUsage.designsUsedInPeriod),
        inOverage: currentUsage.designsUsedInPeriod > tier.limits.designs,
        overageCount: currentUsage.overageDesigns,
        overageCharge: parseFloat(currentUsage.overageCharge.toString()),
        warning: {
          type: 'cooldown',
          message: `Wait ${remainingHours}h before next generation`,
        },
      };
    }
  }

  // Check 3: Hard cap reached
  if (currentUsage.hardCapReached) {
    return {
      allowed: false,
      reason: `You've reached the maximum overage limit for your ${tier.name} plan. Please upgrade or wait for next billing period.`,
      designsUsed: currentUsage.designsUsedInPeriod,
      allowance: tier.limits.designs,
      remaining: 0,
      inOverage: true,
      overageCount: currentUsage.overageDesigns,
      overageCharge: parseFloat(currentUsage.overageCharge.toString()),
      warning: {
        type: 'hard_cap',
        message: 'Hard limit reached - upgrade required',
      },
    };
  }

  // Check 4: Calculate projected usage
  const projectedUsage = currentUsage.designsUsedInPeriod + requestedCount;
  const projectedOverage = Math.max(0, projectedUsage - tier.limits.designs);

  // Check 4a: Overage not enabled for this tier (e.g., Free tier)
  // If user would go into overage and overage is disabled, block immediately
  if (!tier.overage.enabled && projectedOverage > 0) {
    return {
      allowed: false,
      reason: `You've reached your ${tier.limits.designs} design limit for the ${tier.name} plan. Upgrade to continue creating designs.`,
      designsUsed: currentUsage.designsUsedInPeriod,
      allowance: tier.limits.designs,
      remaining: 0,
      inOverage: false,
      overageCount: 0,
      overageCharge: 0,
      warning: {
        type: 'hard_cap',
        message: 'Upgrade required to create more designs',
      },
    };
  }

  // Check 4b: Would this request exceed hard cap? (for paid tiers)
  if (tier.overage.hardCap && projectedOverage > tier.overage.hardCap) {
    return {
      allowed: false,
      reason: `This would exceed your hard cap of ${tier.overage.hardCap} overage designs. You can generate ${tier.overage.hardCap - currentUsage.overageDesigns} more designs this period.`,
      designsUsed: currentUsage.designsUsedInPeriod,
      allowance: tier.limits.designs,
      remaining: Math.max(0, (tier.limits.designs + tier.overage.hardCap) - currentUsage.designsUsedInPeriod),
      inOverage: true,
      overageCount: currentUsage.overageDesigns,
      overageCharge: parseFloat(currentUsage.overageCharge.toString()),
      warning: {
        type: 'hard_cap',
        message: `Approaching hard limit: ${currentUsage.overageDesigns}/${tier.overage.hardCap} overages used`,
      },
    };
  }

  // Calculate current and projected overage
  const currentOverageCalc = calculateOverage(
    user.subscriptionTier as TierName,
    currentUsage.designsUsedInPeriod
  );

  const projectedOverageCalc = calculateOverage(
    user.subscriptionTier as TierName,
    projectedUsage
  );

  const additionalCharge = projectedOverageCalc.overageCharge - currentOverageCalc.overageCharge;

  // All checks passed - user can generate
  const status: UsageStatus = {
    allowed: true,
    designsUsed: currentUsage.designsUsedInPeriod,
    allowance: tier.limits.designs,
    remaining: Math.max(0, tier.limits.designs - currentUsage.designsUsedInPeriod),
    inOverage: projectedUsage > tier.limits.designs,
    overageCount: projectedOverage,
    overageCharge: projectedOverageCalc.overageCharge,
  };

  // Add warnings
  if (projectedOverageCalc.approachingSoftCap && !currentUsage.softCapReached) {
    status.warning = {
      type: 'soft_cap',
      message: `You're approaching your soft limit. Additional designs will cost $${tier.overage.pricePerDesign.toFixed(2)} each.`,
    };
  }

  if (additionalCharge > 0) {
    status.warning = {
      type: 'soft_cap',
      message: `This will incur an additional charge of $${additionalCharge.toFixed(2)} (${projectedOverage} × $${tier.overage.pricePerDesign.toFixed(2)}).`,
    };
  }

  return status;
}

/**
 * Record a design generation for billing purposes
 *
 * Call this AFTER a successful design generation to:
 * - Increment the user's usage counter for the current billing period
 * - Calculate and store overage charges if applicable
 * - Update soft/hard cap flags
 *
 * This function is idempotent when called with the same runId - it will
 * not double-count if the same generation is recorded twice.
 *
 * Admin users are bypassed and no usage is recorded.
 *
 * @param userId - The database user ID (not Clerk ID)
 * @param designCount - Number of designs generated in this run
 * @param runId - Unique identifier for this generation run (for idempotency)
 * @returns OverageCalculation with updated usage and charge information
 * @throws Error if user is not found
 *
 * @example
 * const runId = crypto.randomUUID();
 * const result = await recordDesignGeneration(user.id, 3, runId);
 * if (result.overage > 0) {
 *   console.log(`Charged $${result.overageCharge} for ${result.overage} overage designs`);
 * }
 */
export async function recordDesignGeneration(
  userId: string,
  designCount: number,
  runId: string
): Promise<OverageCalculation> {
  console.log('[recordDesignGeneration] Starting for userId:', userId, 'count:', designCount);

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    console.error('[recordDesignGeneration] User not found:', userId);
    throw new Error('User not found');
  }

  console.log('[recordDesignGeneration] Found user:', user.email, 'tier:', user.subscriptionTier);

  // ADMIN BYPASS: Don't record usage or charge admins
  if (user.isAdmin) {
    console.log('[recordDesignGeneration] Admin bypass');
    return {
      allowance: 999999,
      used: 0,
      overage: 0,
      overageCharge: 0,
      withinAllowance: true,
      approachingSoftCap: false,
      atHardCap: false,
    };
  }

  const tier = getTierConfig(user.subscriptionTier as TierName);
  console.log('[recordDesignGeneration] Tier config:', tier.name, 'allowance:', tier.limits.designs);

  // Get or create current usage record
  const now = new Date();
  const periodStart = getStartOfBillingPeriod(user.subscribedAt || user.createdAt);
  const periodEnd = getEndOfBillingPeriod(periodStart);

  console.log('[recordDesignGeneration] Billing period:', periodStart, 'to', periodEnd);

  const usage = await prisma.usageTracking.upsert({
    where: {
      userId_billingPeriodStart: {
        userId,
        billingPeriodStart: periodStart,
      },
    },
    create: {
      userId,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      designsUsedInPeriod: designCount,
      designsAllowance: tier.limits.designs,
      overageDesigns: Math.max(0, designCount - tier.limits.designs),
      overageCharge: Math.max(0, designCount - tier.limits.designs) * tier.overage.pricePerDesign,
      lastGenerationAt: now,
    },
    update: {
      designsUsedInPeriod: { increment: designCount },
      lastGenerationAt: now,
    },
  });

  console.log('[recordDesignGeneration] Usage record updated, old value:', usage.designsUsedInPeriod);

  // Recalculate overage after increment
  // NOTE: usage.designsUsedInPeriod already contains the incremented value from the upsert
  const newTotalUsed = usage.designsUsedInPeriod;
  console.log('[recordDesignGeneration] New total used:', newTotalUsed);

  const overageCalc = calculateOverage(user.subscriptionTier as TierName, newTotalUsed);
  console.log('[recordDesignGeneration] Overage calc:', overageCalc);

  // Update overage fields
  await prisma.usageTracking.update({
    where: { id: usage.id },
    data: {
      overageDesigns: overageCalc.overage,
      overageCharge: overageCalc.overageCharge,
      softCapReached: overageCalc.approachingSoftCap,
      hardCapReached: overageCalc.atHardCap,
    },
  });

  console.log('[recordDesignGeneration] Complete');
  return overageCalc;
}

/**
 * Initialize billing period for a user
 */
export async function initializeBillingPeriod(userId: string, tierName: TierName) {
  const tier = getTierConfig(tierName);
  const now = new Date();
  const periodStart = getStartOfBillingPeriod(now);
  const periodEnd = getEndOfBillingPeriod(periodStart);

  await prisma.usageTracking.create({
    data: {
      userId,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      designsUsedInPeriod: 0,
      designsAllowance: tier.limits.designs,
      overageDesigns: 0,
      overageCharge: 0,
      lastGenerationAt: now,
    },
  });
}

/**
 * Get current usage summary for a user (for display in UI)
 */
export async function getUserUsageSummary(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      usage: {
        where: {
          billingPeriodEnd: { gte: new Date() },
        },
        orderBy: { billingPeriodStart: 'desc' },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // ADMIN BYPASS: Show unlimited usage for admins
  if (user.isAdmin) {
    return {
      tier: 'Admin (Unlimited)',
      allowance: 999999,
      used: 0,
      remaining: 999999,
      overage: 0,
      overageCharge: 0,
      periodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    };
  }

  const tier = getTierConfig(user.subscriptionTier as TierName);
  const currentUsage = user.usage[0];

  if (!currentUsage) {
    return {
      tier: tier.name,
      allowance: tier.limits.designs,
      used: 0,
      remaining: tier.limits.designs,
      overage: 0,
      overageCharge: 0,
      periodEnd: getEndOfBillingPeriod(new Date()),
    };
  }

  // IMPORTANT: Use tier's CURRENT allowance, not the stored value
  // This ensures correct remaining count if user upgraded mid-period
  const allowance = tier.limits.designs;
  const used = currentUsage.designsUsedInPeriod;

  return {
    tier: tier.name,
    allowance: allowance,
    used: used,
    remaining: Math.max(0, allowance - used),
    overage: currentUsage.overageDesigns,
    overageCharge: parseFloat(currentUsage.overageCharge.toString()),
    periodEnd: currentUsage.billingPeriodEnd,
  };
}

// ============================================================================
// BILLING HELPERS
// ============================================================================

/**
 * Get start of current billing period (anchored to subscription date)
 */
function getStartOfBillingPeriod(anchorDate: Date): Date {
  const now = new Date();
  const anchor = new Date(anchorDate);

  // Get the day of month from anchor
  const anchorDay = anchor.getDate();

  // Start with current month
  let start = new Date(now.getFullYear(), now.getMonth(), anchorDay);

  // If we haven't reached the anchor day yet, use previous month
  if (start > now) {
    start = new Date(now.getFullYear(), now.getMonth() - 1, anchorDay);
  }

  return start;
}

/**
 * Get end of billing period (1 month from start)
 */
function getEndOfBillingPeriod(periodStart: Date): Date {
  const end = new Date(periodStart);
  end.setMonth(end.getMonth() + 1);
  return end;
}

/**
 * Parse cooldown string to hours
 */
function parseCooldown(cooldown: string): number {
  const match = cooldown.match(/^(\d+)([hdm])$/);
  if (!match) return 0;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'h':
      return value;
    case 'd':
      return value * 24;
    case 'm':
      return value / 60;
    default:
      return 0;
  }
}

/**
 * Create billing record at end of period
 */
export async function createBillingRecord(userId: string, periodStart: Date) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const tier = getTierConfig(user.subscriptionTier as TierName);
  const periodEnd = getEndOfBillingPeriod(periodStart);

  const usage = await prisma.usageTracking.findUnique({
    where: {
      userId_billingPeriodStart: {
        userId,
        billingPeriodStart: periodStart,
      },
    },
  });

  if (!usage) {
    throw new Error('Usage record not found');
  }

  const subscriptionFee = tier.price;
  const overageFee = parseFloat(usage.overageCharge.toString());
  const totalAmount = subscriptionFee + overageFee;

  return prisma.billingRecord.create({
    data: {
      userId,
      periodStart,
      periodEnd,
      subscriptionFee,
      overageFee,
      totalAmount,
      designsIncluded: usage.designsAllowance,
      designsUsed: usage.designsUsedInPeriod,
      overageDesigns: usage.overageDesigns,
      overageRate: tier.overage.pricePerDesign,
      tier: user.subscriptionTier,
      pricingVersion: user.pricingVersion,
      paymentStatus: 'pending',
    },
  });
}

// ============================================================================
// ALIASES FOR BACKWARD COMPATIBILITY
// ============================================================================

/**
 * Alias for getUserUsageSummary (for backward compatibility)
 * @deprecated Use getUserUsageSummary instead
 */
export const getCurrentUsage = getUserUsageSummary;
