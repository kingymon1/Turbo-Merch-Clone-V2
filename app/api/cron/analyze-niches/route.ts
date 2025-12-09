/**
 * POST /api/cron/analyze-niches
 *
 * Cron job endpoint for analyzing collected market data into NicheTrend records.
 * Runs every 12 hours via Vercel cron (after data collection).
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeNicheTrends } from '@/lib/merch/data-collectors';

// Extended timeout for cron job
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[Cron] CRON_SECRET not configured');
      return NextResponse.json(
        { success: false, error: 'Cron not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[Cron] Invalid authorization');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Cron] Starting niche analysis');
    const startTime = Date.now();

    // Analyze all collected market data
    const analyzedCount = await analyzeNicheTrends();

    const duration = Date.now() - startTime;
    console.log(`[Cron] Analysis complete in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Niche analysis complete',
      stats: {
        nichesAnalyzed: analyzedCount,
        duration: `${duration}ms`,
      },
    });
  } catch (error) {
    console.error('[Cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Analysis failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel cron
export async function GET(request: NextRequest): Promise<NextResponse> {
  return POST(request);
}
