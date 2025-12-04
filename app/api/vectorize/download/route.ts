/**
 * POST /api/vectorize/download
 *
 * Vectorize an image for HD download with caching.
 * - Checks if design already has a cached vectorized version
 * - If cached, returns the cached URL
 * - If not cached, vectorizes and stores in R2, updates database
 *
 * Access Control:
 * - Only available to paid tiers (starter, pro, agency, enterprise)
 * - Free trial users see the option but cannot use it
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import {
    vectorizeForHDDownload,
    isVectorizerEnabled,
    tierHasVectorizerAccess,
    HDVectorizeResult
} from '@/services/vectorizerService';
import { uploadToR2, getPublicUrl } from '@/lib/r2-storage';

// Max timeout for vectorization
export const maxDuration = 300;

interface VectorizeDownloadRequest {
    /** Design ID to vectorize */
    designId: string;
    /** Image URL or data URL to vectorize (optional if designId has imageUrl) */
    imageUrl?: string;
}

export async function POST(request: NextRequest) {
    try {
        // Check if feature is enabled
        if (!isVectorizerEnabled()) {
            return NextResponse.json(
                { error: 'HD vectorization is not available' },
                { status: 503 }
            );
        }

        // Authenticate user
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Get user and check tier
        const user = await prisma.user.findUnique({
            where: { clerkId },
            select: {
                id: true,
                subscriptionTier: true,
                subscriptionStatus: true
            }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        // Check tier access
        if (!tierHasVectorizerAccess(user.subscriptionTier)) {
            return NextResponse.json(
                {
                    error: 'HD Vector downloads require a paid subscription',
                    upgradeRequired: true,
                    currentTier: user.subscriptionTier
                },
                { status: 403 }
            );
        }

        const body: VectorizeDownloadRequest = await request.json();

        if (!body.designId) {
            return NextResponse.json(
                { error: 'designId is required' },
                { status: 400 }
            );
        }

        // Get the design
        const design = await prisma.designHistory.findUnique({
            where: { id: body.designId },
            select: {
                id: true,
                userId: true,
                imageUrl: true,
                vectorizedUrl: true,
                vectorizedAt: true
            }
        });

        if (!design) {
            return NextResponse.json(
                { error: 'Design not found' },
                { status: 404 }
            );
        }

        // Verify ownership
        if (design.userId !== user.id) {
            return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
            );
        }

        // Check if already vectorized (cached)
        if (design.vectorizedUrl && design.vectorizedAt) {
            console.log(`[API] Returning cached vectorized image for design ${design.id}`);

            const result: HDVectorizeResult = {
                imageUrl: design.vectorizedUrl,
                format: 'png',
                fromCache: true,
                designId: design.id,
                storageUrl: design.vectorizedUrl
            };

            return NextResponse.json({
                success: true,
                ...result
            });
        }

        // Get image to vectorize
        const imageUrl = body.imageUrl || design.imageUrl;
        if (!imageUrl) {
            return NextResponse.json(
                { error: 'No image available to vectorize' },
                { status: 400 }
            );
        }

        console.log(`[API] Vectorizing image for design ${design.id}`);

        // Fetch image if it's a URL (not data URL)
        let imageDataUrl = imageUrl;
        if (imageUrl.startsWith('http')) {
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                throw new Error(`Failed to fetch image: ${imageResponse.status}`);
            }
            const imageBuffer = await imageResponse.arrayBuffer();
            const base64 = Buffer.from(imageBuffer).toString('base64');
            const contentType = imageResponse.headers.get('content-type') || 'image/png';
            imageDataUrl = `data:${contentType};base64,${base64}`;
        }

        // Vectorize the image
        const vectorizeResult = await vectorizeForHDDownload(imageDataUrl, {
            mode: 'production'
        });

        // Extract base64 data from result
        const base64Match = vectorizeResult.imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!base64Match) {
            throw new Error('Invalid vectorized image format');
        }

        const vectorizedBuffer = Buffer.from(base64Match[2], 'base64');

        // Upload to R2
        const r2Key = `vectors/${user.id}/${design.id}_hd.png`;
        await uploadToR2(r2Key, vectorizedBuffer, 'image/png');
        const publicUrl = getPublicUrl(r2Key);

        // Update database with cached URL
        await prisma.designHistory.update({
            where: { id: design.id },
            data: {
                vectorizedUrl: publicUrl,
                vectorizedAt: new Date()
            }
        });

        console.log(`[API] Vectorization complete and cached for design ${design.id}`);

        const result: HDVectorizeResult = {
            imageUrl: vectorizeResult.imageUrl, // Return data URL for immediate use
            format: 'png',
            fromCache: false,
            designId: design.id,
            storageUrl: publicUrl,
            creditsUsed: vectorizeResult.creditsUsed
        };

        return NextResponse.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('[API] Vectorize download error:', error);

        const message = error instanceof Error ? error.message : 'Failed to vectorize image';

        return NextResponse.json(
            { error: message },
            { status: 500 }
        );
    }
}

/**
 * GET /api/vectorize/download
 *
 * Check vectorization status for a design
 */
export async function GET(request: NextRequest) {
    try {
        if (!isVectorizerEnabled()) {
            return NextResponse.json({ enabled: false });
        }

        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const designId = request.nextUrl.searchParams.get('designId');
        if (!designId) {
            return NextResponse.json(
                { error: 'designId parameter required' },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { clerkId },
            select: { id: true, subscriptionTier: true }
        });

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        const design = await prisma.designHistory.findUnique({
            where: { id: designId },
            select: {
                id: true,
                userId: true,
                vectorizedUrl: true,
                vectorizedAt: true
            }
        });

        if (!design || design.userId !== user.id) {
            return NextResponse.json(
                { error: 'Design not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            enabled: true,
            hasAccess: tierHasVectorizerAccess(user.subscriptionTier),
            currentTier: user.subscriptionTier,
            isVectorized: !!design.vectorizedUrl,
            vectorizedUrl: design.vectorizedUrl,
            vectorizedAt: design.vectorizedAt
        });

    } catch (error) {
        console.error('[API] Vectorize status check error:', error);
        return NextResponse.json(
            { error: 'Failed to check status' },
            { status: 500 }
        );
    }
}
