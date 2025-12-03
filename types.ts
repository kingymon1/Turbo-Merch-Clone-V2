
export enum AppView {
  DASHBOARD = 'DASHBOARD',
  TREND_RESEARCH = 'TREND_RESEARCH',
  TREND_LAB = 'TREND_LAB',
  LISTING_GENERATOR = 'LISTING_GENERATOR',
  LIBRARY = 'LIBRARY',
  IDEAS_VAULT = 'IDEAS_VAULT',
  SUBSCRIPTION = 'SUBSCRIPTION',
  REFUNDS = 'REFUNDS',
  TERMS = 'TERMS',
  PRIVACY = 'PRIVACY',
  CONTACT = 'CONTACT',
}

export interface TrendData {
  topic: string;
  platform: string;
  volume: string;
  sentiment: string;
  keywords: string[];
  description: string;

  // Visual & Design Direction
  visualStyle: string; // Detailed visual direction for design
  typographyStyle?: string; // Specific typography recommendations
  designStyle?: string; // streetwear/vintage/minimalist/meme/etc.
  colorPalette?: string; // Recommended colors and why
  designEffects?: string[]; // distressed, clean, gradient, halftone, etc.

  // Customer Language (Most Important!)
  customerPhrases: string[]; // EXACT phrases customers use
  purchaseSignals?: string[]; // Quotes showing buying intent
  designText?: string; // 2-5 words that would work ON the shirt
  audienceProfile?: string; // Who is this person? age, interests, values

  // Shirt/Product Recommendations
  recommendedShirtColor?: string; // black, white, navy, heather grey, etc.
  shirtColorReason?: string; // Why this color works for this design
  alternativeShirtColors?: string[]; // Other colors that would work

  // Metadata
  sourceUrl?: string;
  sources?: string[]; // e.g. ['Google', 'Grok', 'Brave', 'Rabbit Hole']
  amazonSafe?: boolean; // Safe for print-on-demand

  // Trend Classification
  interpretationLevel?: string; // Commercial, Niche, etc.
  undergroundLevel?: number; // 1-10 scale of how obscure the trend is
}

export interface GeneratedListing {
  title: string;
  brand: string;
  bullet1: string;
  bullet2: string;
  description: string;
  keywords: string[];
  imagePrompt: string; // AI crafted prompt for the image generator
  refinementInstruction?: string; // Instruction for image-to-image refinement
  designText: string; // Specific text to be rendered on the shirt
  price?: number;
}

export interface DesignRequest {
  prompt: string;
  style: string;
  aspectRatio: string;
}

// Enhanced design research data from Gemini 3 Pro analysis
export interface DesignResearch {
  aesthetic: string; // The chosen aesthetic category (e.g., 'streetwear', 'minimalist')
  targetDemographic: string; // Who this design is for
  layout?: string; // NEW: Dynamic layout selection
  archetypeId?: string; // NEW: AI-selected archetype ID
  customPromptStructure?: string; // NEW: For DYNAMIC mode, the AI writes the prompt structure
  designBrief: {
    exactText: string; // The exact text to render on the design
    typography: {
      primaryFont: string; // Specific font style description
      weight: string; // Font weight
      effects: string[]; // Typography effects (distressed, outlined, shadowed, etc.)
      letterSpacing: string; // Kerning/spacing
      hierarchy: string; // Text hierarchy and sizing
    };
    placement: {
      position: string; // Where on the shirt (center chest, left chest, oversized, etc.)
      size: string; // Relative size (large, medium, small)
      orientation: string; // Orientation and composition
    };
    visualElements: {
      primaryImagery: string; // Main visual elements
      style: string; // Illustration style
      composition: string; // How elements are arranged
      effects: string[]; // Visual effects (halftone, gradient, distressed, etc.)
    };
    colorStrategy: {
      palette: string; // Color palette description
      contrast: string; // Contrast approach
      meaning: string; // Cultural/emotional meaning of colors
    };
  };
  culturalContext: string; // Cultural relevance and context
  referenceStyles: string[]; // Example styles or references
}

export enum ProcessingStage {
  IDLE = 'IDLE',
  SEARCHING = 'SEARCHING',
  ANALYZING = 'ANALYZING',
  GENERATING_TEXT = 'GENERATING_TEXT',
  GENERATING_IMAGE = 'GENERATING_IMAGE',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

// Image generation prompt approach
export type PromptMode = 'advanced' | 'simple';

// Individual image version in history
export interface ImageVersion {
  imageUrl: string;
  promptMode: PromptMode;
  generatedAt: number; // Unix timestamp
  regenerationIndex: number; // 0 = original, 1+ = regenerations
}

export const PROMPT_MODE_INFO = {
  advanced: {
    label: 'Advanced',
    description: 'Detailed technical prompts with sections, constraints, and specific instructions',
    pros: ['More control over output', 'Specific typography rules', 'Detailed color strategies'],
    cons: ['Can be over-engineered', 'May confuse the model', 'Longer processing']
  },
  simple: {
    label: 'Simple',
    description: 'Conversational prompts like "Make a grunge style t-shirt design..."',
    pros: ['Natural language', 'Often better results', 'Faster to process'],
    cons: ['Less explicit control', 'Results may vary more']
  }
} as const;

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  description?: string; // e.g. "15 designs included"
  features: string[];
  recommended?: boolean;
  highlight?: string; // e.g. "MOST POPULAR"
  buttonText?: string;
  priceId?: string; // Stripe Price ID
  comingSoon?: boolean;
  disabled?: boolean;
}

// New interface to pass full package between components
export interface MerchPackage {
  trend: TrendData;
  listing: GeneratedListing;
  imageUrl: string; // Primary/latest image URL
  // Image history - all versions including regenerations
  imageHistory?: ImageVersion[];
  // Analytics metadata
  promptMode?: PromptMode;
  viralityLevel?: number;
  generatedAt?: number; // Unix timestamp for time tracking
}

export interface SavedListing extends MerchPackage {
  id: string;
  createdAt: number;
  expiresAt: number;
  tierAtCreation: string;
}

// Ideas Vault - stores trend ideas for later use
export interface SavedIdea {
  id: string;
  trend: TrendData;
  savedAt: number;
  expiresAt: number; // Expiration based on user's subscription tier
  tierAtCreation: string; // The tier the user was on when the idea was saved
  searchQuery: string; // The original search query that generated this idea
  viralityLevel: number; // The virality level used during search
  notes?: string; // Optional user notes
  isUsed?: boolean; // Track if this idea was already used to create a listing
  usedAt?: number; // When it was used
}
