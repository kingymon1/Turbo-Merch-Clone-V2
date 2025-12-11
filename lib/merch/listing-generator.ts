/**
 * Listing Generator for Merch Design Generator
 *
 * Generates Amazon-optimized listings using the existing Gemini service.
 * This module provides a simplified interface for the merch generator feature.
 *
 * Phase 7A Enhancement: Now integrates marketplace intelligence to inject
 * proven keywords from successful MBA products into listing generation.
 *
 * WORLD-CLASS UPDATE: Now uses multi-source keyword intelligence including:
 * - Amazon autocomplete suggestions (what customers actually search)
 * - Competitor title analysis (winning patterns from top BSR products)
 * - Customer language from reviews (actual words customers use)
 * - Long-tail keyword extraction
 *
 * NOTE: Phase 7B validation removed - was stripping too many useful words.
 * Will be re-added later in revised format.
 */

import { TrendData, GeneratedListing } from '@/types';
import { generateListing as geminiGenerateListing } from '@/services/geminiService';
import {
  getOptimizedKeywordsForNiche,
  OptimizedKeywords,
  isDatabaseConfigured,
} from '@/services/marketplaceLearning';
import { scrapeNicheOnDemand } from '@/services/marketplaceBootstrap';
import {
  buildKeywordIntelligence,
  KeywordIntelligence,
  isApiConfigured as isMarketplaceApiConfigured,
} from '@/services/marketplaceIntelligence';
// NOTE: Validation import removed - will be re-added later
// import {
//   validateMerchListing,
//   type MerchValidationResult,
// } from './validation';

export interface ListingResult {
  title: string;
  bullets: string[];
  description: string;
  keywords?: string[];
  brand?: string;
  // Phase 7A: Track marketplace data usage
  marketplaceEnhanced?: boolean;
  marketplaceConfidence?: number;
  // NOTE: Phase 7B validation property removed - will be re-added later
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
  // Now with auto-scraping: if niche not in database, scrape it on-demand
  let marketplaceData: OptimizedKeywords | null = null;
  let marketplaceEnhanced = false;

  try {
    const dbConfigured = await isDatabaseConfigured();
    if (dbConfigured) {
      // First try to get existing data
      marketplaceData = await getOptimizedKeywordsForNiche(niche);

      if (marketplaceData && marketplaceData.confidence >= 30) {
        marketplaceEnhanced = true;
        console.log(`[ListingGenerator] Using marketplace data for "${niche}" (confidence: ${marketplaceData.confidence}%)`);
      } else {
        // AUTO-SCRAPE: No good data exists, try to scrape this niche on-demand
        console.log(`[ListingGenerator] No marketplace data for "${niche}", triggering auto-scrape...`);

        const scrapeResult = await scrapeNicheOnDemand(niche);

        if (scrapeResult.success && !scrapeResult.alreadyHadData) {
          console.log(`[ListingGenerator] Auto-scraped ${scrapeResult.productsAdded} products, confidence: ${scrapeResult.confidence}%`);

          // Re-fetch the data now that we've scraped
          if (scrapeResult.confidence >= 30) {
            marketplaceData = await getOptimizedKeywordsForNiche(niche);
            if (marketplaceData) {
              marketplaceEnhanced = true;
              console.log(`[ListingGenerator] Marketplace data now available after auto-scrape`);
            }
          }
        } else if (scrapeResult.error) {
          console.log(`[ListingGenerator] Auto-scrape failed: ${scrapeResult.error}`);
        }
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

    // NOTE: Phase 7B validation removed - was stripping too many useful words
    // Will be re-added later in revised format
    return {
      title: listing.title,
      bullets: bullets.slice(0, 2), // Merch only uses 2 bullets
      description: listing.description,
      keywords: enhanceKeywordsWithMarketplace(listing.keywords || [], marketplaceData),
      brand: listing.brand || '',
      marketplaceEnhanced,
      marketplaceConfidence: marketplaceData?.confidence,
    };
  } catch (error) {
    console.error('[ListingGenerator] Error generating listing:', error);

    // Fallback to a basic listing if Gemini fails
    const fallback = generateFallbackListing(phrase, niche, tone);

    // NOTE: Validation removed - will be re-added later in revised format
    return {
      title: fallback.title,
      bullets: fallback.bullets.slice(0, 2),
      description: fallback.description,
      keywords: fallback.keywords,
      brand: '',
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

// ============================================================================
// WORLD-CLASS LISTING GENERATION WITH MULTI-SOURCE KEYWORD INTELLIGENCE
// ============================================================================

export interface EnhancedListingResult extends ListingResult {
  keywordIntelligence?: {
    autocompleteUsed: string[];
    competitorKeywordsUsed: string[];
    customerLanguageUsed: string[];
    titlePatternUsed?: string;
  };
}

/**
 * Generate a world-class listing using multi-source keyword intelligence
 *
 * This enhanced version:
 * 1. Fetches Amazon autocomplete suggestions (real customer searches)
 * 2. Analyzes competitor titles from top BSR products
 * 3. Extracts customer language from product reviews
 * 4. Applies learned title patterns from successful listings
 */
export async function generateEnhancedListing(
  phrase: string,
  niche: string,
  tone?: string,
  style?: string
): Promise<EnhancedListingResult> {
  console.log(`[ListingGenerator] Generating enhanced listing for "${phrase}" in ${niche}`);

  // Step 1: Build comprehensive keyword intelligence
  let keywordIntel: KeywordIntelligence | null = null;

  if (isMarketplaceApiConfigured()) {
    try {
      keywordIntel = await buildKeywordIntelligence(niche);
      console.log(`[ListingGenerator] Keyword intelligence gathered: ${keywordIntel.autocomplete.length} autocomplete, ${keywordIntel.competitorKeywords.length} competitor keywords`);
    } catch (error) {
      console.log('[ListingGenerator] Keyword intelligence failed, using fallback:', error);
    }
  }

  // Step 2: Also get the existing marketplace data
  let marketplaceData: OptimizedKeywords | null = null;
  let marketplaceEnhanced = false;

  try {
    const dbConfigured = await isDatabaseConfigured();
    if (dbConfigured) {
      marketplaceData = await getOptimizedKeywordsForNiche(niche);
      if (marketplaceData && marketplaceData.confidence >= 30) {
        marketplaceEnhanced = true;
      } else {
        // Auto-scrape if needed
        const scrapeResult = await scrapeNicheOnDemand(niche);
        if (scrapeResult.success && scrapeResult.confidence >= 30) {
          marketplaceData = await getOptimizedKeywordsForNiche(niche);
          if (marketplaceData) marketplaceEnhanced = true;
        }
      }
    }
  } catch (error) {
    console.log('[ListingGenerator] Marketplace lookup failed:', error);
  }

  // Step 3: Build super-enhanced keywords combining all sources
  const enhancedKeywords = buildSuperEnhancedKeywords(phrase, niche, tone, keywordIntel, marketplaceData);

  // Step 4: Build customer phrases from real review language
  const customerPhrases = buildRealCustomerPhrases(phrase, niche, tone, keywordIntel, marketplaceData);

  // Step 5: Build comprehensive context for AI
  const aiContext = buildComprehensiveContext(phrase, niche, keywordIntel, marketplaceData);

  // Step 6: Create trend data with all intelligence
  const trendData: TrendData = {
    topic: phrase,
    platform: 'Merch Generator - Enhanced',
    volume: marketplaceEnhanced || keywordIntel ? 'Intelligence-Driven' : 'Generated',
    sentiment: tone || 'Funny',
    keywords: enhancedKeywords,
    description: aiContext,
    visualStyle: style || 'Bold modern typography with clean design',
    typographyStyle: style || 'Bold sans-serif',
    designText: phrase,
    customerPhrases,
    audienceProfile: niche,
    marketplaceContext: aiContext,
  };

  try {
    // Generate the listing
    const listing: GeneratedListing = await geminiGenerateListing(trendData);

    // Track which intelligence sources were used
    const intelligenceUsed = {
      autocompleteUsed: keywordIntel?.autocomplete.slice(0, 5) || [],
      competitorKeywordsUsed: keywordIntel?.competitorKeywords.slice(0, 5) || [],
      customerLanguageUsed: keywordIntel?.customerLanguage.slice(0, 5) || [],
      titlePatternUsed: keywordIntel?.titlePatterns[0]?.pattern,
    };

    return {
      title: listing.title,
      bullets: [listing.bullet1, listing.bullet2].filter(Boolean),
      description: listing.description,
      keywords: enhancedKeywords,
      brand: listing.brand || '',
      marketplaceEnhanced,
      marketplaceConfidence: marketplaceData?.confidence,
      keywordIntelligence: intelligenceUsed,
    };

  } catch (error) {
    console.error('[ListingGenerator] Enhanced generation failed:', error);

    // Fallback to basic generation
    return generateFallbackListing(phrase, niche, tone);
  }
}

/**
 * Build super-enhanced keywords from all sources
 */
function buildSuperEnhancedKeywords(
  phrase: string,
  niche: string,
  tone: string | undefined,
  keywordIntel: KeywordIntelligence | null,
  marketplaceData: OptimizedKeywords | null
): string[] {
  const keywords = new Set<string>();

  // Base keywords
  keywords.add(phrase.toLowerCase());
  keywords.add(niche.toLowerCase());
  if (tone) keywords.add(tone.toLowerCase());
  keywords.add('shirt');
  keywords.add('gift');

  // Long-tail from phrase
  const phraseParts = phrase.toLowerCase().split(/\s+/);
  if (phraseParts.length >= 2) {
    keywords.add(`${phrase.toLowerCase()} shirt`);
    keywords.add(`${niche} ${phrase.toLowerCase()}`);
    keywords.add(`funny ${niche} shirt`);
  }

  // Add autocomplete suggestions (highest priority - real customer searches)
  if (keywordIntel?.autocomplete.length) {
    for (const suggestion of keywordIntel.autocomplete.slice(0, 8)) {
      keywords.add(suggestion.toLowerCase());
    }
  }

  // Add competitor keywords (proven to work)
  if (keywordIntel?.competitorKeywords.length) {
    for (const keyword of keywordIntel.competitorKeywords.slice(0, 10)) {
      keywords.add(keyword.toLowerCase());
    }
  }

  // Add long-tail phrases
  if (keywordIntel?.longTail.length) {
    for (const lt of keywordIntel.longTail.slice(0, 5)) {
      keywords.add(lt.toLowerCase());
    }
  }

  // Add marketplace primary keywords
  if (marketplaceData?.primaryKeywords.length) {
    for (const pk of marketplaceData.primaryKeywords.slice(0, 5)) {
      keywords.add(pk.toLowerCase());
    }
  }

  return Array.from(keywords).slice(0, 25);
}

/**
 * Build customer phrases from real review language
 */
function buildRealCustomerPhrases(
  phrase: string,
  niche: string,
  tone: string | undefined,
  keywordIntel: KeywordIntelligence | null,
  marketplaceData: OptimizedKeywords | null
): string[] {
  const phrases: string[] = [];

  // Start with customer language from reviews (most authentic)
  if (keywordIntel?.customerLanguage.length) {
    phrases.push(...keywordIntel.customerLanguage.slice(0, 4));
  }

  // Add bullet formulas filled in with our data
  if (keywordIntel?.bulletFormulas.length) {
    const formula = keywordIntel.bulletFormulas[0];
    const filled = formula.formula
      .replace('{audience}', niche)
      .replace('{niche}', niche)
      .replace('{behavior}', `love ${tone || 'funny'} shirts`)
      .replace('{adjective}', tone || 'hilarious')
      .replace('{trait}', 'personality')
      .replace('{occasion}', 'birthdays');
    phrases.push(filled);
  }

  // Add marketplace-informed phrases
  if (marketplaceData?.mbaInsights?.commonTones.length) {
    if (marketplaceData.mbaInsights.commonTones.includes('gift-focused')) {
      phrases.push(`Makes the perfect gift for ${niche}`);
    }
    if (marketplaceData.mbaInsights.commonTones.includes('funny')) {
      phrases.push('Gets laughs and compliments every time');
    }
  }

  // Default phrases if we have nothing
  if (phrases.length === 0) {
    phrases.push(
      `Perfect for ${niche}`,
      `Great ${tone || 'funny'} gift idea`,
      'Premium quality that lasts'
    );
  }

  return phrases.slice(0, 6);
}

/**
 * Build comprehensive context for AI listing generation
 */
function buildComprehensiveContext(
  phrase: string,
  niche: string,
  keywordIntel: KeywordIntelligence | null,
  marketplaceData: OptimizedKeywords | null
): string {
  const sections: string[] = [
    '═══════════════════════════════════════════════════════════════',
    'COMPREHENSIVE KEYWORD INTELLIGENCE',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Design Text: "${phrase}"`,
    `Target Niche: ${niche}`,
    '',
  ];

  // Autocomplete section
  if (keywordIntel?.autocomplete.length) {
    sections.push(
      '─── AMAZON AUTOCOMPLETE (What Customers Search) ───',
      keywordIntel.autocomplete.slice(0, 10).join(', '),
      '',
      'USE THESE EXACT PHRASES - they are what customers type into Amazon!',
      ''
    );
  }

  // Competitor analysis section
  if (keywordIntel?.competitorKeywords.length) {
    sections.push(
      '─── COMPETITOR KEYWORDS (Top BSR Product Titles) ───',
      keywordIntel.competitorKeywords.slice(0, 15).join(', '),
      ''
    );
  }

  // Title patterns section
  if (keywordIntel?.titlePatterns.length) {
    sections.push(
      '─── WINNING TITLE PATTERNS ───',
    );
    for (const pattern of keywordIntel.titlePatterns.slice(0, 3)) {
      sections.push(`• ${pattern.pattern} (${Math.round(pattern.successRate * 100)}% frequency)`);
      if (pattern.examples.length) {
        sections.push(`  Example: "${pattern.examples[0]}"`);
      }
    }
    sections.push('');
  }

  // Customer language section
  if (keywordIntel?.customerLanguage.length) {
    sections.push(
      '─── CUSTOMER LANGUAGE (From Reviews) ───',
      'These are actual phrases customers use:',
      keywordIntel.customerLanguage.slice(0, 8).join(', '),
      '',
      'Use this language in bullets - it resonates with buyers!',
      ''
    );
  }

  // Long-tail section
  if (keywordIntel?.longTail.length) {
    sections.push(
      '─── LONG-TAIL KEYWORDS (High-Value) ───',
      keywordIntel.longTail.slice(0, 8).join(', '),
      ''
    );
  }

  // Bullet formulas
  if (keywordIntel?.bulletFormulas.length) {
    sections.push(
      '─── PROVEN BULLET FORMULAS ───',
    );
    for (const formula of keywordIntel.bulletFormulas.slice(0, 3)) {
      sections.push(`• ${formula.formula}`);
    }
    sections.push('');
  }

  // Marketplace data
  if (marketplaceData) {
    sections.push(
      '─── MARKETPLACE INTELLIGENCE ───',
      `Saturation: ${marketplaceData.saturation}`,
      `Entry Recommendation: ${marketplaceData.entryRecommendation}`,
      `Confidence: ${marketplaceData.confidence}%`,
      '',
      'Proven Primary Keywords:',
      marketplaceData.primaryKeywords.slice(0, 10).join(', '),
      ''
    );
  }

  sections.push(
    '═══════════════════════════════════════════════════════════════',
    'INSTRUCTIONS:',
    '1. Use autocomplete phrases in title (customers search these exact terms)',
    '2. Apply a winning title pattern from above',
    '3. Use customer language in bullets (resonates with buyers)',
    '4. Include long-tail keywords naturally',
    '5. Keep title under 200 chars, bullets under 500 chars each',
    '═══════════════════════════════════════════════════════════════'
  );

  return sections.join('\n');
}
