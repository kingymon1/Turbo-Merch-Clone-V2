/**
 * POST /api/cron/moonshot-trends
 *
 * Cron job endpoint for collecting moonshot/viral trend data.
 * Uses test mode for maximum exploration.
 * Runs once daily via Vercel cron (more expensive, so less frequent).
 */

import { NextRequest, NextResponse } from 'next/server';
import { collectMoonshotTrends } from '@/lib/merch/data-collectors';

// Extended timeout for moonshot collection (can take longer)
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

    console.log('[Cron] Starting moonshot trend collection');
    const startTime = Date.now();

    // Collect moonshot trends using test mode
    const moonshotCount = await collectMoonshotTrends();

    const duration = Date.now() - startTime;
    console.log(`[Cron] Moonshot collection complete in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Moonshot collection complete',
      stats: {
        moonshot: moonshotCount,
        duration: `${duration}ms`,
      },
    });
  } catch (error) {
    console.error('[Cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Moonshot collection failed',
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
