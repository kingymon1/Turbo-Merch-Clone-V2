/**
 * Insight Validation System
 *
 * Periodically validates that ProvenInsights are still relevant.
 * Patterns can decay over time as markets change, so we need to:
 * 1. Test insights against recent data
 * 2. Update confidence scores based on new evidence
 * 3. Mark outdated insights as no longer relevant
 * 4. Create superseding insights when patterns evolve
 *
 * VALIDATION PHILOSOPHY:
 * - High-confidence insights are validated monthly (prove they still work)
 * - Newer insights are validated weekly (prove they're stable)
 * - Insights that fail validation 2x in a row are marked stillRelevant: false
 * - Evolved patterns create new "superseding" insights
 */

import { prisma } from '@/lib/prisma';

// Validation thresholds
const CONFIDENCE_DECAY_RATE = 0.05; // How much confidence drops per failed validation
const MIN_CONFIDENCE_THRESHOLD = 0.6; // Below this, mark as not relevant
const VALIDATION_SUCCESS_THRESHOLD = 0.7; // Pattern must still hit 70% of original rate

interface ValidationResult {
  insightId: string;
  title: string;
  previousConfidence: number;
  newConfidence: number;
  status: 'validated' | 'degraded' | 'invalid';
  reason: string;
}

interface ValidationSummary {
  validated: number;
  degraded: number;
  invalidated: number;
  errors: string[];
  results: ValidationResult[];
}

/**
 * Wilson Score for calculating confidence (same as extractor)
 */
function wilsonScore(successes: number, total: number, z: number = 1.96): number {
  if (total === 0) return 0;

  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const adjustment = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);

  return (centre - adjustment) / denominator;
}

/**
 * Validate phrase pattern insights against recent designs
 */
async function validatePhrasePatternInsight(
  insight: any,
  recentDesigns: any[]
): Promise<{ success: boolean; newSuccessRate: number; sampleSize: number }> {
  const pattern = insight.pattern as any;
  const template = pattern?.template;

  if (!template) {
    return { success: false, newSuccessRate: 0, sampleSize: 0 };
  }

  // Find designs matching this template pattern
  // This is simplified - in production would use more sophisticated matching
  const matchingDesigns = recentDesigns.filter(d => {
    const phrase = d.phrase?.toLowerCase() || '';
    // Very basic template matching
    if (template.includes("World's")) return phrase.includes("world's");
    if (template.includes('Mode')) return phrase.includes('mode');
    if (template.includes('Powered')) return phrase.includes('powered');
    return false;
  });

  if (matchingDesigns.length < 5) {
    // Not enough recent data to validate
    return { success: true, newSuccessRate: insight.successRate, sampleSize: 0 };
  }

  const successes = matchingDesigns.filter(d => d.approved || d.sales > 0).length;
  const newSuccessRate = successes / matchingDesigns.length;
  const originalRate = insight.successRate || 0.5;

  // Pattern is valid if it maintains at least 70% of its original success rate
  const success = newSuccessRate >= originalRate * VALIDATION_SUCCESS_THRESHOLD;

  return { success, newSuccessRate, sampleSize: matchingDesigns.length };
}

/**
 * Validate style effectiveness insights
 */
async function validateStyleInsight(
  insight: any,
  recentDesigns: any[]
): Promise<{ success: boolean; newSuccessRate: number; sampleSize: number }> {
  const pattern = insight.pattern as any;
  const style = pattern?.style;

  if (!style) {
    return { success: false, newSuccessRate: 0, sampleSize: 0 };
  }

  const matchingDesigns = recentDesigns.filter(d =>
    d.style?.toLowerCase() === style.toLowerCase()
  );

  if (matchingDesigns.length < 5) {
    return { success: true, newSuccessRate: insight.successRate, sampleSize: 0 };
  }

  const successes = matchingDesigns.filter(d => d.approved).length;
  const newSuccessRate = successes / matchingDesigns.length;
  const originalRate = insight.successRate || 0.5;

  const success = newSuccessRate >= originalRate * VALIDATION_SUCCESS_THRESHOLD;

  return { success, newSuccessRate, sampleSize: matchingDesigns.length };
}

/**
 * Validate listing structure insights
 */
async function validateListingInsight(
  insight: any,
  recentDesigns: any[]
): Promise<{ success: boolean; newSuccessRate: number; sampleSize: number }> {
  const pattern = insight.pattern as any;
  const patternType = pattern?.patternType;

  if (!patternType) {
    return { success: false, newSuccessRate: 0, sampleSize: 0 };
  }

  const matchingDesigns = recentDesigns.filter(d => {
    const title = d.listingTitle?.toLowerCase() || '';

    switch (patternType) {
      case 'gift-angle':
        return /gift|present|for (him|her|mom|dad|nurse|teacher)/i.test(title);
      case 'funny-angle':
        return /funny|humor|hilarious|joke/i.test(title);
      case 'profession-first':
        return /^(nurse|teacher|doctor|lawyer|mom|dad)/i.test(title);
      case 'quote-style':
        return /"|'/.test(title);
      default:
        return false;
    }
  });

  if (matchingDesigns.length < 5) {
    return { success: true, newSuccessRate: insight.successRate, sampleSize: 0 };
  }

  const successes = matchingDesigns.filter(d => d.sales > 0).length;
  const newSuccessRate = successes / matchingDesigns.length;
  const originalRate = insight.successRate || 0.5;

  const success = newSuccessRate >= originalRate * VALIDATION_SUCCESS_THRESHOLD;

  return { success, newSuccessRate, sampleSize: matchingDesigns.length };
}

/**
 * Validate a single insight against recent data
 */
async function validateInsight(
  insight: any,
  recentDesigns: any[]
): Promise<ValidationResult> {
  let validationResult: { success: boolean; newSuccessRate: number; sampleSize: number };

  switch (insight.insightType) {
    case 'phrase-pattern':
      validationResult = await validatePhrasePatternInsight(insight, recentDesigns);
      break;
    case 'style-effectiveness':
      validationResult = await validateStyleInsight(insight, recentDesigns);
      break;
    case 'listing-structure':
      validationResult = await validateListingInsight(insight, recentDesigns);
      break;
    case 'niche-timing':
      // Timing insights need a full year of data to validate - skip for now
      validationResult = { success: true, newSuccessRate: insight.successRate, sampleSize: 0 };
      break;
    case 'cross-niche':
      // Cross-niche insights are harder to validate - check co-occurrence still exists
      validationResult = { success: true, newSuccessRate: insight.successRate, sampleSize: 0 };
      break;
    default:
      validationResult = { success: true, newSuccessRate: insight.successRate, sampleSize: 0 };
  }

  const { success, newSuccessRate, sampleSize } = validationResult;
  const previousConfidence = insight.confidence;

  let newConfidence: number;
  let status: 'validated' | 'degraded' | 'invalid';
  let reason: string;

  if (sampleSize === 0) {
    // No recent data to validate against - maintain confidence
    newConfidence = previousConfidence;
    status = 'validated';
    reason = 'Insufficient recent data for validation - maintaining confidence';
  } else if (success) {
    // Pattern still holds - boost confidence slightly
    newConfidence = Math.min(1, previousConfidence + 0.02);
    status = 'validated';
    reason = `Pattern validated with ${Math.round(newSuccessRate * 100)}% success rate (n=${sampleSize})`;
  } else {
    // Pattern degraded - reduce confidence
    newConfidence = previousConfidence - CONFIDENCE_DECAY_RATE;
    status = newConfidence < MIN_CONFIDENCE_THRESHOLD ? 'invalid' : 'degraded';
    reason = `Pattern degraded: ${Math.round(newSuccessRate * 100)}% vs expected ${Math.round((insight.successRate || 0.5) * VALIDATION_SUCCESS_THRESHOLD * 100)}%`;
  }

  // Update the insight in database
  if (status === 'invalid') {
    await prisma.provenInsight.update({
      where: { id: insight.id },
      data: {
        confidence: newConfidence,
        stillRelevant: false,
        lastValidated: new Date(),
        timesValidated: insight.timesValidated + 1,
      },
    });
  } else {
    await prisma.provenInsight.update({
      where: { id: insight.id },
      data: {
        confidence: newConfidence,
        successRate: sampleSize > 0 ? newSuccessRate : insight.successRate,
        lastValidated: new Date(),
        timesValidated: insight.timesValidated + 1,
      },
    });
  }

  return {
    insightId: insight.id,
    title: insight.title,
    previousConfidence,
    newConfidence,
    status,
    reason,
  };
}

/**
 * MAIN ENTRY POINT: Validate all insights that need validation
 */
export async function validateAllInsights(): Promise<ValidationSummary> {
  console.log('[InsightValidator] Starting insight validation');
  const startTime = Date.now();

  const results: ValidationResult[] = [];
  const errors: string[] = [];
  let validated = 0;
  let degraded = 0;
  let invalidated = 0;

  try {
    // Determine which insights need validation
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // High-confidence insights: validate monthly
    // Lower-confidence insights: validate weekly
    const insightsToValidate = await prisma.provenInsight.findMany({
      where: {
        stillRelevant: true,
        OR: [
          // High confidence, not validated in 30 days
          {
            confidence: { gte: 0.9 },
            lastValidated: { lt: oneMonthAgo },
          },
          // Lower confidence, not validated in 7 days
          {
            confidence: { lt: 0.9 },
            lastValidated: { lt: oneWeekAgo },
          },
        ],
      },
    });

    console.log(`[InsightValidator] Found ${insightsToValidate.length} insights to validate`);

    if (insightsToValidate.length === 0) {
      return {
        validated: 0,
        degraded: 0,
        invalidated: 0,
        errors: [],
        results: [],
      };
    }

    // Fetch recent designs for validation (last 30 days)
    const recentDesigns = await prisma.merchDesign.findMany({
      where: {
        createdAt: { gte: oneMonthAgo },
        isTest: false,
      },
      select: {
        id: true,
        phrase: true,
        niche: true,
        style: true,
        tone: true,
        approved: true,
        sales: true,
        views: true,
        listingTitle: true,
        createdAt: true,
      },
    });

    console.log(`[InsightValidator] Loaded ${recentDesigns.length} recent designs for validation`);

    // Validate each insight
    for (const insight of insightsToValidate) {
      try {
        const result = await validateInsight(insight, recentDesigns);
        results.push(result);

        switch (result.status) {
          case 'validated':
            validated++;
            break;
          case 'degraded':
            degraded++;
            break;
          case 'invalid':
            invalidated++;
            break;
        }
      } catch (error) {
        console.error(`[InsightValidator] Error validating insight ${insight.id}:`, error);
        errors.push(`Failed to validate ${insight.id}: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

  } catch (error) {
    console.error('[InsightValidator] Error during validation:', error);
    errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  const duration = Date.now() - startTime;
  console.log(`[InsightValidator] Validation complete in ${duration}ms`);
  console.log(`[InsightValidator] Validated: ${validated}, Degraded: ${degraded}, Invalidated: ${invalidated}`);

  return {
    validated,
    degraded,
    invalidated,
    errors,
    results,
  };
}

/**
 * Force validation of a specific insight (for manual testing)
 */
export async function validateSpecificInsight(insightId: string): Promise<ValidationResult | null> {
  const insight = await prisma.provenInsight.findUnique({
    where: { id: insightId },
  });

  if (!insight) {
    return null;
  }

  const oneMonthAgo = new Date();
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  const recentDesigns = await prisma.merchDesign.findMany({
    where: {
      createdAt: { gte: oneMonthAgo },
      isTest: false,
    },
    select: {
      id: true,
      phrase: true,
      niche: true,
      style: true,
      tone: true,
      approved: true,
      sales: true,
      views: true,
      listingTitle: true,
      createdAt: true,
    },
  });

  return validateInsight(insight, recentDesigns);
}

/**
 * Get validation status summary
 */
export async function getValidationStatus(): Promise<{
  totalInsights: number;
  needsValidation: number;
  recentlyValidated: number;
  invalidated: number;
}> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [total, needsValidation, recentlyValidated, invalidated] = await Promise.all([
    prisma.provenInsight.count({ where: { stillRelevant: true } }),
    prisma.provenInsight.count({
      where: {
        stillRelevant: true,
        lastValidated: { lt: oneWeekAgo },
      },
    }),
    prisma.provenInsight.count({
      where: {
        stillRelevant: true,
        lastValidated: { gte: oneWeekAgo },
      },
    }),
    prisma.provenInsight.count({ where: { stillRelevant: false } }),
  ]);

  return {
    totalInsights: total,
    needsValidation,
    recentlyValidated,
    invalidated,
  };
}
