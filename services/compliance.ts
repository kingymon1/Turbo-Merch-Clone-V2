
export const BANNED_WORDS_LIST = [
  "100% natural", "100% quality", "100% value", "adhd", "aids", "als", "alzheimer's", 
  "amazon choice", "amazon suggested", "antibacterial", "antifungal", "anti-microbial", 
  "anxiety", "approved", "arrive faster", "attention deficit disorder", "authentic", 
  "award winning", "bacteria", "best deal", "best price", "best seller", "best selling", 
  "big sale", "biodegradable", "bpa free", "brand new", "buy now", "buy with confidence", 
  "cancer", "cancroid", "cataract", "cells", "certified", "cheap", "chlamydia", "closeout", 
  "coronavirus", "cost", "covid", "cure", "dementia", "depression", "detoxification", 
  "diabetes", "discounted price", "disease", "eco friendly", "fda", "free gift", "free shipping", 
  "fungal", "glaucoma", "guarantee", "hassle free", "heal", "hepatitis", "herpes", 
  "highest rated", "hiv", "hot item", "huge sale", "imported from", "inflammation", 
  "kidney disease", "limited time offer", "liver disease", "money back guarantee", "natural", 
  "new version", "non-toxic", "no.1 product", "on sale", "patented", "perfect gift", 
  "pesticide", "professional quality", "proven", "quality", "recommended by", "remedy", 
  "satisfaction", "save $", "seasonal affective disorder", "special offer", "stroke", 
  "super sale", "tested", "top quality", "toxic", "treat", "treatment", "unbeatable price", 
  "used", "validated", "viral", "warranty", "weight loss", "wholesale price", "winter sale", 
  "worlds best", "miracle", "guaranteed results", "risk-free", "instant results", "secret formula", 
  "revolutionary", "no-brainer", "freebie", "once in a lifetime", "exclusive deal", "flash sale", 
  "best kept secret", "quick fix", "act now", "this won't last", "game-changer", "magic", 
  "cutting-edge", "unbelievable"
];

export const TITLE_RESTRICTED_WORDS = [
  "design", "designs", "graphic", "artwork", "illustration", "print", "drawing", 
  "t-shirt", "shirt", "hoodie", "gift", "premium", "perfect", "apparel", "clothing"
];

export const COMPLIANCE_SYSTEM_INSTRUCTION = `
You are the Amazon Merch on Demand Compliance Officer & Copywriter Agent.
Your task is to generate product listings that are 100% compliant with Amazon's strict content policies while maximizing sales potential through safe, descriptive, and benefit-driven copy.

STRICT ADHERENCE TO THE FOLLOWING RULES IS MANDATORY. VIOLATION WILL CAUSE ACCOUNT SUSPENSION.

1. HARD CHARACTER LIMITS (Auto-trim if necessary):
   - Title: MAX 60 characters.
   - Brand: MAX 50 characters.
   - Bullet Points: MAX 256 characters each.
   - Description: MAX 2000 characters.

2. PROHIBITED CONTENT (AUTOMATIC REJECTION):
   - NO medical claims (cure, heal, anxiety, depression, cancer, virus, therapy).
   - NO quality claims (100% quality, high quality, premium, best seller, satisfaction guaranteed).
   - NO shipping/service promises (free shipping, fast delivery, prime, arrive faster).
   - NO promotional tactics (sale, discount, limited time, special offer, free gift).
   - NO special characters or emojis. Use ASCII only (A-Z, 0-9, basic punctuation).
   - NO "Gold", "Silver", "Metallic", "Glitter", "Neon", or "Glow-in-the-dark" descriptors unless it is a factual color name (e.g., "Yellow" instead of "Gold").
   - NO tragedies, violence, illegal activity, or sexual content.

3. TITLE RULES:
   - DO NOT use the following words in the Title: ${TITLE_RESTRICTED_WORDS.join(", ")}.
   - Title must be descriptive of the design subject and style only.

4. BRANDING RULES:
   - Create a unique, micro-brand name.
   - Do NOT use "Amazon", "Merch", or well-known brand names.

5. LISTING TONE:
   - Professional, descriptive, and lifestyle-focused.
   - Focus on the *subject* of the design (e.g., "Retro Cat Astronaut") and who it is for (e.g., "Space Lovers").
`;

export const NATURAL_LANGUAGE_INSTRUCTION = `
    CRITICAL COPYWRITING RULES (AMAZON MERCH OPTIMIZED):

    1. **TITLE (Weight: #1)**:
       - MUST be between 50-60 characters (use the space!).
       - Structure: "[Main Subject] [Aesthetic] [Keyword] [Design Type]".
       - Example: "Skeleton Drinking Coffee Vintage Distressed Grunge Graphic".
       - DO NOT repeat the Brand Name in the title.
       - DO NOT use fluff words like "Perfect", "Unique", "Idea".

    2. **BRAND (Weight: #2)**:
       - Create a "Studio" or "Collective" style name (3+ words).
       - Examples: "Midnight Static Supply", "Echo Vibe Labs", "Neon Drifter Co.", "Urban Legend Press".
       - AVOID generic "Adjective Noun" (e.g., "Funny Cat"). Make it sound like a streetwear label.

    3. **BULLETS (Weight: #3 & #4)**:
       - MAXIMIZE SPACE. Aim for 200-256 characters per bullet.
       - TONE: Conversational, "Insider" fan-speak.
       - STRUCTURE: "The Hook (Vibe) + The Story (Situation) + The Keywords (Style)".
       - Bullet 1: Focus on the *feeling* and *identity* of the wearer.
       - Bullet 2: Focus on the *art style* and *aesthetic* details.
       - NO: "Great gift", "High quality", "Wash cold", "Lightweight". (Banned by compliance).

    4. **LANGUAGE BAN LIST (STRICT)**:
       - DO NOT USE: "Garment", "Apparel", "Attire", "Clothing", "Product", "Item", "Merch".
       - INSTEAD USE: "Graphic", "Print", "Design", "Piece", "Look", "Vibe", "Aesthetic".
`;

// ============================================================================
// LISTING SANITIZATION - Enforces all constraints after AI generation
// ============================================================================

import { GeneratedListing } from '../types';

const LIMITS = {
    title: { min: 40, max: 60 },
    brand: { max: 50 },
    bullet: { min: 180, max: 256 },
    description: { max: 2000 },
    designText: { maxWords: 5 },
};

// Strip emojis and non-ASCII characters
const stripSpecialChars = (text: string): string => {
    return text
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // emoticons
        .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // symbols & pictographs
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // transport & map
        .replace(/[\u{2600}-\u{26FF}]/gu, '')   // misc symbols
        .replace(/[\u{2700}-\u{27BF}]/gu, '')   // dingbats
        .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // supplemental symbols
        .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // chess symbols
        .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // symbols extended
        .replace(/[^\x20-\x7E]/g, '')           // keep only printable ASCII
        .replace(/\s+/g, ' ')
        .trim();
};

// Remove banned words from text (case-insensitive)
const removeBannedWords = (text: string): string => {
    let result = text;
    for (const banned of BANNED_WORDS_LIST) {
        const regex = new RegExp(`\\b${banned}\\b`, 'gi');
        result = result.replace(regex, '');
    }
    // Clean up double spaces
    return result.replace(/\s+/g, ' ').trim();
};

// Remove title-restricted words
const removeTitleRestrictedWords = (text: string): string => {
    let result = text;
    for (const word of TITLE_RESTRICTED_WORDS) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        result = result.replace(regex, '');
    }
    return result.replace(/\s+/g, ' ').trim();
};

// Smart truncate at word boundary
const smartTruncate = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > maxLength * 0.7 ? truncated.substring(0, lastSpace) : truncated;
};

// Limit design text to max words
const limitDesignTextWords = (text: string, maxWords: number): string => {
    const words = text.trim().split(/\s+/);
    if (words.length <= maxWords) return text.toUpperCase();
    return words.slice(0, maxWords).join(' ').toUpperCase();
};

/**
 * Sanitize a generated listing to ensure compliance
 * Call this after AI generation to enforce all constraints
 */
export const sanitizeListing = (listing: GeneratedListing): GeneratedListing => {
    const warnings: string[] = [];

    // 1. Title: strip special chars, remove banned/restricted words, enforce length
    let title = stripSpecialChars(listing.title || '');
    title = removeBannedWords(title);
    title = removeTitleRestrictedWords(title);
    if (title.length > LIMITS.title.max) {
        warnings.push(`Title truncated from ${title.length} to ${LIMITS.title.max} chars`);
        title = smartTruncate(title, LIMITS.title.max);
    }

    // 2. Brand: strip special chars, enforce length
    let brand = stripSpecialChars(listing.brand || '');
    brand = removeBannedWords(brand);
    if (brand.length > LIMITS.brand.max) {
        brand = smartTruncate(brand, LIMITS.brand.max);
    }

    // 3. Bullets: strip special chars, remove banned words, enforce length
    let bullet1 = stripSpecialChars(listing.bullet1 || '');
    bullet1 = removeBannedWords(bullet1);
    if (bullet1.length > LIMITS.bullet.max) {
        bullet1 = smartTruncate(bullet1, LIMITS.bullet.max);
    }

    let bullet2 = stripSpecialChars(listing.bullet2 || '');
    bullet2 = removeBannedWords(bullet2);
    if (bullet2.length > LIMITS.bullet.max) {
        bullet2 = smartTruncate(bullet2, LIMITS.bullet.max);
    }

    // 4. Description: strip special chars, remove banned words, enforce length
    let description = stripSpecialChars(listing.description || '');
    description = removeBannedWords(description);
    if (description.length > LIMITS.description.max) {
        description = smartTruncate(description, LIMITS.description.max);
    }

    // 5. Design text: limit to max words, uppercase
    let designText = stripSpecialChars(listing.designText || '');
    designText = removeBannedWords(designText);
    designText = limitDesignTextWords(designText, LIMITS.designText.maxWords);

    // 6. Keywords: filter out any that contain banned words
    const keywords = (listing.keywords || [])
        .map(k => stripSpecialChars(k))
        .filter(k => {
            const lower = k.toLowerCase();
            return !BANNED_WORDS_LIST.some(banned => lower.includes(banned));
        });

    if (warnings.length > 0) {
        console.log('[Compliance] Sanitization warnings:', warnings.join('; '));
    }

    return {
        ...listing,
        title,
        brand,
        bullet1,
        bullet2,
        description,
        designText,
        keywords,
    };
};

/**
 * Sanitize design text only (for Trend Lab trends)
 */
export const sanitizeDesignText = (text: string): string => {
    let result = stripSpecialChars(text || '');
    result = removeBannedWords(result);
    return limitDesignTextWords(result, LIMITS.designText.maxWords);
};
