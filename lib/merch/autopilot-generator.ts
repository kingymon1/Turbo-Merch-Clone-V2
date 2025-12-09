/**
 * Autopilot Generator for Merch Design Generator
 *
 * Uses the existing multi-agent trend research system to generate design concepts.
 * Integrates with searchTrends() which combines Grok, Brave, and Google agents.
 *
 * Phase 5 Enhancement: Now uses cached market data when available, falling back
 * to live API calls only when necessary. This reduces API costs by ~90%.
 *
 * Phase 6 Enhancement: Integrates ProvenInsights learning system to make smarter
 * generation decisions based on historical patterns. Low-risk generations heavily
 * favor proven insights, while high-risk allows more experimentation.
 */

import { searchTrends } from '@/services/geminiService';
import { TrendData } from '@/types';
import { DesignConcept } from './image-prompter';
import {
  hasRecentData,
  getRecentMarketData,
  getRandomHighPerformingNiche,
  generateConceptFromCachedData,
} from './data-collectors';
import {
  applyInsightsToGeneration,
} from './learning';

// Track applied insights for logging
interface AppliedInsight {
  id: string;
  type: string;
  appliedAs: string;
  confidence: number;
}

// Niches to explore based on risk level
const NICHE_POOLS = {
  // Low risk: Evergreen, proven niches
  low: [
    'nurse gifts',
    'teacher appreciation',
    'dog mom',
    'cat lover',
    'coffee addict',
    'dad jokes',
    'mom life',
    'gaming',
    'fishing',
    'camping',
  ],
  // Medium risk: Trending but established
  medium: [
    'work from home',
    'introvert life',
    'plant mom',
    'true crime',
    'book lover',
    'yoga life',
    'running',
    'self care',
    'mental health awareness',
    'millennial humor',
  ],
  // High risk: Emerging trends, viral potential
  high: [
    'trending memes',
    'viral tiktok',
    'internet culture',
    'gen z humor',
    'chronically online',
    'goblin mode',
    'delulu',
    'roman empire',
    'pop culture moments',
    'breaking news trends',
  ],
};

/**
 * Map risk level (0-100) to search virality level
 * The searchTrends function uses virality 0-100 where higher = more aggressive/viral hunting
 */
function mapRiskToVirality(riskLevel: number): number {
  // Direct mapping - risk level is equivalent to virality level
  return Math.max(0, Math.min(100, riskLevel));
}

/**
 * Select a random niche from the appropriate pool based on risk level
 */
function selectNicheForRisk(riskLevel: number): string {
  let pool: string[];

  if (riskLevel < 30) {
    pool = NICHE_POOLS.low;
  } else if (riskLevel < 70) {
    pool = NICHE_POOLS.medium;
  } else {
    pool = NICHE_POOLS.high;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Extract the best design concept from trend data
 * Phase 6: Now accepts insight guidance to influence style/tone selection
 */
function extractDesignConcept(
  trend: TrendData,
  insightGuidance?: {
    recommendedStyles: string[];
    recommendedTones: string[];
    phraseTemplates: string[];
    warnings: string[];
    appliedInsights: AppliedInsight[];
  } | null
): DesignConcept {
  // Use designText if available, otherwise extract from topic
  const phrase = trend.designText ||
                 trend.topic.split(' ').slice(0, 5).join(' ').toUpperCase() ||
                 trend.topic;

  // Phase 6: Use insight-recommended style if available, otherwise infer from trend
  let style = insightGuidance?.recommendedStyles[0] || 'Bold Modern';

  // If no insight, try to infer from trend visual style
  if (!insightGuidance?.recommendedStyles.length && trend.visualStyle) {
    if (trend.visualStyle.toLowerCase().includes('vintage') || trend.visualStyle.toLowerCase().includes('retro')) {
      style = 'Vintage Retro';
    } else if (trend.visualStyle.toLowerCase().includes('minimal')) {
      style = 'Minimalist';
    } else if (trend.visualStyle.toLowerCase().includes('distress') || trend.visualStyle.toLowerCase().includes('grunge')) {
      style = 'Distressed';
    } else if (trend.visualStyle.toLowerCase().includes('playful') || trend.visualStyle.toLowerCase().includes('cartoon')) {
      style = 'Playful';
    }
  }

  // Phase 6: Use insight-recommended tone if available
  let tone = insightGuidance?.recommendedTones[0] || 'Funny';

  // If no insight, infer from sentiment
  if (!insightGuidance?.recommendedTones.length && trend.sentiment) {
    const sentiment = trend.sentiment.toLowerCase();
    if (sentiment.includes('inspirational') || sentiment.includes('motivat')) {
      tone = 'Inspirational';
    } else if (sentiment.includes('sarcas') || sentiment.includes('ironic')) {
      tone = 'Sarcastic';
    } else if (sentiment.includes('heart') || sentiment.includes('emotional')) {
      tone = 'Heartfelt';
    } else if (sentiment.includes('proud') || sentiment.includes('confident')) {
      tone = 'Proud';
    } else if (sentiment.includes('edgy') || sentiment.includes('rebel')) {
      tone = 'Edgy';
    }
  }

  return {
    phrase,
    niche: trend.audienceProfile || trend.topic.split(' ')[0] || 'general',
    style,
    tone,
    visualStyle: trend.visualStyle,
    imageFeature: trend.customerPhrases?.[0], // Use first customer phrase as potential icon hint
  };
}

/**
 * Determine data category from risk level
 */
function getCategoryFromRisk(riskLevel: number): 'proven' | 'emerging' | 'moonshot' {
  if (riskLevel < 30) return 'proven';
  if (riskLevel < 70) return 'emerging';
  return 'moonshot';
}

/**
 * Generate a design concept using cached data when available.
 * Falls back to live API calls only when no recent cached data exists.
 *
 * Phase 6: Now integrates ProvenInsights to make smarter decisions.
 *
 * @param riskLevel - 0-100, where 0 is safe/evergreen and 100 is viral/risky
 * @returns Design concept with phrase, niche, style, tone, and applied insights
 */
export async function generateAutopilotConcept(riskLevel: number): Promise<{
  concept: DesignConcept;
  trend: TrendData;
  source: string;
  appliedInsights?: AppliedInsight[];
}> {
  console.log(`[Autopilot] Generating concept at risk level ${riskLevel}`);

  // Determine which data category to use
  const category = getCategoryFromRisk(riskLevel);
  console.log(`[Autopilot] Data category: ${category}`);

  // PHASE 6: Query insights to guide generation
  let insightGuidance: {
    recommendedStyles: string[];
    recommendedTones: string[];
    phraseTemplates: string[];
    warnings: string[];
    appliedInsights: AppliedInsight[];
  } | null = null;

  try {
    const selectedNiche = selectNicheForRisk(riskLevel);
    insightGuidance = await applyInsightsToGeneration({
      niche: selectedNiche,
      riskLevel,
      month: new Date().getMonth(),
    });

    if (insightGuidance.appliedInsights.length > 0) {
      console.log(`[Autopilot] Applied ${insightGuidance.appliedInsights.length} insights`);
      console.log(`[Autopilot] Recommended styles: ${insightGuidance.recommendedStyles.join(', ')}`);

      // Log any warnings from anti-patterns
      for (const warning of insightGuidance.warnings) {
        console.log(`[Autopilot] Warning: ${warning}`);
      }
    }
  } catch (insightError) {
    console.log('[Autopilot] Insight lookup failed, continuing without:', insightError);
  }

  // PHASE 5: Try to use cached data first
  try {
    const hasCached = await hasRecentData(category, 12); // 12 hours

    if (hasCached) {
      console.log('[Autopilot] Using cached market data (saves API costs!)');

      // Get cached trends for this category
      const cachedTrends = await getRecentMarketData(category, 12);

      if (cachedTrends.length > 0) {
        // Select a random trend from cached data
        const randomIndex = Math.floor(Math.random() * Math.min(cachedTrends.length, 10));
        const selectedTrend = cachedTrends[randomIndex];

        const concept = extractDesignConcept(selectedTrend, insightGuidance);

        console.log(`[Autopilot] Using cached trend: ${selectedTrend.topic}`);
        return {
          concept,
          trend: selectedTrend,
          source: `Cached data (${category})`,
          appliedInsights: insightGuidance?.appliedInsights,
        };
      }
    }

    // Also try niche-level cached intelligence
    const nicheData = await getRandomHighPerformingNiche();
    if (nicheData && nicheData.phrases.length > 0) {
      console.log(`[Autopilot] Using cached niche data: ${nicheData.niche}`);

      // Generate concept from cached niche analysis
      const generated = await generateConceptFromCachedData(nicheData);

      // Apply insight-recommended style if available (Phase 6)
      const style = insightGuidance?.recommendedStyles[0] || generated.style;

      const concept: DesignConcept = {
        phrase: generated.phrase,
        niche: nicheData.niche,
        style,
        tone: generated.tone,
        visualStyle: generated.visualDirection,
      };

      const trend: TrendData = {
        topic: generated.phrase,
        platform: 'Cached Niche Intelligence',
        volume: 'Analyzed',
        sentiment: generated.tone,
        keywords: nicheData.keywords.slice(0, 10),
        description: `Design based on ${nicheData.niche} niche analysis`,
        visualStyle: generated.visualDirection,
        customerPhrases: nicheData.phrases.slice(0, 5),
      };

      return {
        concept,
        trend,
        source: `Niche Intelligence (${nicheData.category})`,
        appliedInsights: insightGuidance?.appliedInsights,
      };
    }
  } catch (cacheError) {
    console.log('[Autopilot] Cache lookup failed, falling back to live API:', cacheError);
    // Continue to live API
  }

  // FALLBACK: Live API call (original behavior)
  console.log('[Autopilot] No cached data, using live API');

  // Select niche based on risk level
  const selectedNiche = selectNicheForRisk(riskLevel);
  console.log(`[Autopilot] Selected niche: ${selectedNiche}`);

  // Map risk to virality for the search
  const viralityLevel = mapRiskToVirality(riskLevel);
  console.log(`[Autopilot] Virality level for search: ${viralityLevel}`);

  try {
    // Use the existing multi-agent trend research system
    // This calls Grok, Brave, and Google agents to find trends
    const trends = await searchTrends(selectedNiche, viralityLevel);

    if (!trends || trends.length === 0) {
      console.log('[Autopilot] No trends found, using fallback');
      return generateFallbackConcept(riskLevel, selectedNiche, insightGuidance);
    }

    // Select the best trend (first one is usually highest quality)
    const bestTrend = trends[0];
    console.log(`[Autopilot] Best trend: ${bestTrend.topic}`);

    const concept = extractDesignConcept(bestTrend, insightGuidance);

    return {
      concept,
      trend: bestTrend,
      source: `Live API (${bestTrend.sources?.join(', ') || bestTrend.platform})`,
      appliedInsights: insightGuidance?.appliedInsights,
    };
  } catch (error) {
    console.error('[Autopilot] Error in trend research:', error);
    return generateFallbackConcept(riskLevel, selectedNiche, insightGuidance);
  }
}

/**
 * Generate a fallback concept when trend research fails
 * Phase 6: Now uses insight guidance to improve fallback quality
 */
function generateFallbackConcept(
  riskLevel: number,
  niche: string,
  insightGuidance?: {
    recommendedStyles: string[];
    recommendedTones: string[];
    phraseTemplates: string[];
    warnings: string[];
    appliedInsights: AppliedInsight[];
  } | null
): {
  concept: DesignConcept;
  trend: TrendData;
  source: string;
  appliedInsights?: AppliedInsight[];
} {
  // Fallback phrases based on niche and risk level
  const fallbackPhrases: Record<string, string[]> = {
    'nurse gifts': ["World's Okayest Nurse", "Nurse Mode: ON", "Coffee Scrubs Rubber Gloves"],
    'teacher appreciation': ["Teaching is My Superpower", "Powered by Coffee & Chaos", "Teacher Mode: Activated"],
    'dog mom': ["Dog Mom Life", "My Dog is My Therapist", "Powered by Dog Cuddles"],
    'cat lover': ["Cat Mom Vibes", "Sorry I Have Plans With My Cat", "Cats Over People"],
    'coffee addict': ["But First, Coffee", "Powered by Caffeine", "Coffee Then Everything"],
    'gaming': ["One More Game", "Respawn and Try Again", "Gaming Mode: ON"],
    default: ["Living My Best Life", "Good Vibes Only", "Just Keep Going"],
  };

  const phrases = fallbackPhrases[niche] || fallbackPhrases.default;
  const phrase = phrases[Math.floor(Math.random() * phrases.length)];

  // Phase 6: Use insight-recommended style/tone if available
  const style = insightGuidance?.recommendedStyles[0] ||
                (riskLevel > 50 ? 'Distressed' : 'Bold Modern');
  const tone = insightGuidance?.recommendedTones[0] || 'Funny';

  const concept: DesignConcept = {
    phrase,
    niche: niche.split(' ')[0],
    style,
    tone,
  };

  const trend: TrendData = {
    topic: phrase,
    platform: 'Fallback',
    volume: 'Generated',
    sentiment: tone,
    keywords: [phrase, niche],
    description: `${phrase} design for ${niche}`,
    visualStyle: style,
    customerPhrases: [`Perfect for ${niche}`],
  };

  return {
    concept,
    trend,
    source: 'Fallback (trend research unavailable)',
    appliedInsights: insightGuidance?.appliedInsights,
  };
}

/**
 * Get risk level description for UI display
 */
export function getRiskLevelDescription(riskLevel: number): string {
  if (riskLevel < 30) {
    return 'Safe Zone: Proven evergreen niches with consistent demand';
  } else if (riskLevel < 50) {
    return 'Balanced: Mix of established trends and emerging opportunities';
  } else if (riskLevel < 70) {
    return 'Aggressive: Chasing momentum and rising trends';
  } else {
    return 'Moonshot: Early viral signals and maximum trend potential';
  }
}
