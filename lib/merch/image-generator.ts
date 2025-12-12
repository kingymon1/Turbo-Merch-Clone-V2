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

export type ImageModel = 'gemini' | 'gpt-image-1' | 'ideogram' | 'dalle3';

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

    switch (model) {
      case 'gpt-image-1':
        imageUrl = await generateWithGptImage1(executionResult.prompt, brief);
        break;
      case 'ideogram':
        imageUrl = await generateWithIdeogram(executionResult.prompt, brief);
        break;
      case 'dalle3':
        imageUrl = await generateWithDalle3(executionResult.prompt);
        break;
      case 'gemini':
      default:
        // Default to Gemini
        imageUrl = await generateDesignImage(
          executionResult.prompt,
          brief.style.aesthetic.primary,
          brief.text.exact,
          brief.style.typography.required,
          brief.style.colorApproach.shirtColor,
          promptMode
        );
        break;
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
 * Quality floor constraints - negative prompts to ensure professional quality
 * These are appended to ALL model prompts to set a minimum quality bar
 */
const QUALITY_FLOOR_CONSTRAINTS = `
DO NOT create: amateur graphics, clipart style, basic flat designs, generic stock imagery,
poorly rendered text, childish scribbles, low-effort templates, blurry elements,
pixelated graphics, MS Paint quality, default system fonts.`;

/**
 * Generate image using DALL-E 3 (Legacy)
 */
async function generateWithDalle3(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn('[ImageGenerator] OPENAI_API_KEY not set, falling back to Gemini');
    throw new Error('DALL-E 3 not configured');
  }

  try {
    console.log('[ImageGenerator] Generating with DALL-E 3...');

    // Add quality floor constraints
    const enhancedPrompt = `${prompt}

${QUALITY_FLOOR_CONSTRAINTS}`;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: enhancedPrompt,
        n: 1,
        size: '1024x1792',  // Portrait
        quality: 'hd',
        style: 'vivid',
        response_format: 'url'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`DALL-E 3 API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    if (data.data?.[0]?.url) {
      console.log('[ImageGenerator] DALL-E 3 generation successful');
      return data.data[0].url;
    }

    throw new Error('No image URL in DALL-E 3 response');

  } catch (error) {
    console.error('[ImageGenerator] DALL-E 3 error:', error);
    throw error;
  }
}

/**
 * Generate image using GPT-Image-1 (OpenAI's latest model)
 *
 * Key features:
 * - Native transparent background support
 * - 75% cheaper than DALL-E 3
 * - Better at following detailed prompts
 * - Improved text rendering
 */
async function generateWithGptImage1(prompt: string, brief: DesignBrief): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn('[ImageGenerator] OPENAI_API_KEY not set');
    throw new Error('GPT-Image-1 not configured');
  }

  try {
    console.log('[ImageGenerator] Generating with GPT-Image-1...');

    // Build text-first non-negotiable prompt structure
    const textFirstPrompt = buildTextFirstPrompt(prompt, brief);

    // Add quality floor constraints
    const finalPrompt = `${textFirstPrompt}

${QUALITY_FLOOR_CONSTRAINTS}`;

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: finalPrompt,
        n: 1,
        size: '1024x1536',  // Portrait aspect ratio
        quality: 'high',
        background: 'transparent',  // Native transparent background support
        output_format: 'png'
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`GPT-Image-1 API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    if (data.data?.[0]?.b64_json) {
      console.log('[ImageGenerator] GPT-Image-1 generation successful (base64)');
      return `data:image/png;base64,${data.data[0].b64_json}`;
    } else if (data.data?.[0]?.url) {
      console.log('[ImageGenerator] GPT-Image-1 generation successful (url)');
      return data.data[0].url;
    }

    throw new Error('No image data in GPT-Image-1 response');

  } catch (error) {
    console.error('[ImageGenerator] GPT-Image-1 error:', error);
    throw error;
  }
}

/**
 * Generate image using Ideogram 3.0
 *
 * Key features:
 * - Best-in-class typography/text rendering
 * - DESIGN style type for graphic design work
 * - magic_prompt: OFF for exact text preservation
 */
async function generateWithIdeogram(prompt: string, brief: DesignBrief): Promise<string> {
  const apiKey = process.env.IDEOGRAM_API_KEY;

  if (!apiKey) {
    console.warn('[ImageGenerator] IDEOGRAM_API_KEY not set');
    throw new Error('Ideogram not configured');
  }

  try {
    console.log('[ImageGenerator] Generating with Ideogram 3.0...');

    // Build text-first non-negotiable prompt structure
    const textFirstPrompt = buildTextFirstPrompt(prompt, brief);

    // Add quality floor as negative prompt
    const negativePrompt = 'amateur graphics, clipart, basic flat design, generic stock imagery, poorly rendered text, childish, low-effort, blurry, pixelated, MS Paint quality, default fonts';

    // Add quality floor constraints to main prompt
    const finalPrompt = `${textFirstPrompt}

${QUALITY_FLOOR_CONSTRAINTS}`;

    // Use FormData as per Ideogram API docs
    const formData = new FormData();
    formData.append('prompt', finalPrompt);
    formData.append('aspect_ratio', 'ASPECT_2_3');  // Portrait for t-shirt designs
    formData.append('model', 'V_3');
    formData.append('style_type', 'DESIGN');  // Optimized for graphic design
    formData.append('magic_prompt', 'OFF');   // CRITICAL: Preserve exact text
    formData.append('negative_prompt', negativePrompt);

    const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Ideogram API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();

    if (data.data?.[0]?.url) {
      console.log('[ImageGenerator] Ideogram generation successful');
      return data.data[0].url;
    }

    throw new Error('No image URL in Ideogram response');

  } catch (error) {
    console.error('[ImageGenerator] Ideogram error:', error);
    throw error;
  }
}

/**
 * Build text-first non-negotiable prompt structure
 *
 * The text requirement must be:
 * 1. FIRST in the prompt (loudest/most important)
 * 2. EXACT - no paraphrasing allowed
 * 3. NON-NEGOTIABLE - image models must render this text
 */
function buildTextFirstPrompt(originalPrompt: string, brief: DesignBrief): string {
  const exactText = brief.text.exact;

  // Text-first structure: Text requirement is the loudest part
  return `TEXT REQUIREMENT (MANDATORY - EXACT): The design MUST prominently display the text "${exactText}" - this text must be clearly readable and is the primary element of this t-shirt graphic design.

${originalPrompt}`;
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
    // Text layout from research agent
    textLayout?: {
      positioning?: string;
      emphasis?: string;
      sizing?: string;
      reasoning?: string;
    };
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

  // Build the design brief from trend data (async - uses agent research for niche style)
  const brief = await buildDesignBriefFromTrend(trendData, nicheStyle, userOverrides);

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
      const brief = await buildDesignBriefFromTrend(trendData, nicheStyle);
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
