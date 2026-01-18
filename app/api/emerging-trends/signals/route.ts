/**
 * GET /api/emerging-trends/signals
 *
 * Get emerging trends for the UI.
 * Returns validated merch opportunities sorted by velocity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getActiveEmergingTrends, markTrendUsed } from '@/lib/emerging-trends';

interface SignalsQuery {
  limit?: string;
  minViability?: string;
  amazonSafeOnly?: string;
  unusedOnly?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const query: SignalsQuery = {
      limit: searchParams.get('limit') || undefined,
      minViability: searchParams.get('minViability') || undefined,
      amazonSafeOnly: searchParams.get('amazonSafeOnly') || undefined,
      unusedOnly: searchParams.get('unusedOnly') || undefined,
    };

    // Get trends
    const trends = await getActiveEmergingTrends({
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      minViability: query.minViability ? parseFloat(query.minViability) : 0.5,
      amazonSafeOnly: query.amazonSafeOnly !== 'false',
      unusedOnly: query.unusedOnly === 'true',
    });

    // Group by velocity tier
    const grouped = {
      exploding: trends.filter((t) => t.velocityTrend === 'exploding'),
      rising: trends.filter((t) => t.velocityTrend === 'rising'),
      steady: trends.filter((t) => t.velocityTrend === 'steady'),
    };

    return NextResponse.json({
      success: true,
      data: {
        trends,
        grouped,
        total: trends.length,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('[EmergingTrends] Signals fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch signals',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/emerging-trends/signals
 *
 * Mark a trend as used for design generation.
 */
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

    const body = await request.json();
    const { trendId, designId } = body;

    if (!trendId) {
      return NextResponse.json(
        { error: 'Missing trendId' },
        { status: 400 }
      );
    }

    await markTrendUsed(trendId, designId);

    return NextResponse.json({
      success: true,
      message: 'Trend marked as used',
    });

  } catch (error) {
    console.error('[EmergingTrends] Mark used error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to mark trend as used',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
