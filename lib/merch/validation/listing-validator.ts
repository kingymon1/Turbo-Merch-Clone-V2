/**
 * Amazon Merch listing validator
 *
 * Validates and sanitizes merch listings to ensure compliance
 * with Amazon Merch on Demand requirements.
 *
 * NOTE: This is a SEPARATE system from services/compliance.ts
 * Used only by the merch generator (Phases 1-6).
 */

import { containsBannedWords, findBannedWords, removeBannedWords } from './banned-words';
import { cleanToAscii, hasNonAsciiPunctuation, hasEmojis, hasNonAscii } from './ascii-cleaner';

/**
 * Input listing structure
 */
export interface MerchListing {
  title: string;
  brand: string;
  bullets: string[];
  description: string;
  keywords?: string[];
}

/**
 * Validation result with detailed feedback
 */
export interface MerchValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  cleanedListing: MerchListing;
  stats: {
    bannedWordsRemoved: number;
    charactersChanged: number;
    fieldsTruncated: string[];
  };
}

/**
 * Amazon Merch specific character limits
 *
 * NOTE: These are DIFFERENT from general Amazon limits:
 * - Merch description is 500 chars (not 2000)
 * - Merch has exactly 2 bullet points (not 5)
 */
export const MERCH_LIMITS = {
  title: {
    min: 40,
    max: 60,
    label: 'Title'
  },
  brand: {
    min: 1,
    max: 50,
    label: 'Brand'
  },
  bullet: {
    min: 180,
    max: 256,
    label: 'Bullet'
  },
  description: {
    min: 100,
    max: 500,
    label: 'Description'
  },
  bulletCount: 2
};

/**
 * Smart truncate text at word boundary
 * Avoids cutting words in half
 */
function smartTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  // If we can find a space in the last 30% of the string, use it
  if (lastSpace > maxLength * 0.7) {
    return truncated.substring(0, lastSpace);
  }

  return truncated;
}

/**
 * Validate a single field for banned words and character limits
 */
function validateField(
  value: string,
  fieldName: string,
  limits: { min?: number; max: number },
  errors: string[],
  warnings: string[]
): { cleaned: string; truncated: boolean; bannedFound: string[] } {
  let cleaned = cleanToAscii(value);
  let truncated = false;
  const bannedFound: string[] = [];

  // Check for banned words
  const banned = findBannedWords(cleaned);
  if (banned.length > 0) {
    bannedFound.push(...banned);
    errors.push(`${fieldName} contains banned words: ${banned.slice(0, 5).join(', ')}${banned.length > 5 ? ` (+${banned.length - 5} more)` : ''}`);
    cleaned = removeBannedWords(cleaned);
  }

  // Check minimum length
  if (limits.min && cleaned.length < limits.min) {
    warnings.push(`${fieldName} is short: ${cleaned.length} chars (recommended: ${limits.min}+)`);
  }

  // Check and enforce maximum length
  if (cleaned.length > limits.max) {
    errors.push(`${fieldName} too long: ${cleaned.length} chars (max: ${limits.max})`);
    cleaned = smartTruncate(cleaned, limits.max);
    truncated = true;
    warnings.push(`${fieldName} auto-truncated to ${limits.max} characters`);
  }

  // ASCII warnings
  if (hasNonAscii(value)) {
    if (hasEmojis(value)) {
      warnings.push(`${fieldName}: Emojis removed`);
    }
    if (hasNonAsciiPunctuation(value)) {
      warnings.push(`${fieldName}: Unicode punctuation converted to ASCII`);
    }
  }

  return { cleaned, truncated, bannedFound };
}

/**
 * Main validation function
 *
 * Validates and sanitizes a merch listing:
 * 1. Converts Unicode to ASCII
 * 2. Removes banned words
 * 3. Enforces character limits
 * 4. Returns detailed validation result
 */
export function validateMerchListing(listing: MerchListing): MerchValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fieldsTruncated: string[] = [];
  let totalBannedRemoved = 0;
  let totalCharsChanged = 0;

  // Track original lengths for stats
  const originalLengths = {
    title: listing.title?.length || 0,
    brand: listing.brand?.length || 0,
    bullets: listing.bullets?.map(b => b?.length || 0) || [],
    description: listing.description?.length || 0
  };

  // Initialize cleaned listing
  const cleanedListing: MerchListing = {
    title: '',
    brand: '',
    bullets: [],
    description: '',
    keywords: []
  };

  // 1. VALIDATE TITLE
  const titleResult = validateField(
    listing.title || '',
    MERCH_LIMITS.title.label,
    { min: MERCH_LIMITS.title.min, max: MERCH_LIMITS.title.max },
    errors,
    warnings
  );
  cleanedListing.title = titleResult.cleaned;
  if (titleResult.truncated) fieldsTruncated.push('title');
  totalBannedRemoved += titleResult.bannedFound.length;
  totalCharsChanged += Math.abs(originalLengths.title - cleanedListing.title.length);

  // 2. VALIDATE BRAND
  const brandResult = validateField(
    listing.brand || '',
    MERCH_LIMITS.brand.label,
    { min: MERCH_LIMITS.brand.min, max: MERCH_LIMITS.brand.max },
    errors,
    warnings
  );
  cleanedListing.brand = brandResult.cleaned;
  if (brandResult.truncated) fieldsTruncated.push('brand');
  totalBannedRemoved += brandResult.bannedFound.length;
  totalCharsChanged += Math.abs(originalLengths.brand - cleanedListing.brand.length);

  // 3. VALIDATE BULLETS
  if (!listing.bullets || !Array.isArray(listing.bullets)) {
    errors.push('Bullets must be an array');
    cleanedListing.bullets = [];
  } else if (listing.bullets.length !== MERCH_LIMITS.bulletCount) {
    errors.push(`Must have exactly ${MERCH_LIMITS.bulletCount} bullets (current: ${listing.bullets.length})`);

    // Process whatever bullets we have
    cleanedListing.bullets = listing.bullets.slice(0, MERCH_LIMITS.bulletCount).map((bullet, idx) => {
      const bulletResult = validateField(
        bullet || '',
        `${MERCH_LIMITS.bullet.label} ${idx + 1}`,
        { min: MERCH_LIMITS.bullet.min, max: MERCH_LIMITS.bullet.max },
        errors,
        warnings
      );
      if (bulletResult.truncated) fieldsTruncated.push(`bullet${idx + 1}`);
      totalBannedRemoved += bulletResult.bannedFound.length;
      totalCharsChanged += Math.abs((originalLengths.bullets[idx] || 0) - bulletResult.cleaned.length);
      return bulletResult.cleaned;
    });
  } else {
    cleanedListing.bullets = listing.bullets.map((bullet, idx) => {
      const bulletResult = validateField(
        bullet || '',
        `${MERCH_LIMITS.bullet.label} ${idx + 1}`,
        { min: MERCH_LIMITS.bullet.min, max: MERCH_LIMITS.bullet.max },
        errors,
        warnings
      );
      if (bulletResult.truncated) fieldsTruncated.push(`bullet${idx + 1}`);
      totalBannedRemoved += bulletResult.bannedFound.length;
      totalCharsChanged += Math.abs((originalLengths.bullets[idx] || 0) - bulletResult.cleaned.length);
      return bulletResult.cleaned;
    });
  }

  // 4. VALIDATE DESCRIPTION
  const descResult = validateField(
    listing.description || '',
    MERCH_LIMITS.description.label,
    { min: MERCH_LIMITS.description.min, max: MERCH_LIMITS.description.max },
    errors,
    warnings
  );
  cleanedListing.description = descResult.cleaned;
  if (descResult.truncated) fieldsTruncated.push('description');
  totalBannedRemoved += descResult.bannedFound.length;
  totalCharsChanged += Math.abs(originalLengths.description - cleanedListing.description.length);

  // 5. VALIDATE KEYWORDS (optional but clean them if present)
  if (listing.keywords && Array.isArray(listing.keywords)) {
    cleanedListing.keywords = listing.keywords
      .map(keyword => cleanToAscii(keyword || ''))
      .filter(keyword => {
        const banned = findBannedWords(keyword);
        if (banned.length > 0) {
          warnings.push(`Keyword "${keyword}" contains banned words: ${banned.join(', ')}`);
          totalBannedRemoved += banned.length;
          return false;
        }
        return keyword.length > 0;
      });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    cleanedListing,
    stats: {
      bannedWordsRemoved: totalBannedRemoved,
      charactersChanged: totalCharsChanged,
      fieldsTruncated
    }
  };
}

/**
 * Quick validation check (no cleaning)
 * Returns true if listing would pass validation
 */
export function isValidMerchListing(listing: MerchListing): boolean {
  const result = validateMerchListing(listing);
  return result.valid;
}

/**
 * Get the character limits for Merch listings
 */
export function getMerchLimits(): typeof MERCH_LIMITS {
  return MERCH_LIMITS;
}

/**
 * Validate just the title field
 */
export function validateTitle(title: string): { valid: boolean; errors: string[]; cleaned: string } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const result = validateField(
    title,
    MERCH_LIMITS.title.label,
    { min: MERCH_LIMITS.title.min, max: MERCH_LIMITS.title.max },
    errors,
    warnings
  );

  return {
    valid: errors.length === 0,
    errors,
    cleaned: result.cleaned
  };
}

/**
 * Validate just the brand field
 */
export function validateBrand(brand: string): { valid: boolean; errors: string[]; cleaned: string } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const result = validateField(
    brand,
    MERCH_LIMITS.brand.label,
    { min: MERCH_LIMITS.brand.min, max: MERCH_LIMITS.brand.max },
    errors,
    warnings
  );

  return {
    valid: errors.length === 0,
    errors,
    cleaned: result.cleaned
  };
}

/**
 * Pre-validate input before generation
 * Checks for obvious issues that should be fixed before AI generation
 */
export function preValidateInput(phrase: string, niche: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check phrase
  if (!phrase || phrase.trim().length === 0) {
    errors.push('Phrase is required');
  } else {
    const phraseBanned = findBannedWords(phrase);
    if (phraseBanned.length > 0) {
      warnings.push(`Phrase contains words that may be filtered: ${phraseBanned.join(', ')}`);
    }
  }

  // Check niche
  if (!niche || niche.trim().length === 0) {
    errors.push('Niche is required');
  } else {
    const nicheBanned = findBannedWords(niche);
    if (nicheBanned.length > 0) {
      warnings.push(`Niche contains words that may be filtered: ${nicheBanned.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
