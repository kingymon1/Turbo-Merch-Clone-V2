/**
 * Image Prompt Builder for Merch Design Generator
 *
 * Creates optimized prompts for Gemini Imagen based on mode and specs.
 *
 * ARCHITECTURE:
 * - Legacy functions (createImagePrompt, buildManualPrompt, buildAutopilotPrompt) remain for backwards compatibility
 * - New DesignBrief system uses executeDesignBrief for strict style compliance
 * - The DesignBrief system ensures style information flows from research → image without loss
 */

import { ManualSpecs, DesignBrief, DesignExecutionResult, NicheStyleProfile } from './types';
import { executeDesignBrief, createDesignBriefFromTrend } from './design-executor';

export interface DesignConcept {
  phrase: string;
  niche: string;
  style?: string;
  tone?: string;
  visualStyle?: string;
  imageFeature?: string;
}

/**
 * Create an image generation prompt based on mode and design concept
 */
export function createImagePrompt(
  concept: DesignConcept,
  mode: 'autopilot' | 'manual',
  specs?: ManualSpecs
): string {
  const { phrase, niche, style, tone, visualStyle, imageFeature } = concept;

  // Determine the visual style to use
  const effectiveStyle = specs?.style || style || visualStyle || 'Bold Modern';
  const effectiveTone = specs?.tone || tone || 'Funny';
  const icon = specs?.imageFeature || imageFeature;

  // Base prompt structure - always include these for best results
  const baseRequirements = [
    'center composition',
    'high contrast',
    'transparent background',
    'print-ready design',
    't-shirt graphic',
  ].join(', ');

  if (mode === 'manual' && specs) {
    // Manual mode: Honor exact user specifications
    return buildManualPrompt(phrase, effectiveStyle, effectiveTone, icon, niche, specs.additionalInstructions);
  } else {
    // Autopilot mode: Pass through the rich visualStyle from research
    return buildAutopilotPrompt(phrase, effectiveStyle, effectiveTone, niche, visualStyle);
  }
}

/**
 * Build prompt for manual mode - respects user specifications
 */
function buildManualPrompt(
  phrase: string,
  style: string,
  tone: string,
  icon?: string,
  niche?: string,
  additionalInstructions?: string
): string {
  const styleMapping: Record<string, string> = {
    'Bold Modern': 'bold modern sans-serif typography, clean lines, contemporary design',
    'Vintage Retro': 'vintage retro typography, distressed texture, 70s-80s aesthetic, weathered look',
    'Elegant Script': 'elegant script calligraphy, flowing cursive, sophisticated design',
    'Minimalist': 'minimalist design, clean typography, simple composition, whitespace',
    'Distressed': 'heavily distressed grunge style, worn texture, urban aesthetic',
    'Playful': 'playful cartoon style, fun typography, bright cheerful design',
    'Professional': 'professional clean design, corporate-friendly, polished look',
  };

  const styleDescription = styleMapping[style] || styleMapping['Bold Modern'];

  let prompt = `T-shirt design with the text "${phrase}". ${styleDescription}`;

  // Add icon/image feature if specified
  if (icon) {
    prompt += `. Include ${icon} as a visual element`;
  }

  // Add tone influence
  if (tone && tone !== 'Let AI decide') {
    const toneMapping: Record<string, string> = {
      'Funny': 'humorous playful vibe',
      'Inspirational': 'uplifting motivational feel',
      'Sarcastic': 'witty sarcastic edge',
      'Heartfelt': 'warm emotional sentiment',
      'Proud': 'bold confident pride',
      'Edgy': 'edgy rebellious attitude',
    };
    prompt += `. ${toneMapping[tone] || ''}`;
  }

  // Add niche context if provided
  if (niche) {
    prompt += `. Designed for ${niche} audience`;
  }

  // Add user's additional instructions
  if (additionalInstructions) {
    prompt += `. ${additionalInstructions}`;
  }

  // Add technical requirements
  prompt += `. Center composition, high contrast, transparent background, print-ready.`;

  return prompt;
}

/**
 * Build prompt for autopilot mode - uses rich visualStyle from trend research
 */
function buildAutopilotPrompt(
  phrase: string,
  style: string,
  tone: string,
  niche: string,
  visualStyle?: string
): string {
  // Use the rich visualStyle from research if available (80+ chars of creative direction)
  // This is the key fix - we were compressing rich style data into generic keywords
  if (visualStyle && visualStyle.length > 20) {
    return `T-shirt design with the text "${phrase}".

STYLE DIRECTION: ${visualStyle}

Designed for ${niche} audience. ${tone} vibe.
Center composition, high contrast, transparent background, print-ready graphic.`;
  }

  // Fallback: use basic style hints if no rich visualStyle available
  const styleHint = style.toLowerCase().includes('vintage') ? 'vintage retro distressed' :
                    style.toLowerCase().includes('minimalist') ? 'clean minimalist' :
                    style.toLowerCase().includes('playful') ? 'fun playful colorful' :
                    style.toLowerCase().includes('elegant') ? 'elegant script calligraphy' :
                    style.toLowerCase().includes('distress') ? 'grunge distressed worn' :
                    'bold modern typography';

  return `T-shirt design: "${phrase}" in ${styleHint} style. Perfect for ${niche}. ${tone} vibe. Center composition, high contrast, transparent background, print-ready graphic.`;
}

/**
 * Create a simple prompt for quick generation (used in testing)
 */
export function createSimplePrompt(phrase: string, style: string = 'bold modern'): string {
  return `T-shirt design with text "${phrase}". ${style} typography, center composition, transparent background, print-ready.`;
}

// ============================================================================
// NEW: DESIGN BRIEF SYSTEM - Ensures style flows from research → image intact
// ============================================================================

/**
 * Create an image prompt using the DesignBrief system
 * This is the preferred method as it ensures style compliance
 */
export async function createImagePromptFromBrief(
  brief: DesignBrief
): Promise<DesignExecutionResult> {
  console.log(`[ImagePrompter] Creating prompt from brief for: "${brief.text.exact}"`);
  console.log(`[ImagePrompter] Style source: ${brief.style.source}, confidence: ${brief.style.confidence}`);

  const result = await executeDesignBrief(brief);

  if (result.success) {
    console.log(`[ImagePrompter] Prompt created with ${result.compliance.overallScore * 100}% compliance`);
  } else {
    console.log(`[ImagePrompter] Prompt creation failed: ${result.error}`);
  }

  return result;
}

/**
 * Create a DesignBrief from trend data
 * Use this when generating from autopilot research results
 *
 * NOW ASYNC: Uses agent-based niche style research when data is incomplete
 */
export async function buildDesignBriefFromTrend(
  trendData: {
    topic?: string;
    designText?: string;
    phrase?: string;
    niche?: string;
    audienceProfile?: string;
    visualStyle?: string;
    designStyle?: string;
    colorPalette?: string;
    recommendedShirtColor?: string;
    sentiment?: string;
    typographyStyle?: string;
    // Text layout from research agent
    textLayout?: {
      positioning?: string;
      emphasis?: string;
      sizing?: string;
      reasoning?: string;
    };
  },
  nicheStyle?: Partial<NicheStyleProfile>,
  userOverrides?: {
    text?: string;
    style?: string;
    tone?: string;
  }
): Promise<DesignBrief> {
  return createDesignBriefFromTrend(trendData, nicheStyle, userOverrides);
}

/**
 * Create a DesignBrief for manual mode
 * User specifications take priority
 */
export function buildDesignBriefFromManualSpecs(
  specs: ManualSpecs,
  nicheStyle?: Partial<NicheStyleProfile>
): DesignBrief {
  const niche = specs.niche || 'general';
  const tone = specs.tone || 'funny';

  // Build typography based on user style selection
  const typography = buildTypographyFromStyle(specs.style);

  // Build color approach - user can override with additional instructions
  const colorApproach = buildColorApproachFromStyle(specs.style);

  // Build aesthetic from user style
  const aesthetic = buildAestheticFromStyle(specs.style, specs.additionalInstructions);

  // Build layout
  const layout = buildLayoutFromStyle(specs.style, specs.imageFeature);

  const brief: DesignBrief = {
    text: {
      exact: specs.exactText,
      preserveCase: true
    },
    style: {
      source: 'user-specified',
      confidence: 0.9, // High confidence since user specified it
      typography,
      colorApproach,
      aesthetic,
      layout
    },
    context: {
      niche,
      audienceDescription: `${niche} enthusiasts`,
      tone,
      seasonalModifier: detectSeasonFromText(specs.exactText),
      crossNicheBlend: undefined
    },
    _meta: {
      briefId: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      researchSource: 'user-manual',
      styleConfidence: 0.9
    }
  };

  // Apply niche style if available (can enhance user choices)
  if (nicheStyle) {
    brief.style.confidence = Math.min(0.95, brief.style.confidence + 0.1);
    // Add forbidden elements from niche style
    if (nicheStyle.moodAesthetic?.avoid) {
      brief.style.aesthetic.forbidden = [
        ...(brief.style.aesthetic.forbidden || []),
        ...nicheStyle.moodAesthetic.avoid
      ];
    }
  }

  return brief;
}

/**
 * Helper: Build typography from user style selection
 */
function buildTypographyFromStyle(style?: string): DesignBrief['style']['typography'] {
  const styleMap: Record<string, { required: string; effects?: string[] }> = {
    'Bold Modern': { required: 'bold modern sans-serif, clean lines', effects: [] },
    'Vintage Retro': { required: 'vintage serif with distressed texture', effects: ['distressed', 'worn'] },
    'Elegant Script': { required: 'elegant script calligraphy, flowing curves', effects: ['flowing'] },
    'Minimalist': { required: 'thin clean sans-serif, minimal weight', effects: [] },
    'Distressed': { required: 'grunge distressed typography, urban worn look', effects: ['heavy distress', 'worn'] },
    'Playful': { required: 'rounded friendly sans-serif, fun bouncy letters', effects: ['playful'] },
    'Professional': { required: 'clean professional sans-serif, polished', effects: [] }
  };

  const match = styleMap[style || 'Bold Modern'] || styleMap['Bold Modern'];

  return {
    required: match.required,
    weight: style?.toLowerCase().includes('bold') ? 'bold' : 'medium',
    effects: match.effects?.length ? match.effects : undefined
  };
}

/**
 * Helper: Build color approach from user style selection
 */
function buildColorApproachFromStyle(style?: string): DesignBrief['style']['colorApproach'] {
  const styleColorMap: Record<string, { palette: string[]; mood: string; shirtColor: string }> = {
    'Bold Modern': { palette: ['vibrant colors', 'high contrast'], mood: 'energetic', shirtColor: 'black' },
    'Vintage Retro': { palette: ['muted earth tones', 'cream', 'rust'], mood: 'nostalgic', shirtColor: 'heather gray' },
    'Elegant Script': { palette: ['soft pastels', 'gold accents'], mood: 'sophisticated', shirtColor: 'white' },
    'Minimalist': { palette: ['monochrome', 'single accent color'], mood: 'calm', shirtColor: 'white' },
    'Distressed': { palette: ['dark tones', 'weathered colors'], mood: 'edgy', shirtColor: 'black' },
    'Playful': { palette: ['bright primary colors', 'rainbow options'], mood: 'cheerful', shirtColor: 'white' },
    'Professional': { palette: ['navy', 'gray', 'subtle tones'], mood: 'trustworthy', shirtColor: 'navy' }
  };

  const match = styleColorMap[style || 'Bold Modern'] || styleColorMap['Bold Modern'];

  return {
    palette: match.palette,
    mood: match.mood,
    shirtColor: match.shirtColor
  };
}

/**
 * Helper: Build aesthetic from user style and instructions
 */
function buildAestheticFromStyle(
  style?: string,
  additionalInstructions?: string
): DesignBrief['style']['aesthetic'] {
  const styleAestheticMap: Record<string, { primary: string; keywords: string[] }> = {
    'Bold Modern': { primary: 'contemporary bold design with clean modern appeal', keywords: ['modern', 'clean', 'bold'] },
    'Vintage Retro': { primary: 'nostalgic vintage design with retro charm', keywords: ['vintage', 'retro', 'nostalgic', 'classic'] },
    'Elegant Script': { primary: 'sophisticated elegant design with refined aesthetics', keywords: ['elegant', 'refined', 'sophisticated'] },
    'Minimalist': { primary: 'clean minimalist design with intentional whitespace', keywords: ['minimal', 'clean', 'simple'] },
    'Distressed': { primary: 'urban grunge aesthetic with worn texture', keywords: ['grunge', 'urban', 'distressed', 'edgy'] },
    'Playful': { primary: 'fun playful design with cheerful energy', keywords: ['playful', 'fun', 'cheerful', 'whimsical'] },
    'Professional': { primary: 'polished professional design with corporate appeal', keywords: ['professional', 'polished', 'clean'] }
  };

  const match = styleAestheticMap[style || 'Bold Modern'] || styleAestheticMap['Bold Modern'];

  // Parse additional instructions for extra keywords
  const extraKeywords: string[] = [];
  if (additionalInstructions) {
    const instructions = additionalInstructions.toLowerCase();
    if (instructions.includes('outdoor')) extraKeywords.push('outdoor', 'nature');
    if (instructions.includes('rustic')) extraKeywords.push('rustic', 'handmade');
    if (instructions.includes('tech')) extraKeywords.push('tech', 'digital');
    if (instructions.includes('cozy')) extraKeywords.push('cozy', 'warm');
  }

  return {
    primary: additionalInstructions ? `${match.primary}. ${additionalInstructions}` : match.primary,
    keywords: [...match.keywords, ...extraKeywords]
  };
}

/**
 * Helper: Build layout from style and image feature
 */
function buildLayoutFromStyle(
  style?: string,
  imageFeature?: string
): DesignBrief['style']['layout'] {
  const hasIcon = !!imageFeature;

  const styleLayoutMap: Record<string, string> = {
    'Bold Modern': 'centered, balanced composition',
    'Vintage Retro': 'centered with badge or emblem feel',
    'Elegant Script': 'centered, flowing composition',
    'Minimalist': 'centered with generous whitespace',
    'Distressed': 'slightly off-center, raw feel',
    'Playful': 'dynamic, slightly askew composition',
    'Professional': 'perfectly centered, formal layout'
  };

  return {
    composition: styleLayoutMap[style || 'Bold Modern'] || 'centered, balanced composition',
    textPlacement: 'centered',
    includeIcon: hasIcon,
    iconStyle: hasIcon ? `${imageFeature} in matching style` : undefined
  };
}

/**
 * Helper: Detect seasonal context from text
 */
function detectSeasonFromText(text: string): string | undefined {
  const textLower = text.toLowerCase();

  if (textLower.includes('christmas') || textLower.includes('xmas') || textLower.includes('santa')) return 'christmas';
  if (textLower.includes('halloween') || textLower.includes('spooky')) return 'halloween';
  if (textLower.includes('valentine') || textLower.includes('love')) return 'valentines';
  if (textLower.includes('easter')) return 'easter';
  if (textLower.includes('mother')) return 'mothers-day';
  if (textLower.includes('father')) return 'fathers-day';
  if (textLower.includes('july') || textLower.includes('patriot')) return 'july-4th';
  if (textLower.includes('thanksgiving') || textLower.includes('turkey')) return 'thanksgiving';

  return undefined;
}

/**
 * HYBRID: Generate prompt using both legacy and new systems
 * Uses DesignBrief system when possible, falls back to legacy
 */
export async function createImagePromptHybrid(
  concept: DesignConcept,
  mode: 'autopilot' | 'manual',
  specs?: ManualSpecs,
  nicheStyle?: Partial<NicheStyleProfile>,
  useBriefSystem: boolean = true
): Promise<{
  prompt: string;
  usedBriefSystem: boolean;
  compliance?: DesignExecutionResult['compliance'];
}> {
  // Try the new DesignBrief system if enabled
  if (useBriefSystem) {
    try {
      let brief: DesignBrief;

      if (mode === 'manual' && specs) {
        brief = buildDesignBriefFromManualSpecs(specs, nicheStyle);
      } else {
        brief = await buildDesignBriefFromTrend(
          {
            phrase: concept.phrase,
            niche: concept.niche,
            visualStyle: concept.visualStyle,
            designStyle: concept.style,
            sentiment: concept.tone
          },
          nicheStyle
        );
      }

      const result = await createImagePromptFromBrief(brief);

      if (result.success) {
        return {
          prompt: result.prompt,
          usedBriefSystem: true,
          compliance: result.compliance
        };
      }

      // If brief system failed, fall through to legacy
      console.log('[ImagePrompter] Brief system failed, falling back to legacy');
    } catch (error) {
      console.error('[ImagePrompter] Brief system error, falling back to legacy:', error);
    }
  }

  // Fallback to legacy system
  const legacyPrompt = createImagePrompt(concept, mode, specs);
  return {
    prompt: legacyPrompt,
    usedBriefSystem: false
  };
}

// Export the brief-related functions for direct use
export {
  executeDesignBrief,
  createDesignBriefFromTrend
};
