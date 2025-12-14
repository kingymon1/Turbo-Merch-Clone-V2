/**
 * Form Filler Service
 *
 * Uses GPT-4.1-nano to fill the DesignForm from research data.
 * Forces structured decisions with strict character limits.
 *
 * This is the key innovation: instead of complex prompt engineering,
 * the AI fills a simple form like a human would.
 *
 * STYLE INTELLIGENCE ARCHITECTURE:
 * When STYLE_INTEL_MERCH_ENABLED is true and a styleSpec is passed:
 * - The styleSpec (StyleRecipe) is the AUTHORITATIVE source for style decisions
 * - This agent should IMPLEMENT the recipe, not re-decide style
 * - The form's "style" field should align with the recipe's direction
 * - Research data (trendData, styleContext) provides context (niche, tone, audience)
 *
 * The agent's role when styleSpec is present:
 * - Read the StyleRecipe's typography, layout, color, effects guidance
 * - Match the form's style and tone to the recipe's characteristics
 * - Use research data for niche, audience context only
 * - Do NOT try to override or re-invent style decisions
 *
 * When styleSpec is ABSENT:
 * - Use styleContext and trendData as primary style sources
 * - Make style decisions based on research data
 * - Behavior unchanged from pre-StyleIntel implementation
 */

import OpenAI from 'openai';
import {
  DesignForm,
  DESIGN_FORM_LIMITS,
  FormFillerResult,
  StyleContext,
} from './types';
import type { StyleRecipe } from '../style-intel/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Input for the form filler
 */
export interface FormFillerInput {
  // From research phase (existing agents)
  trendData: {
    phrase?: string;
    topic?: string;
    niche?: string;
    audienceProfile?: string;
    visualStyle?: string;
    sentiment?: string;
    designText?: string;
    keywords?: string[];
  };

  // From style database (NicheStyleProfile)
  styleContext?: StyleContext;

  // From StyleIntel service (pre-mined recipes)
  styleSpec?: StyleRecipe;

  // User settings
  riskLevel: number; // 0-100 (affects idea selection, not quality)

  // Optional: force certain values
  overrides?: Partial<DesignForm>;
}

/**
 * Fill the design form using GPT-4.1-nano
 *
 * @param input - Research data, style context, and risk level
 * @returns Filled DesignForm with token usage info
 */
export async function fillDesignForm(
  input: FormFillerInput
): Promise<FormFillerResult> {
  const { trendData, styleContext, styleSpec, riskLevel, overrides } = input;

  const systemPrompt = buildSystemPrompt(riskLevel, styleSpec);
  const userPrompt = buildUserPrompt(trendData, styleContext, styleSpec);

  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-nano',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'design_form',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            exactText: {
              type: ['string', 'null'],
              description: `Text to display (max ${DESIGN_FORM_LIMITS.exactText} chars) or null for no text`,
            },
            style: {
              type: 'string',
              description: `Visual style in 1-3 words (max ${DESIGN_FORM_LIMITS.style} chars)`,
            },
            imageFeature: {
              type: ['string', 'null'],
              description: `One visual element (max ${DESIGN_FORM_LIMITS.imageFeature} chars) or null`,
            },
            niche: {
              type: 'string',
              description: `Target niche (max ${DESIGN_FORM_LIMITS.niche} chars)`,
            },
            tone: {
              type: 'string',
              description: `Emotional tone (max ${DESIGN_FORM_LIMITS.tone} chars)`,
            },
            additionalInstructions: {
              type: ['string', 'null'],
              description: `Technical notes (max ${DESIGN_FORM_LIMITS.additionalInstructions} chars) or null`,
            },
          },
          required: [
            'exactText',
            'style',
            'imageFeature',
            'niche',
            'tone',
            'additionalInstructions',
          ],
          additionalProperties: false,
        },
      },
    },
    temperature: 0.7,
    max_tokens: 300,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('Empty response from form filler');
  }

  let form: DesignForm;
  try {
    form = JSON.parse(content) as DesignForm;
  } catch (error) {
    throw new Error(`Failed to parse form filler response: ${content}`);
  }

  // Enforce character limits (truncate if model exceeded)
  form = enforceCharacterLimits(form);

  // Apply any overrides
  if (overrides) {
    form = { ...form, ...overrides };
  }

  return {
    form,
    tokensUsed:
      (response.usage?.total_tokens ?? 0),
    model: 'gpt-4.1-nano',
  };
}

/**
 * Build the system prompt for the form filler
 */
function buildSystemPrompt(riskLevel: number, styleSpec?: StyleRecipe): string {
  const riskDescription =
    riskLevel < 30
      ? 'Safe (0-30): Focus on proven, evergreen ideas with existing market demand. Stick to what works.'
      : riskLevel < 70
        ? 'Balanced (30-70): Mix proven concepts with some creativity. Test variations on successful themes.'
        : 'Experimental (70-100): First-mover opportunities, emerging trends, novel combinations. Be creative.';

  // Add StyleIntel guidance if available
  let styleIntelGuidance = '';
  if (styleSpec) {
    styleIntelGuidance = `
═══════════════════════════════════════════════════════════════
STYLE INTELLIGENCE RECIPE (AUTHORITATIVE - MUST FOLLOW)
═══════════════════════════════════════════════════════════════

A proven StyleRecipe "${styleSpec.meta.displayName}" has been selected by the Style Intelligence system.
This recipe is AUTHORITATIVE for style decisions. You must IMPLEMENT it, not re-decide style.

TYPOGRAPHY (FOLLOW THIS):
- Category: ${styleSpec.typography.fontCategory}
- Weight: ${styleSpec.typography.fontWeight || 'bold'}
- Transform: ${styleSpec.typography.textTransform || 'mixed'}

LAYOUT (FOLLOW THIS):
- Composition: ${styleSpec.layout.composition}
- Hierarchy: ${styleSpec.layout.hierarchyType || 'text-primary'}

COLOR (FOLLOW THIS):
- Scheme: ${styleSpec.color.schemeType}
- Mood: ${styleSpec.color.colorMood || 'balanced'}

EFFECTS TO APPLY:
${styleSpec.effects.halftone?.enabled ? `- Halftone: ${styleSpec.effects.halftone.density || 'medium'} density` : ''}
${styleSpec.effects.texture?.enabled ? `- Texture: ${styleSpec.effects.texture.type || 'distressed'}` : ''}
${styleSpec.effects.shadow?.enabled ? `- Shadow: ${styleSpec.effects.shadow.type || 'drop'}` : ''}
${!styleSpec.effects.halftone?.enabled && !styleSpec.effects.texture?.enabled && !styleSpec.effects.shadow?.enabled ? '- Clean style, no heavy effects' : ''}

INSTRUCTIONS:
- Your "style" field should reflect this recipe (e.g., "${styleSpec.meta.displayName}" or similar)
- Your "tone" should align with the recipe's mood
- Use research data ONLY for niche, audience, text content context
- Do NOT override recipe style decisions based on research data
`;
  }

  return `You are a t-shirt design decision maker. Your job is to fill out a design form based on research data.

CRITICAL RULES:
1. Be CONCISE. Every character counts. Shorter is better.
2. Respect character limits EXACTLY. Truncate if needed.
3. Make DECISIONS, don't hedge or explain.
4. exactText can be null ONLY if the design truly works better without text. This is a deliberate choice, not a fallback.
5. style should be 1-3 descriptive words max (e.g., "Ugly Christmas", "Vintage Retro", "Bold Modern").
6. imageFeature describes ONE visual element concisely, not a detailed scene.
7. additionalInstructions should only include technical notes like "on black background".
${styleIntelGuidance}
CHARACTER LIMITS (STRICT):
- exactText: ${DESIGN_FORM_LIMITS.exactText} chars max
- style: ${DESIGN_FORM_LIMITS.style} chars max
- imageFeature: ${DESIGN_FORM_LIMITS.imageFeature} chars max
- niche: ${DESIGN_FORM_LIMITS.niche} chars max
- tone: ${DESIGN_FORM_LIMITS.tone} chars max
- additionalInstructions: ${DESIGN_FORM_LIMITS.additionalInstructions} chars max

RISK LEVEL: ${riskLevel}/100
${riskDescription}

Higher risk = more creative/novel choices, NOT lower quality. All designs should be high quality regardless of risk level.

Return ONLY valid JSON matching the schema. No explanations.`;
}

/**
 * Build the user prompt with research data
 */
function buildUserPrompt(
  trendData: FormFillerInput['trendData'],
  styleContext?: StyleContext,
  styleSpec?: StyleRecipe
): string {
  const parts: string[] = ['Research data:'];

  // Add trend data
  if (trendData.phrase || trendData.designText) {
    parts.push(`Phrase: "${trendData.phrase || trendData.designText}"`);
  }
  if (trendData.topic) {
    parts.push(`Topic: ${trendData.topic}`);
  }
  if (trendData.niche) {
    parts.push(`Niche: ${trendData.niche}`);
  }
  if (trendData.audienceProfile) {
    parts.push(`Audience: ${trendData.audienceProfile}`);
  }
  if (trendData.visualStyle) {
    parts.push(`Visual hints: ${trendData.visualStyle}`);
  }
  if (trendData.sentiment) {
    parts.push(`Sentiment: ${trendData.sentiment}`);
  }
  if (trendData.keywords?.length) {
    parts.push(`Keywords: ${trendData.keywords.slice(0, 5).join(', ')}`);
  }

  // Add style context if available
  if (styleContext) {
    parts.push('');
    parts.push('Style context from database:');
    if (styleContext.dominantTypography) {
      parts.push(`Typography: ${styleContext.dominantTypography}`);
    }
    if (styleContext.colorPalette?.length) {
      parts.push(`Colors: ${styleContext.colorPalette.join(', ')}`);
    }
    if (styleContext.moodAesthetic) {
      parts.push(`Mood: ${styleContext.moodAesthetic}`);
    }
    if (styleContext.avoidStyles?.length) {
      parts.push(`Avoid: ${styleContext.avoidStyles.join(', ')}`);
    }
  }

  // Add StyleIntel recipe guidance if available
  if (styleSpec) {
    parts.push('');
    parts.push('═══════════════════════════════════════════════════════════════');
    parts.push('STYLE RECIPE (AUTHORITATIVE - USE THIS FOR STYLE DECISIONS):');
    parts.push('═══════════════════════════════════════════════════════════════');
    parts.push(`Recipe: "${styleSpec.meta.displayName}" (${styleSpec.meta.category})`);
    if (styleSpec.meta.nicheHints?.length) {
      parts.push(`Best for: ${styleSpec.meta.nicheHints.join(', ')}`);
    }
    if (styleSpec.meta.tone?.length) {
      parts.push(`Tone direction: ${styleSpec.meta.tone.join(', ')}`);
    }
    // Include layout guidance
    if (styleSpec.layout.composition) {
      parts.push(`Layout: ${styleSpec.layout.composition}`);
    }
    // Include recommended garment colors
    if (styleSpec.color.recommendedGarmentColors?.length) {
      parts.push(`Best on: ${styleSpec.color.recommendedGarmentColors.join(' or ')} shirts`);
    }
    parts.push('');
    parts.push('IMPORTANT: Your "style" field should align with this recipe.');
    parts.push('Use research data above for niche/audience context only.');
  }

  parts.push('');
  parts.push('Fill the design form. Return ONLY valid JSON.');

  return parts.join('\n');
}

/**
 * Enforce character limits on all form fields
 */
function enforceCharacterLimits(form: DesignForm): DesignForm {
  return {
    exactText: form.exactText
      ? form.exactText.slice(0, DESIGN_FORM_LIMITS.exactText)
      : null,
    style: form.style.slice(0, DESIGN_FORM_LIMITS.style),
    imageFeature: form.imageFeature
      ? form.imageFeature.slice(0, DESIGN_FORM_LIMITS.imageFeature)
      : null,
    niche: form.niche.slice(0, DESIGN_FORM_LIMITS.niche),
    tone: form.tone.slice(0, DESIGN_FORM_LIMITS.tone),
    additionalInstructions: form.additionalInstructions
      ? form.additionalInstructions.slice(
          0,
          DESIGN_FORM_LIMITS.additionalInstructions
        )
      : null,
    modelOverrides: form.modelOverrides,
  };
}

/**
 * Convert ManualSpecs to DesignForm
 * Used when user provides manual input
 */
export function manualSpecsToDesignForm(specs: {
  exactText: string;
  style?: string;
  imageFeature?: string;
  niche?: string;
  tone?: string;
  additionalInstructions?: string;
}): DesignForm {
  return enforceCharacterLimits({
    exactText: specs.exactText || null,
    style: specs.style || 'Modern',
    imageFeature: specs.imageFeature || null,
    niche: specs.niche || 'general',
    tone: specs.tone || 'fun',
    additionalInstructions: specs.additionalInstructions || null,
  });
}

/**
 * Validate a DesignForm
 */
export function validateDesignForm(form: DesignForm): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check required fields
  if (!form.style) {
    errors.push('style is required');
  }
  if (!form.niche) {
    errors.push('niche is required');
  }
  if (!form.tone) {
    errors.push('tone is required');
  }

  // Check character limits
  if (form.exactText && form.exactText.length > DESIGN_FORM_LIMITS.exactText) {
    errors.push(
      `exactText exceeds ${DESIGN_FORM_LIMITS.exactText} chars`
    );
  }
  if (form.style.length > DESIGN_FORM_LIMITS.style) {
    errors.push(`style exceeds ${DESIGN_FORM_LIMITS.style} chars`);
  }
  if (
    form.imageFeature &&
    form.imageFeature.length > DESIGN_FORM_LIMITS.imageFeature
  ) {
    errors.push(
      `imageFeature exceeds ${DESIGN_FORM_LIMITS.imageFeature} chars`
    );
  }
  if (form.niche.length > DESIGN_FORM_LIMITS.niche) {
    errors.push(`niche exceeds ${DESIGN_FORM_LIMITS.niche} chars`);
  }
  if (form.tone.length > DESIGN_FORM_LIMITS.tone) {
    errors.push(`tone exceeds ${DESIGN_FORM_LIMITS.tone} chars`);
  }
  if (
    form.additionalInstructions &&
    form.additionalInstructions.length >
      DESIGN_FORM_LIMITS.additionalInstructions
  ) {
    errors.push(
      `additionalInstructions exceeds ${DESIGN_FORM_LIMITS.additionalInstructions} chars`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
