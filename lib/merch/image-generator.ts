/**
 * Image Generator for Merch Design Generator
 *
 * Generates t-shirt design images using Gemini Imagen and DALL-E 3.
 * This module wraps the existing services for use by the merch generator feature.
 *
 * ARCHITECTURE:
 * - generateMerchImage() - Legacy function using direct prompts
 * - generateMerchImageFromBrief() - New function using DesignBrief system with Claude enforcement
 * - generateMerchImageWithModelSelection() - Allows choosing between Gemini and DALL-E
 */

import { generateDesignImage } from '@/services/geminiService';
import { PromptMode } from '@/types';
import {
  DesignBrief,
  DesignExecutionResult,
  NicheStyleProfile
} from './types';
import {
  createImagePromptFromBrief,
  buildDesignBriefFromTrend,
  buildDesignBriefFromManualSpecs
} from './image-prompter';
import { ManualSpecs } from './types';

export interface ImageGenerationResult {
  imageUrl: string;
  prompt: string;
}

/**
 * Generate a merch design image using Gemini Imagen
 *
 * @param prompt - The full image generation prompt
 * @param style - Visual style (e.g., 'streetwear', 'vintage', 'minimalist')
 * @param textOnDesign - The text that should appear on the design
 * @param shirtColor - Recommended shirt color for contrast
 * @param promptMode - 'simple' for short prompts, 'advanced' for detailed
 * @returns Base64 data URL of the generated image
 */
export async function generateMerchImage(
  prompt: string,
  style: string = 'modern',
  textOnDesign?: string,
  shirtColor: string = 'black',
  promptMode: PromptMode = 'simple'
): Promise<ImageGenerationResult> {
  try {
    console.log('[ImageGenerator] Generating image with Gemini Imagen...');
    console.log('[ImageGenerator] Style:', style);
    console.log('[ImageGenerator] Text on design:', textOnDesign);
    console.log('[ImageGenerator] Prompt mode:', promptMode);

    // Map our style names to geminiService style keywords
    // Note: We now pass through descriptive styles instead of generic keywords
    const styleMap: Record<string, string> = {
      'Bold Modern': 'bold modern',
      'Vintage Retro': 'vintage retro',
      'Elegant Script': 'elegant script',
      'Minimalist': 'minimalist clean',
      'Distressed': 'grunge distressed',
      'Playful': 'playful cartoon',
      'Professional': 'professional clean',
      // Direct mappings
      'streetwear': 'streetwear urban',
      'vintage': 'vintage retro',
      'minimalist': 'minimalist clean',
      'modern': 'bold modern',
      'grunge': 'grunge distressed',
      'elegant': 'elegant script',
    };

    // Pass through the style - don't compress everything to one generic style
    const mappedStyle = styleMap[style] || style || 'bold modern';

    // Use the existing Gemini service for image generation
    const imageUrl = await generateDesignImage(
      prompt,
      mappedStyle,
      textOnDesign,
      undefined, // typographyStyle - let AI decide
      shirtColor,
      promptMode
    );

    console.log('[ImageGenerator] Image generated successfully');

    return {
      imageUrl,
      prompt,
    };
  } catch (error) {
    console.error('[ImageGenerator] Error generating image:', error);
    throw new Error(`Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a placeholder image URL for testing/fallback
 * Used when real generation fails or in test mode
 */
export function generatePlaceholderImage(text: string, style: string = 'modern'): string {
  const encodedText = encodeURIComponent(text.substring(0, 30));
  const bgColor = style.includes('vintage') ? '8B4513' : '1a1a2e';
  const textColor = '00d4ff';

  return `https://placehold.co/400x400/${bgColor}/${textColor}/png?text=${encodedText}`;
}

/**
 * Check if the generated image is valid (not empty, correct format)
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false;

  // Check for base64 data URL
  if (url.startsWith('data:image/')) {
    return url.includes('base64,') && url.length > 100;
  }

  // Check for HTTP URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return true;
  }

  return false;
}

// ============================================================================
// NEW: DESIGN BRIEF SYSTEM - Style-compliant image generation
// ============================================================================

export type ImageModel = 'gemini' | 'dalle3';

export interface BriefBasedGenerationResult extends ImageGenerationResult {
  model: ImageModel;
  briefCompliance?: DesignExecutionResult['compliance'];
  usedBriefSystem: boolean;
}

/**
 * Generate a merch design image using the DesignBrief system
 * This ensures style information flows from research → image without loss
 */
export async function generateMerchImageFromBrief(
  brief: DesignBrief,
  model: ImageModel = 'gemini',
  promptMode: PromptMode = 'advanced'
): Promise<BriefBasedGenerationResult> {
  console.log(`[ImageGenerator] Generating from brief for: "${brief.text.exact}"`);
  console.log(`[ImageGenerator] Model: ${model}, Style source: ${brief.style.source}`);

  try {
    // Step 1: Use Claude to generate a compliant prompt from the brief
    const executionResult = await createImagePromptFromBrief(brief);

    if (!executionResult.success) {
      throw new Error(executionResult.error || 'Failed to execute design brief');
    }

    console.log(`[ImageGenerator] Brief compliance: ${executionResult.compliance.overallScore * 100}%`);

    // Step 2: Generate the image using the selected model
    let imageUrl: string;

    if (model === 'dalle3') {
      imageUrl = await generateWithDalle3(executionResult.prompt);
    } else {
      // Default to Gemini
      imageUrl = await generateDesignImage(
        executionResult.prompt,
        brief.style.aesthetic.primary,
        brief.text.exact,
        brief.style.typography.required,
        brief.style.colorApproach.shirtColor,
        promptMode
      );
    }

    console.log(`[ImageGenerator] Image generated successfully with ${model}`);

    return {
      imageUrl,
      prompt: executionResult.prompt,
      model,
      briefCompliance: executionResult.compliance,
      usedBriefSystem: true
    };

  } catch (error) {
    console.error(`[ImageGenerator] Error generating from brief:`, error);

    // Fallback to placeholder
    const placeholderUrl = generatePlaceholderImage(brief.text.exact, brief.style.aesthetic.primary);

    return {
      imageUrl: placeholderUrl,
      prompt: `Fallback for: ${brief.text.exact}`,
      model,
      usedBriefSystem: true,
      briefCompliance: {
        textPreserved: false,
        typographyFollowed: false,
        colorApproachFollowed: false,
        aestheticFollowed: false,
        forbiddenElementsAvoided: false,
        overallScore: 0
      }
    };
  }
}

/**
 * Generate image using DALL-E 3
 */
async function generateWithDalle3(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn('[ImageGenerator] OPENAI_API_KEY not set, falling back to Gemini');
    throw new Error('DALL-E 3 not configured');
  }

  try {
    console.log('[ImageGenerator] Generating with DALL-E 3...');

    // Enhance prompt with quality requirements for DALL-E
    const enhancedPrompt = `${prompt}

CRITICAL QUALITY INSTRUCTIONS:
- Create a PROFESSIONAL COMMERCIAL-GRADE graphic design
- Typography MUST have visual depth: 3D effects, drop shadows, bevels, or gradient fills
- NOT flat basic text, NOT clip-art style - must look like professional graphic design
- If illustrations are present, they must be DETAILED with proper shading and highlights
- This is premium wearable art, not amateur graphics`;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',  // Upgraded from dall-e-3 to latest flagship model
        prompt: enhancedPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'high',  // gpt-image-1 uses 'low'/'medium'/'high' (not 'standard'/'hd')
        response_format: 'url'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`DALL-E API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    if (!data.data?.[0]?.url) {
      throw new Error('No image URL in DALL-E response');
    }

    console.log('[ImageGenerator] DALL-E 3 generation successful');
    return data.data[0].url;

  } catch (error) {
    console.error('[ImageGenerator] DALL-E 3 error:', error);
    throw error;
  }
}

/**
 * Generate with model selection - allows A/B testing between models
 */
export async function generateMerchImageWithModelSelection(
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
  },
  nicheStyle?: Partial<NicheStyleProfile>,
  options: {
    model?: ImageModel;
    testBothModels?: boolean;
    promptMode?: PromptMode;
    userOverrides?: {
      text?: string;
      style?: string;
      tone?: string;
    };
  } = {}
): Promise<BriefBasedGenerationResult | BriefBasedGenerationResult[]> {
  const {
    model = 'gemini',
    testBothModels = false,
    promptMode = 'advanced',
    userOverrides
  } = options;

  // Build the design brief from trend data
  const brief = buildDesignBriefFromTrend(trendData, nicheStyle, userOverrides);

  if (testBothModels) {
    // Generate with both models for comparison
    console.log('[ImageGenerator] Testing both models (Gemini and DALL-E 3)');

    const results = await Promise.allSettled([
      generateMerchImageFromBrief(brief, 'gemini', promptMode),
      generateMerchImageFromBrief(brief, 'dalle3', promptMode)
    ]);

    const successfulResults: BriefBasedGenerationResult[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        successfulResults.push(result.value);
      } else {
        console.error('[ImageGenerator] Model test failed:', result.reason);
      }
    }

    return successfulResults.length > 0 ? successfulResults : [{
      imageUrl: generatePlaceholderImage(brief.text.exact),
      prompt: 'Both models failed',
      model: 'gemini',
      usedBriefSystem: true
    }];
  }

  // Single model generation
  return generateMerchImageFromBrief(brief, model, promptMode);
}

/**
 * Generate from manual specs using the brief system
 */
export async function generateMerchImageFromManualSpecs(
  specs: ManualSpecs,
  nicheStyle?: Partial<NicheStyleProfile>,
  model: ImageModel = 'gemini',
  promptMode: PromptMode = 'advanced'
): Promise<BriefBasedGenerationResult> {
  // Build brief from manual specs
  const brief = buildDesignBriefFromManualSpecs(specs, nicheStyle);

  return generateMerchImageFromBrief(brief, model, promptMode);
}

/**
 * Hybrid generation - tries brief system first, falls back to legacy
 */
export async function generateMerchImageHybrid(
  prompt: string,
  trendData?: {
    topic?: string;
    designText?: string;
    phrase?: string;
    niche?: string;
    visualStyle?: string;
    designStyle?: string;
    colorPalette?: string;
    recommendedShirtColor?: string;
    sentiment?: string;
  },
  options: {
    style?: string;
    textOnDesign?: string;
    shirtColor?: string;
    promptMode?: PromptMode;
    model?: ImageModel;
    useBriefSystem?: boolean;
    nicheStyle?: Partial<NicheStyleProfile>;
  } = {}
): Promise<BriefBasedGenerationResult> {
  const {
    style = 'modern',
    textOnDesign,
    shirtColor = 'black',
    promptMode = 'simple',
    model = 'gemini',
    useBriefSystem = true,
    nicheStyle
  } = options;

  // Try brief system if trend data is available
  if (useBriefSystem && trendData) {
    try {
      const brief = buildDesignBriefFromTrend(trendData, nicheStyle);
      const result = await generateMerchImageFromBrief(brief, model, promptMode);

      if (result.imageUrl && isValidImageUrl(result.imageUrl)) {
        return result;
      }
    } catch (error) {
      console.warn('[ImageGenerator] Brief system failed, falling back to legacy:', error);
    }
  }

  // Fallback to legacy generation
  const legacyResult = await generateMerchImage(prompt, style, textOnDesign, shirtColor, promptMode);

  return {
    ...legacyResult,
    model: 'gemini',
    usedBriefSystem: false
  };
}
