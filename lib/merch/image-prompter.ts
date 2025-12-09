/**
 * Image Prompt Builder for Merch Design Generator
 *
 * Creates optimized prompts for Gemini Imagen based on mode and specs.
 */

import { ManualSpecs } from './types';

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
    // Autopilot mode: Simple, clean prompts
    return buildAutopilotPrompt(phrase, effectiveStyle, effectiveTone, niche);
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
 * Build prompt for autopilot mode - simple and effective
 */
function buildAutopilotPrompt(
  phrase: string,
  style: string,
  tone: string,
  niche: string
): string {
  // Keep autopilot prompts simple but effective
  const styleHint = style.toLowerCase().includes('vintage') ? 'vintage retro distressed' :
                    style.toLowerCase().includes('minimalist') ? 'clean minimalist' :
                    style.toLowerCase().includes('playful') ? 'fun playful colorful' :
                    'bold modern';

  return `T-shirt design: "${phrase}" in ${styleHint} typography style. Perfect for ${niche}. ${tone} vibe. Center composition, high contrast, transparent background, print-ready graphic.`;
}

/**
 * Create a simple prompt for quick generation (used in testing)
 */
export function createSimplePrompt(phrase: string, style: string = 'bold modern'): string {
  return `T-shirt design with text "${phrase}". ${style} typography, center composition, transparent background, print-ready.`;
}
