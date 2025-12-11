/**
 * POST /api/cron/discover-styles
 *
 * Cron job endpoint for discovering niche style characteristics from MBA product images.
 * Uses Claude Vision to analyze actual successful products and extract style patterns.
 *
 * Recommended schedule: Every 24-48 hours (style patterns don't change rapidly)
 *
 * This is a KEY COMPONENT of the style discovery system that ensures designs
 * match what actually sells in each niche, rather than using hardcoded assumptions.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  discoverStylesForNiches,
  getNichesNeedingStyleDiscovery
} from '@/lib/merch/style-discovery';
import { prisma } from '@/lib/prisma';

// Extended timeout for cron job (style analysis is image-intensive)
export const maxDuration = 600;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[DiscoverStyles] CRON_SECRET not configured');
      return NextResponse.json(
        { success: false, error: 'Cron not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[DiscoverStyles] Invalid authorization');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[DiscoverStyles] Starting style discovery cron job');
    const startTime = Date.now();

    // Parse request body for optional configuration
    let config = {
      maxNiches: 10,       // Maximum niches to process per run
      sampleSize: 15,      // Products to analyze per niche
      maxAgeHours: 168,    // Refresh profiles older than 1 week
      specificNiches: [] as string[]  // If provided, only process these
    };

    try {
      const body = await request.json();
      config = { ...config, ...body };
    } catch {
      // Use defaults if no body
    }

    // Step 1: Get niches that need style discovery
    let nichesToProcess: string[];

    if (config.specificNiches.length > 0) {
      nichesToProcess = config.specificNiches;
      console.log(`[DiscoverStyles] Processing ${nichesToProcess.length} specified niches`);
    } else {
      nichesToProcess = await getNichesNeedingStyleDiscovery(config.maxAgeHours);
      console.log(`[DiscoverStyles] Found ${nichesToProcess.length} niches needing discovery`);

      // Limit to maxNiches per run
      if (nichesToProcess.length > config.maxNiches) {
        // Prioritize niches with more MBA products
        const nicheProductCounts = await prisma.nicheMarketData.findMany({
          where: { niche: { in: nichesToProcess } },
          orderBy: { mbaProducts: 'desc' },
          take: config.maxNiches,
          select: { niche: true }
        });

        nichesToProcess = nicheProductCounts.map(n => n.niche);
        console.log(`[DiscoverStyles] Limited to ${nichesToProcess.length} highest-traffic niches`);
      }
    }

    if (nichesToProcess.length === 0) {
      console.log('[DiscoverStyles] No niches need style discovery at this time');
      return NextResponse.json({
        success: true,
        message: 'No niches need style discovery',
        stats: {
          processedCount: 0,
          duration: `${Date.now() - startTime}ms`
        }
      });
    }

    // Step 2: Run style discovery for each niche
    console.log(`[DiscoverStyles] Processing niches: ${nichesToProcess.join(', ')}`);

    const results = await discoverStylesForNiches(nichesToProcess, {
      sampleSize: config.sampleSize,
      concurrency: 2  // Conservative to avoid rate limits
    });

    // Step 3: Summarize results
    let successCount = 0;
    let failCount = 0;
    const profilesSummary: Array<{
      niche: string;
      success: boolean;
      confidence?: number;
      sampleSize?: number;
    }> = [];

    for (const [niche, profile] of results) {
      if (profile) {
        successCount++;
        profilesSummary.push({
          niche,
          success: true,
          confidence: profile.confidence,
          sampleSize: profile.sampleSize
        });
      } else {
        failCount++;
        profilesSummary.push({
          niche,
          success: false
        });
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[DiscoverStyles] Completed in ${duration}ms: ${successCount} success, ${failCount} failed`);

    return NextResponse.json({
      success: true,
      message: 'Style discovery complete',
      stats: {
        processedCount: nichesToProcess.length,
        successCount,
        failCount,
        duration: `${duration}ms`,
        profiles: profilesSummary
      }
    });

  } catch (error) {
    console.error('[DiscoverStyles] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Style discovery failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Support GET for Vercel cron
export async function GET(request: NextRequest): Promise<NextResponse> {
  return POST(request);
}
