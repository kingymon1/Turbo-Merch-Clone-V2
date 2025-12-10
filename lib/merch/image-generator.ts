/**
 * Image Generator for Merch Design Generator
 *
 * Generates t-shirt design images using Gemini Imagen (internally called "Nano Banana").
 * This module wraps the existing geminiService for use by the merch generator feature.
 */

import { generateDesignImage } from '@/services/geminiService';
import { PromptMode } from '@/types';

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
