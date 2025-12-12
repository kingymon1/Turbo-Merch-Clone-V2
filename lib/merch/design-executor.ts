/**
 * Design Executor
 *
 * This module uses Claude to execute design briefs with STRICT compliance.
 * The executor's job is to translate a DesignBrief into an image generation
 * prompt that honors ALL style requirements without deviation.
 *
 * Key principle: The executor is a DISCIPLINED translator, not a creative.
 * All creative decisions were made during research. The executor FOLLOWS.
 */

import Anthropic from '@anthropic-ai/sdk';
import { DesignBrief, DesignExecutionResult } from './types';

// Initialize Anthropic client
const getAnthropicClient = (): Anthropic => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }
  return new Anthropic({ apiKey });
};

/**
 * Execute a design brief and generate an image prompt
 * Uses Claude with strict tool use to ensure compliance
 */
export async function executeDesignBrief(
  brief: DesignBrief
): Promise<DesignExecutionResult> {
  console.log(`[DesignExecutor] Executing brief for: "${brief.text.exact}"`);
  console.log(`[DesignExecutor] Style source: ${brief.style.source}, confidence: ${brief.style.confidence}`);

  try {
    const client = getAnthropicClient();

    // Build the compliance checklist from the brief
    const complianceRequirements = buildComplianceRequirements(brief);

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      tools: [{
        name: 'generate_image_prompt',
        description: 'Generate a t-shirt design image prompt that EXACTLY follows the design brief. The prompt will be sent to an image generation model.',
        input_schema: {
          type: 'object' as const,
          properties: {
            imagePrompt: {
              type: 'string',
              description: 'The complete image generation prompt for the t-shirt design'
            },
            compliance: {
              type: 'object',
              properties: {
                textPreserved: {
                  type: 'boolean',
                  description: 'True if the exact text from the brief is used verbatim'
                },
                typographyFollowed: {
                  type: 'boolean',
                  description: 'True if typography requirements are followed'
                },
                colorApproachFollowed: {
                  type: 'boolean',
                  description: 'True if color palette and mood requirements are followed'
                },
                aestheticFollowed: {
                  type: 'boolean',
                  description: 'True if the primary aesthetic is honored'
                },
                forbiddenElementsAvoided: {
                  type: 'boolean',
                  description: 'True if all forbidden elements are avoided'
                },
                complianceNotes: {
                  type: 'string',
                  description: 'Brief notes on how each requirement was addressed'
                }
              },
              required: ['textPreserved', 'typographyFollowed', 'colorApproachFollowed', 'aestheticFollowed', 'forbiddenElementsAvoided', 'complianceNotes']
            }
          },
          required: ['imagePrompt', 'compliance']
        }
      }],
      tool_choice: { type: 'tool', name: 'generate_image_prompt' },
      messages: [{
        role: 'user',
        content: buildExecutorPrompt(brief, complianceRequirements)
      }]
    });

    // Extract tool use response
    const toolUse = response.content.find(c => c.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('Claude did not return a tool use response');
    }

    const toolInput = toolUse.input as {
      imagePrompt: string;
      compliance: {
        textPreserved: boolean;
        typographyFollowed: boolean;
        colorApproachFollowed: boolean;
        aestheticFollowed: boolean;
        forbiddenElementsAvoided: boolean;
        complianceNotes: string;
      };
    };

    // Validate compliance
    const compliance = toolInput.compliance;
    const allCompliant =
      compliance.textPreserved &&
      compliance.typographyFollowed &&
      compliance.colorApproachFollowed &&
      compliance.aestheticFollowed &&
      compliance.forbiddenElementsAvoided;

    // Calculate overall compliance score
    const complianceScore = [
      compliance.textPreserved,
      compliance.typographyFollowed,
      compliance.colorApproachFollowed,
      compliance.aestheticFollowed,
      compliance.forbiddenElementsAvoided
    ].filter(Boolean).length / 5;

    // Generate warnings for any non-compliance
    const warnings: string[] = [];
    if (!compliance.textPreserved) warnings.push('Text may not match brief exactly');
    if (!compliance.typographyFollowed) warnings.push('Typography may deviate from requirements');
    if (!compliance.colorApproachFollowed) warnings.push('Colors may not match palette');
    if (!compliance.aestheticFollowed) warnings.push('Aesthetic may differ from brief');
    if (!compliance.forbiddenElementsAvoided) warnings.push('May contain forbidden elements');

    console.log(`[DesignExecutor] Compliance score: ${complianceScore * 100}%`);
    if (warnings.length > 0) {
      console.log(`[DesignExecutor] Warnings: ${warnings.join(', ')}`);
    }

    return {
      success: true,
      prompt: toolInput.imagePrompt,
      compliance: {
        textPreserved: compliance.textPreserved,
        typographyFollowed: compliance.typographyFollowed,
        colorApproachFollowed: compliance.colorApproachFollowed,
        aestheticFollowed: compliance.aestheticFollowed,
        forbiddenElementsAvoided: compliance.forbiddenElementsAvoided,
        overallScore: complianceScore
      },
      warnings: warnings.length > 0 ? warnings : undefined
    };

  } catch (error) {
    console.error('[DesignExecutor] Error executing brief:', error);

    // Fallback to direct prompt generation if Claude fails
    return generateFallbackPrompt(brief);
  }
}

/**
 * Build the executor prompt with all requirements
 */
function buildExecutorPrompt(brief: DesignBrief, requirements: string[]): string {
  return `You are a DESIGN EXECUTOR. Your job is to translate a Design Brief into an image generation prompt.

CRITICAL RULES:
1. You are NOT a creative. All creative decisions have been made.
2. You MUST follow the brief EXACTLY - no improvisation, no "improvements"
3. The text "${brief.text.exact}" MUST appear in the prompt VERBATIM
4. Every style requirement is MANDATORY, not a suggestion
5. Forbidden elements are STRICTLY prohibited

═══════════════════════════════════════════════════════════════
DESIGN BRIEF
═══════════════════════════════════════════════════════════════

TEXT (MANDATORY - USE EXACTLY):
"${brief.text.exact}"
${brief.text.preserveCase ? '(Preserve original casing)' : ''}

TYPOGRAPHY (MANDATORY):
- Required: ${brief.style.typography.required}
${brief.style.typography.weight ? `- Weight: ${brief.style.typography.weight}` : ''}
${brief.style.typography.effects?.length ? `- Effects: ${brief.style.typography.effects.join(', ')}` : ''}
${brief.style.typography.forbidden?.length ? `- FORBIDDEN: ${brief.style.typography.forbidden.join(', ')}` : ''}

COLOR APPROACH (MANDATORY):
- Palette: ${brief.style.colorApproach.palette.join(', ')}
- Mood: ${brief.style.colorApproach.mood}
- Shirt Color: ${brief.style.colorApproach.shirtColor}
${brief.style.colorApproach.forbidden?.length ? `- FORBIDDEN: ${brief.style.colorApproach.forbidden.join(', ')}` : ''}

AESTHETIC (MANDATORY):
- Primary: ${brief.style.aesthetic.primary}
- Keywords: ${brief.style.aesthetic.keywords.join(', ')}
${brief.style.aesthetic.reference ? `- Reference: ${brief.style.aesthetic.reference}` : ''}
${brief.style.aesthetic.forbidden?.length ? `- FORBIDDEN: ${brief.style.aesthetic.forbidden.join(', ')}` : ''}

LAYOUT (MANDATORY):
- Composition: ${brief.style.layout.composition}
- Text Placement: ${brief.style.layout.textPlacement}
${brief.style.layout.includeIcon !== undefined ? `- Include Icon: ${brief.style.layout.includeIcon}` : ''}
${brief.style.layout.iconStyle ? `- Icon Style: ${brief.style.layout.iconStyle}` : ''}

CONTEXT:
- Niche: ${brief.context.niche}
- Audience: ${brief.context.audienceDescription}
- Tone: ${brief.context.tone}
${brief.context.seasonalModifier ? `- Seasonal: ${brief.context.seasonalModifier}` : ''}
${brief.context.crossNicheBlend?.length ? `- Cross-Niche Blend: ${brief.context.crossNicheBlend.join(' + ')}` : ''}

═══════════════════════════════════════════════════════════════
COMPLIANCE CHECKLIST
═══════════════════════════════════════════════════════════════

${requirements.map((req, i) => `${i + 1}. ${req}`).join('\n')}

═══════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════

Generate an image prompt for a t-shirt design that:

TECHNICAL REQUIREMENTS:
1. Is suitable for print-on-demand (transparent background preferred)
2. Works on a ${brief.style.colorApproach.shirtColor} t-shirt with high contrast
3. Has the text "${brief.text.exact}" as the PRIMARY, FIRST element mentioned in the prompt
4. Follows ALL style requirements from the brief above
5. Avoids ALL forbidden elements

QUALITY FLOOR (MINIMUM STANDARDS):
The prompt must include these negative constraints to avoid low-quality output:
- DO NOT create: amateur graphics, clipart style, basic flat designs, generic stock imagery
- DO NOT create: poorly rendered text, childish scribbles, low-effort templates
- DO NOT create: blurry elements, pixelated graphics, MS Paint quality, default system fonts

IMPORTANT - RESEARCH DATA PRIORITY:
- The style requirements above come from REAL market research
- DO NOT override or "enhance" the research data with generic quality instructions
- If the research says "vintage distressed" - use that, don't add "3D effects"
- If the research says "minimalist clean" - honor that, don't add "gradients and shadows"
- Trust the research data - it knows what sells in this niche

PROMPT STRUCTURE (MANDATORY):
1. Text requirement MUST come FIRST (loudest part of prompt)
2. Style direction follows research brief EXACTLY
3. Quality floor constraints come LAST as negative/avoid instructions

REMEMBER: You are an EXECUTOR, not a creative director. The brief IS the creative direction.`;
}

/**
 * Build compliance requirements from the brief
 */
function buildComplianceRequirements(brief: DesignBrief): string[] {
  const requirements: string[] = [
    `Text "${brief.text.exact}" appears EXACTLY as specified`,
    `Typography is ${brief.style.typography.required}`,
    `Color palette includes: ${brief.style.colorApproach.palette.join(', ')}`,
    `Overall aesthetic is: ${brief.style.aesthetic.primary}`,
    `Composition follows: ${brief.style.layout.composition}`
  ];

  if (brief.style.typography.forbidden?.length) {
    requirements.push(`Typography does NOT include: ${brief.style.typography.forbidden.join(', ')}`);
  }

  if (brief.style.colorApproach.forbidden?.length) {
    requirements.push(`Colors do NOT include: ${brief.style.colorApproach.forbidden.join(', ')}`);
  }

  if (brief.style.aesthetic.forbidden?.length) {
    requirements.push(`Aesthetic is NOT: ${brief.style.aesthetic.forbidden.join(', ')}`);
  }

  return requirements;
}

/**
 * Generate a fallback prompt if Claude fails
 * This is a safety net - should rarely be used
 */
function generateFallbackPrompt(brief: DesignBrief): DesignExecutionResult {
  console.log('[DesignExecutor] Using fallback prompt generation');

  // Text-first structure: Text requirement is the loudest part
  const prompt = `TEXT REQUIREMENT (MANDATORY - EXACT): T-shirt design with the text "${brief.text.exact}" - this text must be clearly readable and is the primary element.

STYLE: ${brief.style.aesthetic.primary}
TYPOGRAPHY: ${brief.style.typography.required}
COLORS: ${brief.style.colorApproach.palette.join(', ')}
MOOD: ${brief.style.colorApproach.mood}
LAYOUT: ${brief.style.layout.composition}

For ${brief.context.niche} audience. Tone: ${brief.context.tone}.

QUALITY FLOOR (AVOID):
${brief.style.aesthetic.forbidden?.length ? `Style: ${brief.style.aesthetic.forbidden.join(', ')}.` : ''}
DO NOT create: amateur graphics, clipart style, basic flat designs, poorly rendered text, blurry elements, pixelated graphics, MS Paint quality, default system fonts.

Print-ready, transparent background, suitable for ${brief.style.colorApproach.shirtColor} shirt.`;

  return {
    success: true,
    prompt,
    compliance: {
      textPreserved: true,
      typographyFollowed: true,
      colorApproachFollowed: true,
      aestheticFollowed: true,
      forbiddenElementsAvoided: true,
      overallScore: 0.8  // Fallback gets lower confidence
    },
    warnings: ['Used fallback prompt generation - Claude API may be unavailable']
  };
}

/**
 * Create a DesignBrief from TrendData and optional user overrides
 */
export function createDesignBriefFromTrend(
  trend: {
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
  nicheStyle?: Partial<import('./types').NicheStyleProfile>,
  userOverrides?: {
    text?: string;
    style?: string;
    tone?: string;
  }
): DesignBrief {
  // Determine text - user override > trend data
  const text = userOverrides?.text || trend.designText || trend.phrase || trend.topic || 'Design';

  // Determine niche
  const niche = trend.niche || extractNicheFromTopic(trend.topic || '');

  // Build typography from available sources
  const typography = buildTypography(trend, nicheStyle, userOverrides?.style);

  // Build color approach from available sources
  const colorApproach = buildColorApproach(trend, nicheStyle);

  // Build aesthetic from available sources
  const aesthetic = buildAesthetic(trend, nicheStyle, userOverrides?.style);

  // Build layout from available sources
  const layout = buildLayout(trend, nicheStyle);

  // Determine style source and confidence
  const styleSource = nicheStyle
    ? 'discovered'
    : trend.visualStyle
      ? 'researched'
      : userOverrides?.style
        ? 'user-specified'
        : 'niche-default';

  const styleConfidence = nicheStyle?.confidence || (trend.visualStyle ? 0.7 : 0.5);

  return {
    text: {
      exact: text,
      preserveCase: true
    },
    style: {
      source: styleSource,
      confidence: styleConfidence,
      typography,
      colorApproach,
      aesthetic,
      layout
    },
    context: {
      niche,
      audienceDescription: trend.audienceProfile || `${niche} enthusiasts`,
      tone: userOverrides?.tone || trend.sentiment || 'funny',
      seasonalModifier: detectSeasonalContext(text, trend.topic),
      crossNicheBlend: detectCrossNiche(niche, text)
    },
    _meta: {
      briefId: `brief-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      researchSource: 'trend-data',
      styleConfidence,
      originalTrendData: trend
    }
  };
}

// ============================================================================
// NICHE-AWARE DEFAULTS
// When research data is incomplete, use these niche-specific fallbacks
// instead of generic defaults. These are based on successful market patterns.
// ============================================================================

const NICHE_STYLE_DEFAULTS: Record<string, {
  typography: string;
  effects: string[];
  colorPalette: string[];
  mood: string;
  shirtColor: string;
  aesthetic: string;
}> = {
  'fishing': {
    typography: 'bold weathered sans-serif with outdoor character',
    effects: ['slightly distressed'],
    colorPalette: ['forest green', 'navy', 'rust', 'cream'],
    mood: 'rugged outdoor',
    shirtColor: 'forest green',
    aesthetic: 'cozy cabin fishing lodge vibe',
  },
  'nursing': {
    typography: 'clean modern sans-serif with friendly weight',
    effects: [],
    colorPalette: ['teal', 'soft pink', 'white', 'navy'],
    mood: 'professional yet warm',
    shirtColor: 'navy',
    aesthetic: 'healthcare professional pride',
  },
  'coffee': {
    typography: 'warm rounded sans-serif or friendly script',
    effects: ['subtle shadow'],
    colorPalette: ['coffee brown', 'cream', 'warm tan', 'dark roast'],
    mood: 'cozy morning ritual',
    shirtColor: 'heather brown',
    aesthetic: 'coffee shop comfort',
  },
  'dog': {
    typography: 'playful rounded sans-serif',
    effects: ['friendly weight'],
    colorPalette: ['warm tones', 'paw prints', 'earthy colors'],
    mood: 'loving and playful',
    shirtColor: 'heather gray',
    aesthetic: 'devoted pet parent',
  },
  'gaming': {
    typography: 'bold tech-styled sans-serif or pixel-inspired',
    effects: ['glow', 'tech edges'],
    colorPalette: ['neon green', 'electric blue', 'black', 'purple'],
    mood: 'energetic competitive',
    shirtColor: 'black',
    aesthetic: 'gamer lifestyle',
  },
  'fitness': {
    typography: 'ultra bold condensed sans-serif',
    effects: ['strong shadow', 'metallic optional'],
    colorPalette: ['black', 'red', 'gold', 'white'],
    mood: 'powerful motivational',
    shirtColor: 'black',
    aesthetic: 'gym motivation',
  },
  'teacher': {
    typography: 'friendly serif or clean sans-serif',
    effects: ['chalkboard style optional'],
    colorPalette: ['apple red', 'green', 'navy', 'warm tones'],
    mood: 'appreciative warm',
    shirtColor: 'heather gray',
    aesthetic: 'educator appreciation',
  },
  'default': {
    typography: 'versatile bold sans-serif',
    effects: [],
    colorPalette: ['versatile neutral tones'],
    mood: 'balanced approachable',
    shirtColor: 'black',
    aesthetic: 'clean modern design',
  },
};

/**
 * Get niche-specific defaults for incomplete research data
 */
function getNicheDefaults(niche: string): typeof NICHE_STYLE_DEFAULTS['default'] {
  const nicheLower = niche?.toLowerCase() || '';

  // Try to match niche to defaults
  for (const [key, defaults] of Object.entries(NICHE_STYLE_DEFAULTS)) {
    if (key !== 'default' && nicheLower.includes(key)) {
      return defaults;
    }
  }

  return NICHE_STYLE_DEFAULTS.default;
}

/**
 * Build typography settings from available data
 *
 * PRIORITY ORDER (most reliable to least):
 * 1. nicheStyle - from Claude Vision image analysis (cached OR real-time)
 * 2. trend data - from Gemini text-based research
 * 3. user style - explicit user preference
 * 4. niche-aware defaults - fallback based on niche context
 *
 * Note: nicheStyle comes from getSmartStyleProfile which ensures freshness:
 * - Fresh cache (<1 week) → used directly
 * - Stale/missing → real-time Claude Vision analysis performed
 * - Real-time fails → stale cache with reduced confidence
 */
function buildTypography(
  trend: { typographyStyle?: string; visualStyle?: string; designStyle?: string; niche?: string },
  nicheStyle?: Partial<import('./types').NicheStyleProfile>,
  userStyle?: string
): DesignBrief['style']['typography'] {
  const nicheDefaults = getNicheDefaults(trend.niche || '');
  let primary = nicheDefaults.typography;
  const forbidden: string[] = [];
  const effects: string[] = [...nicheDefaults.effects];

  if (nicheStyle?.dominantTypography?.primary) {
    primary = nicheStyle.dominantTypography.primary;
  } else if (trend.typographyStyle) {
    primary = trend.typographyStyle;
  } else if (trend.visualStyle) {
    // Extract typography hints from visual style
    if (trend.visualStyle.toLowerCase().includes('vintage')) {
      primary = 'vintage serif with slight wear';
      effects.push('distressed');
    } else if (trend.visualStyle.toLowerCase().includes('modern')) {
      primary = 'clean modern sans-serif';
    } else if (trend.visualStyle.toLowerCase().includes('playful')) {
      primary = 'rounded friendly sans-serif';
    } else if (trend.visualStyle.toLowerCase().includes('retro')) {
      primary = 'retro display typeface';
      effects.push('shadow');
    }
  } else if (userStyle) {
    if (userStyle.toLowerCase().includes('vintage')) {
      primary = 'vintage serif with character';
      effects.push('distressed');
    } else if (userStyle.toLowerCase().includes('minimalist')) {
      primary = 'thin clean sans-serif';
    } else if (userStyle.toLowerCase().includes('bold')) {
      primary = 'extra bold impact style';
    }
  }
  // Note: If none of the above match, nicheDefaults.typography is already set

  // Add forbidden based on nicheStyle.moodAesthetic.avoid
  if (nicheStyle?.moodAesthetic?.avoid) {
    for (const avoid of nicheStyle.moodAesthetic.avoid) {
      if (avoid.toLowerCase().includes('neon')) forbidden.push('neon');
      if (avoid.toLowerCase().includes('script')) forbidden.push('script');
      if (avoid.toLowerCase().includes('comic')) forbidden.push('comic sans');
    }
  }

  return {
    required: primary,
    forbidden: forbidden.length > 0 ? forbidden : undefined,
    weight: 'bold',
    effects: effects.length > 0 ? effects : undefined
  };
}

/**
 * Build color approach from available data
 * Uses niche-aware defaults when research data is incomplete
 */
function buildColorApproach(
  trend: { colorPalette?: string; recommendedShirtColor?: string; visualStyle?: string; niche?: string },
  nicheStyle?: Partial<import('./types').NicheStyleProfile>
): DesignBrief['style']['colorApproach'] {
  const nicheDefaults = getNicheDefaults(trend.niche || '');
  let palette: string[] = nicheDefaults.colorPalette;
  let mood = nicheDefaults.mood;
  let shirtColor = trend.recommendedShirtColor || nicheDefaults.shirtColor;
  const forbidden: string[] = [];

  if (nicheStyle?.colorPalette?.primary?.length) {
    palette = nicheStyle.colorPalette.primary;
    if (nicheStyle.colorPalette.background?.length) {
      shirtColor = nicheStyle.colorPalette.background[0];
    }
  } else if (trend.colorPalette) {
    // Parse color palette string
    palette = trend.colorPalette.split(/[,;]/).map(c => c.trim()).filter(Boolean);
    if (palette.length === 0) {
      palette = [trend.colorPalette];
    }
  }
  // Note: If none of the above match, nicheDefaults.colorPalette is already set

  // Determine mood from visual style
  if (trend.visualStyle) {
    const vs = trend.visualStyle.toLowerCase();
    if (vs.includes('warm') || vs.includes('cozy')) mood = 'warm and inviting';
    else if (vs.includes('bold') || vs.includes('energetic')) mood = 'energetic and vibrant';
    else if (vs.includes('calm') || vs.includes('minimal')) mood = 'calm and understated';
    else if (vs.includes('professional')) mood = 'professional and clean';
    else if (vs.includes('playful')) mood = 'fun and playful';
  }
  // Note: If visualStyle doesn't match, nicheDefaults.mood is already set

  // Add forbidden colors based on nicheStyle
  if (nicheStyle?.moodAesthetic?.avoid) {
    for (const avoid of nicheStyle.moodAesthetic.avoid) {
      if (avoid.toLowerCase().includes('neon')) forbidden.push('neon colors');
      if (avoid.toLowerCase().includes('dark')) forbidden.push('dark gothic colors');
      if (avoid.toLowerCase().includes('rainbow')) forbidden.push('rainbow');
    }
  }

  return {
    palette,
    mood,
    shirtColor,
    forbidden: forbidden.length > 0 ? forbidden : undefined
  };
}

/**
 * Build aesthetic settings from available data
 * Uses niche-aware defaults when research data is incomplete
 */
function buildAesthetic(
  trend: { visualStyle?: string; designStyle?: string; niche?: string },
  nicheStyle?: Partial<import('./types').NicheStyleProfile>,
  userStyle?: string
): DesignBrief['style']['aesthetic'] {
  const nicheDefaults = getNicheDefaults(trend.niche || '');
  let primary = nicheDefaults.aesthetic;
  let keywords: string[] = ['professional', 'readable'];
  const forbidden: string[] = [];

  if (nicheStyle?.moodAesthetic?.primary) {
    primary = nicheStyle.moodAesthetic.primary;
    if (nicheStyle.moodAesthetic.avoid) {
      forbidden.push(...nicheStyle.moodAesthetic.avoid);
    }
  } else if (trend.visualStyle) {
    // Use the rich visual style directly - don't compress it!
    primary = trend.visualStyle;
    keywords = extractKeywordsFromStyle(trend.visualStyle);
  } else if (trend.designStyle) {
    primary = trend.designStyle;
    keywords = extractKeywordsFromStyle(trend.designStyle);
  } else if (userStyle) {
    primary = userStyle;
    keywords = extractKeywordsFromStyle(userStyle);
  }
  // Note: If none of the above match, nicheDefaults.aesthetic is already set

  // Extract keywords from nicheStyle illustration subjects
  if (nicheStyle?.illustrationStyle?.subjectMatter?.length) {
    keywords.push(...nicheStyle.illustrationStyle.subjectMatter);
  }

  return {
    primary,
    keywords,
    forbidden: forbidden.length > 0 ? forbidden : undefined
  };
}

/**
 * Build layout settings from available data
 * Priority: trend.textLayout (agent-determined) > nicheStyle > defaults
 */
function buildLayout(
  trend: {
    visualStyle?: string;
    textLayout?: {
      positioning?: string;
      emphasis?: string;
      sizing?: string;
      reasoning?: string;
    };
  },
  nicheStyle?: Partial<import('./types').NicheStyleProfile>
): DesignBrief['style']['layout'] {
  let composition = 'centered, balanced composition';
  let textPlacement = 'centered';
  let includeIcon = false;
  let iconStyle: string | undefined;

  // PRIORITY 1: Use agent-determined text layout from research
  if (trend.textLayout) {
    // Build composition from agent decisions
    const layoutParts: string[] = [];

    if (trend.textLayout.positioning) {
      layoutParts.push(trend.textLayout.positioning);
    }
    if (trend.textLayout.emphasis) {
      layoutParts.push(`emphasis: ${trend.textLayout.emphasis}`);
    }
    if (trend.textLayout.sizing) {
      layoutParts.push(`sizing: ${trend.textLayout.sizing}`);
    }

    if (layoutParts.length > 0) {
      composition = layoutParts.join('; ');
    }

    textPlacement = trend.textLayout.positioning || textPlacement;

    console.log(`[DesignExecutor] Using agent-determined layout: ${composition}`);
    if (trend.textLayout.reasoning) {
      console.log(`[DesignExecutor] Layout reasoning: ${trend.textLayout.reasoning}`);
    }
  }
  // PRIORITY 2: Use cached niche style patterns
  else if (nicheStyle?.layoutPatterns) {
    composition = nicheStyle.layoutPatterns.dominant || composition;
    textPlacement = nicheStyle.layoutPatterns.textPlacement || textPlacement;
    includeIcon = nicheStyle.layoutPatterns.iconUsage === 'common';
    if (includeIcon && nicheStyle.illustrationStyle?.dominant) {
      iconStyle = nicheStyle.illustrationStyle.dominant;
    }
  }

  // Detect if visual style suggests icons
  if (trend.visualStyle) {
    const vs = trend.visualStyle.toLowerCase();
    if (vs.includes('illustration') || vs.includes('icon') || vs.includes('graphic')) {
      includeIcon = true;
      iconStyle = vs.includes('simple') ? 'simple line art' : 'detailed illustration';
    }
  }

  return {
    composition,
    textPlacement,
    includeIcon,
    iconStyle
  };
}

/**
 * Extract keywords from a style description
 */
function extractKeywordsFromStyle(style: string): string[] {
  const keywords: string[] = [];
  const styleWords = style.toLowerCase().split(/[\s,;]+/);

  const relevantWords = [
    'vintage', 'retro', 'modern', 'minimal', 'bold', 'playful',
    'professional', 'elegant', 'rustic', 'cozy', 'warm', 'cool',
    'edgy', 'clean', 'distressed', 'hand-drawn', 'illustrated',
    'typography', 'graphic', 'artistic', 'simple', 'detailed',
    'outdoor', 'nature', 'urban', 'classic', 'contemporary',
    'whimsical', 'serious', 'fun', 'quirky', 'sophisticated'
  ];

  for (const word of styleWords) {
    if (relevantWords.includes(word)) {
      keywords.push(word);
    }
  }

  return keywords.length > 0 ? keywords : ['balanced', 'readable'];
}

/**
 * Extract niche from topic string
 */
function extractNicheFromTopic(topic: string): string {
  const topicLower = topic.toLowerCase();

  // Common niche mappings
  const nicheMappings: Record<string, string> = {
    'nurse': 'nursing',
    'teacher': 'teaching',
    'doctor': 'medical',
    'fishing': 'fishing',
    'hunting': 'hunting',
    'camping': 'camping',
    'coffee': 'coffee',
    'dog': 'dog lovers',
    'cat': 'cat lovers',
    'mom': 'motherhood',
    'dad': 'fatherhood',
    'gaming': 'gaming',
    'golf': 'golf',
    'fitness': 'fitness',
    'yoga': 'yoga',
    'beer': 'beer',
    'wine': 'wine',
    'music': 'music',
    'christmas': 'christmas',
    'halloween': 'halloween'
  };

  for (const [key, value] of Object.entries(nicheMappings)) {
    if (topicLower.includes(key)) {
      return value;
    }
  }

  // Default: use first significant word
  const words = topic.split(/\s+/).filter(w => w.length > 3);
  return words[0]?.toLowerCase() || 'general';
}

/**
 * Detect seasonal context from text
 */
function detectSeasonalContext(text: string, topic?: string): string | undefined {
  const combined = `${text} ${topic || ''}`.toLowerCase();

  if (combined.includes('christmas') || combined.includes('xmas') || combined.includes('holiday')) {
    return 'christmas';
  }
  if (combined.includes('halloween') || combined.includes('spooky') || combined.includes('witch')) {
    return 'halloween';
  }
  if (combined.includes('valentine') || combined.includes('love')) {
    return 'valentines';
  }
  if (combined.includes('easter') || combined.includes('bunny')) {
    return 'easter';
  }
  if (combined.includes('mother') || combined.includes('mom')) {
    return 'mothers-day';
  }
  if (combined.includes('father') || combined.includes('dad')) {
    return 'fathers-day';
  }
  if (combined.includes('4th of july') || combined.includes('fourth of july') || combined.includes('patriot')) {
    return 'july-4th';
  }

  return undefined;
}

/**
 * Detect cross-niche opportunities from text
 */
function detectCrossNiche(primaryNiche: string, text: string): string[] | undefined {
  const textLower = text.toLowerCase();
  const detected: string[] = [];

  const nicheIndicators: Record<string, string[]> = {
    'coffee': ['coffee', 'caffeine', 'espresso', 'latte'],
    'wine': ['wine', 'vino', 'merlot', 'chardonnay'],
    'beer': ['beer', 'brew', 'ipa', 'ale'],
    'dog': ['dog', 'puppy', 'pup', 'canine', 'fur baby'],
    'cat': ['cat', 'kitten', 'feline', 'meow'],
    'fishing': ['fish', 'fishing', 'angler', 'bass'],
    'hunting': ['hunt', 'hunting', 'deer', 'buck'],
    'gaming': ['game', 'gaming', 'gamer', 'player'],
    'fitness': ['gym', 'fitness', 'workout', 'lift'],
    'yoga': ['yoga', 'namaste', 'zen', 'meditation'],
    'running': ['run', 'running', 'marathon', 'jog'],
    'camping': ['camp', 'camping', 'tent', 'outdoor'],
    'golf': ['golf', 'birdie', 'bogey', 'tee']
  };

  for (const [niche, indicators] of Object.entries(nicheIndicators)) {
    if (niche !== primaryNiche) {
      for (const indicator of indicators) {
        if (textLower.includes(indicator)) {
          detected.push(niche);
          break;
        }
      }
    }
  }

  return detected.length > 0 ? detected : undefined;
}

export default {
  executeDesignBrief,
  createDesignBriefFromTrend
};
