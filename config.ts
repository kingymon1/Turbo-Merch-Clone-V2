/**
 * Application Configuration
 * Centralized configuration for the Turbo Merch application
 */

// Subscription Tiers and Retention Policies
export const SUBSCRIPTION_CONFIG = {
  tiers: {
    starter: {
      name: 'Starter',
      retentionDays: 7,
      price: 19.99,
      stripeMonthlyPriceId: 'price_starter_monthly',
      stripeYearlyPriceId: 'price_starter_yearly'
    },
    pro: {
      name: 'Pro',
      retentionDays: 30,
      price: 59.99,
      stripeMonthlyPriceId: 'price_pro_monthly',
      stripeYearlyPriceId: 'price_pro_yearly'
    },
    agency: {
      name: 'Business',
      retentionDays: 365,
      price: 99.99,
      stripeMonthlyPriceId: 'price_agency_monthly',
      stripeYearlyPriceId: 'price_agency_yearly'
    },
    enterprise: {
      name: 'Enterprise',
      retentionDays: 365,
      price: 199.99,
      stripeMonthlyPriceId: 'price_enterprise_monthly',
      stripeYearlyPriceId: 'price_enterprise_yearly'
    }
  },
  defaultTier: 'pro' as const
};

// AI Model Configuration
// Text: Gemini 3 Pro Preview for high-quality listing text generation
// Image: Gemini 3 Pro Image (Preview) - Required for advanced image generation
export const AI_CONFIG = {
  models: {
    text: 'gemini-3-pro-preview',
    image: 'gemini-3-pro-image-preview'
  },
  // Request timeouts in milliseconds
  timeouts: {
    trendSearch: 60000,
    listingGeneration: 30000,
    imageGeneration: 120000,
    designResearch: 45000
  },
  // Rate limiting
  rateLimits: {
    requestsPerMinute: 10,
    requestsPerHour: 100
  }
};

// Design Aesthetic Reference Library
// These serve as educational examples and inspiration for Gemini 3 Pro
// NOT rigid templates - Gemini is free to create custom aesthetic approaches
export const DESIGN_AESTHETICS = {
  streetwear: {
    name: 'Streetwear',
    typography: 'Bold, distressed, graffiti-inspired, heavy sans-serif, impactful fonts with attitude',
    visualStyle: 'Urban graphics, bold imagery, high contrast, street art influences, edgy compositions',
    colorPalette: 'Bold primary colors, black and white contrast, vibrant accents',
    placement: 'Oversized chest print, large back graphics, or all-over print',
    tone: 'Bold, irreverent, confident, youth culture'
  },
  minimalist: {
    name: 'Minimalist Professional',
    typography: 'Clean sans-serif, subtle serifs, geometric fonts, professional clarity',
    visualStyle: 'Simple icons, clean lines, negative space, sophisticated layouts',
    colorPalette: 'Monochromatic, muted tones, professional color theory',
    placement: 'Left chest, subtle center, small pocket area',
    tone: 'Professional, refined, sophisticated, understated'
  },
  vintage: {
    name: 'Vintage/Retro',
    typography: 'Retro scripts, classic serifs, period-specific lettering, nostalgic fonts',
    visualStyle: 'Distressed textures, vintage badges, retro illustrations, faded aesthetics',
    colorPalette: 'Faded colors, sepia tones, vintage color palettes, aged effects',
    placement: 'Classic chest placement, vintage badge positioning',
    tone: 'Nostalgic, timeless, authentic, heritage'
  },
  wholesome: {
    name: 'Wholesome/Family',
    typography: 'Friendly rounded fonts, handwritten styles, warm readable text',
    visualStyle: 'Soft illustrations, heartwarming imagery, approachable graphics',
    colorPalette: 'Warm pastels, friendly bright colors, approachable tones',
    placement: 'Center chest, friendly positioning',
    tone: 'Warm, friendly, family-oriented, positive'
  },
  outdoor: {
    name: 'Outdoor/Adventure',
    typography: 'Rugged fonts, outdoor-inspired lettering, adventure typography',
    visualStyle: 'Nature elements, mountain/forest imagery, adventure icons, outdoor scenes',
    colorPalette: 'Earth tones, forest greens, sky blues, natural colors',
    placement: 'Classic outdoor brand positioning',
    tone: 'Adventurous, rugged, nature-connected, explorer'
  },
  professional: {
    name: 'Professional/Healthcare',
    typography: 'Medical-grade clarity, professional sans-serif, trustworthy fonts',
    visualStyle: 'Professional symbols, medical icons, clean imagery, trustworthy graphics',
    colorPalette: 'Medical blues, trustworthy colors, professional palette',
    placement: 'Professional placement, work-appropriate positioning',
    tone: 'Trustworthy, professional, respectful, competent'
  },
  inspirational: {
    name: 'Inspirational/Faith',
    typography: 'Elegant scripts, inspirational lettering, meaningful typography',
    visualStyle: 'Uplifting imagery, symbolic graphics, meaningful illustrations',
    colorPalette: 'Peaceful colors, inspirational tones, hopeful palette',
    placement: 'Centered, meaningful positioning',
    tone: 'Uplifting, meaningful, hopeful, spiritual'
  },
  bold_graphic: {
    name: 'Bold Graphic',
    typography: 'Impact fonts, bold display type, attention-grabbing typography',
    visualStyle: 'Strong graphics, high impact imagery, bold compositions',
    colorPalette: 'High contrast, bold colors, attention-grabbing combinations',
    placement: 'Large impact placements',
    tone: 'Bold, confident, impactful, statement-making'
  },
  artistic: {
    name: 'Artistic/Creative',
    typography: 'Artistic fonts, creative lettering, expressive typography',
    visualStyle: 'Artistic illustrations, creative compositions, expressive art',
    colorPalette: 'Artistic color theory, creative palettes, expressive colors',
    placement: 'Artistic composition placement',
    tone: 'Creative, expressive, artistic, unique'
  }
};

// Amazon Merch Specifications
export const AMAZON_MERCH_SPECS = {
  listing: {
    maxTitleLength: 60,
    maxBrandLength: 50,
    maxBulletLength: 256,
    maxBulletsCount: 2,
    maxDescriptionLength: 256
  },
  design: {
    printWidth: 4500,
    printHeight: 5400,
    dpi: 300,
    format: 'PNG' as const,
    maxFileSizeBytes: 25 * 1024 * 1024 // 25MB
  }
};

// Virality Level Type for type safety
export interface ViralityLevel {
  label: string;
  desc: string;
  longDesc: string;
  color: string;
  bg: string;
  sources: string[];
  freshness: string;
  rabbitHole: boolean;
  riskLevel: string;
  competition: string;
}

// Virality Levels Configuration
// Used by TrendScanner for research strategy selection
export const VIRALITY_LEVELS: ViralityLevel[] = [
  {
    label: "Mainstream",
    desc: "Safe bets with proven demand",
    longDesc: "Established trends with high search volume. Products already selling on Amazon. Broad appeal, timeless themes.",
    color: "text-blue-400",
    bg: "bg-blue-500",
    sources: ["Google Trends", "Major News"],
    freshness: "Past Month",
    rabbitHole: false,
    riskLevel: "Low",
    competition: "High"
  },
  {
    label: "Rising",
    desc: "Breakout trends gaining momentum",
    longDesc: "Growing search interest, emerging on social media. Balance of novelty with marketability. Sweet spot for timing.",
    color: "text-green-400",
    bg: "bg-green-500",
    sources: ["TikTok", "Instagram", "Google"],
    freshness: "Past Week",
    rabbitHole: false,
    riskLevel: "Low-Medium",
    competition: "Medium"
  },
  {
    label: "Breakout",
    desc: "Just spiking - high potential",
    longDesc: "Trends hitting critical mass right now. Higher reward potential, timing is crucial. Good for first-movers.",
    color: "text-yellow-400",
    bg: "bg-yellow-500",
    sources: ["Reddit", "Twitter/X", "Forums"],
    freshness: "Past Week",
    rabbitHole: false,
    riskLevel: "Medium",
    competition: "Medium-Low"
  },
  {
    label: "Underground",
    desc: "Niche communities, insider language",
    longDesc: "Passionate fan communities with their own slang. Low competition, trends before they go mainstream. Activates Rabbit Hole exploration.",
    color: "text-orange-400",
    bg: "bg-orange-500",
    sources: ["Deep Reddit", "Discord", "Niche Forums"],
    freshness: "Past Week",
    rabbitHole: true,
    riskLevel: "Medium-High",
    competition: "Low"
  },
  {
    label: "Predictive",
    desc: "Blue ocean - high risk/reward",
    longDesc: "Emerging patterns others haven't spotted. Mashups, crossovers, unexpected combinations. Creates new trends. Full Rabbit Hole mode.",
    color: "text-red-500",
    bg: "bg-red-600",
    sources: ["AI Synthesis", "Cross-Niche", "Emerging"],
    freshness: "Last 24 Hours",
    rabbitHole: true,
    riskLevel: "High",
    competition: "Very Low"
  }
];

// Trend Discovery Configuration
export const TREND_CONFIG = {
  // Keep legacy viralityLevels for backward compatibility
  viralityLevels: VIRALITY_LEVELS,
  // Discovery queries - TOPIC-AGNOSTIC
  // Let the AI discover what's actually trending across ALL categories
  // These queries ask HOW to find trends, not WHAT topics to find
  globalDiscoveryQueries: [
    'what topics are capturing attention right now',
    'what are people passionate about today',
    'what unexpected things are trending this week',
    'what communities are most excited right now',
    'what are people talking about and sharing today'
  ],
  // Seasonal discovery - rotates based on time of year
  seasonalDiscoveryHints: [
    'current holiday events and celebrations',
    'seasonal trends and upcoming occasions',
    'sports events and games happening now',
    'entertainment news movies shows releases'
  ]
};

// Storage Configuration
export const STORAGE_CONFIG = {
  keys: {
    library: 'turbomerch_library',
    preferences: 'turbomerch_preferences',
    lastSync: 'turbomerch_last_sync'
  },
  limits: {
    maxItemsPerUser: 1000,
    estimatedQuotaBytes: 5 * 1024 * 1024 // 5MB
  }
};

// API Endpoints
export const API_ENDPOINTS = {
  stripe: {
    createCheckoutSession: '/api/stripe/create-checkout-session',
    createPortalSession: '/api/stripe/create-portal-session'
  },
  brave: {
    search: 'https://api.search.brave.com/res/v1/web/search'
  },
  grok: {
    chat: 'https://api.x.ai/v1/chat/completions'
  }
};

// UI Configuration
export const UI_CONFIG = {
  animations: {
    defaultDuration: 200,
    slowDuration: 400
  },
  colors: {
    brand: {
      primary: '#0ea5e9', // sky-500 (brand-500)
      secondary: '#06b6d4' // cyan-500 (secondary accent)
    }
  },
  breakpoints: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280
  }
};

// Feature Flags
export const FEATURES = {
  enableAnonymousMode: true,
  enableAutoPilot: true,
  enableImageProcessing: true,
  enableBraveSearch: true,
  enableGrokIntegration: true,
  // Vectorizer.AI HD downloads - reads from env var, defaults to false
  enableVectorizer: process.env.NEXT_PUBLIC_VECTORIZER_ENABLED === 'true'
};

// Vectorizer.AI Configuration
export const VECTORIZER_CONFIG = {
  // Feature is enabled via NEXT_PUBLIC_VECTORIZER_ENABLED env var
  enabled: process.env.NEXT_PUBLIC_VECTORIZER_ENABLED === 'true',
  // Input limits (from Vectorizer.AI docs)
  maxInputPixels: 3000000, // 3 megapixels
  maxInputFileSizeMB: 30,
  // Output is 4x input size
  outputMultiplier: 4,
  // Target output size for merch (4500x5400 @ 300 DPI)
  targetOutputWidth: 4500,
  targetOutputHeight: 5400,
  // Tiers that have access to HD downloads (free trial excluded)
  allowedTiers: ['starter', 'pro', 'agency', 'enterprise'] as const,
  // API timeout in ms (Vectorizer.AI recommends 180s minimum)
  timeoutMs: 180000
};

export default {
  SUBSCRIPTION_CONFIG,
  AI_CONFIG,
  AMAZON_MERCH_SPECS,
  TREND_CONFIG,
  STORAGE_CONFIG,
  API_ENDPOINTS,
  UI_CONFIG,
  FEATURES,
  VECTORIZER_CONFIG
};
