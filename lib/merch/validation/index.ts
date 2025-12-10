/**
 * Merch Validation System
 *
 * Dedicated validation for Amazon Merch on Demand listings.
 * This is a SEPARATE system from services/compliance.ts.
 *
 * Usage:
 *   import { validateMerchListing, getMerchLimits } from '@/lib/merch/validation';
 *
 * Features:
 * - 200+ Merch-specific banned words
 * - Amazon Merch character limits (60 title, 50 brand, 256 bullet, 500 desc)
 * - Unicode to ASCII conversion
 * - Emoji removal
 * - Smart truncation at word boundaries
 * - Detailed error and warning reporting
 */

// Main validation exports
export {
  validateMerchListing,
  isValidMerchListing,
  getMerchLimits,
  validateTitle,
  validateBrand,
  preValidateInput,
  MERCH_LIMITS,
  type MerchListing,
  type MerchValidationResult,
} from './listing-validator';

// Banned words exports
export {
  MERCH_BANNED_WORDS,
  ALL_MERCH_BANNED_WORDS,
  containsBannedWords,
  findBannedWords,
  removeBannedWords,
  getBannedWordCategories,
  getBannedWordCount,
  isInCategory,
} from './banned-words';

// ASCII cleaner exports
export {
  cleanToAscii,
  hasNonAsciiPunctuation,
  hasEmojis,
  hasNonAscii,
  findNonAsciiChars,
  isValidAscii,
  getCharInfo,
} from './ascii-cleaner';
