/**
 * Variation Strategy Generator
 *
 * Uses AI to generate unique visual strategies for design variations.
 * Each variation gets a completely different visual approach.
 */

import { GoogleGenAI } from "@google/genai";

// Lazy initialization of API client
let aiClient: GoogleGenAI | null = null;
const getAI = (): GoogleGenAI => {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
};

export interface VariationStrategy {
  visualDirection: string;
  fontStyle: string;
  layoutApproach: string;
  colorScheme: string;
  graphicElements: string;
  overallVibe: string;
  specificDetails: string;
  phraseVariation: string;
}

/**
 * Generate a unique variation strategy using AI
 */
export async function generateVariationStrategy(
  originalPhrase: string,
  niche: string,
  variationNumber: number,
  previousStrategies: VariationStrategy[]
): Promise<VariationStrategy> {
  const ai = getAI();

  const previousDescriptions = previousStrategies.map((s, i) =>
    `Variation ${i + 1}: ${s.visualDirection} - ${s.overallVibe}`
  ).join('\n');

  const prompt = `You are a creative director designing t-shirt variation #${variationNumber + 1} for Amazon Merch.

Original Design:
- Phrase: "${originalPhrase}"
- Niche: ${niche}

Previous variations already created:
${previousDescriptions || 'None yet - this is the first variation'}

Your task: Create a COMPLETELY DIFFERENT visual approach for this same phrase.
Think like a different designer with a different aesthetic sensibility.

Requirements:
- Must look visually distinct from all previous variations
- Same phrase (or very minor text variation like adding "Ever" or changing punctuation)
- Still appropriate for the ${niche} niche
- Still works as a t-shirt design (readable, printable, wearable)

You MUST respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "phraseVariation": "exact text to use (can be same or slightly modified)",
  "visualDirection": "overall aesthetic concept (e.g., '1970s retro disco aesthetic')",
  "fontStyle": "specific font description (e.g., 'chunky rounded bubble letters')",
  "layoutApproach": "how to arrange elements (e.g., 'arched text with starburst background')",
  "colorScheme": "specific colors (e.g., 'burnt orange and cream')",
  "graphicElements": "what icons/graphics to include (e.g., 'small stethoscope icon' or 'none - text only')",
  "overallVibe": "emotional feel (e.g., 'playful and nostalgic')",
  "specificDetails": "unique touches that make this distinct (e.g., 'add decorative flourishes at corners')"
}

Be creative and ensure this looks completely different from previous variations.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const text = response.text || '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[VariationStrategy] Could not parse JSON from response:', text);
      return generateFallbackStrategy(originalPhrase, variationNumber);
    }

    const strategy = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!strategy.phraseVariation || !strategy.visualDirection) {
      console.error('[VariationStrategy] Missing required fields:', strategy);
      return generateFallbackStrategy(originalPhrase, variationNumber);
    }

    return strategy as VariationStrategy;
  } catch (error) {
    console.error('[VariationStrategy] Error generating strategy:', error);
    return generateFallbackStrategy(originalPhrase, variationNumber);
  }
}

/**
 * Generate a fallback strategy when AI fails
 */
function generateFallbackStrategy(phrase: string, variationNumber: number): VariationStrategy {
  // Predefined style variations to ensure diversity
  const styleVariations = [
    {
      visualDirection: 'Modern minimalist',
      fontStyle: 'Clean sans-serif, thin weight',
      layoutApproach: 'Center-aligned, plenty of whitespace',
      colorScheme: 'Black text on light background',
      graphicElements: 'None - pure typography',
      overallVibe: 'Sophisticated and clean',
      specificDetails: 'Extra letter spacing for elegance',
    },
    {
      visualDirection: '1970s retro',
      fontStyle: 'Groovy bubble letters with rainbow outline',
      layoutApproach: 'Wavy text with starburst background',
      colorScheme: 'Orange, yellow, brown earth tones',
      graphicElements: 'Small decorative flowers',
      overallVibe: 'Nostalgic and fun',
      specificDetails: 'Halftone texture overlay',
    },
    {
      visualDirection: 'Vintage distressed',
      fontStyle: 'Weathered serif with cracks',
      layoutApproach: 'Centered badge/emblem style',
      colorScheme: 'Faded cream and rust',
      graphicElements: 'Banner ribbon underneath',
      overallVibe: 'Aged and authentic',
      specificDetails: 'Heavy distress texture',
    },
    {
      visualDirection: 'Bold streetwear',
      fontStyle: 'Heavy block letters, all caps',
      layoutApproach: 'Stacked text, tight leading',
      colorScheme: 'High contrast black and white',
      graphicElements: 'Lightning bolt accents',
      overallVibe: 'Urban and edgy',
      specificDetails: 'Dripping paint effect on letters',
    },
    {
      visualDirection: 'Cute kawaii',
      fontStyle: 'Rounded bubbly font',
      layoutApproach: 'Playful with bouncy baseline',
      colorScheme: 'Pastel pink and mint',
      graphicElements: 'Tiny hearts and stars',
      overallVibe: 'Sweet and adorable',
      specificDetails: 'Sparkle effects around text',
    },
    {
      visualDirection: 'Professional corporate',
      fontStyle: 'Classic serif, medium weight',
      layoutApproach: 'Traditional centered layout',
      colorScheme: 'Navy blue and gold',
      graphicElements: 'Simple line border',
      overallVibe: 'Polished and trustworthy',
      specificDetails: 'Subtle gradient on text',
    },
    {
      visualDirection: 'Hand-drawn sketch',
      fontStyle: 'Handwritten marker style',
      layoutApproach: 'Casual, slightly tilted',
      colorScheme: 'Black ink with red accent',
      graphicElements: 'Doodle arrows and underlines',
      overallVibe: 'Personal and authentic',
      specificDetails: 'Rough edges and imperfections',
    },
    {
      visualDirection: 'Neon cyberpunk',
      fontStyle: 'Geometric futuristic font',
      layoutApproach: 'Glowing text with scan lines',
      colorScheme: 'Hot pink and electric blue',
      graphicElements: 'Circuit pattern background',
      overallVibe: 'Futuristic and cool',
      specificDetails: 'Glow effect and chromatic aberration',
    },
    {
      visualDirection: 'Country western',
      fontStyle: 'Slab serif with wood texture',
      layoutApproach: 'Curved banner shape',
      colorScheme: 'Brown leather and tan',
      graphicElements: 'Stars and rope border',
      overallVibe: 'Rustic and authentic',
      specificDetails: 'Branded/burned look',
    },
    {
      visualDirection: 'Athletic sports',
      fontStyle: 'Italic bold with speed lines',
      layoutApproach: 'Dynamic diagonal arrangement',
      colorScheme: 'Red and white',
      graphicElements: 'Motion blur swoosh',
      overallVibe: 'Energetic and competitive',
      specificDetails: 'Jersey number styling',
    },
  ];

  const styleIndex = variationNumber % styleVariations.length;
  const selectedStyle = styleVariations[styleIndex];

  return {
    phraseVariation: phrase,
    ...selectedStyle,
  };
}

/**
 * Generate multiple strategies at once for efficiency
 */
export async function generateBatchStrategies(
  originalPhrase: string,
  niche: string,
  count: number
): Promise<VariationStrategy[]> {
  const strategies: VariationStrategy[] = [];

  for (let i = 0; i < count; i++) {
    const strategy = await generateVariationStrategy(
      originalPhrase,
      niche,
      i,
      strategies
    );
    strategies.push(strategy);

    // Small delay to avoid rate limiting
    if (i < count - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return strategies;
}
