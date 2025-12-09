/**
 * Listing Generator for Merch Design Generator
 *
 * Generates Amazon-optimized listings using the existing Gemini service.
 * This module provides a simplified interface for the merch generator feature.
 */

import { TrendData, GeneratedListing } from '@/types';
import { generateListing as geminiGenerateListing } from '@/services/geminiService';

export interface ListingResult {
  title: string;
  bullets: string[];
  description: string;
  keywords?: string[];
  brand?: string;
}

/**
 * Generate an Amazon-optimized listing for a merch design
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
  // Create a TrendData object to pass to the existing Gemini listing generator
  // This leverages all the existing optimization and prompting
  const trendData: TrendData = {
    topic: phrase,
    platform: 'Merch Generator',
    volume: 'Generated',
    sentiment: tone || 'Funny',
    keywords: [phrase, niche, tone || 'funny', 'gift', 'shirt'].filter(Boolean) as string[],
    description: `${phrase} design for ${niche}`,
    visualStyle: style || 'Bold modern typography with clean design',
    typographyStyle: style || 'Bold sans-serif',
    designText: phrase,
    customerPhrases: [
      `Perfect for ${niche}`,
      `Great ${tone || 'funny'} gift`,
      `Love this ${phrase} design`,
    ],
    audienceProfile: niche,
  };

  try {
    // Use the existing, battle-tested Gemini listing generator
    const listing: GeneratedListing = await geminiGenerateListing(trendData);

    return {
      title: listing.title,
      bullets: [
        listing.bullet1,
        listing.bullet2,
        // Add more bullet points for completeness
        `Perfect gift for ${niche} who appreciate ${tone || 'humor'}`,
        'Premium quality fabric for maximum comfort',
        'Vibrant print that lasts wash after wash',
      ],
      description: listing.description,
      keywords: listing.keywords,
      brand: listing.brand,
    };
  } catch (error) {
    console.error('[ListingGenerator] Error generating listing:', error);

    // Fallback to a basic listing if Gemini fails
    return generateFallbackListing(phrase, niche, tone);
  }
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
