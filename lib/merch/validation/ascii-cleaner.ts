/**
 * ASCII cleanup for Amazon Merch listings
 *
 * Amazon Merch requires ASCII-only text in listings.
 * This module converts Unicode punctuation to ASCII equivalents
 * and removes emojis and other special characters.
 *
 * NOTE: This is a SEPARATE system from services/compliance.ts
 * Used only by the merch generator (Phases 1-6).
 */

// Unicode to ASCII replacement mappings
const UNICODE_REPLACEMENTS: Record<string, string> = {
  // Smart quotes (curly quotes)
  '\u201C': '"',  // " left double quotation mark
  '\u201D': '"',  // " right double quotation mark
  '\u2018': "'",  // ' left single quotation mark
  '\u2019': "'",  // ' right single quotation mark
  '\u201A': "'",  // ‚ single low-9 quotation mark
  '\u201E': '"',  // „ double low-9 quotation mark
  '\u2039': "'",  // ‹ single left-pointing angle quotation
  '\u203A': "'",  // › single right-pointing angle quotation
  '\u00AB': '"',  // « left-pointing double angle quotation
  '\u00BB': '"',  // » right-pointing double angle quotation

  // Dashes and hyphens
  '\u2014': '-',  // — em dash
  '\u2013': '-',  // – en dash
  '\u2212': '-',  // − minus sign
  '\u2010': '-',  // ‐ hyphen
  '\u2011': '-',  // ‑ non-breaking hyphen
  '\u2012': '-',  // ‒ figure dash
  '\u2015': '-',  // ― horizontal bar

  // Ellipsis
  '\u2026': '...',  // … horizontal ellipsis

  // Various spaces (normalize to regular space)
  '\u00A0': ' ',   // non-breaking space
  '\u2002': ' ',   // en space
  '\u2003': ' ',   // em space
  '\u2004': ' ',   // three-per-em space
  '\u2005': ' ',   // four-per-em space
  '\u2006': ' ',   // six-per-em space
  '\u2007': ' ',   // figure space
  '\u2008': ' ',   // punctuation space
  '\u2009': ' ',   // thin space
  '\u200A': ' ',   // hair space
  '\u200B': '',    // zero-width space (remove)
  '\u202F': ' ',   // narrow no-break space
  '\u205F': ' ',   // medium mathematical space
  '\u3000': ' ',   // ideographic space

  // Bullets and list markers
  '\u2022': '-',   // • bullet
  '\u2023': '-',   // ‣ triangular bullet
  '\u2043': '-',   // ⁃ hyphen bullet
  '\u25E6': '-',   // ◦ white bullet
  '\u00B7': '-',   // · middle dot
  '\u2219': '-',   // ∙ bullet operator

  // Symbols to remove entirely
  '\u2122': '',    // ™ trademark
  '\u00AE': '',    // ® registered trademark
  '\u00A9': '',    // © copyright
  '\u2120': '',    // ℠ service mark

  // Fractions (convert to text)
  '\u00BC': '1/4',  // ¼
  '\u00BD': '1/2',  // ½
  '\u00BE': '3/4',  // ¾
  '\u2153': '1/3',  // ⅓
  '\u2154': '2/3',  // ⅔

  // Currency symbols
  '\u20AC': 'EUR',  // €
  '\u00A3': 'GBP',  // £
  '\u00A5': 'JPY',  // ¥

  // Mathematical symbols
  '\u00D7': 'x',    // × multiplication
  '\u00F7': '/',    // ÷ division
  '\u2260': '!=',   // ≠ not equal
  '\u2264': '<=',   // ≤ less than or equal
  '\u2265': '>=',   // ≥ greater than or equal
  '\u221E': 'infinity', // ∞

  // Arrows (convert to text or remove)
  '\u2192': '->',   // → rightwards arrow
  '\u2190': '<-',   // ← leftwards arrow
  '\u2194': '<->',  // ↔ left right arrow
  '\u21D2': '=>',   // ⇒ rightwards double arrow

  // Accented characters (normalize to base)
  '\u00E0': 'a', '\u00E1': 'a', '\u00E2': 'a', '\u00E3': 'a', '\u00E4': 'a', '\u00E5': 'a',
  '\u00C0': 'A', '\u00C1': 'A', '\u00C2': 'A', '\u00C3': 'A', '\u00C4': 'A', '\u00C5': 'A',
  '\u00E8': 'e', '\u00E9': 'e', '\u00EA': 'e', '\u00EB': 'e',
  '\u00C8': 'E', '\u00C9': 'E', '\u00CA': 'E', '\u00CB': 'E',
  '\u00EC': 'i', '\u00ED': 'i', '\u00EE': 'i', '\u00EF': 'i',
  '\u00CC': 'I', '\u00CD': 'I', '\u00CE': 'I', '\u00CF': 'I',
  '\u00F2': 'o', '\u00F3': 'o', '\u00F4': 'o', '\u00F5': 'o', '\u00F6': 'o',
  '\u00D2': 'O', '\u00D3': 'O', '\u00D4': 'O', '\u00D5': 'O', '\u00D6': 'O',
  '\u00F9': 'u', '\u00FA': 'u', '\u00FB': 'u', '\u00FC': 'u',
  '\u00D9': 'U', '\u00DA': 'U', '\u00DB': 'U', '\u00DC': 'U',
  '\u00F1': 'n', '\u00D1': 'N',
  '\u00E7': 'c', '\u00C7': 'C',
  '\u00DF': 'ss',  // ß German sharp s
};

/**
 * Clean text to ASCII-only characters
 * Replaces Unicode with ASCII equivalents and removes emojis
 */
export function cleanToAscii(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // Step 1: Replace known Unicode characters with ASCII equivalents
  for (const [unicode, ascii] of Object.entries(UNICODE_REPLACEMENTS)) {
    cleaned = cleaned.split(unicode).join(ascii);
  }

  // Step 2: Remove emojis (comprehensive ranges)
  cleaned = cleaned
    // Emoticons
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    // Miscellaneous Symbols and Pictographs
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    // Transport and Map Symbols
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    // Alchemical Symbols
    .replace(/[\u{1F700}-\u{1F77F}]/gu, '')
    // Geometric Shapes Extended
    .replace(/[\u{1F780}-\u{1F7FF}]/gu, '')
    // Supplemental Arrows-C
    .replace(/[\u{1F800}-\u{1F8FF}]/gu, '')
    // Supplemental Symbols and Pictographs
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    // Chess Symbols
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
    // Symbols and Pictographs Extended-A
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
    // Dingbats
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    // Miscellaneous Symbols
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    // Enclosed Alphanumeric Supplement
    .replace(/[\u{1F100}-\u{1F1FF}]/gu, '')
    // Enclosed Ideographic Supplement
    .replace(/[\u{1F200}-\u{1F2FF}]/gu, '')
    // Regional Indicator Symbols (flags)
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    // Variation Selectors
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    // Zero Width Joiner used in emoji sequences
    .replace(/\u200D/g, '')
    // Skin tone modifiers
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, '');

  // Step 3: Remove any remaining non-printable ASCII characters
  // Keep only characters in the range 0x20 (space) to 0x7E (~)
  cleaned = cleaned.replace(/[^\x20-\x7E]/g, '');

  // Step 4: Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Check if text contains Unicode punctuation that will be replaced
 */
export function hasNonAsciiPunctuation(text: string): boolean {
  if (!text) return false;
  return Object.keys(UNICODE_REPLACEMENTS).some(char => text.includes(char));
}

/**
 * Check if text contains emojis
 */
export function hasEmojis(text: string): boolean {
  if (!text) return false;
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}]/gu;
  return emojiRegex.test(text);
}

/**
 * Check if text contains any non-ASCII characters
 */
export function hasNonAscii(text: string): boolean {
  if (!text) return false;
  // Check for characters outside printable ASCII range
  return /[^\x20-\x7E]/.test(text);
}

/**
 * Get list of non-ASCII characters found in text
 * Useful for debugging
 */
export function findNonAsciiChars(text: string): string[] {
  if (!text) return [];
  const nonAscii = text.match(/[^\x20-\x7E]/g) || [];
  return [...new Set(nonAscii)];
}

/**
 * Get Unicode character info for debugging
 */
export function getCharInfo(char: string): { code: string; name: string } {
  const code = char.codePointAt(0);
  return {
    code: code ? `U+${code.toString(16).toUpperCase().padStart(4, '0')}` : 'unknown',
    name: UNICODE_REPLACEMENTS[char] !== undefined
      ? `replaces with "${UNICODE_REPLACEMENTS[char]}"`
      : 'will be removed'
  };
}

/**
 * Validate that text is pure ASCII
 * Returns true if text contains only printable ASCII characters
 */
export function isValidAscii(text: string): boolean {
  if (!text) return true;
  return /^[\x20-\x7E]*$/.test(text);
}
