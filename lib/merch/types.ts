export interface MerchDesign {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  mode: 'autopilot' | 'manual';
  riskLevel?: number;
  sourceData?: any;
  userSpecs?: ManualSpecs;
  phrase: string;
  niche: string;
  style?: string;
  tone?: string;
  imageUrl: string;
  imagePrompt: string;
  listingBrand?: string;       // Brand name for the listing
  listingTitle: string;
  listingBullets: string[];
  listingDesc: string;
  listingKeywords?: string[];  // Keywords for Amazon search
  approved: boolean;
  approvedAt?: Date;
  userRating?: number;
  views: number;
  sales: number;
  parentId?: string;
  // Library integration
  libraryDesignId?: string;    // ID of the corresponding DesignHistory record
}

export interface ManualSpecs {
  exactText: string;
  style?: string;
  imageFeature?: string;
  niche?: string;
  tone?: string;
  additionalInstructions?: string;
}

export interface AutopilotParams {
  riskLevel: number;
}

// Image generation models
export type ImageModel = 'gemini' | 'gpt-image-1' | 'ideogram' | 'dalle3';

export interface GenerationRequest {
  mode: 'autopilot' | 'manual';
  riskLevel?: number;
  specs?: ManualSpecs;

  // Enhanced options
  imageModel?: ImageModel;                       // Which model to use for image generation
  useEnhancedListing?: boolean;                  // Use keyword-intelligent listing generation
  useStyleDiscovery?: boolean;                   // Use discovered niche style profiles
  useCrossNicheBlend?: boolean;                  // Apply cross-niche style blending
  useBriefSystem?: boolean;                      // Use DesignBrief system (recommended)
  promptMode?: 'simple' | 'advanced';            // Prompt complexity
}

export interface GenerationResponse {
  success: boolean;
  design?: MerchDesign;
  error?: string;
}

// ============================================================================
// DESIGN BRIEF - The Contract Between Research and Execution
// ============================================================================
// This interface represents a BINDING CONTRACT that the execution phase
// MUST honor. Style information discovered during research flows through
// this interface without loss or compression.

export interface DesignBrief {
  // REQUIRED TEXT - Execution MUST use these exactly
  text: {
    exact: string;           // The phrase, verbatim - do not paraphrase
    maxLength?: number;      // Optional max length
    preserveCase: boolean;   // Whether to preserve original casing
  };

  // REQUIRED STYLE - Discovered from market data or specified by user
  style: {
    source: 'discovered' | 'researched' | 'user-specified' | 'niche-default';
    confidence: number;      // 0-1, how confident we are in this style

    typography: {
      required: string;      // e.g., "bold sans-serif with slight distress"
      forbidden?: string[];  // e.g., ["script", "neon", "comic sans"]
      weight?: string;       // e.g., "bold", "regular", "light"
      effects?: string[];    // e.g., ["distressed", "shadow", "outline"]
    };

    colorApproach: {
      palette: string[];     // e.g., ["warm earth tones", "forest green", "cream"]
      mood: string;          // e.g., "cozy", "energetic", "professional"
      forbidden?: string[];  // e.g., ["neon", "rainbow", "black and white"]
      shirtColor: string;    // Recommended shirt color for contrast
    };

    aesthetic: {
      primary: string;       // e.g., "cozy cabin fishing lodge vibe"
      keywords: string[];    // e.g., ["rustic", "outdoor", "morning"]
      forbidden?: string[];  // e.g., ["urban", "streetwear", "grunge"]
      reference?: string;    // e.g., "vintage outdoor catalog aesthetic"
    };

    layout: {
      composition: string;   // e.g., "centered with small icon below"
      textPlacement: string; // e.g., "top-heavy", "centered", "stacked"
      includeIcon?: boolean; // Whether to include an icon/illustration
      iconStyle?: string;    // e.g., "simple line art", "detailed illustration"
    };
  };

  // CONTEXT - Informs but doesn't override style
  context: {
    niche: string;
    audienceDescription: string;
    seasonalModifier?: string;  // e.g., "christmas" changes style variant
    crossNicheBlend?: string[]; // e.g., ["coffee", "fishing"] for fusion
    tone: string;               // e.g., "funny", "heartfelt", "sarcastic"
  };

  // METADATA - For tracking and debugging
  _meta: {
    briefId: string;
    createdAt: Date;
    researchSource: string;     // Which agent(s) contributed
    styleConfidence: number;    // Overall confidence in style choices
    originalTrendData?: any;    // Raw trend data for reference
  };
}

// Result of design execution
export interface DesignExecutionResult {
  success: boolean;
  prompt: string;
  compliance: {
    textPreserved: boolean;
    typographyFollowed: boolean;
    colorApproachFollowed: boolean;
    aestheticFollowed: boolean;
    forbiddenElementsAvoided: boolean;
    overallScore: number;        // 0-1 compliance score
  };
  warnings?: string[];           // Any compliance concerns
  error?: string;
}

// Style profile discovered from market analysis
export interface NicheStyleProfile {
  niche: string;
  sampleSize: number;
  lastAnalyzed: Date;
  confidence: number;

  // Discovered from actual MBA products
  dominantTypography: {
    primary: string;
    secondary?: string;
    examples: string[];
  };

  colorPalette: {
    primary: string[];
    accent: string[];
    background: string[];        // Typical shirt colors that work
    seasonalVariants?: Record<string, string[]>;
  };

  layoutPatterns: {
    dominant: string;
    alternatives: string[];
    textPlacement: string;
    iconUsage: 'common' | 'rare' | 'none';
  };

  illustrationStyle: {
    dominant: string;            // "hand-drawn", "vector", "none", "photographic"
    subjectMatter: string[];     // Common visual elements
  };

  moodAesthetic: {
    primary: string;
    secondary?: string;
    avoid: string[];             // Styles that don't work for this niche
  };
}

// Cross-niche opportunity
export interface CrossNicheOpportunity {
  nicheA: string;
  nicheB: string;
  amazonGap: 'blue_ocean' | 'early_mover' | 'competitive' | 'saturated';
  existingProducts: number;
  suggestedPhrases: string[];
  blendedStyle: Partial<NicheStyleProfile>;
  confidence: number;
  validatedAt: Date;
}

// Keyword intelligence from multiple sources
export interface KeywordIntelligence {
  niche: string;
  fetchedAt: Date;

  autocomplete: string[];        // From Amazon autocomplete
  competitorKeywords: string[];  // From top BSR product titles
  customerLanguage: string[];    // From reviews
  longTail: string[];            // 3+ word phrases

  titlePatterns: {
    pattern: string;
    successRate: number;
    examples: string[];
  }[];

  bulletFormulas: {
    formula: string;
    examples: string[];
  }[];
}
