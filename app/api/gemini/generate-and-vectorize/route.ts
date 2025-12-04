/**
 * POST /api/gemini/generate-and-vectorize
 *
 * Combined endpoint that generates an image using Gemini (Nano Banana Pro)
 * and then vectorizes it using Vectorizer.AI, returning a high-quality
 * vectorized PNG (4x input resolution).
 *
 * Flow:
 * 1. Generate image with Gemini 3 Pro (Nano Banana)
 * 2. Send generated image to Vectorizer.AI
 * 3. Return vectorized PNG for download
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateDesignImage, generateDesignImageEnhanced } from '@/services/geminiService';
import {
    vectorizeImage,
    validateImageForVectorization,
    VectorizerOutputFormat,
    VectorizerMode
} from '@/services/vectorizerService';
import { TrendData, PromptMode } from '@/types';

// Maximum timeout for combined operation (generation + vectorization)
// Generation can take up to 120s, vectorization up to 180s
export const maxDuration = 300;

interface GenerateAndVectorizeRequest {
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

    // Vectorization options
    vectorize?: boolean; // Set to false to skip vectorization (default: true)
    outputFormat?: VectorizerOutputFormat;
    vectorizerMode?: VectorizerMode;
}

export async function POST(request: NextRequest) {
    try {
        const body: GenerateAndVectorizeRequest = await request.json();

        // Default to vectorization enabled
        const shouldVectorize = body.vectorize !== false;

        let generatedImageUrl: string;
        let research = null;

        // Step 1: Generate the image with Gemini
        console.log('[API] Step 1: Generating image with Gemini...');

        if (body.trend) {
            // Enhanced generation with trend data
            console.log('[API] Using enhanced generation for trend:', body.trend.topic);
            const result = await generateDesignImageEnhanced(
                body.trend,
                body.useEnhancedResearch ?? true,
                body.promptMode || 'advanced'
            );
            generatedImageUrl = result.imageUrl;
            research = result.research;
        } else if (body.basicPrompt) {
            // Basic generation with direct prompt
            console.log('[API] Using basic generation with prompt');
            generatedImageUrl = await generateDesignImage(
                body.basicPrompt,
                body.style || 'streetwear',
                body.textOnDesign,
                body.typographyStyle,
                body.recommendedShirtColor,
                body.promptMode || 'advanced'
            );
        } else {
            return NextResponse.json(
                { error: 'Missing required field: either trend or basicPrompt' },
                { status: 400 }
            );
        }

        console.log('[API] Image generated successfully');

        // If vectorization is disabled, return the generated image directly
        if (!shouldVectorize) {
            return NextResponse.json({
                success: true,
                imageUrl: generatedImageUrl,
                research,
                vectorized: false
            });
        }

        // Step 2: Vectorize the generated image
        console.log('[API] Step 2: Vectorizing image with Vectorizer.AI...');

        // Validate before sending to vectorizer
        const validation = validateImageForVectorization(generatedImageUrl);
        if (!validation.valid) {
            console.warn('[API] Image validation issues:', validation.issues);
            // Still try to vectorize - some issues might be acceptable
        }

        const vectorizerOptions = {
            outputFormat: body.outputFormat || 'png' as VectorizerOutputFormat,
            mode: body.vectorizerMode || 'production' as VectorizerMode,
        };

        const vectorizedResult = await vectorizeImage(generatedImageUrl, vectorizerOptions);

        console.log('[API] Vectorization complete');

        return NextResponse.json({
            success: true,
            imageUrl: vectorizedResult.imageUrl, // The vectorized image
            originalImageUrl: generatedImageUrl, // The original generated image
            format: vectorizedResult.format,
            research,
            vectorized: true,
            creditsUsed: vectorizedResult.creditsUsed
        });

    } catch (error) {
        console.error('[API] Generate and vectorize error:', error);

        const message = error instanceof Error ? error.message : 'Failed to generate and vectorize image';

        // Determine if it was a generation or vectorization error
        const isVectorizerError = message.toLowerCase().includes('vectorizer');

        return NextResponse.json(
            {
                error: message,
                stage: isVectorizerError ? 'vectorization' : 'generation'
            },
            { status: 500 }
        );
    }
}
