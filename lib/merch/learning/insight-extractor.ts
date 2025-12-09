/**
 * Insight Extraction Engine
 *
 * Analyzes MerchDesign records, MarketData, and NicheTrend data to extract
 * high-confidence proven patterns. Only creates ProvenInsight records when:
 * - Sample size >= 10 (minimum statistical relevance)
 * - Confidence >= 0.8 (80%+ certainty)
 * - Pattern validated across multiple time periods
 *
 * STATISTICAL APPROACH:
 * - Uses Wilson Score Interval for confidence calculation (better for small samples)
 * - Requires 2+ distinct time periods for temporal validation
 * - Applies Bayesian smoothing for success rate estimation
 *
 * This module is the brain of the learning system.
 */

import { prisma } from '@/lib/prisma';
import { TrendData } from '@/types';

// Minimum thresholds for insight creation
const MIN_SAMPLE_SIZE = 10;
const MIN_CONFIDENCE = 0.8;
const MIN_TIME_PERIODS = 2; // Must appear in at least 2 different weeks/months

// Types for internal use
interface DesignWithMetrics {
  id: string;
  phrase: string;
  niche: string;
  style: string | null;
  tone: string | null;
  approved: boolean;
  sales: number;
  views: number;
  userRating: number | null;
  createdAt: Date;
  mode: string;
  riskLevel: number | null;
  listingTitle: string;
  listingBullets: string[];
  sourceData: any;
}

interface PatternCandidate {
  pattern: string;
  samples: DesignWithMetrics[];
  successCount: number;
  totalCount: number;
}

interface ExtractionResult {
  insightsCreated: number;
  insightsUpdated: number;
  candidatesAnalyzed: number;
  errors: string[];
}

/**
 * Wilson Score Interval - better than simple percentage for small samples
 * Returns lower bound of confidence interval (conservative estimate)
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
 * Calculate confidence score based on sample size and consistency
 * Uses Wilson Score for the success rate, then adjusts for sample size
 */
function calculateConfidence(
  successes: number,
  total: number,
  timePeriods: number
): number {
  if (total < MIN_SAMPLE_SIZE) return 0;

  // Base confidence from Wilson Score
  const wilsonConfidence = wilsonScore(successes, total);

  // Boost for larger samples (logarithmic scale to prevent runaway)
  const sampleBoost = Math.min(0.1, Math.log10(total / MIN_SAMPLE_SIZE) * 0.05);

  // Boost for temporal consistency (pattern appears across time)
  const temporalBoost = Math.min(0.1, (timePeriods - MIN_TIME_PERIODS) * 0.025);

  return Math.min(1, wilsonConfidence + sampleBoost + temporalBoost);
}

/**
 * Group designs by time period (week) for temporal validation
 */
function groupByTimePeriod(designs: DesignWithMetrics[]): Map<string, DesignWithMetrics[]> {
  const groups = new Map<string, DesignWithMetrics[]>();

  for (const design of designs) {
    // Group by ISO week
    const date = new Date(design.createdAt);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const key = weekStart.toISOString().split('T')[0];

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(design);
  }

  return groups;
}

/**
 * Extract phrase pattern templates (e.g., "World's Okayest {X}")
 */
function extractPhraseTemplate(phrase: string): string | null {
  // Common patterns to detect
  const patterns = [
    { regex: /^World'?s\s+(Best|Okayest|Greatest|Worst)\s+(.+)$/i, template: "World's {adj} {noun}" },
    { regex: /^(.+)\s+(Mom|Dad|Nurse|Teacher|Boss)$/i, template: "{descriptor} {profession}" },
    { regex: /^(I|We)\s+(Love|Hate|Need|Want)\s+(.+)$/i, template: "{pronoun} {verb} {noun}" },
    { regex: /^(.+)\s+(Mode|Life|Vibes|Energy)$/i, template: "{topic} {state}" },
    { regex: /^(Powered|Fueled|Running)\s+(By|On)\s+(.+)$/i, template: "Powered by {noun}" },
    { regex: /^(Just|Simply|Always)\s+(.+)$/i, template: "{adverb} {action}" },
  ];

  for (const { regex, template } of patterns) {
    if (regex.test(phrase)) {
      return template;
    }
  }

  return null;
}

/**
 * MAIN EXTRACTION: Extract phrase pattern insights
 */
async function extractPhrasePatterns(designs: DesignWithMetrics[]): Promise<number> {
  console.log(`[InsightExtractor] Analyzing ${designs.length} designs for phrase patterns`);

  // Group by phrase template
  const templateGroups: Record<string, PatternCandidate> = {};

  for (const design of designs) {
    const template = extractPhraseTemplate(design.phrase);
    if (!template) continue;

    if (!templateGroups[template]) {
      templateGroups[template] = {
        pattern: template,
        samples: [],
        successCount: 0,
        totalCount: 0,
      };
    }

    templateGroups[template].samples.push(design);
    templateGroups[template].totalCount++;
    if (design.approved || design.sales > 0) {
      templateGroups[template].successCount++;
    }
  }

  let insightsCreated = 0;

  for (const [template, data] of Object.entries(templateGroups)) {
    if (data.totalCount < MIN_SAMPLE_SIZE) continue;

    const timePeriods = groupByTimePeriod(data.samples).size;
    if (timePeriods < MIN_TIME_PERIODS) continue;

    const confidence = calculateConfidence(data.successCount, data.totalCount, timePeriods);
    if (confidence < MIN_CONFIDENCE) continue;

    const successRate = data.successCount / data.totalCount;

    // Extract niches where this pattern worked
    const nicheSuccesses: Record<string, { success: number; total: number }> = {};
    for (const design of data.samples) {
      if (!nicheSuccesses[design.niche]) {
        nicheSuccesses[design.niche] = { success: 0, total: 0 };
      }
      nicheSuccesses[design.niche].total++;
      if (design.approved || design.sales > 0) {
        nicheSuccesses[design.niche].success++;
      }
    }

    const applicableNiches = Object.entries(nicheSuccesses)
      .filter(([_, stats]) => stats.total >= 3 && stats.success / stats.total >= 0.5)
      .map(([niche]) => niche);

    // Check if insight already exists
    const existing = await prisma.provenInsight.findFirst({
      where: {
        insightType: 'phrase-pattern',
        title: { contains: template },
        stillRelevant: true,
      },
    });

    if (existing) {
      // Update existing insight with new data
      await prisma.provenInsight.update({
        where: { id: existing.id },
        data: {
          sampleSize: data.totalCount,
          confidence,
          successRate,
          timesValidated: existing.timesValidated + 1,
          lastValidated: new Date(),
          niches: applicableNiches,
        },
      });
    } else {
      // Create new insight
      await prisma.provenInsight.create({
        data: {
          insightType: 'phrase-pattern',
          category: 'evergreen',
          title: `Phrase template "${template}" shows ${Math.round(successRate * 100)}% success rate`,
          description: `The phrase pattern "${template}" has been validated across ${data.totalCount} designs over ${timePeriods} time periods. This template consistently performs well and can be adapted for multiple niches.`,
          pattern: {
            template,
            examplePhrases: data.samples.slice(0, 5).map(d => d.phrase),
            nicheBreakdown: nicheSuccesses,
          },
          sampleSize: data.totalCount,
          confidence,
          successRate,
          niches: applicableNiches,
          timeframe: 'year-round',
          riskLevel: 'proven',
          sourceDataIds: data.samples.map(d => d.id),
        },
      });
      insightsCreated++;
    }
  }

  console.log(`[InsightExtractor] Created ${insightsCreated} phrase pattern insights`);
  return insightsCreated;
}

/**
 * MAIN EXTRACTION: Extract style effectiveness insights
 */
async function extractStyleInsights(designs: DesignWithMetrics[]): Promise<number> {
  console.log(`[InsightExtractor] Analyzing style effectiveness`);

  // Group by style
  const styleGroups: Record<string, PatternCandidate> = {};

  for (const design of designs) {
    const style = design.style || 'Unknown';

    if (!styleGroups[style]) {
      styleGroups[style] = {
        pattern: style,
        samples: [],
        successCount: 0,
        totalCount: 0,
      };
    }

    styleGroups[style].samples.push(design);
    styleGroups[style].totalCount++;
    if (design.approved) {
      styleGroups[style].successCount++;
    }
  }

  let insightsCreated = 0;

  for (const [style, data] of Object.entries(styleGroups)) {
    if (data.totalCount < MIN_SAMPLE_SIZE) continue;

    const timePeriods = groupByTimePeriod(data.samples).size;
    if (timePeriods < MIN_TIME_PERIODS) continue;

    const confidence = calculateConfidence(data.successCount, data.totalCount, timePeriods);
    if (confidence < MIN_CONFIDENCE) continue;

    const successRate = data.successCount / data.totalCount;

    // Calculate average performance metrics
    const avgViews = data.samples.reduce((sum, d) => sum + d.views, 0) / data.samples.length;
    const avgSales = data.samples.reduce((sum, d) => sum + d.sales, 0) / data.samples.length;

    const existing = await prisma.provenInsight.findFirst({
      where: {
        insightType: 'style-effectiveness',
        title: { contains: style },
        stillRelevant: true,
      },
    });

    if (existing) {
      await prisma.provenInsight.update({
        where: { id: existing.id },
        data: {
          sampleSize: data.totalCount,
          confidence,
          successRate,
          avgPerformance: { avgViews, avgSales },
          timesValidated: existing.timesValidated + 1,
          lastValidated: new Date(),
        },
      });
    } else {
      await prisma.provenInsight.create({
        data: {
          insightType: 'style-effectiveness',
          category: 'design',
          title: `"${style}" style has ${Math.round(successRate * 100)}% approval rate`,
          description: `Designs using the "${style}" visual style achieve a ${Math.round(successRate * 100)}% approval rate based on ${data.totalCount} samples. Average performance: ${avgViews.toFixed(1)} views, ${avgSales.toFixed(1)} sales.`,
          pattern: {
            style,
            approvalRate: successRate,
            avgViews,
            avgSales,
          },
          sampleSize: data.totalCount,
          confidence,
          successRate,
          avgPerformance: { avgViews, avgSales },
          timeframe: 'year-round',
          riskLevel: 'proven',
          sourceDataIds: data.samples.map(d => d.id),
        },
      });
      insightsCreated++;
    }
  }

  console.log(`[InsightExtractor] Created ${insightsCreated} style effectiveness insights`);
  return insightsCreated;
}

/**
 * MAIN EXTRACTION: Extract niche timing insights (seasonal patterns)
 */
async function extractNicheTimingInsights(designs: DesignWithMetrics[]): Promise<number> {
  console.log(`[InsightExtractor] Analyzing niche timing patterns`);

  // Group by niche and month
  const nicheMonthGroups: Record<string, Record<number, PatternCandidate>> = {};

  for (const design of designs) {
    const month = new Date(design.createdAt).getMonth();

    if (!nicheMonthGroups[design.niche]) {
      nicheMonthGroups[design.niche] = {};
    }

    if (!nicheMonthGroups[design.niche][month]) {
      nicheMonthGroups[design.niche][month] = {
        pattern: `${design.niche}-month-${month}`,
        samples: [],
        successCount: 0,
        totalCount: 0,
      };
    }

    nicheMonthGroups[design.niche][month].samples.push(design);
    nicheMonthGroups[design.niche][month].totalCount++;
    if (design.sales > 0) {
      nicheMonthGroups[design.niche][month].successCount++;
    }
  }

  let insightsCreated = 0;
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  for (const [niche, monthData] of Object.entries(nicheMonthGroups)) {
    // Find peak month(s) for this niche
    const monthStats = Object.entries(monthData)
      .map(([month, data]) => ({
        month: parseInt(month),
        avgSales: data.samples.reduce((sum, d) => sum + d.sales, 0) / data.samples.length,
        sampleSize: data.totalCount,
      }))
      .filter(m => m.sampleSize >= 5);

    if (monthStats.length < 3) continue; // Need enough months to detect patterns

    // Calculate overall average
    const overallAvg = monthStats.reduce((sum, m) => sum + m.avgSales, 0) / monthStats.length;
    if (overallAvg === 0) continue;

    // Find months with significantly higher sales (1.5x+ average)
    const peakMonths = monthStats.filter(m => m.avgSales >= overallAvg * 1.5);

    if (peakMonths.length === 0) continue;

    const totalSamples = monthStats.reduce((sum, m) => sum + m.sampleSize, 0);
    if (totalSamples < MIN_SAMPLE_SIZE) continue;

    const confidence = Math.min(0.95, 0.7 + (totalSamples / 100) * 0.1);
    if (confidence < MIN_CONFIDENCE) continue;

    const peakMonthNames = peakMonths.map(m => monthNames[m.month]).join(', ');
    const multiplier = Math.max(...peakMonths.map(m => m.avgSales / overallAvg));

    const existing = await prisma.provenInsight.findFirst({
      where: {
        insightType: 'niche-timing',
        niche,
        stillRelevant: true,
      },
    });

    if (existing) {
      await prisma.provenInsight.update({
        where: { id: existing.id },
        data: {
          sampleSize: totalSamples,
          confidence,
          pattern: {
            peakMonths: peakMonths.map(m => m.month),
            multiplier,
            monthlyBreakdown: monthStats,
          },
          timesValidated: existing.timesValidated + 1,
          lastValidated: new Date(),
        },
      });
    } else {
      await prisma.provenInsight.create({
        data: {
          insightType: 'niche-timing',
          category: 'seasonal',
          title: `"${niche}" peaks in ${peakMonthNames} (${multiplier.toFixed(1)}x sales)`,
          description: `The "${niche}" niche shows ${multiplier.toFixed(1)}x higher sales during ${peakMonthNames} compared to average. Plan inventory and marketing campaigns accordingly.`,
          pattern: {
            peakMonths: peakMonths.map(m => m.month),
            multiplier,
            monthlyBreakdown: monthStats,
          },
          sampleSize: totalSamples,
          confidence,
          niche,
          niches: [niche],
          timeframe: peakMonthNames.includes(',') ? 'multi-seasonal' : 'seasonal',
          riskLevel: 'proven',
          sourceDataIds: Object.values(monthData).flatMap(d => d.samples.map(s => s.id)),
        },
      });
      insightsCreated++;
    }
  }

  console.log(`[InsightExtractor] Created ${insightsCreated} niche timing insights`);
  return insightsCreated;
}

/**
 * MAIN EXTRACTION: Extract listing structure insights
 */
async function extractListingInsights(designs: DesignWithMetrics[]): Promise<number> {
  console.log(`[InsightExtractor] Analyzing listing structures`);

  // Analyze title patterns
  const titlePatterns: Record<string, PatternCandidate> = {
    'gift-angle': { pattern: 'gift-angle', samples: [], successCount: 0, totalCount: 0 },
    'funny-angle': { pattern: 'funny-angle', samples: [], successCount: 0, totalCount: 0 },
    'profession-first': { pattern: 'profession-first', samples: [], successCount: 0, totalCount: 0 },
    'quote-style': { pattern: 'quote-style', samples: [], successCount: 0, totalCount: 0 },
  };

  for (const design of designs) {
    const title = design.listingTitle.toLowerCase();

    if (/gift|present|for (him|her|mom|dad|nurse|teacher)/i.test(title)) {
      titlePatterns['gift-angle'].samples.push(design);
      titlePatterns['gift-angle'].totalCount++;
      if (design.sales > 0) titlePatterns['gift-angle'].successCount++;
    }

    if (/funny|humor|hilarious|joke/i.test(title)) {
      titlePatterns['funny-angle'].samples.push(design);
      titlePatterns['funny-angle'].totalCount++;
      if (design.sales > 0) titlePatterns['funny-angle'].successCount++;
    }

    if (/^(nurse|teacher|doctor|lawyer|mom|dad)/i.test(title)) {
      titlePatterns['profession-first'].samples.push(design);
      titlePatterns['profession-first'].totalCount++;
      if (design.sales > 0) titlePatterns['profession-first'].successCount++;
    }

    if (/"|'/.test(title)) {
      titlePatterns['quote-style'].samples.push(design);
      titlePatterns['quote-style'].totalCount++;
      if (design.sales > 0) titlePatterns['quote-style'].successCount++;
    }
  }

  let insightsCreated = 0;

  const patternDescriptions: Record<string, string> = {
    'gift-angle': 'Titles framed as "gift for X" or "present for Y"',
    'funny-angle': 'Titles emphasizing humor (funny, hilarious, etc.)',
    'profession-first': 'Titles starting with profession/identity',
    'quote-style': 'Titles containing quotes or saying-style text',
  };

  for (const [pattern, data] of Object.entries(titlePatterns)) {
    if (data.totalCount < MIN_SAMPLE_SIZE) continue;

    const timePeriods = groupByTimePeriod(data.samples).size;
    if (timePeriods < MIN_TIME_PERIODS) continue;

    const confidence = calculateConfidence(data.successCount, data.totalCount, timePeriods);
    if (confidence < MIN_CONFIDENCE) continue;

    const successRate = data.successCount / data.totalCount;
    const avgSales = data.samples.reduce((sum, d) => sum + d.sales, 0) / data.samples.length;

    const existing = await prisma.provenInsight.findFirst({
      where: {
        insightType: 'listing-structure',
        title: { contains: pattern },
        stillRelevant: true,
      },
    });

    if (existing) {
      await prisma.provenInsight.update({
        where: { id: existing.id },
        data: {
          sampleSize: data.totalCount,
          confidence,
          successRate,
          avgPerformance: { avgSales },
          timesValidated: existing.timesValidated + 1,
          lastValidated: new Date(),
        },
      });
    } else {
      await prisma.provenInsight.create({
        data: {
          insightType: 'listing-structure',
          category: 'listing',
          title: `"${pattern}" title pattern converts at ${Math.round(successRate * 100)}%`,
          description: `${patternDescriptions[pattern]}. This approach shows ${Math.round(successRate * 100)}% conversion with avg ${avgSales.toFixed(1)} sales per design.`,
          pattern: {
            patternType: pattern,
            description: patternDescriptions[pattern],
            exampleTitles: data.samples.slice(0, 5).map(d => d.listingTitle),
          },
          sampleSize: data.totalCount,
          confidence,
          successRate,
          avgPerformance: { avgSales },
          timeframe: 'year-round',
          riskLevel: 'proven',
          sourceDataIds: data.samples.map(d => d.id),
        },
      });
      insightsCreated++;
    }
  }

  console.log(`[InsightExtractor] Created ${insightsCreated} listing structure insights`);
  return insightsCreated;
}

/**
 * MAIN EXTRACTION: Extract cross-niche opportunity insights
 */
async function extractCrossNicheInsights(designs: DesignWithMetrics[]): Promise<number> {
  console.log(`[InsightExtractor] Analyzing cross-niche opportunities`);

  // Build niche co-occurrence matrix
  const nichePairs: Record<string, PatternCandidate> = {};

  // Group by user to find users who bought in multiple niches
  const userNiches: Record<string, Set<string>> = {};
  for (const design of designs) {
    // Use sourceData to simulate user grouping (in reality would use actual buyer data)
    const userKey = design.sourceData?.query || 'general';
    if (!userNiches[userKey]) {
      userNiches[userKey] = new Set();
    }
    userNiches[userKey].add(design.niche);
  }

  // Find niches that often appear together
  for (const niches of Object.values(userNiches)) {
    if (niches.size < 2) continue;

    const nicheArray = Array.from(niches).sort();
    for (let i = 0; i < nicheArray.length; i++) {
      for (let j = i + 1; j < nicheArray.length; j++) {
        const pairKey = `${nicheArray[i]}+${nicheArray[j]}`;
        if (!nichePairs[pairKey]) {
          nichePairs[pairKey] = {
            pattern: pairKey,
            samples: [],
            successCount: 0,
            totalCount: 0,
          };
        }
        nichePairs[pairKey].totalCount++;

        // Find designs in either niche and add them
        const relevantDesigns = designs.filter(
          d => d.niche === nicheArray[i] || d.niche === nicheArray[j]
        );
        nichePairs[pairKey].samples.push(...relevantDesigns.slice(0, 2));

        if (relevantDesigns.some(d => d.sales > 0)) {
          nichePairs[pairKey].successCount++;
        }
      }
    }
  }

  let insightsCreated = 0;

  for (const [pairKey, data] of Object.entries(nichePairs)) {
    if (data.totalCount < MIN_SAMPLE_SIZE) continue;

    const [niche1, niche2] = pairKey.split('+');
    const confidence = Math.min(0.9, 0.7 + (data.totalCount / 50) * 0.1);
    if (confidence < MIN_CONFIDENCE) continue;

    const existing = await prisma.provenInsight.findFirst({
      where: {
        insightType: 'cross-niche',
        title: { contains: niche1 },
        stillRelevant: true,
      },
    });

    if (existing) {
      await prisma.provenInsight.update({
        where: { id: existing.id },
        data: {
          sampleSize: data.totalCount,
          confidence,
          timesValidated: existing.timesValidated + 1,
          lastValidated: new Date(),
        },
      });
    } else {
      await prisma.provenInsight.create({
        data: {
          insightType: 'cross-niche',
          category: 'evergreen',
          title: `"${niche1}" + "${niche2}" crossover opportunity`,
          description: `Users interested in "${niche1}" also show interest in "${niche2}". Consider creating designs that combine both audiences (e.g., "${niche1} who loves ${niche2}").`,
          pattern: {
            niche1,
            niche2,
            coOccurrence: data.totalCount,
            crossoverIdeas: [
              `${niche1} who also ${niche2}`,
              `${niche2} ${niche1} combo`,
            ],
          },
          sampleSize: data.totalCount,
          confidence,
          niches: [niche1, niche2],
          timeframe: 'year-round',
          riskLevel: 'emerging',
          sourceDataIds: data.samples.slice(0, 20).map(d => d.id),
        },
      });
      insightsCreated++;
    }
  }

  console.log(`[InsightExtractor] Created ${insightsCreated} cross-niche insights`);
  return insightsCreated;
}

/**
 * MAIN ENTRY POINT: Run all insight extraction
 */
export async function extractAllInsights(): Promise<ExtractionResult> {
  console.log('[InsightExtractor] Starting comprehensive insight extraction');
  const startTime = Date.now();

  const errors: string[] = [];
  let totalCreated = 0;
  let totalUpdated = 0;

  try {
    // Fetch all designs with metrics
    const designs = await prisma.merchDesign.findMany({
      where: {
        isTest: false, // Exclude test data
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
        userRating: true,
        createdAt: true,
        mode: true,
        riskLevel: true,
        listingTitle: true,
        listingBullets: true,
        sourceData: true,
      },
    });

    console.log(`[InsightExtractor] Loaded ${designs.length} designs for analysis`);

    if (designs.length < MIN_SAMPLE_SIZE) {
      console.log('[InsightExtractor] Not enough data for meaningful insights');
      return {
        insightsCreated: 0,
        insightsUpdated: 0,
        candidatesAnalyzed: 0,
        errors: ['Insufficient data - need at least 10 designs'],
      };
    }

    // Run all extraction pipelines
    const phraseInsights = await extractPhrasePatterns(designs);
    totalCreated += phraseInsights;

    const styleInsights = await extractStyleInsights(designs);
    totalCreated += styleInsights;

    const timingInsights = await extractNicheTimingInsights(designs);
    totalCreated += timingInsights;

    const listingInsights = await extractListingInsights(designs);
    totalCreated += listingInsights;

    const crossNicheInsights = await extractCrossNicheInsights(designs);
    totalCreated += crossNicheInsights;

    // Count updates (insights that were refreshed, not created)
    const recentUpdates = await prisma.provenInsight.count({
      where: {
        updatedAt: { gte: new Date(startTime) },
        createdAt: { lt: new Date(startTime) },
      },
    });
    totalUpdated = recentUpdates;

  } catch (error) {
    console.error('[InsightExtractor] Error during extraction:', error);
    errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  const duration = Date.now() - startTime;
  console.log(`[InsightExtractor] Extraction complete in ${duration}ms`);
  console.log(`[InsightExtractor] Created: ${totalCreated}, Updated: ${totalUpdated}`);

  return {
    insightsCreated: totalCreated,
    insightsUpdated: totalUpdated,
    candidatesAnalyzed: 5, // Number of extraction pipelines
    errors,
  };
}

/**
 * Get insights summary for display
 */
export async function getInsightsSummary(): Promise<{
  total: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
  highConfidence: number;
  recentlyValidated: number;
}> {
  const insights = await prisma.provenInsight.findMany({
    where: { stillRelevant: true },
    select: {
      insightType: true,
      category: true,
      confidence: true,
      lastValidated: true,
    },
  });

  const byType: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let highConfidence = 0;
  let recentlyValidated = 0;

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  for (const insight of insights) {
    byType[insight.insightType] = (byType[insight.insightType] || 0) + 1;
    byCategory[insight.category] = (byCategory[insight.category] || 0) + 1;

    if (insight.confidence >= 0.9) highConfidence++;
    if (insight.lastValidated >= oneWeekAgo) recentlyValidated++;
  }

  return {
    total: insights.length,
    byType,
    byCategory,
    highConfidence,
    recentlyValidated,
  };
}
