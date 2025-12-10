/**
 * Amazon Merch-specific banned words
 *
 * More comprehensive than general compliance system.
 * Organized by category for easier maintenance.
 *
 * NOTE: This is a SEPARATE system from services/compliance.ts
 * Used only by the merch generator (Phases 1-6).
 */

export const MERCH_BANNED_WORDS = {
  // Words that describe the product itself (not allowed in Merch titles)
  apparel: [
    'design', 'designs', 'designer', 'designed',
    'graphic', 'graphics', 'artwork', 'illustration',
    'print', 'printed', 'printing', 'drawing',
    't-shirt', 'tshirt', 'shirt', 'shirts',
    'hoodie', 'hoodies', 'sweatshirt', 'sweatshirts',
    'tank top', 'tank tops', 'tanktop',
    'gift', 'gifts', 'present', 'gifting',
    'premium', 'perfect', 'tee', 'tees',
    'apparel', 'clothing', 'wear', 'garment',
    'merchandise', 'merch', 'product', 'item',
    'outfit', 'attire', 'costume', 'jersey',
    'pullover', 'crewneck', 'crew neck', 'raglan',
    'v-neck', 'vneck', 'long sleeve', 'short sleeve'
  ],

  // Health and medical claims (strictly prohibited)
  healthMedical: [
    'cure', 'cures', 'curing', 'treat', 'treatment',
    'fda', 'approved', 'medical', 'medicine',
    'cancer', 'diabetes', 'disease', 'disorder',
    'anti-bacterial', 'antibacterial', 'therapeutic',
    'detoxify', 'detox', 'cleanse', 'cleansing',
    'healing', 'heals', 'heal', 'healer',
    'doctor', 'prescription', 'diagnose', 'diagnosis',
    'symptom', 'symptoms', 'remedy', 'remedies',
    'anxiety', 'depression', 'depressed', 'anxious',
    'aids', 'hiv', 'covid', 'covid-19', 'coronavirus',
    'pandemic', 'virus', 'viral', 'infection',
    'health claim', 'health benefits', 'wellness',
    'arthritis', 'alzheimers', 'alzheimer',
    'autism', 'adhd', 'add', 'bipolar',
    'ptsd', 'ocd', 'schizophrenia', 'dementia',
    'stroke', 'heart attack', 'blood pressure',
    'cholesterol', 'immune system', 'immunity',
    'anti-inflammatory', 'antiinflammatory',
    'antiviral', 'anti-viral', 'antimicrobial',
    'antibiotics', 'antibiotic', 'vaccination',
    'vaccine', 'clinical', 'clinically',
    'pharmaceutical', 'drug', 'drugs', 'medication'
  ],

  // Promotional and sales language
  promotional: [
    'best seller', 'bestseller', 'best-seller',
    'top seller', 'top-seller', 'topseller',
    'guaranteed', 'guarantee', 'guarantees',
    'money-back', 'money back', 'refund', 'refunds',
    'limited time', 'limited-time', 'hurry',
    'free shipping', 'free delivery', 'fast shipping',
    'sale', 'sales', 'on sale', 'for sale',
    'discount', 'discounted', 'discounts',
    'off', '% off', 'percent off',
    'offer', 'offers', 'special offer', 'exclusive offer',
    'deal', 'deals', 'hot deal', 'best deal',
    'clearance', 'closeout', 'liquidation',
    'promo', 'promotion', 'promotional',
    'flash sale', 'flash-sale', 'daily deal',
    'today only', 'act now', 'order now',
    'buy now', 'shop now', 'get yours',
    'amazon choice', "amazon's choice", 'amazon pick',
    'prime', 'prime eligible', 'prime day',
    'black friday', 'cyber monday', 'holiday sale',
    'winter sale', 'summer sale', 'spring sale',
    'seasonal', 'seasonal sale', 'end of season'
  ],

  // Quality and certification claims
  qualityClaims: [
    '100%', 'one hundred percent', 'hundred percent',
    'percent', 'certified', 'certificate', 'certification',
    'proven', 'tested', 'verified', 'validation',
    'award winning', 'award-winning', 'awarded', 'awards',
    'top quality', 'highest quality', 'superior quality',
    'best quality', 'quality assured', 'quality guaranteed',
    'professional grade', 'professional-grade', 'pro grade',
    'official', 'officially', 'officially licensed',
    'authentic', 'authenticity', 'genuine', 'real',
    'original', 'the original', 'originals',
    'exclusive', 'exclusively', 'exclusive design',
    'luxury', 'luxurious', 'deluxe', 'premium quality',
    'world class', 'world-class', 'worldclass',
    'finest', 'the finest', 'superior', 'elite',
    'ultimate', 'the ultimate', 'ultimates',
    'perfect', 'perfection', 'perfectly',
    'top rated', 'top-rated', 'toprated',
    'highly rated', 'highly-rated', '5 star', '5-star',
    'five star', 'number one', '#1', 'no. 1',
    'first place', '1st place', 'winner', 'winning'
  ],

  // Sales pressure and urgency
  salesPressure: [
    'cheap', 'cheapest', 'cheaper',
    'affordable', 'budget', 'budget-friendly',
    'inexpensive', 'low cost', 'low-cost',
    'buy now', 'buy today', 'purchase now',
    'huge sale', 'big sale', 'massive sale',
    'massive discount', 'huge discount', 'big discount',
    'unbeatable price', 'unbeatable', 'cant beat',
    'lowest price', 'low price', 'reduced price',
    'best price', 'price drop', 'price cut',
    'act now', 'act fast', 'act today',
    'order now', 'order today', 'get now',
    'shop now', 'shop today', 'grab yours',
    'limited quantity', 'limited stock', 'low stock',
    'few left', 'only a few left', 'almost gone',
    'selling fast', 'sells fast', 'going fast',
    'last chance', 'final chance', 'one time only',
    "don't miss", 'dont miss', 'miss out',
    "don't wait", 'dont wait', 'wait no more',
    'limited availability', 'while supplies last',
    'until gone', 'before its gone', "won't last",
    'expires', 'expiring', 'ending soon'
  ],

  // Trademarked brands (will cause immediate rejection)
  trademarks: [
    // Sports brands
    'nike', 'adidas', 'puma', 'reebok', 'under armour',
    'new balance', 'asics', 'fila', 'champion',

    // Entertainment
    'disney', 'pixar', 'marvel', 'dc comics', 'dc universe',
    'warner bros', 'warner brothers', 'universal',
    'dreamworks', 'illumination', 'paramount',
    'netflix', 'hulu', 'hbo', 'showtime',

    // Characters & franchises
    'mickey mouse', 'minnie mouse', 'donald duck',
    'harry potter', 'hogwarts', 'star wars', 'jedi',
    'pokemon', 'pikachu', 'nintendo', 'mario', 'zelda',
    'minecraft', 'fortnite', 'roblox', 'among us',
    'call of duty', 'cod', 'halo', 'gears of war',
    'playstation', 'xbox', 'sony', 'sega',
    'transformers', 'gi joe', 'barbie', 'hot wheels',
    'lego', 'playmobil', 'nerf', 'hasbro', 'mattel',

    // Tech companies
    'apple', 'iphone', 'ipad', 'macbook', 'airpods',
    'google', 'android', 'pixel', 'chromebook',
    'microsoft', 'windows', 'surface', 'office',
    'amazon', 'alexa', 'kindle', 'echo',
    'facebook', 'meta', 'instagram', 'whatsapp',
    'twitter', 'tiktok', 'snapchat', 'youtube',
    'spotify', 'netflix', 'twitch',

    // Food & beverage
    'coca cola', 'coke', 'pepsi', 'mountain dew',
    'starbucks', 'dunkin', 'mcdonalds', 'burger king',
    'wendys', 'taco bell', 'kfc', 'subway',
    'red bull', 'monster energy', 'gatorade',

    // Fashion
    'gucci', 'prada', 'louis vuitton', 'chanel',
    'versace', 'armani', 'burberry', 'hermes',
    'ralph lauren', 'tommy hilfiger', 'calvin klein',
    'levis', 'gap', 'old navy', 'zara', 'h&m',

    // Sports leagues & teams
    'nfl', 'nba', 'mlb', 'nhl', 'mls', 'fifa',
    'ufc', 'wwe', 'aew', 'nascar', 'formula 1',
    'olympics', 'olympic', 'world cup',

    // Automotive
    'ford', 'chevy', 'chevrolet', 'dodge', 'jeep',
    'toyota', 'honda', 'nissan', 'bmw', 'mercedes',
    'audi', 'volkswagen', 'tesla', 'ferrari', 'porsche'
  ],

  // Shipping and service promises
  servicePromises: [
    'free shipping', 'free delivery', 'fast shipping',
    'fast delivery', 'quick shipping', 'express shipping',
    'same day', 'same-day', 'next day', 'next-day',
    'overnight', 'rush delivery', 'expedited',
    'ships fast', 'ships quickly', 'ships today',
    'in stock', 'ready to ship', 'ships from usa',
    'domestic shipping', 'international shipping',
    'worldwide shipping', 'global shipping',
    'tracking', 'tracked', 'insured shipping',
    'satisfaction guaranteed', 'money back',
    '30 day return', '30-day return', 'easy returns',
    'no questions asked', 'hassle free', 'hassle-free',
    'customer service', '24/7 support', 'live chat'
  ],

  // Fabric and material claims (unless verifiable)
  materialClaims: [
    'organic', 'organic cotton', '100% cotton',
    'eco friendly', 'eco-friendly', 'sustainable',
    'recycled', 'recyclable', 'biodegradable',
    'vegan', 'cruelty free', 'cruelty-free',
    'fair trade', 'fairtrade', 'ethically made',
    'handmade', 'hand made', 'hand-made',
    'made in usa', 'made in america', 'american made',
    'imported', 'hand crafted', 'handcrafted',
    'artisan', 'artisanal', 'bespoke', 'custom made'
  ],

  // Dangerous or inappropriate content indicators
  inappropriate: [
    'explicit', 'adult', 'mature', 'nsfw',
    'sexy', 'sexual', 'erotic', 'nude',
    'violence', 'violent', 'gore', 'gory',
    'blood', 'bloody', 'death', 'kill', 'murder',
    'hate', 'hatred', 'racist', 'racism',
    'discrimination', 'offensive', 'vulgar',
    'profanity', 'swear', 'curse', 'damn', 'hell',
    'drug', 'drugs', 'marijuana', 'cannabis', 'weed',
    'cocaine', 'heroin', 'meth', 'lsd', 'mdma',
    'alcohol', 'beer', 'wine', 'vodka', 'whiskey',
    'drunk', 'intoxicated', 'high', 'stoned',
    'weapon', 'weapons', 'gun', 'guns', 'firearm',
    'knife', 'knives', 'bomb', 'explosive'
  ]
};

// Flatten all banned words into a single array
export const ALL_MERCH_BANNED_WORDS = Object.values(MERCH_BANNED_WORDS).flat();

/**
 * Check if text contains any banned words
 */
export function containsBannedWords(text: string): boolean {
  const lowerText = text.toLowerCase();
  return ALL_MERCH_BANNED_WORDS.some(word => {
    // Escape special regex characters in the banned word
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    return regex.test(lowerText);
  });
}

/**
 * Find all banned words in text
 * Returns array of found banned words
 */
export function findBannedWords(text: string): string[] {
  const lowerText = text.toLowerCase();
  const found: string[] = [];

  for (const word of ALL_MERCH_BANNED_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    if (regex.test(lowerText)) {
      found.push(word);
    }
  }

  return [...new Set(found)]; // Remove duplicates
}

/**
 * Get banned words organized by category
 */
export function getBannedWordCategories(): Record<string, string[]> {
  return MERCH_BANNED_WORDS;
}

/**
 * Get total count of banned words
 */
export function getBannedWordCount(): number {
  return ALL_MERCH_BANNED_WORDS.length;
}

/**
 * Check if a specific category contains a word
 */
export function isInCategory(word: string, category: keyof typeof MERCH_BANNED_WORDS): boolean {
  return MERCH_BANNED_WORDS[category].some(
    banned => banned.toLowerCase() === word.toLowerCase()
  );
}

/**
 * Remove banned words from text
 * Returns cleaned text with banned words removed
 */
export function removeBannedWords(text: string): string {
  let cleaned = text;

  for (const word of ALL_MERCH_BANNED_WORDS) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  }

  // Clean up extra whitespace
  return cleaned.replace(/\s+/g, ' ').trim();
}
