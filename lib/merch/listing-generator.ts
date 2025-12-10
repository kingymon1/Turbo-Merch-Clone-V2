/**
 * Listing Generator for Merch Design Generator
 *
 * Generates Amazon-optimized listings using the existing Gemini service.
 * This module provides a simplified interface for the merch generator feature.
 *
 * Phase 7A Enhancement: Now integrates marketplace intelligence to inject
 * proven keywords from successful MBA products into listing generation.
 */

import { TrendData, GeneratedListing } from '@/types';
import { generateListing as geminiGenerateListing } from '@/services/geminiService';
import {
  getOptimizedKeywordsForNiche,
  OptimizedKeywords,
  isDatabaseConfigured,
} from '@/services/marketplaceLearning';

export interface ListingResult {
  title: string;
  bullets: string[];
  description: string;
  keywords?: string[];
  brand?: string;
  // Phase 7A: Track marketplace data usage
  marketplaceEnhanced?: boolean;
  marketplaceConfidence?: number;
}

/**
 * Generate an Amazon-optimized listing for a merch design
 *
 * Phase 7A: Now queries marketplace intelligence to enhance listings with
 * proven keywords from successful MBA products.
 *
 * @param phrase - The main phrase/text on the design
 * @param niche - Target audience/niche
 * @param tone - Tone of the design (funny, inspirational, etc.)
 * @param style - Visual style of the design
 * @returns Listing with title, bullets, and description
 */
export async function generateMerchListing(
  phrase: string,
  niche: string,
  tone?: string,
  style?: string
): Promise<ListingResult> {
  // Phase 7A: Try to get marketplace intelligence for this niche
  let marketplaceData: OptimizedKeywords | null = null;
  let marketplaceEnhanced = false;

  try {
    const dbConfigured = await isDatabaseConfigured();
    if (dbConfigured) {
      marketplaceData = await getOptimizedKeywordsForNiche(niche);
      if (marketplaceData && marketplaceData.confidence >= 30) {
        marketplaceEnhanced = true;
        console.log(`[ListingGenerator] Using marketplace data for "${niche}" (confidence: ${marketplaceData.confidence}%)`);
      }
    }
  } catch (error) {
    console.log('[ListingGenerator] Marketplace lookup failed, using standard generation:', error);
  }

  // Build enhanced keywords list from marketplace data + defaults
  const enhancedKeywords = buildEnhancedKeywords(phrase, niche, tone, marketplaceData);

  // Build customer phrases with marketplace insights
  const customerPhrases = buildCustomerPhrases(phrase, niche, tone, marketplaceData);

  // Create a TrendData object enhanced with marketplace intelligence
  const trendData: TrendData = {
    topic: phrase,
    platform: 'Merch Generator',
    volume: marketplaceEnhanced ? 'Marketplace-Validated' : 'Generated',
    sentiment: tone || 'Funny',
    keywords: enhancedKeywords,
    description: buildDescription(phrase, niche, marketplaceData),
    visualStyle: style || 'Bold modern typography with clean design',
    typographyStyle: style || 'Bold sans-serif',
    designText: phrase,
    customerPhrases,
    audienceProfile: niche,
    // Phase 7A: Add marketplace context for AI
    marketplaceContext: marketplaceEnhanced
      ? buildMarketplaceContextForAI(marketplaceData!)
      : undefined,
  };

  try {
    // Use the existing, battle-tested Gemini listing generator
    const listing: GeneratedListing = await geminiGenerateListing(trendData);

    // Enhance bullets with marketplace insights if available
    const bullets = buildEnhancedBullets(listing, niche, tone, marketplaceData);

    return {
      title: listing.title,
      bullets,
      description: listing.description,
      keywords: enhanceKeywordsWithMarketplace(listing.keywords || [], marketplaceData),
      brand: listing.brand,
      marketplaceEnhanced,
      marketplaceConfidence: marketplaceData?.confidence,
    };
  } catch (error) {
    console.error('[ListingGenerator] Error generating listing:', error);

    // Fallback to a basic listing if Gemini fails
    return {
      ...generateFallbackListing(phrase, niche, tone),
      marketplaceEnhanced: false,
    };
  }
}

/**
 * Build enhanced keywords list combining phrase, niche, and marketplace data
 */
function buildEnhancedKeywords(
  phrase: string,
  niche: string,
  tone: string | undefined,
  marketplaceData: OptimizedKeywords | null
): string[] {
  // Start with basic keywords
  const baseKeywords = [phrase, niche, tone || 'funny', 'gift', 'shirt'].filter(Boolean) as string[];

  if (!marketplaceData) {
    return baseKeywords;
  }

  // Inject proven primary keywords (limit to avoid over-stuffing)
  const provenKeywords = marketplaceData.primaryKeywords.slice(0, 8);

  // Add high-value long-tail phrases
  const longTailPhrases = marketplaceData.longTailPhrases.slice(0, 4);

  // Combine: base + proven + long-tail, removing duplicates
  const combined = [...new Set([
    ...baseKeywords,
    ...provenKeywords,
    ...longTailPhrases,
  ])];

  return combined.slice(0, 20); // Cap at 20 keywords
}

/**
 * Build customer phrases enhanced with marketplace insights
 */
function buildCustomerPhrases(
  phrase: string,
  niche: string,
  tone: string | undefined,
  marketplaceData: OptimizedKeywords | null
): string[] {
  const basePhrases = [
    `Perfect for ${niche}`,
    `Great ${tone || 'funny'} gift`,
    `Love this ${phrase} design`,
  ];

  if (!marketplaceData) {
    return basePhrases;
  }

  // Add marketplace-informed phrases based on common tones
  const additionalPhrases: string[] = [];

  if (marketplaceData.mbaInsights.commonTones.includes('gift-focused')) {
    additionalPhrases.push(`Perfect gift for ${niche} lovers`);
    additionalPhrases.push('Makes a great birthday or holiday present');
  }

  if (marketplaceData.mbaInsights.commonTones.includes('funny')) {
    additionalPhrases.push('Gets laughs every time I wear it');
    additionalPhrases.push('Everyone asks where I got this shirt');
  }

  return [...basePhrases, ...additionalPhrases].slice(0, 6);
}

/**
 * Build description with marketplace context
 */
function buildDescription(
  phrase: string,
  niche: string,
  marketplaceData: OptimizedKeywords | null
): string {
  if (!marketplaceData) {
    return `${phrase} design for ${niche}`;
  }

  // Include some proven keywords in description
  const topKeywords = marketplaceData.primaryKeywords.slice(0, 3).join(', ');
  return `${phrase} design for ${niche}. Popular keywords: ${topKeywords}`;
}

/**
 * Build marketplace context string for AI consumption
 */
function buildMarketplaceContextForAI(marketplaceData: OptimizedKeywords): string {
  const sections: string[] = [
    '=== MARKETPLACE INTELLIGENCE ===',
    `Niche: ${marketplaceData.niche}`,
    `Saturation: ${marketplaceData.saturation}`,
    `Entry Recommendation: ${marketplaceData.entryRecommendation}`,
    `Confidence: ${marketplaceData.confidence}%`,
    '',
    'PROVEN KEYWORDS (use these in title/bullets):',
    marketplaceData.primaryKeywords.slice(0, 10).join(', '),
    '',
    'LONG-TAIL PHRASES (high-value):',
    marketplaceData.longTailPhrases.slice(0, 5).join(', '),
  ];

  if (marketplaceData.titlePatterns.length > 0) {
    sections.push('', 'SUCCESSFUL TITLE EXAMPLES:');
    marketplaceData.titlePatterns.slice(0, 3).forEach((title, i) => {
      sections.push(`${i + 1}. "${title.slice(0, 80)}..."`);
    });
  }

  sections.push('', 'Use these patterns as guidance but create original content.');

  return sections.join('\n');
}

/**
 * Build enhanced bullets with marketplace insights
 */
function buildEnhancedBullets(
  listing: GeneratedListing,
  niche: string,
  tone: string | undefined,
  marketplaceData: OptimizedKeywords | null
): string[] {
  const bullets: string[] = [
    listing.bullet1,
    listing.bullet2,
  ];

  // Add more bullet points
  if (marketplaceData && marketplaceData.mbaInsights.commonTones.includes('gift-focused')) {
    bullets.push(`Makes the perfect gift for ${niche} - for birthdays, holidays, or just because`);
  } else {
    bullets.push(`Perfect gift for ${niche} who appreciate ${tone || 'humor'}`);
  }

  bullets.push('Premium quality fabric for maximum comfort');
  bullets.push('Vibrant print that lasts wash after wash');

  return bullets;
}

/**
 * Enhance final keywords with marketplace data
 */
function enhanceKeywordsWithMarketplace(
  baseKeywords: string[],
  marketplaceData: OptimizedKeywords | null
): string[] {
  if (!marketplaceData) {
    return baseKeywords;
  }

  // Inject proven keywords that aren't already present
  const existingSet = new Set(baseKeywords.map(k => k.toLowerCase()));
  const newKeywords: string[] = [];

  for (const keyword of marketplaceData.primaryKeywords.slice(0, 5)) {
    if (!existingSet.has(keyword.toLowerCase())) {
      newKeywords.push(keyword);
    }
  }

  return [...baseKeywords, ...newKeywords].slice(0, 15);
}

/**
 * Generate a fallback listing when AI generation fails
 */
function generateFallbackListing(phrase: string, niche: string, tone?: string): ListingResult {
  const capitalizedNiche = niche.charAt(0).toUpperCase() + niche.slice(1);
  const toneDesc = tone || 'Funny';

  return {
    title: `${phrase} - ${toneDesc} ${capitalizedNiche} Gift - Premium Shirt`,
    bullets: [
      `Perfect gift for ${niche} who appreciate ${toneDesc.toLowerCase()} designs. Show off your personality with this "${phrase}" shirt that speaks to your community.`,
      `Premium quality fabric ensures all-day comfort. Vibrant, long-lasting print that won't fade or crack after washing.`,
      `Great for birthdays, holidays, or just because. Makes an unforgettable gift for the ${niche} in your life.`,
      `Available in multiple sizes to ensure the perfect fit. Check our size chart for detailed measurements.`,
      `Designed with care for those who get it. Join thousands of happy customers who love our unique designs.`,
    ],
    description: `Looking for the perfect gift for ${niche}? This "${phrase}" shirt is exactly what you need! Our premium quality tee features a ${toneDesc.toLowerCase()} design that's sure to get laughs and compliments. Whether it's for a birthday, holiday, or just because, this shirt makes the perfect present. The high-quality print is made to last through countless washes while maintaining its vibrant colors. Order now and make someone smile!`,
    keywords: [phrase, niche, toneDesc.toLowerCase(), 'gift', 'shirt', 'tee', 'funny', 'present', 'birthday', 'holiday'],
  };
}

/**
 * Optimize an existing listing title for Amazon search
 * Ensures title is within character limits and keyword-rich
 */
export function optimizeTitle(title: string, maxLength: number = 160): string {
  if (title.length <= maxLength) {
    return title;
  }

  // Truncate at last complete word before limit
  const truncated = title.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  return lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
}
