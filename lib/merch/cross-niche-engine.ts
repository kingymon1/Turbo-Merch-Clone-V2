/**
 * Cross-Niche Engine
 *
 * Detects and validates opportunities at the intersection of two niches.
 * Examples: "fishing + coffee", "nurse + dog mom", "teacher + wine"
 *
 * These combinations often represent untapped markets because:
 * 1. Each niche has its own audience
 * 2. The intersection is smaller but highly passionate
 * 3. Less competition than pure single-niche designs
 *
 * ARCHITECTURE:
 * 1. AI synthesizes potential combinations based on audience overlap
 * 2. Amazon validation checks if the combination exists and its saturation
 * 3. Style blending creates design guidance from both niche profiles
 * 4. Opportunities are scored and stored for use during generation
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { getNicheStyleProfile } from './style-discovery';
import { fetchAmazonAutocomplete } from '@/services/marketplaceIntelligence';
import { NicheStyleProfile } from './types';

// Initialize Anthropic client
const getAnthropicClient = (): Anthropic => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }
  return new Anthropic({ apiKey });
};

/**
 * Result of validating a cross-niche opportunity against Amazon
 */
interface AmazonValidationResult {
  combinedQuery: string;
  productCount: number;
  autocompleteResults: string[];
  saturationLevel: 'low' | 'medium' | 'high' | 'oversaturated';
  existingExamples: string[];
  marketGap: string;
}

/**
 * Suggested design concept for a cross-niche opportunity
 */
interface CrossNicheDesignSuggestion {
  phrase: string;
  style: string;
  tone: string;
  visualDirection: string;
  styleBlendRatio: string;
}

/**
 * Full cross-niche opportunity assessment
 */
interface CrossNicheOpportunityAssessment {
  primaryNiche: string;
  secondaryNiche: string;
  combinedQuery: string;

  // Amazon validation
  validation: AmazonValidationResult;

  // Opportunity scoring
  opportunityScore: number;      // 0-100
  recommendation: 'strong_enter' | 'enter' | 'caution' | 'avoid';
  confidenceLevel: number;       // 0-1

  // Why this works
  audienceOverlap: string;
  emotionalHook: string;
  uniqueAngle: string;

  // Design guidance
  suggestedPhrases: string[];
  suggestedStyles: string[];
  styleBlendRatio: string;
  colorRecommendation: string;
  toneRecommendation: string;
}

/**
 * Detect potential cross-niche opportunities using AI
 */
export async function detectCrossNicheOpportunities(
  baseNiche: string,
  options: {
    maxOpportunities?: number;
    useExistingProfiles?: boolean;
  } = {}
): Promise<CrossNicheOpportunityAssessment[]> {
  const { maxOpportunities = 5, useExistingProfiles = true } = options;

  console.log(`[CrossNiche] Detecting opportunities for: "${baseNiche}"`);

  try {
    const client = getAnthropicClient();

    // Get potential secondary niches from AI
    const potentialPairs = await generatePotentialPairs(client, baseNiche, maxOpportunities * 2);

    if (potentialPairs.length === 0) {
      console.log(`[CrossNiche] No potential pairs found for "${baseNiche}"`);
      return [];
    }

    console.log(`[CrossNiche] Found ${potentialPairs.length} potential pairs, validating...`);

    // Validate and assess each pair
    const assessments: CrossNicheOpportunityAssessment[] = [];

    for (const pair of potentialPairs) {
      if (assessments.length >= maxOpportunities) break;

      try {
        const assessment = await assessCrossNicheOpportunity(
          baseNiche,
          pair.secondaryNiche,
          pair.reasoning,
          useExistingProfiles
        );

        if (assessment && assessment.opportunityScore >= 30) {
          assessments.push(assessment);

          // Store in database
          await storeCrossNicheOpportunity(assessment);
        }
      } catch (error) {
        console.error(`[CrossNiche] Error assessing ${baseNiche} + ${pair.secondaryNiche}:`, error);
      }
    }

    console.log(`[CrossNiche] Found ${assessments.length} viable opportunities for "${baseNiche}"`);
    return assessments;

  } catch (error) {
    console.error(`[CrossNiche] Error detecting opportunities:`, error);
    return [];
  }
}

/**
 * Generate potential niche pairs using AI
 */
async function generatePotentialPairs(
  client: Anthropic,
  baseNiche: string,
  count: number
): Promise<Array<{ secondaryNiche: string; reasoning: string }>> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are a market research expert for t-shirt designs. For the niche "${baseNiche}", suggest ${count} other niches that could be combined with it to create unique cross-niche t-shirt designs.

Consider:
- Shared values or lifestyles (e.g., "nurse" + "coffee" = both involve long hours)
- Complementary hobbies (e.g., "fishing" + "camping")
- Identity combinations (e.g., "teacher" + "dog mom")
- Unexpected but relatable combos (e.g., "accountant" + "adventure")

Return ONLY valid JSON array:
[
  {
    "secondaryNiche": "niche name",
    "reasoning": "why this combination works for the audience"
  }
]

Focus on combinations that:
1. Feel authentic (not forced)
2. Have passionate audiences for BOTH niches
3. Could create funny, heartfelt, or proud slogans
4. Aren't already oversaturated`
    }]
  });

  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') return [];

  const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

/**
 * Assess a specific cross-niche opportunity
 */
async function assessCrossNicheOpportunity(
  primaryNiche: string,
  secondaryNiche: string,
  initialReasoning: string,
  useExistingProfiles: boolean
): Promise<CrossNicheOpportunityAssessment | null> {
  console.log(`[CrossNiche] Assessing: ${primaryNiche} + ${secondaryNiche}`);

  // Step 1: Validate against Amazon
  const validation = await validateAgainstAmazon(primaryNiche, secondaryNiche);

  if (validation.saturationLevel === 'oversaturated') {
    console.log(`[CrossNiche] Skipping ${primaryNiche} + ${secondaryNiche}: oversaturated`);
    return null;
  }

  // Step 2: Get style profiles if available
  let primaryStyle: NicheStyleProfile | null = null;
  let secondaryStyle: NicheStyleProfile | null = null;

  if (useExistingProfiles) {
    [primaryStyle, secondaryStyle] = await Promise.all([
      getNicheStyleProfile(primaryNiche),
      getNicheStyleProfile(secondaryNiche)
    ]);
  }

  // Step 3: Generate design suggestions using AI
  const client = getAnthropicClient();
  const suggestions = await generateDesignSuggestions(
    client,
    primaryNiche,
    secondaryNiche,
    primaryStyle,
    secondaryStyle,
    initialReasoning
  );

  // Step 4: Calculate opportunity score
  const opportunityScore = calculateOpportunityScore(validation, suggestions);
  const recommendation = getRecommendation(opportunityScore, validation.saturationLevel);

  return {
    primaryNiche,
    secondaryNiche,
    combinedQuery: validation.combinedQuery,
    validation,
    opportunityScore,
    recommendation,
    confidenceLevel: calculateConfidence(validation, primaryStyle, secondaryStyle),
    audienceOverlap: suggestions.audienceOverlap,
    emotionalHook: suggestions.emotionalHook,
    uniqueAngle: suggestions.uniqueAngle,
    suggestedPhrases: suggestions.phrases,
    suggestedStyles: suggestions.styles,
    styleBlendRatio: suggestions.styleBlendRatio,
    colorRecommendation: suggestions.colorRecommendation,
    toneRecommendation: suggestions.toneRecommendation
  };
}

/**
 * Validate cross-niche opportunity against Amazon data
 */
async function validateAgainstAmazon(
  primaryNiche: string,
  secondaryNiche: string
): Promise<AmazonValidationResult> {
  // Build combined search queries
  const queries = [
    `${primaryNiche} ${secondaryNiche} shirt`,
    `${primaryNiche} ${secondaryNiche} t-shirt`,
    `${primaryNiche} lover ${secondaryNiche} shirt`
  ];

  // Check autocomplete for each query
  const autocompleteResults: string[] = [];
  for (const query of queries.slice(0, 2)) {
    const results = await fetchAmazonAutocomplete(query);
    autocompleteResults.push(...results.slice(0, 3));
  }

  // Check existing products in database
  const existingProducts = await prisma.marketplaceProduct.findMany({
    where: {
      AND: [
        {
          OR: [
            { title: { contains: primaryNiche, mode: 'insensitive' } },
            { niche: { contains: primaryNiche, mode: 'insensitive' } }
          ]
        },
        {
          OR: [
            { title: { contains: secondaryNiche, mode: 'insensitive' } },
            { niche: { contains: secondaryNiche, mode: 'insensitive' } }
          ]
        }
      ],
      isMerchByAmazon: true
    },
    take: 20,
    select: {
      title: true,
      reviewCount: true,
      salesRank: true
    }
  });

  const productCount = existingProducts.length;

  // Calculate saturation level
  let saturationLevel: 'low' | 'medium' | 'high' | 'oversaturated';
  if (productCount <= 3) {
    saturationLevel = 'low';
  } else if (productCount <= 10) {
    saturationLevel = 'medium';
  } else if (productCount <= 30) {
    saturationLevel = 'high';
  } else {
    saturationLevel = 'oversaturated';
  }

  // Extract example titles
  const existingExamples = existingProducts
    .slice(0, 5)
    .map(p => p.title);

  // Determine market gap
  let marketGap = 'Unknown';
  if (productCount === 0) {
    marketGap = 'Blue ocean - no direct competition found';
  } else if (productCount <= 3) {
    marketGap = 'Early mover advantage - minimal competition';
  } else if (productCount <= 10) {
    marketGap = 'Room for differentiation with unique angle';
  } else {
    marketGap = 'Competitive - need strong unique selling proposition';
  }

  return {
    combinedQuery: `${primaryNiche} ${secondaryNiche} shirt`,
    productCount,
    autocompleteResults: [...new Set(autocompleteResults)],
    saturationLevel,
    existingExamples,
    marketGap
  };
}

/**
 * Generate design suggestions for cross-niche opportunity
 */
async function generateDesignSuggestions(
  client: Anthropic,
  primaryNiche: string,
  secondaryNiche: string,
  primaryStyle: NicheStyleProfile | null,
  secondaryStyle: NicheStyleProfile | null,
  initialReasoning: string
): Promise<{
  audienceOverlap: string;
  emotionalHook: string;
  uniqueAngle: string;
  phrases: string[];
  styles: string[];
  styleBlendRatio: string;
  colorRecommendation: string;
  toneRecommendation: string;
}> {
  // Build context from style profiles
  let styleContext = '';
  if (primaryStyle) {
    styleContext += `\n${primaryNiche} style profile:
- Typography: ${primaryStyle.dominantTypography.primary}
- Colors: ${primaryStyle.colorPalette.primary.join(', ')}
- Aesthetic: ${primaryStyle.moodAesthetic.primary}`;
  }
  if (secondaryStyle) {
    styleContext += `\n${secondaryNiche} style profile:
- Typography: ${secondaryStyle.dominantTypography.primary}
- Colors: ${secondaryStyle.colorPalette.primary.join(', ')}
- Aesthetic: ${secondaryStyle.moodAesthetic.primary}`;
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `You are a t-shirt design strategist creating cross-niche designs.

NICHES TO COMBINE:
- Primary: ${primaryNiche}
- Secondary: ${secondaryNiche}

INITIAL REASONING: ${initialReasoning}
${styleContext}

Create design suggestions that authentically appeal to people who identify with BOTH niches.

Return ONLY valid JSON:
{
  "audienceOverlap": "Description of who buys these designs (be specific about demographics/psychographics)",
  "emotionalHook": "Why this combination resonates emotionally",
  "uniqueAngle": "What makes this combination special vs single-niche designs",
  "phrases": [
    "5-7 catchy t-shirt phrases that blend both niches naturally"
  ],
  "styles": [
    "2-3 design style recommendations"
  ],
  "styleBlendRatio": "How to blend both niche aesthetics (e.g., '70% ${primaryNiche} rugged, 30% ${secondaryNiche} cozy')",
  "colorRecommendation": "Specific color approach that works for this fusion",
  "toneRecommendation": "The ideal tone (funny, heartfelt, proud, sarcastic, etc.)"
}

IMPORTANT:
- Phrases should feel natural, not forced
- Honor what works in BOTH niches
- Consider the emotional journey of someone who identifies with both`
    }]
  });

  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    return getDefaultSuggestions(primaryNiche, secondaryNiche);
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return getDefaultSuggestions(primaryNiche, secondaryNiche);
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return getDefaultSuggestions(primaryNiche, secondaryNiche);
  }
}

/**
 * Default suggestions if AI fails
 */
function getDefaultSuggestions(primaryNiche: string, secondaryNiche: string) {
  return {
    audienceOverlap: `People passionate about both ${primaryNiche} and ${secondaryNiche}`,
    emotionalHook: 'Identity expression through niche combination',
    uniqueAngle: 'Unique combination targeting specific lifestyle intersection',
    phrases: [
      `${primaryNiche.charAt(0).toUpperCase() + primaryNiche.slice(1)} by Day, ${secondaryNiche.charAt(0).toUpperCase() + secondaryNiche.slice(1)} by Heart`
    ],
    styles: ['Bold Modern', 'Vintage Retro'],
    styleBlendRatio: `50% ${primaryNiche}, 50% ${secondaryNiche}`,
    colorRecommendation: 'Versatile neutrals that work for both niches',
    toneRecommendation: 'Funny'
  };
}

/**
 * Calculate opportunity score
 */
function calculateOpportunityScore(
  validation: AmazonValidationResult,
  suggestions: { phrases: string[]; audienceOverlap: string }
): number {
  let score = 50; // Base score

  // Saturation level impact
  switch (validation.saturationLevel) {
    case 'low':
      score += 30;
      break;
    case 'medium':
      score += 15;
      break;
    case 'high':
      score -= 10;
      break;
    case 'oversaturated':
      score -= 30;
      break;
  }

  // Autocomplete presence (market demand signal)
  if (validation.autocompleteResults.length > 0) {
    score += Math.min(validation.autocompleteResults.length * 3, 15);
  }

  // Phrase quality (more = better understood combination)
  if (suggestions.phrases.length >= 5) {
    score += 10;
  } else if (suggestions.phrases.length >= 3) {
    score += 5;
  }

  // Audience clarity
  if (suggestions.audienceOverlap.length > 50) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Get recommendation based on score and saturation
 */
function getRecommendation(
  score: number,
  saturation: 'low' | 'medium' | 'high' | 'oversaturated'
): 'strong_enter' | 'enter' | 'caution' | 'avoid' {
  if (saturation === 'oversaturated') return 'avoid';
  if (score >= 75 && saturation === 'low') return 'strong_enter';
  if (score >= 60) return 'enter';
  if (score >= 40) return 'caution';
  return 'avoid';
}

/**
 * Calculate confidence level
 */
function calculateConfidence(
  validation: AmazonValidationResult,
  primaryStyle: NicheStyleProfile | null,
  secondaryStyle: NicheStyleProfile | null
): number {
  let confidence = 0.5; // Base

  // Amazon data quality
  if (validation.autocompleteResults.length > 0) confidence += 0.1;
  if (validation.productCount > 0) confidence += 0.1;

  // Style profile availability
  if (primaryStyle) confidence += 0.15;
  if (secondaryStyle) confidence += 0.15;

  return Math.min(confidence, 1);
}

/**
 * Store cross-niche opportunity in database
 */
async function storeCrossNicheOpportunity(
  assessment: CrossNicheOpportunityAssessment
): Promise<void> {
  await prisma.crossNicheOpportunity.upsert({
    where: {
      primaryNiche_secondaryNiche: {
        primaryNiche: assessment.primaryNiche,
        secondaryNiche: assessment.secondaryNiche
      }
    },
    update: {
      combinedQuery: assessment.combinedQuery,
      productCount: assessment.validation.productCount,
      avgBsr: null, // Could be calculated from validation
      avgReviewCount: null,
      marketGap: assessment.validation.marketGap,
      opportunityScore: assessment.opportunityScore,
      saturationLevel: assessment.validation.saturationLevel,
      recommendation: assessment.recommendation,
      confidenceLevel: assessment.confidenceLevel,
      audienceOverlap: assessment.audienceOverlap,
      emotionalHook: assessment.emotionalHook,
      uniqueAngle: assessment.uniqueAngle,
      suggestedPhrases: assessment.suggestedPhrases,
      suggestedStyles: assessment.suggestedStyles,
      recommendedStyle: assessment.suggestedStyles[0] || null,
      styleBlendRatio: assessment.styleBlendRatio,
      colorRecommendation: assessment.colorRecommendation,
      toneRecommendation: assessment.toneRecommendation,
      validationCount: { increment: 1 },
      lastValidatedAt: new Date(),
      validationHistory: undefined, // Could append to array
      isActive: assessment.recommendation !== 'avoid'
    },
    create: {
      primaryNiche: assessment.primaryNiche,
      secondaryNiche: assessment.secondaryNiche,
      combinedQuery: assessment.combinedQuery,
      discoveryMethod: 'ai-synthesis',
      productCount: assessment.validation.productCount,
      marketGap: assessment.validation.marketGap,
      opportunityScore: assessment.opportunityScore,
      saturationLevel: assessment.validation.saturationLevel,
      recommendation: assessment.recommendation,
      confidenceLevel: assessment.confidenceLevel,
      audienceOverlap: assessment.audienceOverlap,
      emotionalHook: assessment.emotionalHook,
      uniqueAngle: assessment.uniqueAngle,
      suggestedPhrases: assessment.suggestedPhrases,
      suggestedStyles: assessment.suggestedStyles,
      recommendedStyle: assessment.suggestedStyles[0] || null,
      styleBlendRatio: assessment.styleBlendRatio,
      colorRecommendation: assessment.colorRecommendation,
      toneRecommendation: assessment.toneRecommendation,
      isActive: assessment.recommendation !== 'avoid'
    }
  });

  console.log(`[CrossNiche] Stored opportunity: ${assessment.primaryNiche} + ${assessment.secondaryNiche}`);
}

/**
 * Get stored cross-niche opportunities for a niche
 */
export async function getCrossNicheOpportunities(
  niche: string,
  options: {
    minScore?: number;
    recommendations?: Array<'strong_enter' | 'enter' | 'caution'>;
    limit?: number;
  } = {}
): Promise<Array<{
  primaryNiche: string;
  secondaryNiche: string;
  opportunityScore: number;
  recommendation: string;
  suggestedPhrases: string[];
  styleBlendRatio: string | null;
}>> {
  const {
    minScore = 40,
    recommendations = ['strong_enter', 'enter'],
    limit = 10
  } = options;

  const opportunities = await prisma.crossNicheOpportunity.findMany({
    where: {
      OR: [
        { primaryNiche: { equals: niche, mode: 'insensitive' } },
        { secondaryNiche: { equals: niche, mode: 'insensitive' } }
      ],
      opportunityScore: { gte: minScore },
      recommendation: { in: recommendations },
      isActive: true
    },
    orderBy: { opportunityScore: 'desc' },
    take: limit,
    select: {
      primaryNiche: true,
      secondaryNiche: true,
      opportunityScore: true,
      recommendation: true,
      suggestedPhrases: true,
      styleBlendRatio: true
    }
  });

  return opportunities.map(o => ({
    ...o,
    opportunityScore: o.opportunityScore
  }));
}

/**
 * Get all niches that could benefit from cross-niche scanning
 */
export async function getNichesForCrossNicheScanning(
  options: {
    minMbaProducts?: number;
    excludeRecentlyScanned?: boolean;
    recentHours?: number;
    limit?: number;
  } = {}
): Promise<string[]> {
  const {
    minMbaProducts = 10,
    excludeRecentlyScanned = true,
    recentHours = 168, // 1 week
    limit = 20
  } = options;

  // Get niches with enough MBA products
  const nicheData = await prisma.nicheMarketData.findMany({
    where: {
      mbaProducts: { gte: minMbaProducts }
    },
    orderBy: { mbaProducts: 'desc' },
    take: limit * 2,
    select: { niche: true }
  });

  const allNiches = nicheData.map(n => n.niche);

  if (!excludeRecentlyScanned) {
    return allNiches.slice(0, limit);
  }

  // Exclude niches recently scanned
  const cutoffDate = new Date(Date.now() - recentHours * 60 * 60 * 1000);

  const recentlyScanned = await prisma.crossNicheOpportunity.findMany({
    where: {
      primaryNiche: { in: allNiches },
      lastValidatedAt: { gte: cutoffDate }
    },
    distinct: ['primaryNiche'],
    select: { primaryNiche: true }
  });

  const recentNiches = new Set(recentlyScanned.map(r => r.primaryNiche));

  return allNiches.filter(n => !recentNiches.has(n)).slice(0, limit);
}

/**
 * Scan multiple niches for cross-niche opportunities
 */
export async function scanNichesForOpportunities(
  niches: string[],
  options: {
    maxOpportunitiesPerNiche?: number;
    concurrency?: number;
  } = {}
): Promise<Map<string, CrossNicheOpportunityAssessment[]>> {
  const { maxOpportunitiesPerNiche = 3, concurrency = 2 } = options;
  const results = new Map<string, CrossNicheOpportunityAssessment[]>();

  // Process in batches
  for (let i = 0; i < niches.length; i += concurrency) {
    const batch = niches.slice(i, i + concurrency);

    const batchPromises = batch.map(async niche => {
      const opportunities = await detectCrossNicheOpportunities(niche, {
        maxOpportunities: maxOpportunitiesPerNiche
      });
      return { niche, opportunities };
    });

    const batchResults = await Promise.all(batchPromises);
    for (const { niche, opportunities } of batchResults) {
      results.set(niche, opportunities);
    }

    // Delay between batches
    if (i + concurrency < niches.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return results;
}

// Export for cron job use
export default {
  detectCrossNicheOpportunities,
  getCrossNicheOpportunities,
  getNichesForCrossNicheScanning,
  scanNichesForOpportunities
};
