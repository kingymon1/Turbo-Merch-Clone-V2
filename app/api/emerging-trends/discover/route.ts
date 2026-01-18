/**
 * POST /api/emerging-trends/discover
 *
 * Trigger emerging trends discovery manually.
 * This is the on-demand version of the cron job.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  discoverEmergingTrends,
  checkEmergingTrendsHealth,
  VelocityPreset,
  Platform,
} from '@/lib/emerging-trends';

// Allow longer timeout for discovery
export const maxDuration = 300; // 5 minutes

interface DiscoverRequest {
  platforms?: Platform[];
  velocityPreset?: VelocityPreset;
  maxSignals?: number;
  includeEvaluations?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: DiscoverRequest = await request.json().catch(() => ({}));

    // Health check first
    const health = await checkEmergingTrendsHealth();
    if (!health.decodoConfigured) {
      return NextResponse.json(
        {
          success: false,
          error: 'Decodo API not configured',
          details: 'Set DECODO_USERNAME and DECODO_PASSWORD environment variables',
        },
        { status: 503 }
      );
    }

    // Run discovery
    const result = await discoverEmergingTrends({
      platforms: body.platforms || ['reddit'],
      velocityPreset: body.velocityPreset || 'moderate',
      maxTotalSignals: body.maxSignals || 500,
      includeEvaluations: body.includeEvaluations !== false,
    });

    return NextResponse.json({
      success: result.success,
      data: {
        signalsFound: result.signalsFound,
        signalsStored: result.signalsStored,
        trendsEvaluated: result.trendsEvaluated,
        trendsCreated: result.trendsCreated,
        duration: result.duration,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });

  } catch (error) {
    console.error('[EmergingTrends] Discovery error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Discovery failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/emerging-trends/discover
 *
 * Get discovery status and configuration
 */
export async function GET() {
  try {
    const health = await checkEmergingTrendsHealth();

    return NextResponse.json({
      status: health.errors.length === 0 ? 'ready' : 'not_configured',
      health,
      config: {
        availablePlatforms: ['reddit', 'tiktok'],
        availablePresets: ['conservative', 'moderate', 'aggressive'],
        defaultPreset: 'moderate',
      },
    });

  } catch (error) {
    console.error('[EmergingTrends] Health check error:', error);
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    );
  }
}
