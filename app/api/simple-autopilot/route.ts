/**
 * POST /api/simple-autopilot
 *
 * Simple Autopilot feature: Finds trending topics and generates complete merch designs.
 *
 * Flow:
 * 1. Call Perplexity API to find currently trending topic (with diversity)
 * 2. LLM extracts slot values for the design template
 * 3. Generate image with selected model
 * 4. Generate listing text
 * 5. Save to My Library
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { getTierConfig, parseRetentionDays } from '@/lib/pricing';
import type { TierName } from '@/lib/pricing';
import { uploadImage, uploadResearchData } from '@/lib/r2-storage';
import { selectAllStyles, buildImagePrompt } from '@/lib/simple-style-selector';

export const maxDuration = 300;

// Perplexity API configuration
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

// Gemini API configuration
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Supported image models
type ImageModel = 'ideogram' | 'imagen' | 'gpt-image-1' | 'gpt-image-1.5';

interface SimpleAutopilotRequest {
  category?: string;
  imageModel: ImageModel;
  // Optional user inputs - when provided, these guide/override the auto behavior
  phrase?: string;           // Exact phrase (skips discovery if set)
  mood?: string;             // Tone hint for research
  audience?: string;         // Target demographic
  typography?: string;       // Override random selection
  effect?: string;           // Override random selection
  aesthetic?: string;        // Override random selection
  additionalNotes?: string;  // Free-form guidance for image description
}

interface SlotValues {
  // Code-selected styles (from simple-style-selector.ts)
  typography: string;
  effect: string;
  aesthetic: string;
  // LLM-derived values
  textTop: string;
  textBottom: string;
  imageDescription: string;
  // Trend research data
  trendTopic: string;
  trendSummary: string;
  trendSource: string;
}

interface GenerationResult {
  trendData: {
    topic: string;
    summary: string;
    source: string;
  };
  slotValues: SlotValues;
  prompt: string;
  imageUrl: string;
  listing: {
    brand: string;
    title: string;
    bullet1: string;
    bullet2: string;
    description: string;
  };
  savedDesignId: string;
}

/**
 * Build diverse query variations for Perplexity
 */
function buildDiverseQuery(category?: string): { query: string; angle: string; timeframe: string } {
  // Time window variations
  const timeframes = [
    'trending right now',
    'emerging this week',
    'going viral today',
    'breaking out this month',
    'gaining momentum recently',
    'surging in popularity',
  ];

  // Angle variations
  const angles = [
    'viral on social media',
    'growing interest',
    'breakout trend',
    'culturally relevant',
    'conversation starter',
    'highly shareable',
  ];

  // Randomly select variations
  const timeframe = timeframes[Math.floor(Math.random() * timeframes.length)];
  const angle = angles[Math.floor(Math.random() * angles.length)];

  // Query templates with diversity
  const templates = category ? [
    `What is ${timeframe} in ${category}? Find something ${angle} that would work well on a t-shirt design. Focus on topics with memorable phrases, memes, or slogans.`,
    `Discover a ${angle} topic in ${category} that's ${timeframe}. What phrases or concepts would resonate on merchandise?`,
    `Find a ${category}-related concept that's ${timeframe} and ${angle}. What would make a compelling t-shirt message?`,
  ] : [
    `What topic is ${timeframe} across social media and culture? Find something ${angle} that would make a great t-shirt design with a catchy phrase.`,
    `Discover a ${angle} trend that's ${timeframe}. What meme, phrase, or concept would resonate on merchandise?`,
    `Find a cultural moment or concept that's ${timeframe} and ${angle}. What would make a compelling t-shirt message?`,
  ];

  const query = templates[Math.floor(Math.random() * templates.length)];

  return { query, angle, timeframe };
}

/**
 * Research data returned from Perplexity trend search
 */
interface TrendResearch {
  topic: string;
  phrase: string;      // The t-shirt phrase (2-5 words)
  audience: string;    // Who would buy this shirt
  mood: string;        // Emotional tone (funny, inspirational, sarcastic, etc.)
  summary: string;
  source: string;
}

/**
 * Call Perplexity API to find trending topic
 */
async function findTrendingTopic(category?: string): Promise<TrendResearch> {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }

  const { query, angle, timeframe } = buildDiverseQuery(category);

  console.log('[SimpleAutopilot] Perplexity query:', query);
  console.log('[SimpleAutopilot] Diversity params:', { angle, timeframe });

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `You are a trend research expert helping identify topics that would work well on t-shirt designs.
Focus on finding currently trending topics with:
- Catchy, memorable phrases (2-5 words ideal for t-shirts)
- Cultural relevance and shareability
- Meme potential or viral appeal
- Clear emotional resonance

Return your findings in this exact JSON format:
{
  "topic": "The specific trend or concept name",
  "summary": "A brief 1-2 sentence description of why this is trending and what it means",
  "phrase": "The exact 2-5 word phrase that would work on a t-shirt",
  "audience": "Who would buy this shirt",
  "mood": "The emotional tone (funny, inspirational, sarcastic, etc.)"
}`
        },
        {
          role: 'user',
          content: query
        }
      ],
      temperature: 0.8, // Higher temperature for more variety
      max_tokens: 500,
      return_citations: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[SimpleAutopilot] Perplexity API error:', errorText);
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  console.log('[SimpleAutopilot] Perplexity response:', content);

  // Parse the JSON response
  let trendData: any;
  try {
    // Extract JSON from the response (it might be wrapped in markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      trendData = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (parseError) {
    console.warn('[SimpleAutopilot] Failed to parse Perplexity JSON, using raw content');
    trendData = {
      topic: content.slice(0, 50),
      summary: content,
      phrase: content.slice(0, 30),
      audience: 'trend followers',
      mood: 'funny',
    };
  }

  // Log all research data for debugging
  console.log('[SimpleAutopilot] Parsed research data:', {
    topic: trendData.topic,
    phrase: trendData.phrase,
    audience: trendData.audience,
    mood: trendData.mood,
  });

  return {
    topic: trendData.topic || 'Trending Topic',
    phrase: trendData.phrase || trendData.topic || 'Trending',
    audience: trendData.audience || 'trend followers',
    mood: trendData.mood || 'funny',
    summary: trendData.summary || content,
    source: data.citations?.[0] || 'perplexity',
  };
}

/**
 * Two-Stage Discovery: Stage 1 - Discover an interesting niche
 * Asks Perplexity to find an interesting community/hobby/interest area
 */
async function discoverNiche(): Promise<{ niche: string; audience: string; description: string }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }

  // Randomize the prompt to encourage variety
  const explorationAngles = [
    'a hobby community with passionate followers',
    'a professional field with its own culture and inside jokes',
    'a lifestyle or activity that brings people together',
    'a fandom or enthusiast group',
    'a sport, game, or competitive activity',
    'a craft, art form, or creative pursuit',
    'an outdoor activity or nature-related interest',
    'a collector community or niche interest group',
  ];

  const avoidExamples = [
    'Avoid mainstream tech topics like AI, cryptocurrency, or programming.',
    'Look beyond what dominates Twitter and TikTok front pages.',
    'Skip politics, mainstream celebrities, and viral memes.',
    'Find something from the long tail of human interests.',
  ];

  const angle = explorationAngles[Math.floor(Math.random() * explorationAngles.length)];
  const avoid = avoidExamples[Math.floor(Math.random() * avoidExamples.length)];

  console.log('[SimpleAutopilot] Stage 1: Discovering niche...');
  console.log('[SimpleAutopilot] Exploration angle:', angle);

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `You are an explorer of human interests and communities. Your job is to discover interesting niches that most people don't know exist.

Find ${angle}. ${avoid}

Think about:
- What do these people call themselves?
- What shared language or inside jokes do they have?
- What would they proudly wear on a t-shirt?

Return your discovery in this exact JSON format:
{
  "niche": "The specific community or interest area (e.g., 'competitive yo-yoing', 'urban sketching', 'vintage synthesizer collectors')",
  "audience": "Who these people are in 2-5 words (e.g., 'skill toy enthusiasts', 'traveling artists', 'analog music nerds')",
  "description": "One sentence about what makes this community interesting"
}`
        },
        {
          role: 'user',
          content: 'Discover an interesting niche community for me. Surprise me with something I might not have thought of.'
        }
      ],
      temperature: 0.9, // High temperature for maximum variety
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[SimpleAutopilot] Stage 1 Perplexity error:', errorText);
    throw new Error(`Perplexity API error in niche discovery: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  console.log('[SimpleAutopilot] Stage 1 response:', content);

  // Parse the JSON response
  let nicheData: any;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      nicheData = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (parseError) {
    console.warn('[SimpleAutopilot] Stage 1 parse failed, using fallback');
    // Fallback to a reasonable default
    nicheData = {
      niche: 'outdoor enthusiasts',
      audience: 'nature lovers',
      description: 'People who love spending time outdoors',
    };
  }

  console.log('[SimpleAutopilot] Discovered niche:', nicheData.niche);

  return {
    niche: nicheData.niche || 'hobbyists',
    audience: nicheData.audience || 'enthusiasts',
    description: nicheData.description || '',
  };
}

/**
 * Two-Stage Discovery: Stage 2 - Find trending topic within a niche
 * Asks Perplexity what's currently trending in the discovered niche
 * @param niche - The niche/category to search in
 * @param audience - The target audience
 * @param userHints - Optional hints from user input (mood, audience override)
 */
async function findTrendingInNiche(
  niche: string,
  audience: string,
  userHints?: { mood?: string; audience?: string }
): Promise<TrendResearch> {
  const apiKey = process.env.PERPLEXITY_API_KEY;

  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }

  console.log('[SimpleAutopilot] Stage 2: Finding trend in niche:', niche);
  if (userHints) {
    console.log('[SimpleAutopilot] User hints:', userHints);
  }

  // Use user-provided audience if available, otherwise use discovered audience
  const effectiveAudience = userHints?.audience || audience;

  // Get current date for recency context
  const today = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();

  // Build mood constraint if user specified one
  const moodConstraint = userHints?.mood
    ? `\n\nIMPORTANT: The user specifically wants a "${userHints.mood}" tone. Focus on finding trends that match this mood.`
    : '';

  const response = await fetch(PERPLEXITY_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `You are a trend researcher specializing in the ${niche} community.

Today's date is ${today}. Focus on what's trending RIGHT NOW in ${currentYear} - not historical events or old news.

Your audience is ${effectiveAudience}. You understand their culture, language, and what they find meaningful or funny.${moodConstraint}

Find something currently relevant, trending, or beloved in this community that would work well on a t-shirt. This could be:
- A current event or news in the community
- A beloved phrase, saying, or inside joke
- A meme or reference that insiders would recognize
- A point of pride or identity for community members

Return your finding in this exact JSON format:
{
  "topic": "The specific trend, phrase, or concept",
  "summary": "1-2 sentences about why this resonates with ${effectiveAudience}",
  "phrase": "The exact 2-5 word phrase that would work on a t-shirt",
  "audience": "${effectiveAudience}",
  "mood": "The emotional tone (funny, proud, sarcastic, wholesome, rebellious, etc.)"
}`
        },
        {
          role: 'user',
          content: `What's something currently relevant or trending in the ${niche} community that ${effectiveAudience} would want on a t-shirt? Find a phrase or concept that shows insider knowledge.`
        }
      ],
      temperature: 0.8,
      max_tokens: 500,
      return_citations: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[SimpleAutopilot] Stage 2 Perplexity error:', errorText);
    throw new Error(`Perplexity API error in trend discovery: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  console.log('[SimpleAutopilot] Stage 2 response:', content);

  // Parse the JSON response
  let trendData: any;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      trendData = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found in response');
    }
  } catch (parseError) {
    console.warn('[SimpleAutopilot] Stage 2 parse failed, using raw content');
    trendData = {
      topic: `${niche} trend`,
      summary: content,
      phrase: niche.slice(0, 30),
      audience: audience,
      mood: 'proud',
    };
  }

  console.log('[SimpleAutopilot] Found trend:', trendData.topic);

  return {
    topic: trendData.topic || `${niche} trend`,
    phrase: trendData.phrase || trendData.topic || niche,
    audience: trendData.audience || audience,
    mood: trendData.mood || 'proud',
    summary: trendData.summary || content,
    source: data.citations?.[0] || 'perplexity',
  };
}

/**
 * Two-Stage Discovery: Main function
 * Combines niche discovery + trend finding for broader exploration
 * @param category - Optional category/niche to focus on
 * @param userHints - Optional hints from user input (mood, audience)
 */
async function findTrendingTopicTwoStage(
  category?: string,
  userHints?: { mood?: string; audience?: string }
): Promise<TrendResearch> {
  // If category is provided, skip stage 1 and use it directly
  if (category && category.trim()) {
    console.log('[SimpleAutopilot] Category provided, skipping stage 1:', category);
    return findTrendingInNiche(category.trim(), `${category} enthusiasts`, userHints);
  }

  // Stage 1: Discover a niche
  const { niche, audience } = await discoverNiche();

  // Stage 2: Find trend within that niche (passing user hints)
  return findTrendingInNiche(niche, audience, userHints);
}

/**
 * Use Gemini to derive complementary values for the design template
 * - textTop comes from Perplexity research (phrase field) OR user-provided phrase
 * - Gemini derives imageDescription to complement the phrase
 * - Typography, Effect, and Aesthetic are selected by code (70% Evergreen / 30% Emerging) OR user overrides
 * - textBottom removed: single phrase designs, model decides layout
 * @param trendData - Research data from Perplexity
 * @param styles - Selected or user-provided styles
 * @param userPhrase - Optional user-provided phrase (overrides research)
 * @param additionalNotes - Optional user notes to guide image description
 */
async function extractSlotValues(
  trendData: TrendResearch,
  styles: { typography: string; effect: string; aesthetic: string },
  userPhrase?: string,
  additionalNotes?: string
): Promise<SlotValues> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or NEXT_PUBLIC_API_KEY not configured');
  }

  // Determine the phrase to use (user-provided or from research)
  const effectivePhrase = userPhrase || trendData.phrase;

  // Build additional notes section if provided
  const notesSection = additionalNotes
    ? `\n\nUSER NOTES (incorporate these into the visual):\n${additionalNotes}`
    : '';

  // textTop comes from user or research - Gemini only derives imageDescription
  const prompt = `You are a t-shirt designer. Create a visual element to accompany this phrase.

PHRASE: "${effectivePhrase}"
TARGET AUDIENCE: ${trendData.audience}
MOOD/TONE: ${trendData.mood}
TREND CONTEXT: ${trendData.summary}

STYLE:
- Typography: ${styles.typography}
- Effect: ${styles.effect}
- Aesthetic: ${styles.aesthetic}${notesSection}

Create an imageDescription (5-15 words) for a visual that:
- Is specific to this trend and audience (not generic)
- Uses vivid descriptors (e.g., "a steaming coffee cup with cartoon eyes" not just "coffee cup")
- Fits the ${trendData.mood} mood
- Complements the phrase without competing with it
${additionalNotes ? '- Incorporates the user\'s specific notes above' : ''}

Respond ONLY with valid JSON:
{
  "imageDescription": "specific visual description with vivid descriptors"
}`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            imageDescription: {
              type: 'string',
              description: '5-15 words describing a specific visual element with vivid descriptors',
            },
          },
          required: ['imageDescription'],
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[SimpleAutopilot] Gemini API error:', errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();

  // Debug: log full response structure to understand what Gemini is returning
  console.log('[SimpleAutopilot] Gemini slot response structure:', JSON.stringify(data, null, 2));

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  console.log('[SimpleAutopilot] Gemini slot values raw:', content);

  let llmValues: any;
  try {
    // First try direct parse
    llmValues = JSON.parse(content);
    console.log('[SimpleAutopilot] Gemini parsed successfully:', llmValues);
  } catch (parseError) {
    // Try to extract JSON from markdown code blocks or mixed content
    console.log('[SimpleAutopilot] Direct parse failed, trying JSON extraction...');
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        llmValues = JSON.parse(jsonMatch[0]);
        console.log('[SimpleAutopilot] Gemini extracted and parsed:', llmValues);
      } catch (extractError) {
        console.warn('[SimpleAutopilot] JSON extraction also failed');
        llmValues = null;
      }
    } else {
      console.warn('[SimpleAutopilot] No JSON found in Gemini response');
      llmValues = null;
    }

    // Final fallback if all parsing failed
    if (!llmValues) {
      console.warn('[SimpleAutopilot] Using research-based fallback');
      llmValues = {
        imageDescription: `a ${trendData.mood} illustration related to ${trendData.topic}`,
      };
    }
  }

  // textTop comes from user phrase or research (phrase), not from Gemini
  // Enforce 6-word maximum per autopilot requirement
  let textTop = effectivePhrase;
  const wordCount = textTop.split(/\s+/).length;
  if (wordCount > 6) {
    console.warn(`[SimpleAutopilot] Phrase exceeds 6 words (${wordCount}): "${textTop}"`);
    // Truncate to first 6 words
    textTop = textTop.split(/\s+/).slice(0, 6).join(' ');
    console.log(`[SimpleAutopilot] Truncated to: "${textTop}"`);
  }

  return {
    // Code-selected styles
    typography: styles.typography,
    effect: styles.effect,
    aesthetic: styles.aesthetic,
    // Research-derived textTop (from Perplexity phrase)
    textTop,
    // textBottom removed - single phrase designs, model decides layout
    textBottom: '',
    imageDescription: llmValues.imageDescription || `a ${trendData.mood} graphic element`,
    // Trend research data
    trendTopic: trendData.topic,
    trendSummary: trendData.summary,
    trendSource: trendData.source,
  };
}

/**
 * Build the complete prompt from slot values using the new template
 * Template: [TYPOGRAPHY] t-shirt design (no mockup) [EFFECT] style typography with the words '[TEXT_TOP]' at the top
 * and '[TEXT_BOTTOM]' at the bottom. Make it in a [AESTHETIC] style using big typography and [EFFECT] effects.
 * Add [IMAGE_DESCRIPTION] in the middle of the design. 4500x5400px use all the canvas. Make it for a black shirt.
 */
function buildPrompt(slots: SlotValues): string {
  return buildImagePrompt({
    typography: slots.typography,
    effect: slots.effect,
    aesthetic: slots.aesthetic,
    textTop: slots.textTop,
    textBottom: slots.textBottom,
    imageDescription: slots.imageDescription,
  });
}

/**
 * Generate image with selected model
 */
async function generateImage(prompt: string, model: ImageModel): Promise<string> {
  console.log(`[SimpleAutopilot] Generating image with ${model}...`);

  switch (model) {
    case 'ideogram':
      return generateWithIdeogram(prompt);
    case 'imagen':
      return generateWithImagen(prompt);
    case 'gpt-image-1':
      return generateWithGptImage1(prompt);
    case 'gpt-image-1.5':
      return generateWithGptImage15(prompt);
    default:
      throw new Error(`Unknown image model: ${model}`);
  }
}

async function generateWithIdeogram(prompt: string): Promise<string> {
  const apiKey = process.env.IDEOGRAM_API_KEY;

  if (!apiKey) {
    throw new Error('IDEOGRAM_API_KEY not configured');
  }

  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('aspect_ratio', '2x3');
  formData.append('model', 'V_3');
  formData.append('style_type', 'DESIGN');
  formData.append('magic_prompt', 'OFF');
  formData.append('negative_prompt', 'amateur graphics, clipart, basic flat design, poorly rendered text, blurry, pixelated');

  const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ideogram API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.data?.[0]?.url) {
    return data.data[0].url;
  }

  throw new Error('No image URL in Ideogram response');
}

async function generateWithImagen(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or NEXT_PUBLIC_API_KEY not configured');
  }

  // Append negative prompt guidance (Imagen 4 doesn't have native negative prompt parameter)
  // Per docs: "Not native; append 'avoid blurry, deformed, low-res' to prompt"
  const enhancedPrompt = `${prompt}. Avoid blurry, deformed, low-res, diagram, flowchart, technical illustration, clipart, amateur graphics.`;

  // Imagen uses :predict endpoint (NOT :generateContent) with instances/parameters format
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [{ prompt: enhancedPrompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: '3:4',
        personGeneration: 'DONT_ALLOW',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Imagen API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Response structure for :predict endpoint
  if (data.predictions?.[0]?.bytesBase64Encoded) {
    return `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
  }

  throw new Error('No image data in Imagen response');
}

async function generateWithGptImage1(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1536',
      quality: 'high',
      background: 'transparent',
      output_format: 'png',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GPT-Image-1 API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.data?.[0]?.b64_json) {
    return `data:image/png;base64,${data.data[0].b64_json}`;
  } else if (data.data?.[0]?.url) {
    return data.data[0].url;
  }

  throw new Error('No image data in GPT-Image-1 response');
}

async function generateWithGptImage15(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1.5',
      prompt,
      n: 1,
      size: '1024x1536',
      quality: 'high',
      background: 'transparent',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GPT-Image-1.5 API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.data?.[0]?.b64_json) {
    return `data:image/png;base64,${data.data[0].b64_json}`;
  } else if (data.data?.[0]?.url) {
    return data.data[0].url;
  }

  throw new Error('No image data in GPT-Image-1.5 response');
}

/**
 * Generate listing text using Gemini
 */
async function generateListing(slots: SlotValues): Promise<{ brand: string; title: string; bullet1: string; bullet2: string; description: string }> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or NEXT_PUBLIC_API_KEY not configured');
  }

  const prompt = `Generate Amazon merch listing text for a t-shirt with this design:
- Top text: "${slots.textTop}"
- Bottom text: "${slots.textBottom}"
- Typography: ${slots.typography}
- Visual effect: ${slots.effect}
- Aesthetic: ${slots.aesthetic}
- Trend: ${slots.trendTopic}
- Summary: ${slots.trendSummary}

Respond ONLY with valid JSON, no other text:
{
  "brand": "A catchy brand name (2-3 words)",
  "title": "Amazon-optimized title with keywords (60-80 chars)",
  "bullet1": "First bullet point - who this is perfect for",
  "bullet2": "Second bullet point - quality/gift angle",
  "description": "Engaging product description (100-150 words)"
}`;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            brand: {
              type: 'string',
              description: 'A catchy brand name (2-3 words)',
            },
            title: {
              type: 'string',
              description: 'Amazon-optimized title with keywords (60-80 chars)',
            },
            bullet1: {
              type: 'string',
              description: 'First bullet point - who this is perfect for',
            },
            bullet2: {
              type: 'string',
              description: 'Second bullet point - quality/gift angle',
            },
            description: {
              type: 'string',
              description: 'Engaging product description (100-150 words)',
            },
          },
          required: ['brand', 'title', 'bullet1', 'bullet2', 'description'],
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[SimpleAutopilot] Gemini listing error:', errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();

  // Debug: log full response structure
  console.log('[SimpleAutopilot] Gemini listing response structure:', JSON.stringify(data, null, 2));

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  console.log('[SimpleAutopilot] Generated listing raw:', content);

  let listing: any;
  try {
    // First try direct parse
    listing = JSON.parse(content);
    console.log('[SimpleAutopilot] Listing parsed successfully');
  } catch (parseError) {
    // Try to extract JSON from markdown code blocks or mixed content
    console.log('[SimpleAutopilot] Direct listing parse failed, trying JSON extraction...');
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        listing = JSON.parse(jsonMatch[0]);
        console.log('[SimpleAutopilot] Listing extracted and parsed');
      } catch (extractError) {
        console.warn('[SimpleAutopilot] Listing JSON extraction also failed');
        listing = null;
      }
    } else {
      console.warn('[SimpleAutopilot] No JSON found in listing response');
      listing = null;
    }

    // Final fallback if all parsing failed
    if (!listing) {
      console.warn('[SimpleAutopilot] Using listing defaults');
      listing = {
        brand: 'TrendWear Co',
        title: `${slots.textTop} ${slots.textBottom} Funny Trending T-Shirt Gift`,
        bullet1: 'Perfect gift for anyone who gets the trend',
        bullet2: 'Premium quality fabric for maximum comfort',
        description: `Show off your style with this trending ${slots.textTop} ${slots.textBottom} t-shirt. Great for casual wear or making a statement.`,
      };
    }
  }

  return {
    brand: listing.brand || 'TrendWear Co',
    title: listing.title || `${slots.textTop} ${slots.textBottom} T-Shirt`,
    bullet1: listing.bullet1 || 'Perfect gift for trend followers',
    bullet2: listing.bullet2 || 'Premium quality fabric',
    description: listing.description || `Trending ${slots.textTop} ${slots.textBottom} design.`,
  };
}

/**
 * Save design to database (My Library)
 */
async function saveToLibrary(
  userId: string,
  slots: SlotValues,
  prompt: string,
  imageUrl: string,
  listing: { brand: string; title: string; bullet1: string; bullet2: string; description: string },
  imageModel: ImageModel
): Promise<string> {
  // Find user
  let user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });
  }

  if (!user) {
    throw new Error('User not found');
  }

  const designId = crypto.randomUUID();

  // Upload image to R2 if base64
  let r2ImageUrl = imageUrl;
  try {
    if (imageUrl && imageUrl.startsWith('data:')) {
      console.log('[SimpleAutopilot] Uploading image to R2...');
      r2ImageUrl = await uploadImage(user.id, designId, imageUrl);
    }
  } catch (r2Error) {
    console.error('[SimpleAutopilot] R2 upload failed, using original URL:', r2Error);
  }

  // Calculate retention
  const tier = getTierConfig(user.subscriptionTier as TierName);
  const retentionDays = parseRetentionDays(tier.limits.historyRetention);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (retentionDays * 24 * 60 * 60 * 1000));

  // Create design record with full research data stored in runConfig
  const design = await prisma.designHistory.create({
    data: {
      id: designId,
      userId: user.id,
      runId: crypto.randomUUID(),
      runConfig: {
        tierAtCreation: user.subscriptionTier,
        mode: 'simple-autopilot',
        imageModel,
        slots: { ...slots },
        savedAt: now.toISOString(),
        // Research data
        research: {
          trendTopic: slots.trendTopic,
          trendSummary: slots.trendSummary,
          trendSource: slots.trendSource,
        },
        // Style selection data
        selectedStyles: {
          typography: slots.typography,
          effect: slots.effect,
          aesthetic: slots.aesthetic,
        },
        // LLM-derived content
        llmDerived: {
          textTop: slots.textTop,
          textBottom: slots.textBottom,
          imageDescription: slots.imageDescription,
        },
        finalPrompt: prompt,
      },
      niche: slots.trendTopic,
      slogan: `${slots.textTop} ${slots.textBottom}`,
      designCount: 1,
      targetMarket: 'Trending',
      listingData: {
        brand: listing.brand,
        title: listing.title,
        bullet1: listing.bullet1,
        bullet2: listing.bullet2,
        description: listing.description,
        keywords: [slots.trendTopic, slots.typography, slots.aesthetic, slots.effect],
        imagePrompt: prompt,
        designText: `${slots.textTop} ${slots.textBottom}`,
      },
      artPrompt: {
        prompt,
        typography: slots.typography,
        effect: slots.effect,
        aesthetic: slots.aesthetic,
      },
      imageUrl: r2ImageUrl,
      imageHistory: [],
      imageQuality: 'standard',
      canDownload: true,
      promptMode: 'simple',
      expiresAt,
    },
  });

  return design.id;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: SimpleAutopilotRequest = await request.json();
    const {
      category,
      imageModel,
      phrase,
      mood,
      audience,
      typography,
      effect,
      aesthetic,
      additionalNotes,
    } = body;

    // Validate image model
    const validModels: ImageModel[] = ['ideogram', 'imagen', 'gpt-image-1', 'gpt-image-1.5'];
    if (!validModels.includes(imageModel)) {
      return NextResponse.json(
        { success: false, error: `Invalid image model. Must be one of: ${validModels.join(', ')}` },
        { status: 400 }
      );
    }

    console.log('[SimpleAutopilot] Starting generation...');
    console.log('[SimpleAutopilot] Category:', category || '(any)');
    console.log('[SimpleAutopilot] Image model:', imageModel);
    console.log('[SimpleAutopilot] User inputs:', {
      phrase: phrase || '(auto)',
      mood: mood || '(auto)',
      audience: audience || '(auto)',
      typography: typography || '(auto)',
      effect: effect || '(auto)',
      aesthetic: aesthetic || '(auto)',
      additionalNotes: additionalNotes ? '(provided)' : '(none)',
    });

    // Step 1: Find trending topic via Perplexity (unless user provided phrase)
    // Toggle between classic (single query) and twostage (niche discovery + trend) modes
    const researchMode = process.env.SIMPLE_AUTOPILOT_RESEARCH_MODE || 'twostage';
    console.log('[SimpleAutopilot] Step 1: Finding trending topic...');
    console.log('[SimpleAutopilot] Research mode:', researchMode);

    // Build user hints for research
    const userHints = (mood || audience) ? { mood, audience } : undefined;

    const trendData = researchMode === 'twostage'
      ? await findTrendingTopicTwoStage(category, userHints)
      : await findTrendingTopic(category);
    console.log('[SimpleAutopilot] Found trend:', trendData.topic);

    // Step 2: Select styles via weighted random (70% Evergreen / 30% Emerging)
    // OR use user-provided overrides
    console.log('[SimpleAutopilot] Step 2: Selecting styles...');
    const autoStyles = selectAllStyles();
    const selectedStyles = {
      typography: typography || autoStyles.typography,
      effect: effect || autoStyles.effect,
      aesthetic: aesthetic || autoStyles.aesthetic,
    };
    console.log('[SimpleAutopilot] Selected styles:', selectedStyles);
    console.log('[SimpleAutopilot] Style sources:', {
      typography: typography ? 'user' : 'auto',
      effect: effect ? 'user' : 'auto',
      aesthetic: aesthetic ? 'user' : 'auto',
    });

    // Step 3: Extract LLM-derived values via Gemini (IMAGE_DESCRIPTION)
    // Pass user phrase and additional notes if provided
    console.log('[SimpleAutopilot] Step 3: Extracting LLM-derived values...');
    const slotValues = await extractSlotValues(trendData, selectedStyles, phrase, additionalNotes);
    console.log('[SimpleAutopilot] Slot values:', slotValues);

    // Step 4: Build prompt
    const prompt = buildPrompt(slotValues);
    console.log('[SimpleAutopilot] Step 4: Built prompt:', prompt);

    // Step 5: Generate image
    console.log('[SimpleAutopilot] Step 5: Generating image...');
    const imageUrl = await generateImage(prompt, imageModel);
    console.log('[SimpleAutopilot] Image generated');

    // Step 6: Generate listing
    console.log('[SimpleAutopilot] Step 6: Generating listing...');
    const listing = await generateListing(slotValues);
    console.log('[SimpleAutopilot] Listing generated');

    // Step 7: Save to library
    console.log('[SimpleAutopilot] Step 7: Saving to library...');
    const savedDesignId = await saveToLibrary(userId, slotValues, prompt, imageUrl, listing, imageModel);
    console.log('[SimpleAutopilot] Saved with ID:', savedDesignId);

    const result: GenerationResult = {
      trendData: {
        topic: trendData.topic,
        summary: trendData.summary,
        source: trendData.source,
      },
      slotValues,
      prompt,
      imageUrl,
      listing,
      savedDesignId,
    };

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error: any) {
    console.error('[SimpleAutopilot] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
