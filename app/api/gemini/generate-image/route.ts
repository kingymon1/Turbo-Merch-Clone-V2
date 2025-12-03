/**
 * POST /api/gemini/generate-image
 *
 * Server-side endpoint for generating t-shirt design images.
 * Keeps the Gemini API key secure on the server.
 */

import { NextRequest, NextResponse } from 'next/server';

// Increase timeout for AI image generation (requires Vercel Pro plan for >10s)
export const maxDuration = 60;
import { generateDesignImage, generateDesignImageEnhanced } from '@/services/geminiService';
import { TrendData, PromptMode } from '@/types';

interface GenerateImageRequest {
  // For basic generation
  basicPrompt?: string;
  style?: string;
  textOnDesign?: string;
  typographyStyle?: string;
  recommendedShirtColor?: string;
  promptMode?: PromptMode;

  // For enhanced generation (using trend data)
  trend?: TrendData;
  useEnhancedResearch?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateImageRequest = await request.json();

    // Enhanced generation with trend data
    if (body.trend) {
      console.log('[API] Generating enhanced image for trend:', body.trend.topic);

      const result = await generateDesignImageEnhanced(
        body.trend,
        body.useEnhancedResearch ?? true
      );

      return NextResponse.json({
        success: true,
        imageUrl: result.imageUrl,
        research: result.research,
      });
    }

    // Basic generation with direct prompt
    if (body.basicPrompt) {
      console.log('[API] Generating basic image with prompt');

      const imageUrl = await generateDesignImage(
        body.basicPrompt,
        body.style || 'streetwear',
        body.textOnDesign,
        body.typographyStyle,
        body.recommendedShirtColor,
        body.promptMode || 'advanced'
      );

      return NextResponse.json({
        success: true,
        imageUrl,
      });
    }

    return NextResponse.json(
      { error: 'Missing required field: either trend or basicPrompt' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[API] Generate image error:', error);

    const message = error instanceof Error ? error.message : 'Failed to generate image';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
