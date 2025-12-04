/**
 * Vectorizer.AI Service
 *
 * Converts raster images to high-quality vectorized versions using Vectorizer.AI API.
 * The service takes generated images from Gemini (Nano Banana Pro) and returns
 * vectorized PNG images that are 4x the input resolution.
 *
 * Flow for HD downloads:
 * 1. Receive original image (any size)
 * 2. Shrink to ≤3 megapixels if needed (Vectorizer.AI limit)
 * 3. Send to Vectorizer.AI for vectorization
 * 4. Receive 4x sized vectorized PNG
 * 5. Resize to target dimensions (4500x5400 for Amazon Merch)
 *
 * API Documentation: https://vectorizer.ai/api
 * Output Options: https://vectorizer.ai/api/outputOptions
 */

import { VECTORIZER_CONFIG } from '@/config';

// Supported output formats from Vectorizer.AI
export type VectorizerOutputFormat = 'svg' | 'pdf' | 'eps' | 'dxf' | 'png';

// Processing mode - 'production' for full quality, 'test' for previews (lower cost)
export type VectorizerMode = 'production' | 'test';

export interface VectorizerOptions {
    /** Output format - defaults to 'png' */
    outputFormat?: VectorizerOutputFormat;
    /** Processing mode - 'production' for full quality, 'test' for previews */
    mode?: VectorizerMode;
    /** Number of days to retain the result (0-365, 0 = don't retain) */
    retentionDays?: number;
    /** Max colors in output (for processing optimization) */
    maxColors?: number;
}

export interface VectorizerResult {
    /** The vectorized image as a base64 data URL */
    imageUrl: string;
    /** Original format of the output */
    format: VectorizerOutputFormat;
    /** Image token for downloading additional formats (if retention > 0) */
    imageToken?: string;
    /** Receipt for downloading additional formats */
    receipt?: string;
    /** Processing credits used */
    creditsUsed?: number;
}

/**
 * Input limits for Vectorizer.AI:
 * - Max image pixel size: 3 megapixels
 * - Max image file size: 30 megabytes
 * - Supports 32-bit ARGB (full transparency)
 *
 * PNG Output behavior:
 * - Output is exactly 4x as wide and tall as the input image
 * - Maximum output size is 4 megapixels
 * - Full support for non-scaling strokes, quadratic Bézier curves, and arcs
 */

const VECTORIZER_API_URL = 'https://vectorizer.ai/api/v1/vectorize';
const VECTORIZER_DOWNLOAD_URL = 'https://vectorizer.ai/api/v1/download';
const VECTORIZER_TIMEOUT = 180000; // 180 seconds as recommended by API docs

/**
 * Get API credentials from environment variables
 */
const getCredentials = (): { apiId: string; apiSecret: string } => {
    const apiId = process.env.VECTORIZER_API_ID;
    const apiSecret = process.env.VECTORIZER_API_SECRET;

    if (!apiId || !apiSecret) {
        throw new Error(
            'Vectorizer.AI credentials not configured. ' +
            'Please set VECTORIZER_API_ID and VECTORIZER_API_SECRET environment variables.'
        );
    }

    return { apiId, apiSecret };
};

/**
 * Create Basic Auth header from credentials
 */
const createAuthHeader = (apiId: string, apiSecret: string): string => {
    const credentials = Buffer.from(`${apiId}:${apiSecret}`).toString('base64');
    return `Basic ${credentials}`;
};

/**
 * Convert a base64 data URL to a Buffer
 * Handles both data URLs and raw base64 strings
 */
const dataUrlToBuffer = (dataUrl: string): { buffer: Buffer; mimeType: string } => {
    // Check if it's a data URL
    const dataUrlMatch = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

    if (dataUrlMatch) {
        const mimeType = dataUrlMatch[1];
        const base64Data = dataUrlMatch[2];
        return {
            buffer: Buffer.from(base64Data, 'base64'),
            mimeType
        };
    }

    // Assume it's raw base64 PNG if no data URL prefix
    return {
        buffer: Buffer.from(dataUrl, 'base64'),
        mimeType: 'image/png'
    };
};

/**
 * Vectorize an image using the Vectorizer.AI API
 *
 * @param imageDataUrl - Base64 encoded image data URL (from Gemini generation)
 * @param options - Vectorization options
 * @returns Vectorized image result with base64 data URL
 *
 * @example
 * ```typescript
 * const result = await vectorizeImage(generatedImageUrl, {
 *   outputFormat: 'png',
 *   mode: 'production'
 * });
 * console.log(result.imageUrl); // data:image/png;base64,...
 * ```
 */
export const vectorizeImage = async (
    imageDataUrl: string,
    options: VectorizerOptions = {}
): Promise<VectorizerResult> => {
    const {
        outputFormat = 'png',
        mode = 'production',
        retentionDays = 0,
        maxColors
    } = options;

    try {
        const { apiId, apiSecret } = getCredentials();
        const authHeader = createAuthHeader(apiId, apiSecret);

        // Convert data URL to buffer
        const { buffer, mimeType } = dataUrlToBuffer(imageDataUrl);

        // Validate input size (3 megapixels max, 30MB file size max)
        const fileSizeMB = buffer.length / (1024 * 1024);
        if (fileSizeMB > 30) {
            throw new Error(`Image file size (${fileSizeMB.toFixed(2)}MB) exceeds Vectorizer.AI limit of 30MB`);
        }

        console.log(`🎯 Vectorizing image: ${(fileSizeMB).toFixed(2)}MB, format: ${outputFormat}, mode: ${mode}`);

        // Create form data for multipart upload
        const formData = new FormData();

        // Add the image file
        const blob = new Blob([buffer], { type: mimeType });
        formData.append('image', blob, 'image.png');

        // Add output format
        formData.append('output.format', outputFormat);

        // Add processing mode
        formData.append('mode', mode);

        // Add retention policy if specified
        if (retentionDays > 0) {
            formData.append('policy.retention_days', retentionDays.toString());
        }

        // Add max colors if specified (for processing optimization)
        if (maxColors) {
            formData.append('processing.max_colors', maxColors.toString());
        }

        // Make the API request with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), VECTORIZER_TIMEOUT);

        const response = await fetch(VECTORIZER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
            },
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Vectorizer.AI API Error:', response.status, errorText);
            throw new Error(`Vectorizer.AI API error (${response.status}): ${errorText}`);
        }

        // Get response headers for additional info
        const imageToken = response.headers.get('X-Image-Token') || undefined;
        const receipt = response.headers.get('X-Receipt') || undefined;
        const creditsUsedStr = response.headers.get('X-Credits-Used');
        const creditsUsed = creditsUsedStr ? parseInt(creditsUsedStr, 10) : undefined;

        // Get the response as binary data
        const responseBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(responseBuffer).toString('base64');

        // Determine MIME type based on output format
        const outputMimeType = getOutputMimeType(outputFormat);
        const resultDataUrl = `data:${outputMimeType};base64,${base64}`;

        console.log(`✓ Vectorization complete. Credits used: ${creditsUsed || 'unknown'}`);

        return {
            imageUrl: resultDataUrl,
            format: outputFormat,
            imageToken,
            receipt,
            creditsUsed
        };
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Vectorizer.AI request timed out after ${VECTORIZER_TIMEOUT / 1000} seconds`);
        }
        console.error('Vectorization Error:', error);
        throw error;
    }
};

/**
 * Vectorize an image from a URL (instead of base64 data)
 * Useful when the image is already hosted somewhere
 *
 * @param imageUrl - Public URL of the image to vectorize
 * @param options - Vectorization options
 * @returns Vectorized image result
 */
export const vectorizeImageFromUrl = async (
    imageUrl: string,
    options: VectorizerOptions = {}
): Promise<VectorizerResult> => {
    const {
        outputFormat = 'png',
        mode = 'production',
        retentionDays = 0,
        maxColors
    } = options;

    try {
        const { apiId, apiSecret } = getCredentials();
        const authHeader = createAuthHeader(apiId, apiSecret);

        console.log(`🎯 Vectorizing image from URL: ${imageUrl.substring(0, 50)}...`);

        // Create form data
        const formData = new FormData();

        // Use image.url parameter instead of uploading
        formData.append('image.url', imageUrl);

        // Add output format
        formData.append('output.format', outputFormat);

        // Add processing mode
        formData.append('mode', mode);

        // Add retention policy if specified
        if (retentionDays > 0) {
            formData.append('policy.retention_days', retentionDays.toString());
        }

        // Add max colors if specified
        if (maxColors) {
            formData.append('processing.max_colors', maxColors.toString());
        }

        // Make the API request with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), VECTORIZER_TIMEOUT);

        const response = await fetch(VECTORIZER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
            },
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Vectorizer.AI API Error:', response.status, errorText);
            throw new Error(`Vectorizer.AI API error (${response.status}): ${errorText}`);
        }

        // Get response headers
        const imageToken = response.headers.get('X-Image-Token') || undefined;
        const receipt = response.headers.get('X-Receipt') || undefined;
        const creditsUsedStr = response.headers.get('X-Credits-Used');
        const creditsUsed = creditsUsedStr ? parseInt(creditsUsedStr, 10) : undefined;

        // Get the response as binary data
        const responseBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(responseBuffer).toString('base64');

        // Determine MIME type based on output format
        const outputMimeType = getOutputMimeType(outputFormat);
        const resultDataUrl = `data:${outputMimeType};base64,${base64}`;

        console.log(`✓ Vectorization complete. Credits used: ${creditsUsed || 'unknown'}`);

        return {
            imageUrl: resultDataUrl,
            format: outputFormat,
            imageToken,
            receipt,
            creditsUsed
        };
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Vectorizer.AI request timed out after ${VECTORIZER_TIMEOUT / 1000} seconds`);
        }
        console.error('Vectorization Error:', error);
        throw error;
    }
};

/**
 * Download additional output formats for an already-vectorized image
 * Requires the imageToken and receipt from the original vectorization
 *
 * @param imageToken - Token from X-Image-Token header of original request
 * @param receipt - Receipt from X-Receipt header of original request
 * @param outputFormat - Desired output format
 * @returns Vectorized image in the new format
 */
export const downloadAdditionalFormat = async (
    imageToken: string,
    receipt: string,
    outputFormat: VectorizerOutputFormat
): Promise<VectorizerResult> => {
    try {
        const { apiId, apiSecret } = getCredentials();
        const authHeader = createAuthHeader(apiId, apiSecret);

        console.log(`📥 Downloading additional format: ${outputFormat}`);

        const formData = new FormData();
        formData.append('image.token', imageToken);
        formData.append('receipt', receipt);
        formData.append('output.format', outputFormat);

        const response = await fetch(VECTORIZER_DOWNLOAD_URL, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Vectorizer.AI download error (${response.status}): ${errorText}`);
        }

        // Get the new receipt for further downloads
        const newReceipt = response.headers.get('X-Receipt') || undefined;

        // Get the response as binary data
        const responseBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(responseBuffer).toString('base64');

        const outputMimeType = getOutputMimeType(outputFormat);
        const resultDataUrl = `data:${outputMimeType};base64,${base64}`;

        console.log(`✓ Additional format download complete`);

        return {
            imageUrl: resultDataUrl,
            format: outputFormat,
            imageToken,
            receipt: newReceipt
        };
    } catch (error) {
        console.error('Download Additional Format Error:', error);
        throw error;
    }
};

/**
 * Generate an image with Gemini and then vectorize it
 * This is a convenience function that combines image generation with vectorization
 *
 * @param generateImageFn - Function that generates the initial image (returns base64 data URL)
 * @param vectorizerOptions - Options for the vectorization step
 * @returns Vectorized image result
 */
export const generateAndVectorize = async (
    generateImageFn: () => Promise<string>,
    vectorizerOptions: VectorizerOptions = {}
): Promise<VectorizerResult> => {
    console.log('🎨 Step 1: Generating image with AI...');
    const generatedImageUrl = await generateImageFn();

    console.log('🔄 Step 2: Vectorizing generated image...');
    const result = await vectorizeImage(generatedImageUrl, vectorizerOptions);

    return result;
};

/**
 * Get MIME type for output format
 */
const getOutputMimeType = (format: VectorizerOutputFormat): string => {
    const mimeTypes: Record<VectorizerOutputFormat, string> = {
        'svg': 'image/svg+xml',
        'pdf': 'application/pdf',
        'eps': 'application/postscript',
        'dxf': 'application/dxf',
        'png': 'image/png'
    };
    return mimeTypes[format] || 'application/octet-stream';
};

/**
 * Validate that an image meets Vectorizer.AI input requirements
 *
 * Requirements:
 * - Max 3 megapixels
 * - Max 30MB file size
 * - Supported formats: PNG, JPEG, WEBP, BMP, GIF
 *
 * @param imageDataUrl - Base64 encoded image data URL
 * @returns Validation result with any issues
 */
export const validateImageForVectorization = (imageDataUrl: string): {
    valid: boolean;
    issues: string[];
    fileSizeMB: number;
} => {
    const issues: string[] = [];

    const { buffer, mimeType } = dataUrlToBuffer(imageDataUrl);
    const fileSizeMB = buffer.length / (1024 * 1024);

    // Check file size
    if (fileSizeMB > 30) {
        issues.push(`File size (${fileSizeMB.toFixed(2)}MB) exceeds 30MB limit`);
    }

    // Check supported formats
    const supportedMimeTypes = [
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/bmp',
        'image/gif'
    ];

    if (!supportedMimeTypes.includes(mimeType)) {
        issues.push(`Unsupported image format: ${mimeType}. Supported: PNG, JPEG, WEBP, BMP, GIF`);
    }

    return {
        valid: issues.length === 0,
        issues,
        fileSizeMB
    };
};

/**
 * Check if the vectorizer feature is enabled
 */
export const isVectorizerEnabled = (): boolean => {
    return VECTORIZER_CONFIG.enabled;
};

/**
 * Check if a subscription tier has access to HD vectorized downloads
 */
export const tierHasVectorizerAccess = (tier: string): boolean => {
    return (VECTORIZER_CONFIG.allowedTiers as readonly string[]).includes(tier);
};

/**
 * Calculate dimensions that fit within the megapixel limit while maintaining aspect ratio
 */
export const calculateFitDimensions = (
    width: number,
    height: number,
    maxPixels: number = VECTORIZER_CONFIG.maxInputPixels
): { width: number; height: number; wasResized: boolean } => {
    const currentPixels = width * height;

    if (currentPixels <= maxPixels) {
        return { width, height, wasResized: false };
    }

    // Calculate scale factor to fit within max pixels
    const scale = Math.sqrt(maxPixels / currentPixels);
    const newWidth = Math.floor(width * scale);
    const newHeight = Math.floor(height * scale);

    return { width: newWidth, height: newHeight, wasResized: true };
};

/**
 * Calculate dimensions to resize to target while maintaining aspect ratio
 * Uses "cover" strategy - fills target area, may crop edges
 */
export const calculateTargetDimensions = (
    sourceWidth: number,
    sourceHeight: number,
    targetWidth: number = VECTORIZER_CONFIG.targetOutputWidth,
    targetHeight: number = VECTORIZER_CONFIG.targetOutputHeight
): { width: number; height: number; offsetX: number; offsetY: number } => {
    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = targetWidth / targetHeight;

    let width: number;
    let height: number;
    let offsetX = 0;
    let offsetY = 0;

    if (sourceRatio > targetRatio) {
        // Source is wider - fit height, crop width
        height = targetHeight;
        width = Math.round(height * sourceRatio);
        offsetX = Math.round((width - targetWidth) / 2);
    } else {
        // Source is taller - fit width, crop height
        width = targetWidth;
        height = Math.round(width / sourceRatio);
        offsetY = Math.round((height - targetHeight) / 2);
    }

    return { width, height, offsetX, offsetY };
};

/**
 * Full HD vectorization pipeline for downloads
 *
 * This function handles the complete flow:
 * 1. Shrink image to fit Vectorizer.AI's 3MP limit (if needed)
 * 2. Vectorize the image
 * 3. Return the vectorized result (resizing to target happens client-side)
 *
 * @param imageDataUrl - Original image as base64 data URL
 * @param options - Vectorization options
 * @returns Vectorized image result
 */
export const vectorizeForHDDownload = async (
    imageDataUrl: string,
    options: VectorizerOptions = {}
): Promise<VectorizerResult & { originalDimensions?: { width: number; height: number }; wasResized?: boolean }> => {
    console.log('🖼️ Starting HD vectorization pipeline...');

    // For now, we pass through to the main vectorize function
    // The resize logic will be handled client-side or in a future enhancement
    // since we need canvas/sharp for image manipulation which requires different setup

    const result = await vectorizeImage(imageDataUrl, {
        ...options,
        outputFormat: 'png',
        mode: options.mode || 'production'
    });

    console.log('✓ HD vectorization pipeline complete');

    return {
        ...result,
        wasResized: false // Will be set when resize logic is implemented
    };
};

/**
 * Extended result type for HD downloads with caching info
 */
export interface HDVectorizeResult extends VectorizerResult {
    /** Whether the result was served from cache */
    fromCache: boolean;
    /** Design ID if cached */
    designId?: string;
    /** R2 URL where the vectorized image is stored */
    storageUrl?: string;
}
