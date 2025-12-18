/**
 * Simple Prompt Builder
 *
 * Builds clean, short prompts from DesignForm.
 * NO AI involved - pure template-based construction.
 *
 * Target: 40-60 words, like the working reference prompt:
 * "a t-shirt design on black background. Ugly Christmas style.
 *  The text 'Chillin' With My Snowmies' featuring 3 snowmen
 *  enjoying a winter scene. No Mockup"
 *
 * STYLE INTELLIGENCE INTEGRATION:
 * This module provides StyleSpec-aware prompt building functions:
 *
 * - buildSimplePromptWithStyleSpec(): Incorporates StyleRecipe guidance into prompts
 * - buildModelSpecificPromptWithStyleSpec(): Model-optimized variants with StyleRecipe
 *
 * When styleSpec is present:
 * - Typography hints from recipe are included (font category, weight, transform)
 * - Layout guidance from recipe is applied (composition, hierarchy)
 * - Effect hints from recipe are added (halftone, texture, shadow)
 * - The recipe's recommended garment colors may influence background
 *
 * When styleSpec is ABSENT:
 * - Uses form data directly (buildSimplePrompt, buildModelSpecificPrompt)
 * - Behavior unchanged from pre-StyleIntel implementation
 *
 * The prompt builder is a FINAL RENDERER - it implements whatever style direction
 * is passed to it. It does not make style decisions itself.
 */

import { DesignForm, ImageModel } from './types';
import type { StyleRecipe } from '../style-intel/types';
import { formatStyleRecipeForPrompt } from './style-intel-integration';

/**
 * Build a simple, clean prompt from a DesignForm
 *
 * @param form - The filled design form
 * @param targetModel - Optional target model for adjustments
 * @returns Clean prompt string (~40-60 words)
 */
export function buildSimplePrompt(
  form: DesignForm,
  targetModel?: ImageModel
): string {
  const parts: string[] = [];

  // 1. Start with base
  parts.push('a t-shirt design');

  // 2. Background - extract from additionalInstructions or use default
  const background = extractBackground(form.additionalInstructions);
  parts.push(`on ${background} background`);

  // 3. Style (required)
  if (form.style) {
    // Don't duplicate "style" if it's already in the value
    const styleText = form.style.toLowerCase().includes('style')
      ? form.style
      : `${form.style} style`;
    parts.push(styleText);
  }

  // 4. Text (if present)
  if (form.exactText) {
    parts.push(`The text '${form.exactText}'`);
  }

  // 5. Image feature (if present)
  if (form.imageFeature) {
    parts.push(`featuring ${form.imageFeature}`);
  }

  // 6. Additional instructions (excluding background which we handled)
  const cleanedInstructions = cleanAdditionalInstructions(
    form.additionalInstructions
  );
  if (cleanedInstructions) {
    parts.push(cleanedInstructions);
  }

  // 7. End with "No Mockup" to prevent t-shirt renders
  parts.push('No Mockup');

  // Join with periods and clean up
  return parts
    .filter((p) => p && p.trim())
    .join('. ')
    .replace(/\.\./g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a prompt with model-specific adjustments
 *
 * @param form - The filled design form
 * @param model - Target image model
 * @returns Model-optimized prompt string
 */
export function buildModelSpecificPrompt(
  form: DesignForm,
  model: ImageModel
): string {
  const basePrompt = buildSimplePrompt(form, model);

  switch (model) {
    case 'ideogram':
      return buildIdeogramPrompt(form, basePrompt);

    case 'gpt-image-1':
      return buildGptImagePrompt(form, basePrompt);

    case 'gpt-image-1.5':
      return buildGptImage15Prompt(form, basePrompt);

    case 'gemini':
    default:
      return basePrompt;
  }
}

/**
 * Build Ideogram-optimized prompt
 * Ideogram excels with explicit text instructions and DESIGN style
 */
function buildIdeogramPrompt(form: DesignForm, basePrompt: string): string {
  let prompt = basePrompt;

  // Ideogram prefers explicit text rendering instructions
  if (form.exactText) {
    prompt = prompt.replace(
      `The text '${form.exactText}'`,
      `with bold readable text that says "${form.exactText}"`
    );
  }

  return prompt;
}

/**
 * Build GPT Image 1 optimized prompt
 * GPT Image handles text well and supports native transparency
 */
function buildGptImagePrompt(form: DesignForm, basePrompt: string): string {
  let prompt = basePrompt;

  // Handle transparent background override
  if (form.modelOverrides?.gptImage?.background === 'transparent') {
    prompt = prompt.replace('on black background', 'on transparent background');
  }

  return prompt;
}

/**
 * Build GPT Image 1.5 optimized prompt
 * GPT-Image-1.5 has superior text rendering and supports transparent backgrounds
 */
function buildGptImage15Prompt(form: DesignForm, basePrompt: string): string {
  let prompt = basePrompt;

  // Handle transparent background if specified
  if (form.modelOverrides?.gptImage15?.quality === 'high') {
    prompt += '. High detail, professional quality';
  }

  return prompt;
}

/**
 * Extract background color from additional instructions
 */
function extractBackground(instructions: string | null | undefined): string {
  if (!instructions) return 'black';

  const match = instructions.match(
    /on\s+(black|white|transparent|dark|light)\s+background/i
  );
  if (match) {
    const bg = match[1].toLowerCase();
    // Normalize "dark" to "black" and "light" to "white"
    if (bg === 'dark') return 'black';
    if (bg === 'light') return 'white';
    return bg;
  }

  return 'black'; // Default
}

/**
 * Clean additional instructions by removing background reference
 * (since we handle it separately)
 */
function cleanAdditionalInstructions(
  instructions: string | null | undefined
): string {
  if (!instructions) return '';

  return instructions
    .replace(/on\s+(black|white|transparent|dark|light)\s+background/gi, '')
    .replace(/no\s+mockup/gi, '') // We add this at the end
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Count words in a prompt
 */
export function countWords(prompt: string): number {
  return prompt.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Analyze a prompt for potential issues
 */
export function analyzePrompt(prompt: string): {
  wordCount: number;
  hasText: boolean;
  hasStyle: boolean;
  hasBackground: boolean;
  hasNoMockup: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const wordCount = countWords(prompt);

  // Check for common issues
  if (wordCount > 80) {
    warnings.push('Prompt may be too long (>80 words)');
  }
  if (wordCount < 15) {
    warnings.push('Prompt may be too short (<15 words)');
  }

  const hasText = /text\s+['"]|says\s+['"]|displaying\s+['"]/.test(
    prompt.toLowerCase()
  );
  const hasStyle = /style/i.test(prompt);
  const hasBackground = /background/i.test(prompt);
  const hasNoMockup = /no\s+mockup/i.test(prompt);

  if (!hasBackground) {
    warnings.push('No background specified');
  }
  if (!hasNoMockup) {
    warnings.push('Missing "No Mockup" instruction');
  }

  return {
    wordCount,
    hasText,
    hasStyle,
    hasBackground,
    hasNoMockup,
    warnings,
  };
}

/**
 * Generate a reference prompt (the working example)
 * Used for testing and comparison
 */
export function getReferencePrompt(): string {
  return "a t-shirt design on black background. Ugly Christmas style. The text 'Chillin' With My Snowmies' featuring 3 snowmen enjoying a winter scene. No Mockup";
}

/**
 * Generate a reference form (the working example as a form)
 */
export function getReferenceForm(): DesignForm {
  return {
    exactText: "Chillin' With My Snowmies",
    style: 'Ugly Christmas',
    imageFeature: '3 snowmen enjoying a winter scene',
    niche: 'christmas',
    tone: 'funny',
    additionalInstructions: 'on black background',
  };
}

// =============================================================================
// STYLE INTEL ENHANCED PROMPT BUILDERS
// These functions incorporate StyleRecipe data when available
// =============================================================================

/**
 * Build a simple prompt enhanced with StyleRecipe information
 *
 * When styleSpec is provided, adds style-specific guidance to the prompt:
 * - Typography hints (e.g., "bold uppercase sans-serif")
 * - Layout guidance (e.g., "centered badge composition")
 * - Color hints (e.g., "high-contrast warm palette")
 * - Effect hints (e.g., "subtle halftone, light texture")
 *
 * @param form - The filled design form
 * @param styleSpec - Optional StyleRecipe from StyleIntel
 * @param targetModel - Optional target model for adjustments
 * @returns Enhanced prompt string
 */
export function buildSimplePromptWithStyleSpec(
  form: DesignForm,
  styleSpec?: StyleRecipe,
  targetModel?: ImageModel
): string {
  // Start with the base prompt
  const parts: string[] = [];

  // 1. Start with base
  parts.push('a t-shirt design');

  // 2. Background - extract from additionalInstructions or use styleSpec recommendation
  let background = extractBackground(form.additionalInstructions);
  if (styleSpec?.color?.recommendedGarmentColors?.length && background === 'black') {
    // Use first recommended garment color if it's a valid background
    const recommended = styleSpec.color.recommendedGarmentColors[0].toLowerCase();
    if (['black', 'white', 'dark', 'light'].some(c => recommended.includes(c))) {
      background = recommended.includes('white') || recommended.includes('light') ? 'white' : 'black';
    }
  }
  parts.push(`on ${background} background`);

  // 3. Style - enhanced with StyleRecipe if available
  if (styleSpec) {
    const formatted = formatStyleRecipeForPrompt(styleSpec);
    // Build a rich style description
    const styleDesc = `${form.style || styleSpec.meta.displayName} style with ${formatted.typography} typography`;
    parts.push(styleDesc);
  } else if (form.style) {
    const styleText = form.style.toLowerCase().includes('style')
      ? form.style
      : `${form.style} style`;
    parts.push(styleText);
  }

  // 4. Text (if present)
  if (form.exactText) {
    parts.push(`The text '${form.exactText}'`);
  }

  // 5. Image feature (if present)
  if (form.imageFeature) {
    parts.push(`featuring ${form.imageFeature}`);
  }

  // 6. StyleSpec-based enhancements (when no explicit additionalInstructions)
  if (styleSpec && !form.additionalInstructions) {
    const formatted = formatStyleRecipeForPrompt(styleSpec);
    // Add layout hint
    if (formatted.layout && !formatted.layout.includes('centered composition')) {
      parts.push(formatted.layout);
    }
    // Add effects hint
    if (formatted.effectsHint && formatted.effectsHint !== 'clean without excessive effects') {
      parts.push(formatted.effectsHint);
    }
  } else {
    // 6. Additional instructions (excluding background which we handled)
    const cleanedInstructions = cleanAdditionalInstructions(form.additionalInstructions);
    if (cleanedInstructions) {
      parts.push(cleanedInstructions);
    }
  }

  // 7. End with "No Mockup" to prevent t-shirt renders
  parts.push('No Mockup');

  // Join with periods and clean up
  return parts
    .filter((p) => p && p.trim())
    .join('. ')
    .replace(/\.\./g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a model-specific prompt enhanced with StyleRecipe
 *
 * @param form - The filled design form
 * @param model - Target image model
 * @param styleSpec - Optional StyleRecipe from StyleIntel
 * @returns Model-optimized enhanced prompt string
 */
export function buildModelSpecificPromptWithStyleSpec(
  form: DesignForm,
  model: ImageModel,
  styleSpec?: StyleRecipe
): string {
  // If no styleSpec, fall back to regular model-specific prompt
  if (!styleSpec) {
    return buildModelSpecificPrompt(form, model);
  }

  const basePrompt = buildSimplePromptWithStyleSpec(form, styleSpec, model);

  switch (model) {
    case 'ideogram':
      return buildIdeogramPromptWithStyleSpec(form, basePrompt, styleSpec);

    case 'gpt-image-1':
      return buildGptImagePromptWithStyleSpec(form, basePrompt, styleSpec);

    case 'gpt-image-1.5':
      return buildGptImage15PromptWithStyleSpec(form, basePrompt, styleSpec);

    case 'gemini':
    default:
      return basePrompt;
  }
}

/**
 * Build Ideogram-optimized prompt with StyleSpec
 */
function buildIdeogramPromptWithStyleSpec(
  form: DesignForm,
  basePrompt: string,
  styleSpec: StyleRecipe
): string {
  let prompt = basePrompt;

  // Ideogram prefers explicit text rendering instructions
  if (form.exactText) {
    // Use typography hints from styleSpec
    const typo = styleSpec.typography;
    const weight = typo.fontWeight || 'bold';
    const transform = typo.textTransform === 'uppercase' ? 'uppercase' : '';
    prompt = prompt.replace(
      `The text '${form.exactText}'`,
      `with ${weight} ${transform} readable text that says "${form.exactText}"`
    );
  }

  return prompt;
}

/**
 * Build GPT Image 1 optimized prompt with StyleSpec
 */
function buildGptImagePromptWithStyleSpec(
  form: DesignForm,
  basePrompt: string,
  styleSpec: StyleRecipe
): string {
  let prompt = basePrompt;

  // Handle transparent background override
  if (form.modelOverrides?.gptImage?.background === 'transparent') {
    prompt = prompt.replace('on black background', 'on transparent background');
    prompt = prompt.replace('on white background', 'on transparent background');
  }

  return prompt;
}

/**
 * Build GPT Image 1.5 optimized prompt with StyleSpec
 */
function buildGptImage15PromptWithStyleSpec(
  form: DesignForm,
  basePrompt: string,
  styleSpec: StyleRecipe
): string {
  let prompt = basePrompt;

  // Add quality hint based on style spec or override
  if (form.modelOverrides?.gptImage15?.quality === 'high') {
    prompt += '. High detail, professional quality';
  } else if (styleSpec.color.contrastLevel === 'high') {
    prompt += '. High contrast design';
  }

  return prompt;
}
