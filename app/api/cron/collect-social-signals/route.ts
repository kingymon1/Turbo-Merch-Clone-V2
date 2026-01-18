/**
 * GET /api/cron/collect-social-signals
 *
 * Daily cron job for collecting social signals and discovering emerging trends.
 * Called by Vercel Cron at 3 AM daily.
 *
 * Add to vercel.json:
 * {
 *   "path": "/api/cron/collect-social-signals",
 *   "schedule": "0 3 * * *"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  discoverEmergingTrends,
  checkEmergingTrendsHealth,
  CRON_CONFIG,
} from '@/lib/emerging-trends';

// Allow long timeout for cron
export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = CRON_CONFIG.secret;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[Cron:SocialSignals] Unauthorized request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if cron is enabled
    if (!CRON_CONFIG.enabled) {
      console.log('[Cron:SocialSignals] Cron job disabled');
      return NextResponse.json({
        success: true,
        message: 'Cron job disabled',
        skipped: true,
      });
    }

    // Health check
    const health = await checkEmergingTrendsHealth();

    if (!health.decodoConfigured) {
      console.log('[Cron:SocialSignals] Decodo not configured, skipping');
      return NextResponse.json({
        success: false,
        error: 'Decodo API not configured',
        health,
      });
    }

    if (!health.databaseConnected) {
      console.log('[Cron:SocialSignals] Database not connected, skipping');
      return NextResponse.json({
        success: false,
        error: 'Database not connected',
        health,
      });
    }

    console.log('[Cron:SocialSignals] Starting social signal collection');

    // Run discovery
    const result = await discoverEmergingTrends({
      platforms: CRON_CONFIG.platforms,
      velocityPreset: CRON_CONFIG.defaultPreset,
      includeEvaluations: health.claudeConfigured, // Only evaluate if Claude is configured
    });

    const duration = Date.now() - startTime;

    console.log('[Cron:SocialSignals] Collection complete', {
      signalsFound: result.signalsFound,
      signalsStored: result.signalsStored,
      trendsCreated: result.trendsCreated,
      duration,
      errors: result.errors.length,
    });

    return NextResponse.json({
      success: result.success,
      data: {
        signalsFound: result.signalsFound,
        signalsStored: result.signalsStored,
        trendsEvaluated: result.trendsEvaluated,
        trendsCreated: result.trendsCreated,
        duration: result.duration,
        cronDuration: duration,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Cron:SocialSignals] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Social signal collection failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration,
      },
      { status: 500 }
    );
  }
}
