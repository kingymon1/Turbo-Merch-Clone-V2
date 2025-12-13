/**
 * Style Research Cron Job
 *
 * Populates the style database for top niches.
 * Run daily or weekly via Vercel Cron or external scheduler.
 *
 * Usage:
 * GET /api/cron/style-research
 * Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  TOP_NICHES,
  researchNichesBulk,
} from '@/lib/merch/style-research';

// Allow up to 5 minutes for bulk processing
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log(
    `[StyleCron] Starting style research for ${TOP_NICHES.length} niches`
  );

  const startTime = Date.now();

  try {
    const results = await researchNichesBulk(TOP_NICHES, 5);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(
      `[StyleCron] Complete: ${results.succeeded}/${results.total} succeeded in ${duration}s`
    );

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      ...results,
    });
  } catch (error) {
    console.error('[StyleCron] Fatal error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for researching specific niches
 *
 * Body: { niches: string[] }
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const body = await request.json();
  const niches = body.niches as string[];

  if (!niches || !Array.isArray(niches) || niches.length === 0) {
    return NextResponse.json(
      { error: 'niches array is required' },
      { status: 400 }
    );
  }

  console.log(
    `[StyleCron] Custom research for ${niches.length} niches: ${niches.join(', ')}`
  );

  const startTime = Date.now();

  try {
    const results = await researchNichesBulk(niches, 5);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(
      `[StyleCron] Complete: ${results.succeeded}/${results.total} succeeded in ${duration}s`
    );

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      ...results,
    });
  } catch (error) {
    console.error('[StyleCron] Fatal error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
