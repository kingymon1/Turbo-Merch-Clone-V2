import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Image model types
type TrendScannerImageModel = 'imagen' | 'ideogram' | 'gpt-image-1.5';

interface GenerateImageRequest {
  prompt: string;
  imageModel: TrendScannerImageModel;
}

/**
 * Generate image using Imagen 4 (Google)
 */
async function generateWithImagen(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:generateImages?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: '9:16',
          personGeneration: 'DONT_ALLOW',
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Imagen 4 API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const generatedImage = data.generatedImages?.[0];

  if (!generatedImage?.image?.imageBytes) {
    throw new Error('No image data in Imagen 4 response');
  }

  const mimeType = generatedImage.image.mimeType || 'image/png';
  const base64Data = generatedImage.image.imageBytes;

  return `data:${mimeType};base64,${base64Data}`;
}

/**
 * Generate image using Ideogram 3.0
 */
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
  formData.append('negative_prompt', 'amateur graphics, clipart, basic flat design, generic stock imagery, poorly rendered text, childish, low-effort, blurry, pixelated');

  const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`Ideogram API error: ${response.status} - ${errorData}`);
  }

  const data = await response.json();

  if (data.data?.[0]?.url) {
    return data.data[0].url;
  }

  throw new Error('No image URL in Ideogram response');
}

/**
 * Generate image using GPT-Image-1.5
 */
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
 * POST /api/trend-scanner/generate-image
 * Server-side image generation for TrendScanner
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: GenerateImageRequest = await request.json();
    const { prompt, imageModel } = body;

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const validModels: TrendScannerImageModel[] = ['imagen', 'ideogram', 'gpt-image-1.5'];
    if (!validModels.includes(imageModel)) {
      return NextResponse.json(
        { success: false, error: `Invalid image model. Must be one of: ${validModels.join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`[TrendScanner] Generating image with ${imageModel}...`);

    let imageUrl: string;

    switch (imageModel) {
      case 'ideogram':
        imageUrl = await generateWithIdeogram(prompt);
        break;
      case 'gpt-image-1.5':
        imageUrl = await generateWithGptImage15(prompt);
        break;
      case 'imagen':
      default:
        imageUrl = await generateWithImagen(prompt);
        break;
    }

    console.log(`[TrendScanner] Image generated successfully with ${imageModel}`);

    return NextResponse.json({
      success: true,
      imageUrl,
      model: imageModel,
    });
  } catch (error: unknown) {
    console.error('[TrendScanner] Image generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
