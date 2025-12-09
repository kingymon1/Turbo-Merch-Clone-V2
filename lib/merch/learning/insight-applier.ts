/**
 * Insight Application Module
 *
 * Provides functions for applying ProvenInsights during design generation.
 * This is the bridge between the learning system and the autopilot generator.
 *
 * INTEGRATION PHILOSOPHY:
 * - LOW RISK (0-30): Heavily favor proven insights, use validated patterns
 * - MEDIUM RISK (30-70): Blend insights with emerging trends
 * - HIGH RISK (70-100): Use insights for anti-patterns (what NOT to do)
 */

import { prisma } from '@/lib/prisma';
import { DesignConcept } from '../image-prompter';

// Types
interface InsightApplication {
  insightId: string;
  insightType: string;
  title: string;
  appliedAs: 'constraint' | 'suggestion' | 'anti-pattern' | 'validation';
  confidence: number;
}

interface GenerationContext {
  niche?: string;
  riskLevel: number;
  phrase?: string;
  style?: string;
  month?: number;
}

interface AppliedInsights {
  phrasePatterns: any[];
  styleRecommendations: any[];
  timingInsights: any[];
  listingPatterns: any[];
  crossNicheOpportunities: any[];
  antiPatterns: any[];
}

/**
 * Get relevant insights for a given generation context
 */
export async function getRelevantInsights(
  context: GenerationContext
): Promise<AppliedInsights> {
  const { niche, riskLevel, month } = context;

  // Determine which insight categories to prioritize based on risk level
  const minConfidence = riskLevel < 30 ? 0.85 : riskLevel < 70 ? 0.75 : 0.6;

  const baseQuery = {
    stillRelevant: true,
    confidence: { gte: minConfidence },
  };

  // Fetch all relevant insights in parallel
  const [
    phrasePatterns,
    styleInsights,
    timingInsights,
    listingInsights,
    crossNicheInsights,
  ] = await Promise.all([
    // Phrase patterns - always useful
    prisma.provenInsight.findMany({
      where: {
        ...baseQuery,
        insightType: 'phrase-pattern',
        OR: niche ? [
          { niches: { has: niche } },
          { niche: null }, // General patterns apply everywhere
        ] : [{ niche: null }],
      },
      orderBy: { confidence: 'desc' },
      take: 10,
    }),

    // Style effectiveness
    prisma.provenInsight.findMany({
      where: {
        ...baseQuery,
        insightType: 'style-effectiveness',
      },
      orderBy: { successRate: 'desc' },
      take: 5,
    }),

    // Timing insights (if month provided)
    month !== undefined
      ? prisma.provenInsight.findMany({
          where: {
            ...baseQuery,
            insightType: 'niche-timing',
            ...(niche && { niche }),
          },
          take: 5,
        })
      : Promise.resolve([]),

    // Listing structure patterns
    prisma.provenInsight.findMany({
      where: {
        ...baseQuery,
        insightType: 'listing-structure',
      },
      orderBy: { successRate: 'desc' },
      take: 5,
    }),

    // Cross-niche opportunities
    niche
      ? prisma.provenInsight.findMany({
          where: {
            ...baseQuery,
            insightType: 'cross-niche',
            niches: { has: niche },
          },
          take: 3,
        })
      : Promise.resolve([]),
  ]);

  // For high-risk generation, also fetch failed patterns as anti-patterns
  let antiPatterns: any[] = [];
  if (riskLevel >= 70) {
    antiPatterns = await prisma.provenInsight.findMany({
      where: {
        stillRelevant: false,
        confidence: { lt: 0.5 },
      },
      take: 5,
    });
  }

  return {
    phrasePatterns,
    styleRecommendations: styleInsights,
    timingInsights,
    listingPatterns: listingInsights,
    crossNicheOpportunities: crossNicheInsights,
    antiPatterns,
  };
}

/**
 * Apply insights to influence generation decisions
 * Returns guidance for the generator based on available insights
 */
export async function applyInsightsToGeneration(
  context: GenerationContext
): Promise<{
  recommendedStyles: string[];
  recommendedTones: string[];
  phraseTemplates: string[];
  listingGuidance: string[];
  crossNicheIdeas: string[];
  warnings: string[];
  appliedInsights: InsightApplication[];
}> {
  const insights = await getRelevantInsights(context);
  const appliedInsights: InsightApplication[] = [];

  const recommendedStyles: string[] = [];
  const recommendedTones: string[] = [];
  const phraseTemplates: string[] = [];
  const listingGuidance: string[] = [];
  const crossNicheIdeas: string[] = [];
  const warnings: string[] = [];

  // Process style recommendations
  for (const insight of insights.styleRecommendations) {
    const pattern = insight.pattern as any;
    if (pattern?.style) {
      recommendedStyles.push(pattern.style);
      appliedInsights.push({
        insightId: insight.id,
        insightType: insight.insightType,
        title: insight.title,
        appliedAs: context.riskLevel < 50 ? 'constraint' : 'suggestion',
        confidence: insight.confidence,
      });
    }
  }

  // Process phrase patterns
  for (const insight of insights.phrasePatterns) {
    const pattern = insight.pattern as any;
    if (pattern?.template) {
      phraseTemplates.push(pattern.template);
      appliedInsights.push({
        insightId: insight.id,
        insightType: insight.insightType,
        title: insight.title,
        appliedAs: context.riskLevel < 30 ? 'constraint' : 'suggestion',
        confidence: insight.confidence,
      });
    }
  }

  // Process listing patterns
  for (const insight of insights.listingPatterns) {
    const pattern = insight.pattern as any;
    listingGuidance.push(insight.description);
    appliedInsights.push({
      insightId: insight.id,
      insightType: insight.insightType,
      title: insight.title,
      appliedAs: 'suggestion',
      confidence: insight.confidence,
    });
  }

  // Process timing insights
  for (const insight of insights.timingInsights) {
    const pattern = insight.pattern as any;
    const currentMonth = context.month ?? new Date().getMonth();

    if (pattern?.peakMonths?.includes(currentMonth)) {
      // We're in peak season for this niche!
      listingGuidance.push(`Peak season for ${context.niche} - prioritize this niche`);
    }

    appliedInsights.push({
      insightId: insight.id,
      insightType: insight.insightType,
      title: insight.title,
      appliedAs: 'validation',
      confidence: insight.confidence,
    });
  }

  // Process cross-niche opportunities
  for (const insight of insights.crossNicheOpportunities) {
    const pattern = insight.pattern as any;
    if (pattern?.crossoverIdeas) {
      crossNicheIdeas.push(...pattern.crossoverIdeas);
    }
    appliedInsights.push({
      insightId: insight.id,
      insightType: insight.insightType,
      title: insight.title,
      appliedAs: 'suggestion',
      confidence: insight.confidence,
    });
  }

  // Process anti-patterns (for high-risk generation)
  for (const antiPattern of insights.antiPatterns) {
    warnings.push(`Avoid: ${antiPattern.title} (failed pattern)`);
    appliedInsights.push({
      insightId: antiPattern.id,
      insightType: antiPattern.insightType,
      title: antiPattern.title,
      appliedAs: 'anti-pattern',
      confidence: antiPattern.confidence,
    });
  }

  // Add default recommendations if none found
  if (recommendedStyles.length === 0) {
    recommendedStyles.push('Bold Modern', 'Minimalist');
  }

  if (phraseTemplates.length === 0 && context.riskLevel < 50) {
    phraseTemplates.push("{topic} Life", "{topic} Mode", "Powered by {noun}");
  }

  return {
    recommendedStyles,
    recommendedTones,
    phraseTemplates,
    listingGuidance,
    crossNicheIdeas,
    warnings,
    appliedInsights,
  };
}

/**
 * Log which insights were used in a generation
 * This enables tracking insight effectiveness over time
 */
export async function logInsightUsage(
  designId: string,
  appliedInsights: InsightApplication[]
): Promise<void> {
  // Store insight usage in the design's sourceData
  // This allows us to later analyze which insights led to success

  if (appliedInsights.length === 0) return;

  try {
    const design = await prisma.merchDesign.findUnique({
      where: { id: designId },
      select: { sourceData: true },
    });

    const currentSourceData = (design?.sourceData as any) || {};

    await prisma.merchDesign.update({
      where: { id: designId },
      data: {
        sourceData: {
          ...currentSourceData,
          appliedInsights: appliedInsights.map(i => ({
            id: i.insightId,
            type: i.insightType,
            appliedAs: i.appliedAs,
            confidence: i.confidence,
          })),
          insightCount: appliedInsights.length,
          insightTimestamp: new Date().toISOString(),
        },
      },
    });

    console.log(`[InsightApplier] Logged ${appliedInsights.length} insights for design ${designId}`);
  } catch (error) {
    console.error('[InsightApplier] Error logging insight usage:', error);
  }
}

/**
 * Get the best phrase template for a niche based on insights
 */
export async function getBestPhraseTemplate(
  niche: string,
  riskLevel: number
): Promise<{ template: string; confidence: number } | null> {
  const insight = await prisma.provenInsight.findFirst({
    where: {
      insightType: 'phrase-pattern',
      stillRelevant: true,
      confidence: { gte: riskLevel < 50 ? 0.85 : 0.7 },
      OR: [
        { niches: { has: niche } },
        { niche: null },
      ],
    },
    orderBy: [
      { confidence: 'desc' },
      { successRate: 'desc' },
    ],
  });

  if (!insight) return null;

  const pattern = insight.pattern as any;
  return {
    template: pattern?.template || null,
    confidence: insight.confidence,
  };
}

/**
 * Get the recommended style for a niche
 */
export async function getRecommendedStyle(
  niche?: string
): Promise<{ style: string; approvalRate: number } | null> {
  const insight = await prisma.provenInsight.findFirst({
    where: {
      insightType: 'style-effectiveness',
      stillRelevant: true,
      confidence: { gte: 0.8 },
    },
    orderBy: { successRate: 'desc' },
  });

  if (!insight) return null;

  const pattern = insight.pattern as any;
  return {
    style: pattern?.style || 'Bold Modern',
    approvalRate: insight.successRate || 0,
  };
}

/**
 * Check if current month is peak season for a niche
 */
export async function isNichePeakSeason(
  niche: string,
  month?: number
): Promise<{ isPeak: boolean; multiplier: number } | null> {
  const currentMonth = month ?? new Date().getMonth();

  const insight = await prisma.provenInsight.findFirst({
    where: {
      insightType: 'niche-timing',
      niche,
      stillRelevant: true,
    },
  });

  if (!insight) return null;

  const pattern = insight.pattern as any;
  const peakMonths = pattern?.peakMonths || [];
  const isPeak = peakMonths.includes(currentMonth);
  const multiplier = isPeak ? (pattern?.multiplier || 1.5) : 1;

  return { isPeak, multiplier };
}
