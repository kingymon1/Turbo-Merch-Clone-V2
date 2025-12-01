/**
 * POST /api/gemini/generate-listing
 *
 * Server-side endpoint for generating Amazon Merch listings.
 * Keeps the Gemini API key secure on the server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateListing } from '@/services/geminiService';
import { TrendData } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trend } = body as { trend: TrendData };

    if (!trend) {
      return NextResponse.json(
        { error: 'Missing required field: trend' },
        { status: 400 }
      );
    }

    // Validate trend has required fields
    if (!trend.topic) {
      return NextResponse.json(
        { error: 'Invalid trend data: missing topic' },
        { status: 400 }
      );
    }

    console.log('[API] Generating listing for trend:', trend.topic);

    const listing = await generateListing(trend);

    return NextResponse.json({
      success: true,
      listing,
    });
  } catch (error) {
    console.error('[API] Generate listing error:', error);

    const message = error instanceof Error ? error.message : 'Failed to generate listing';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
