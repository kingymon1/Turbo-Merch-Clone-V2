import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/analytics/download
 * Track download events for analytics
 * This is a fire-and-forget endpoint - we don't want to block the user
 */
export async function POST(request: Request) {
    try {
        const { userId } = await auth();
        const data = await request.json();

        const {
            trend,
            promptMode,
            regenerationCount,
            timeToDownload,
            wasRegenerated,
            shirtColor,
            designId // Optional - if we have the design ID
        } = data;

        console.log('📊 Download tracked:', {
            userId: userId || 'anonymous',
            trend,
            promptMode,
            regenerationCount,
            timeToDownload,
            wasRegenerated
        });

        // If we have a designId, update the DesignHistory record
        if (designId && userId) {
            try {
                await prisma.designHistory.update({
                    where: { id: designId },
                    data: {
                        wasDownloaded: true,
                        downloadedAt: new Date(),
                        timeToDownload,
                        regenerationCount,
                        wasRegenerated,
                        promptMode
                    }
                });
            } catch (updateError) {
                console.error('Failed to update design history:', updateError);
            }
        }

        // Update or create TrendInsight for aggregate analytics
        if (trend) {
            try {
                const normalizedTopic = trend.toLowerCase().trim();

                await prisma.trendInsight.upsert({
                    where: { topic: normalizedTopic },
                    create: {
                        topic: normalizedTopic,
                        firstSeenAt: new Date(),
                        lastSeenAt: new Date(),
                        searchCount: 1,
                        designCount: 1,
                        downloadCount: 1,
                        advancedModeCount: promptMode === 'advanced' ? 1 : 0,
                        simpleModeCount: promptMode === 'simple' ? 1 : 0,
                        isActive: true
                    },
                    update: {
                        lastSeenAt: new Date(),
                        downloadCount: { increment: 1 },
                        advancedModeCount: promptMode === 'advanced' ? { increment: 1 } : undefined,
                        simpleModeCount: promptMode === 'simple' ? { increment: 1 } : undefined
                    }
                });
            } catch (trendError) {
                console.error('Failed to update trend insight:', trendError);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Analytics error:', error);
        // Don't return error - analytics should never block the user
        return NextResponse.json({ success: false });
    }
}
