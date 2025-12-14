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
 *
 * Phase 7A Enhancement: Now integrates marketplace intelligence from MBA products
 * to inject proven keywords and patterns into the generation process.
 *
 * STYLE INTELLIGENCE ARCHITECTURE:
 * This generator is the ORCHESTRATOR of the design pipeline. Its role in StyleIntel:
 *
 * 1. CONTEXT PROVIDER - This generator provides rich context for StyleIntel:
 *    - niche (from diversity engine, cached data, or fallback)
 *    - tone (from trend research, insights, or inference)
 *    - riskLevel (from user input)
 *    - visual style hints (from trend research)
 *
 * 2. DOES NOT SELECT STYLES - When STYLE_INTEL_MERCH_ENABLED is true:
 *    - StyleIntelService selects the appropriate StyleRecipe
 *    - This happens downstream in createDesignBriefFromTrend() via maybeApplyStyleIntel()
 *    - The generator passes context, StyleIntel makes the style decision
 *
 * 3. STYLE INFERENCE IS CONTEXT, NOT DECISION:
 *    - extractDesignConcept() infers style/tone from trends
 *    - These are HIGH-LEVEL HINTS that help StyleIntel select recipes
 *    - They do NOT override StyleRecipe when one is selected
 *
 * 4. FORM-BASED SYSTEM (Phase 10):
 *    - generateAutopilotConceptWithForm() uses fillDesignForm() which receives styleSpec
 *    - The styleSpec is passed through and used by FormFiller for final decisions
 *
 * When STYLE_INTEL_MERCH_ENABLED is false:
 * - Behavior unchanged from previous implementation
 * - Style decisions come from research agents directly
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
import {
  getOptimizedKeywordsForNiche,
  OptimizedKeywords,
  isDatabaseConfigured,
} from '@/services/marketplaceLearning';
import { scrapeNicheOnDemand } from '@/services/marketplaceBootstrap';
import {
  preValidateInput,
  findBannedWords,
  cleanToAscii,
  enforceAutopilotTextLimit,
  validateAutopilotTextLength,
} from './validation';
import {
  exploreForDiversity,
  recordGeneration,
  scoreDiversity,
  DiversityScore,
  ExplorationResult,
} from './diversity-engine';

// NEW IMPORTS for form-based system (Phase 10)
import { DesignForm, FormFillerResult } from './types';
import { fillDesignForm } from './form-filler';
import { buildSimplePrompt, buildModelSpecificPrompt } from './simple-prompt-builder';
import { getOrResearchStyleContext } from './style-research';

// Track applied insights for logging
// Maps from InsightApplication (from insight-applier) to simplified format for storage
interface AppliedInsight {
  id: string;        // mapped from insightId
  type: string;      // mapped from insightType
  appliedAs: string;
  confidence: number;
}

// Helper to map InsightApplication to AppliedInsight
function mapToAppliedInsight(insight: {
  insightId: string;
  insightType: string;
  appliedAs: string;
  confidence: number;
}): AppliedInsight {
  return {
    id: insight.insightId,
    type: insight.insightType,
    appliedAs: insight.appliedAs,
    confidence: insight.confidence,
  };
}

// DEPRECATED: These static pools are now replaced by the Diversity Engine
// which dynamically discovers 300+ niches and tracks generation history
// to ensure infinite variety. Kept as fallback only.
const NICHE_POOLS_FALLBACK = {
  low: ['nurse gifts', 'teacher appreciation', 'dog mom', 'cat lover', 'coffee addict'],
  medium: ['work from home', 'introvert life', 'plant mom', 'true crime', 'book lover'],
  high: ['trending memes', 'internet culture', 'gen z humor', 'viral moments', 'meme culture'],
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
 * Select a random niche from the fallback pool based on risk level
 * DEPRECATED: Use exploreForDiversity() instead for dynamic niche discovery
 */
function selectNicheForRiskFallback(riskLevel: number): string {
  let pool: string[];

  if (riskLevel < 30) {
    pool = NICHE_POOLS_FALLBACK.low;
  } else if (riskLevel < 70) {
    pool = NICHE_POOLS_FALLBACK.medium;
  } else {
    pool = NICHE_POOLS_FALLBACK.high;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Extract the best design concept from trend data
 * Phase 6: Now accepts insight guidance to influence style/tone selection
 * Phase 7B: Now validates and cleans phrase for compliance
 *
 * STYLE INTELLIGENCE NOTE:
 * The style and tone extracted here are HIGH-LEVEL HINTS, not final decisions.
 * When STYLE_INTEL_MERCH_ENABLED is true:
 * - These values help StyleIntelService select an appropriate StyleRecipe
 * - The actual style implementation comes from the selected StyleRecipe
 * - This function provides CONTEXT, not final style authority
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
  let rawPhrase = trend.designText ||
                 trend.topic.split(' ').slice(0, 5).join(' ').toUpperCase() ||
                 trend.topic;

  // Phase 7B: Clean phrase to ASCII and check for banned words
  let phrase = cleanToAscii(rawPhrase);
  const bannedInPhrase = findBannedWords(phrase);

  if (bannedInPhrase.length > 0) {
    console.log(`[Autopilot] Phrase contains banned words: ${bannedInPhrase.join(', ')}`);
    // Remove banned words from phrase
    for (const banned of bannedInPhrase) {
      const regex = new RegExp(`\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      phrase = phrase.replace(regex, '').replace(/\s+/g, ' ').trim();
    }
  }

  // Phase 9: Enforce text length limit for autopilot mode (≤6 words)
  const lengthValidation = validateAutopilotTextLength(phrase);
  if (lengthValidation.wasShortened) {
    console.log(`[Autopilot] ${lengthValidation.warning}`);
    phrase = lengthValidation.shortened;
  }

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

  // Phase 7B: Clean niche as well
  const rawNiche = trend.audienceProfile || trend.topic.split(' ')[0] || 'general';
  const niche = cleanToAscii(rawNiche);

  return {
    phrase,
    niche,
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
 * Phase 7A: Now integrates marketplace intelligence from MBA products.
 * Phase 8: Now uses Diversity Engine for infinite variety and anti-repetition.
 *
 * @param riskLevel - 0-100, where 0 is safe/evergreen and 100 is viral/risky
 * @param userId - Optional user ID for per-user diversity tracking
 * @returns Design concept with phrase, niche, style, tone, applied insights, marketplace data, and diversity info
 */
export async function generateAutopilotConcept(riskLevel: number, userId?: string): Promise<{
  concept: DesignConcept;
  trend: TrendData;
  source: string;
  appliedInsights?: AppliedInsight[];
  marketplaceData?: OptimizedKeywords;
  diversityInfo?: {
    score: DiversityScore;
    explorationResult?: ExplorationResult;
    wasForced: boolean;
  };
}> {
  console.log(`[Autopilot] Generating concept at risk level ${riskLevel}${userId ? ` for user ${userId}` : ''}`);

  // PHASE 8: Use Diversity Engine for niche selection
  let explorationResult: ExplorationResult | null = null;
  let diversityNiche: string | null = null;
  let diversityPhrase: string | null = null;

  try {
    explorationResult = await exploreForDiversity({
      userId,
      riskLevel,
      forceExploration: false,
    });

    if (explorationResult && explorationResult.confidence >= 0.4) {
      diversityNiche = explorationResult.niche;
      diversityPhrase = explorationResult.phrase;
      console.log(`[Autopilot] Diversity Engine selected: "${diversityPhrase}" in ${diversityNiche} (score: ${explorationResult.diversityScore.overall.toFixed(2)})`);
    }
  } catch (diversityError) {
    console.warn('[Autopilot] Diversity engine failed, using fallback:', diversityError);
  }

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
    // Use diversity-selected niche if available, otherwise fallback
    const selectedNiche = diversityNiche || selectNicheForRiskFallback(riskLevel);
    const rawGuidance = await applyInsightsToGeneration({
      niche: selectedNiche,
      riskLevel,
      month: new Date().getMonth(),
    });

    // Map InsightApplication to AppliedInsight format
    insightGuidance = {
      ...rawGuidance,
      appliedInsights: rawGuidance.appliedInsights.map(mapToAppliedInsight),
    };

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

  // PHASE 7A: Query marketplace intelligence for proven keywords
  // Now with auto-scraping: if niche not in database, scrape it on-demand
  let marketplaceData: OptimizedKeywords | null = null;
  const selectedNicheForMarketplace = diversityNiche || selectNicheForRiskFallback(riskLevel);

  try {
    const dbConfigured = await isDatabaseConfigured();
    if (dbConfigured) {
      // First try to get existing data
      marketplaceData = await getOptimizedKeywordsForNiche(selectedNicheForMarketplace);

      if (marketplaceData && marketplaceData.confidence >= 30) {
        console.log(`[Autopilot] Marketplace data found for "${selectedNicheForMarketplace}" (confidence: ${marketplaceData.confidence}%)`);
        console.log(`[Autopilot] MBA products: ${marketplaceData.mbaInsights.productCount}, saturation: ${marketplaceData.saturation}`);
      } else {
        // AUTO-SCRAPE: No good data exists, try to scrape this niche on-demand
        console.log(`[Autopilot] No marketplace data for "${selectedNicheForMarketplace}", triggering auto-scrape...`);

        const scrapeResult = await scrapeNicheOnDemand(selectedNicheForMarketplace);

        if (scrapeResult.success && !scrapeResult.alreadyHadData) {
          console.log(`[Autopilot] Auto-scraped ${scrapeResult.productsAdded} products, confidence: ${scrapeResult.confidence}%`);

          // Re-fetch the data now that we've scraped
          if (scrapeResult.confidence >= 30) {
            marketplaceData = await getOptimizedKeywordsForNiche(selectedNicheForMarketplace);
            console.log(`[Autopilot] Marketplace data now available after auto-scrape`);
          } else {
            marketplaceData = null;
          }
        } else if (scrapeResult.error) {
          console.log(`[Autopilot] Auto-scrape failed: ${scrapeResult.error}`);
          marketplaceData = null;
        } else {
          marketplaceData = null; // Low confidence, don't use
        }
      }
    }
  } catch (marketplaceError) {
    console.log('[Autopilot] Marketplace lookup failed, continuing without:', marketplaceError);
  }

  // PHASE 8: If diversity engine provided a high-confidence result, use it directly
  if (explorationResult && explorationResult.confidence >= 0.6) {
    console.log('[Autopilot] Using Diversity Engine result directly (high confidence)');

    // Build concept from diversity exploration
    const style = insightGuidance?.recommendedStyles[0] || 'Bold Modern';
    const tone = insightGuidance?.recommendedTones[0] || 'Funny';

    const concept: DesignConcept = {
      phrase: cleanToAscii(explorationResult.phrase),
      niche: cleanToAscii(explorationResult.niche),
      style,
      tone,
    };

    const keywords = mergeKeywordsWithMarketplace(
      [explorationResult.phrase, explorationResult.niche, explorationResult.topic],
      marketplaceData
    );

    const trend: TrendData = {
      topic: explorationResult.topic,
      platform: 'Diversity Engine',
      volume: 'AI-Discovered',
      sentiment: tone,
      keywords,
      description: `AI-discovered design for ${explorationResult.niche} niche`,
      visualStyle: style,
      customerPhrases: [explorationResult.phrase],
      marketplaceContext: marketplaceData
        ? buildAutopilotMarketplaceContext(marketplaceData)
        : undefined,
    };

    return {
      concept,
      trend,
      source: `Diversity Engine (${explorationResult.source})`,
      appliedInsights: insightGuidance?.appliedInsights,
      marketplaceData: marketplaceData || undefined,
      diversityInfo: {
        score: explorationResult.diversityScore,
        explorationResult,
        wasForced: false,
      },
    };
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

        // PHASE 8: If diversity engine gave us a niche, override the trend's niche
        const concept = extractDesignConcept(selectedTrend, insightGuidance);
        if (diversityNiche) {
          concept.niche = cleanToAscii(diversityNiche);
        }

        // Phase 7A: Enhance trend with marketplace keywords
        const enhancedTrend = enhanceTrendWithMarketplace(selectedTrend, marketplaceData);

        console.log(`[Autopilot] Using cached trend: ${selectedTrend.topic}`);
        return {
          concept,
          trend: enhancedTrend,
          source: `Cached data (${category})`,
          appliedInsights: insightGuidance?.appliedInsights,
          marketplaceData: marketplaceData || undefined,
          diversityInfo: explorationResult ? {
            score: explorationResult.diversityScore,
            explorationResult,
            wasForced: false,
          } : undefined,
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

      // PHASE 8: Use diversity niche if available
      const finalNiche = diversityNiche || nicheData.niche;

      const concept: DesignConcept = {
        phrase: generated.phrase,
        niche: finalNiche,
        style,
        tone: generated.tone,
        visualStyle: generated.visualDirection,
      };

      // Phase 7A: Merge niche keywords with marketplace keywords
      const mergedKeywords = mergeKeywordsWithMarketplace(
        nicheData.keywords.slice(0, 10),
        marketplaceData
      );

      const trend: TrendData = {
        topic: generated.phrase,
        platform: 'Cached Niche Intelligence',
        volume: 'Analyzed',
        sentiment: generated.tone,
        keywords: mergedKeywords,
        description: `Design based on ${finalNiche} niche analysis`,
        visualStyle: generated.visualDirection,
        customerPhrases: nicheData.phrases.slice(0, 5),
        // Phase 7A: Add marketplace context
        marketplaceContext: marketplaceData
          ? buildAutopilotMarketplaceContext(marketplaceData)
          : undefined,
      };

      return {
        concept,
        trend,
        source: `Niche Intelligence (${nicheData.category})`,
        appliedInsights: insightGuidance?.appliedInsights,
        marketplaceData: marketplaceData || undefined,
        diversityInfo: explorationResult ? {
          score: explorationResult.diversityScore,
          explorationResult,
          wasForced: false,
        } : undefined,
      };
    }
  } catch (cacheError) {
    console.log('[Autopilot] Cache lookup failed, falling back to live API:', cacheError);
    // Continue to live API
  }

  // FALLBACK: Live API call (original behavior)
  console.log('[Autopilot] No cached data, using live API');

  // Select niche based on risk level (use diversity niche if available)
  const selectedNiche = diversityNiche || selectNicheForRiskFallback(riskLevel);
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
      return generateFallbackConcept(riskLevel, selectedNiche, insightGuidance, marketplaceData, explorationResult);
    }

    // Select the best trend (first one is usually highest quality)
    const bestTrend = trends[0];
    console.log(`[Autopilot] Best trend: ${bestTrend.topic}`);

    const concept = extractDesignConcept(bestTrend, insightGuidance);

    // PHASE 8: If diversity engine gave us a niche, use it
    if (diversityNiche) {
      concept.niche = cleanToAscii(diversityNiche);
    }

    // Phase 7A: Enhance trend with marketplace keywords
    const enhancedTrend = enhanceTrendWithMarketplace(bestTrend, marketplaceData);

    return {
      concept,
      trend: enhancedTrend,
      source: `Live API (${bestTrend.sources?.join(', ') || bestTrend.platform})`,
      appliedInsights: insightGuidance?.appliedInsights,
      marketplaceData: marketplaceData || undefined,
      diversityInfo: explorationResult ? {
        score: explorationResult.diversityScore,
        explorationResult,
        wasForced: false,
      } : undefined,
    };
  } catch (error) {
    console.error('[Autopilot] Error in trend research:', error);
    return generateFallbackConcept(riskLevel, selectedNiche, insightGuidance, marketplaceData, explorationResult);
  }
}

/**
 * Generate a fallback concept when trend research fails
 * Phase 6: Now uses insight guidance to improve fallback quality
 * Phase 7A: Now uses marketplace data for keywords
 * Phase 7B: Now cleans all text for compliance
 * Phase 8: Now includes diversity info
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
  } | null,
  marketplaceData?: OptimizedKeywords | null,
  explorationResult?: ExplorationResult | null
): {
  concept: DesignConcept;
  trend: TrendData;
  source: string;
  appliedInsights?: AppliedInsight[];
  marketplaceData?: OptimizedKeywords;
  diversityInfo?: {
    score: DiversityScore;
    explorationResult?: ExplorationResult;
    wasForced: boolean;
  };
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
  const rawPhrase = phrases[Math.floor(Math.random() * phrases.length)];

  // Phase 7B: Clean phrase and niche
  const phrase = cleanToAscii(rawPhrase);
  const cleanedNiche = cleanToAscii(niche.split(' ')[0]);

  // Phase 6: Use insight-recommended style/tone if available
  const style = insightGuidance?.recommendedStyles[0] ||
                (riskLevel > 50 ? 'Distressed' : 'Bold Modern');
  const tone = insightGuidance?.recommendedTones[0] || 'Funny';

  const concept: DesignConcept = {
    phrase,
    niche: cleanedNiche,
    style,
    tone,
  };

  // Phase 7A: Merge fallback keywords with marketplace keywords
  const keywords = mergeKeywordsWithMarketplace([phrase, niche], marketplaceData || null);

  const trend: TrendData = {
    topic: phrase,
    platform: 'Fallback',
    volume: 'Generated',
    sentiment: tone,
    keywords,
    description: `${phrase} design for ${niche}`,
    visualStyle: style,
    customerPhrases: [`Perfect for ${niche}`],
    // Phase 7A: Add marketplace context even for fallback
    marketplaceContext: marketplaceData
      ? buildAutopilotMarketplaceContext(marketplaceData)
      : undefined,
  };

  return {
    concept,
    trend,
    source: 'Fallback (trend research unavailable)',
    appliedInsights: insightGuidance?.appliedInsights,
    marketplaceData: marketplaceData || undefined,
    diversityInfo: explorationResult ? {
      score: explorationResult.diversityScore,
      explorationResult,
      wasForced: false,
    } : undefined,
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

// ============================================================================
// PHASE 7A HELPER FUNCTIONS - Marketplace Intelligence Integration
// ============================================================================

/**
 * Enhance a trend with marketplace keywords
 */
function enhanceTrendWithMarketplace(
  trend: TrendData,
  marketplaceData: OptimizedKeywords | null
): TrendData {
  if (!marketplaceData) {
    return trend;
  }

  // Merge keywords
  const enhancedKeywords = mergeKeywordsWithMarketplace(trend.keywords, marketplaceData);

  return {
    ...trend,
    keywords: enhancedKeywords,
    marketplaceContext: buildAutopilotMarketplaceContext(marketplaceData),
  };
}

/**
 * Merge base keywords with marketplace proven keywords
 */
function mergeKeywordsWithMarketplace(
  baseKeywords: string[],
  marketplaceData: OptimizedKeywords | null
): string[] {
  if (!marketplaceData) {
    return baseKeywords;
  }

  // Start with base keywords
  const keywordSet = new Set(baseKeywords.map(k => k.toLowerCase()));
  const result = [...baseKeywords];

  // Add proven primary keywords (top 6)
  for (const keyword of marketplaceData.primaryKeywords.slice(0, 6)) {
    if (!keywordSet.has(keyword.toLowerCase())) {
      result.push(keyword);
      keywordSet.add(keyword.toLowerCase());
    }
  }

  // Add long-tail phrases (top 3)
  for (const phrase of marketplaceData.longTailPhrases.slice(0, 3)) {
    if (!keywordSet.has(phrase.toLowerCase())) {
      result.push(phrase);
      keywordSet.add(phrase.toLowerCase());
    }
  }

  return result.slice(0, 15); // Cap at 15 keywords
}

/**
 * Build marketplace context string for autopilot trends
 */
function buildAutopilotMarketplaceContext(marketplaceData: OptimizedKeywords): string {
  const sections: string[] = [
    '=== MARKETPLACE INTELLIGENCE (Autopilot) ===',
    `Niche: ${marketplaceData.niche}`,
    `MBA Products: ${marketplaceData.mbaInsights.productCount}`,
    `Saturation: ${marketplaceData.saturation}`,
    `Confidence: ${marketplaceData.confidence}%`,
    '',
    'PROVEN KEYWORDS:',
    marketplaceData.primaryKeywords.slice(0, 8).join(', '),
  ];

  if (marketplaceData.longTailPhrases.length > 0) {
    sections.push('', 'HIGH-VALUE PHRASES:');
    sections.push(marketplaceData.longTailPhrases.slice(0, 4).join(', '));
  }

  if (marketplaceData.mbaInsights.commonTones.length > 0) {
    sections.push('', `COMMON TONES: ${marketplaceData.mbaInsights.commonTones.join(', ')}`);
  }

  return sections.join('\n');
}

// ============================================================================
// PHASE 10: FORM-BASED GENERATION (Simple Prompt System)
// ============================================================================
// This new system replaces complex prompt engineering with a simple form.
// The AI fills a form like a human would, with strict character limits.
// The form is then converted to a clean ~50 word prompt.

/**
 * Result of form-based generation
 */
export interface FormBasedGenerationResult {
  // The filled design form
  designForm: DesignForm;

  // The simple prompt built from the form (~50 words)
  imagePrompt: string;

  // Original trend data (for listing generation)
  trend: TrendData;

  // Source of the concept
  source: string;

  // Form-filler metadata
  formFillerResult: FormFillerResult;

  // Legacy concept (for backward compatibility)
  concept: DesignConcept;
}

/**
 * Generate a design using the new form-based system.
 *
 * This is the new recommended way to generate designs.
 * It produces cleaner, simpler prompts that work better with image models.
 *
 * Flow:
 * 1. Run existing research (unchanged)
 * 2. Fetch style context from database
 * 3. Fill design form using GPT-4.1-nano
 * 4. Build simple prompt from form (~50 words)
 *
 * @param riskLevel - 0-100, where 0 is safe/evergreen and 100 is viral/risky
 * @param userId - Optional user ID for per-user diversity tracking
 * @returns FormBasedGenerationResult with form, prompt, and trend data
 */
export async function generateAutopilotConceptWithForm(
  riskLevel: number,
  userId?: string
): Promise<FormBasedGenerationResult> {
  console.log(`[Autopilot-V2] Generating with form-based system at risk level ${riskLevel}`);

  // STEP 1: Run existing research (reuse existing function)
  const legacyResult = await generateAutopilotConcept(riskLevel, userId);
  console.log(`[Autopilot-V2] Research complete: "${legacyResult.concept.phrase}" in ${legacyResult.concept.niche}`);

  // STEP 2: Fetch style context from database
  const styleContext = await getOrResearchStyleContext(legacyResult.concept.niche);
  console.log(`[Autopilot-V2] Style context: ${styleContext.dominantTypography || 'default'}`);

  // STEP 3: Fill design form using GPT-4.1-nano
  const formFillerResult = await fillDesignForm({
    trendData: {
      phrase: legacyResult.concept.phrase,
      topic: legacyResult.trend.topic,
      niche: legacyResult.concept.niche,
      audienceProfile: legacyResult.trend.audienceProfile,
      visualStyle: legacyResult.trend.visualStyle,
      sentiment: legacyResult.trend.sentiment,
      designText: legacyResult.trend.designText,
      keywords: legacyResult.trend.keywords,
    },
    styleContext,
    riskLevel,
  });

  console.log(`[Autopilot-V2] Form filled: text="${formFillerResult.form.exactText}", style="${formFillerResult.form.style}"`);

  // STEP 4: Build simple prompt from form
  const imagePrompt = buildSimplePrompt(formFillerResult.form);
  console.log(`[Autopilot-V2] Simple prompt (${imagePrompt.split(' ').length} words): ${imagePrompt}`);

  return {
    designForm: formFillerResult.form,
    imagePrompt,
    trend: legacyResult.trend,
    source: `Form-Based (${legacyResult.source})`,
    formFillerResult,
    concept: legacyResult.concept,
  };
}

/**
 * Build a model-specific prompt from a form
 *
 * @param form - The filled design form
 * @param model - Target image model
 * @returns Model-optimized prompt string
 */
export function buildPromptForModel(
  form: DesignForm,
  model: 'gemini' | 'gpt-image-1' | 'ideogram' | 'dalle3'
): string {
  return buildModelSpecificPrompt(form, model);
}
