/**
 * POST /api/cron/collect-trends
 *
 * Cron job endpoint for collecting proven and emerging trend data.
 * Runs every 6 hours via Vercel cron.
 */

import { NextRequest, NextResponse } from 'next/server';
import { collectTrendData, cleanOldMarketData } from '@/lib/merch/data-collectors';

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

    console.log('[Cron] Starting trend collection');
    const startTime = Date.now();

    // Clean old data first
    const cleaned = await cleanOldMarketData();
    console.log(`[Cron] Cleaned ${cleaned} old records`);

    // Collect proven trends
    const provenCount = await collectTrendData('proven');
    console.log(`[Cron] Collected ${provenCount} proven datasets`);

    // Collect emerging trends
    const emergingCount = await collectTrendData('emerging');
    console.log(`[Cron] Collected ${emergingCount} emerging datasets`);

    const duration = Date.now() - startTime;
    console.log(`[Cron] Collection complete in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Trend collection complete',
      stats: {
        cleaned,
        proven: provenCount,
        emerging: emergingCount,
        duration: `${duration}ms`,
      },
    });
  } catch (error) {
    console.error('[Cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Collection failed',
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
