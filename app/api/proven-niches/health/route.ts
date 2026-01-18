/**
 * GET /api/proven-niches/health
 *
 * Health check for the Proven Niches pipeline.
 */

import { NextResponse } from 'next/server';
import { checkProvenNichesHealth } from '@/lib/proven-niches';

export async function GET() {
  try {
    const health = await checkProvenNichesHealth();

    return NextResponse.json({
      status: health.working ? 'healthy' : 'unhealthy',
      configured: health.configured,
      working: health.working,
      details: health.details,
      errors: health.errors.length > 0 ? health.errors : undefined,
    });

  } catch (error) {
    console.error('[ProvenNiches] Health check error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
