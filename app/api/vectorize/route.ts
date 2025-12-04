/**
 * POST /api/vectorize
 *
 * Server-side endpoint for vectorizing images using Vectorizer.AI.
 * Accepts either a base64 image data URL or a public image URL.
 * Returns a vectorized PNG image (4x resolution of input).
 *
 * API Documentation: https://vectorizer.ai/api
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    vectorizeImage,
    vectorizeImageFromUrl,
    validateImageForVectorization,
    VectorizerOutputFormat,
    VectorizerMode
} from '@/services/vectorizerService';

// Increase timeout for vectorization (max 300s on Vercel Pro)
// Vectorizer.AI recommends 180s timeout minimum
export const maxDuration = 300;

interface VectorizeRequest {
    /** Base64 encoded image data URL (e.g., data:image/png;base64,...) */
    imageDataUrl?: string;
    /** Public URL of the image to vectorize */
    imageUrl?: string;
    /** Output format - defaults to 'png' */
    outputFormat?: VectorizerOutputFormat;
    /** Processing mode - 'production' for full quality, 'test' for previews (cheaper) */
    mode?: VectorizerMode;
    /** Days to retain result for downloading additional formats (0-365) */
    retentionDays?: number;
    /** Max colors in output (for optimization) */
    maxColors?: number;
}

export async function POST(request: NextRequest) {
    try {
        const body: VectorizeRequest = await request.json();

        // Validate request
        if (!body.imageDataUrl && !body.imageUrl) {
            return NextResponse.json(
                { error: 'Missing required field: either imageDataUrl or imageUrl must be provided' },
                { status: 400 }
            );
        }

        const options = {
            outputFormat: body.outputFormat || 'png' as VectorizerOutputFormat,
            mode: body.mode || 'production' as VectorizerMode,
            retentionDays: body.retentionDays || 0,
            maxColors: body.maxColors
        };

        let result;

        if (body.imageDataUrl) {
            // Vectorize from base64 data URL
            console.log('[API] Vectorizing image from data URL');

            // Validate the image before sending
            const validation = validateImageForVectorization(body.imageDataUrl);
            if (!validation.valid) {
                return NextResponse.json(
                    { error: `Image validation failed: ${validation.issues.join(', ')}` },
                    { status: 400 }
                );
            }

            console.log(`[API] Image validated: ${validation.fileSizeMB.toFixed(2)}MB`);

            result = await vectorizeImage(body.imageDataUrl, options);
        } else if (body.imageUrl) {
            // Vectorize from public URL
            console.log('[API] Vectorizing image from URL:', body.imageUrl.substring(0, 50));
            result = await vectorizeImageFromUrl(body.imageUrl, options);
        }

        return NextResponse.json({
            success: true,
            imageUrl: result!.imageUrl,
            format: result!.format,
            imageToken: result!.imageToken,
            receipt: result!.receipt,
            creditsUsed: result!.creditsUsed
        });

    } catch (error) {
        console.error('[API] Vectorize error:', error);

        const message = error instanceof Error ? error.message : 'Failed to vectorize image';

        // Determine appropriate status code
        let status = 500;
        if (message.includes('credentials not configured')) {
            status = 503; // Service Unavailable
        } else if (message.includes('API error (4')) {
            status = 400; // Bad Request (likely input issue)
        }

        return NextResponse.json(
            { error: message },
            { status }
        );
    }
}
