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
type ImageModel = 'ideogram' | 'imagen' | 'gpt-image-1' | 'dalle3';

interface SimpleAutopilotRequest {
  category?: string;
  imageModel: ImageModel;
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
 * Call Perplexity API to find trending topic
 */
async function findTrendingTopic(category?: string): Promise<{ topic: string; summary: string; source: string }> {
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
    };
  }

  return {
    topic: trendData.topic || trendData.phrase || 'Trending Topic',
    summary: trendData.summary || content,
    source: data.citations?.[0] || 'perplexity',
  };
}

/**
 * Use Gemini to extract LLM-derived values for the design template
 * Note: Typography, Effect, and Aesthetic are selected by code (70% Evergreen / 30% Emerging)
 */
async function extractSlotValues(
  trendData: { topic: string; summary: string; source: string },
  styles: { typography: string; effect: string; aesthetic: string }
): Promise<SlotValues> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or NEXT_PUBLIC_API_KEY not configured');
  }

  // LLM only derives TEXT_TOP, TEXT_BOTTOM, and IMAGE_DESCRIPTION
  const prompt = `You are designing a t-shirt based on this trending topic.

TREND TOPIC: ${trendData.topic}
TREND SUMMARY: ${trendData.summary}

PRE-SELECTED STYLE (do not change these):
- Typography: ${styles.typography}
- Effect: ${styles.effect}
- Aesthetic: ${styles.aesthetic}

Your job is to derive ONLY three values that fit the trend contextually:

1. TEXT_TOP: 2-4 words for the top of the shirt - the hook/attention grabber that relates to the trend
2. TEXT_BOTTOM: 2-4 words for the bottom - the punchline/context that completes the message (NEVER use generic phrases like "Trending Now", "Hot Topic", etc.)
3. IMAGE_DESCRIPTION: Brief description (5-15 words) of a visual element to place in the middle of the design. Use plain human language with uplift descriptors (e.g., "a majestic eagle soaring" not just "eagle")

Respond ONLY with valid JSON, no other text:
{
  "textTop": "2-4 words, catchy and relevant to the trend",
  "textBottom": "2-4 words, completes the message meaningfully",
  "imageDescription": "Brief visual description with uplift descriptors"
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
        maxOutputTokens: 300,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[SimpleAutopilot] Gemini API error:', errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  console.log('[SimpleAutopilot] Gemini slot values:', content);

  let llmValues: any;
  try {
    llmValues = JSON.parse(content);
  } catch (parseError) {
    // Fallback if parsing fails
    console.warn('[SimpleAutopilot] Failed to parse Gemini JSON, using defaults');
    llmValues = {
      textTop: trendData.topic.split(' ').slice(0, 3).join(' '),
      textBottom: 'Life Style',
      imageDescription: 'a bold graphic element representing the trend',
    };
  }

  return {
    // Code-selected styles
    typography: styles.typography,
    effect: styles.effect,
    aesthetic: styles.aesthetic,
    // LLM-derived values
    textTop: llmValues.textTop || trendData.topic.split(' ').slice(0, 3).join(' '),
    textBottom: llmValues.textBottom || 'Life Style',
    imageDescription: llmValues.imageDescription || 'a bold graphic element',
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
    case 'dalle3':
      return generateWithDalle3(prompt);
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

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [{ prompt }],
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

async function generateWithDalle3(prompt: string): Promise<string> {
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
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1792',
      quality: 'hd',
      style: 'vivid',
      response_format: 'url',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DALL-E 3 API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (data.data?.[0]?.url) {
    return data.data[0].url;
  }

  throw new Error('No image URL in DALL-E 3 response');
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
        maxOutputTokens: 800,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[SimpleAutopilot] Gemini listing error:', errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  console.log('[SimpleAutopilot] Generated listing:', content);

  let listing: any;
  try {
    listing = JSON.parse(content);
  } catch (parseError) {
    console.warn('[SimpleAutopilot] Failed to parse listing JSON, using defaults');
    listing = {
      brand: 'TrendWear Co',
      title: `${slots.textTop} ${slots.textBottom} Funny Trending T-Shirt Gift`,
      bullet1: 'Perfect gift for anyone who gets the trend',
      bullet2: 'Premium quality fabric for maximum comfort',
      description: `Show off your style with this trending ${slots.textTop} ${slots.textBottom} t-shirt. Great for casual wear or making a statement.`,
    };
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
    const { category, imageModel } = body;

    // Validate image model
    const validModels: ImageModel[] = ['ideogram', 'imagen', 'gpt-image-1', 'dalle3'];
    if (!validModels.includes(imageModel)) {
      return NextResponse.json(
        { success: false, error: `Invalid image model. Must be one of: ${validModels.join(', ')}` },
        { status: 400 }
      );
    }

    console.log('[SimpleAutopilot] Starting generation...');
    console.log('[SimpleAutopilot] Category:', category || '(any)');
    console.log('[SimpleAutopilot] Image model:', imageModel);

    // Step 1: Find trending topic via Perplexity
    console.log('[SimpleAutopilot] Step 1: Finding trending topic...');
    const trendData = await findTrendingTopic(category);
    console.log('[SimpleAutopilot] Found trend:', trendData.topic);

    // Step 2: Select styles via weighted random (70% Evergreen / 30% Emerging)
    console.log('[SimpleAutopilot] Step 2: Selecting styles (code-based)...');
    const selectedStyles = selectAllStyles();
    console.log('[SimpleAutopilot] Selected styles:', selectedStyles);

    // Step 3: Extract LLM-derived values via Gemini (TEXT_TOP, TEXT_BOTTOM, IMAGE_DESCRIPTION)
    console.log('[SimpleAutopilot] Step 3: Extracting LLM-derived values...');
    const slotValues = await extractSlotValues(trendData, selectedStyles);
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
