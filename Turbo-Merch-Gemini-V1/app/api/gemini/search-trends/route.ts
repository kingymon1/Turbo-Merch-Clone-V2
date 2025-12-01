/**
 * POST /api/gemini/search-trends
 *
 * Server-side endpoint for searching trends using Gemini.
 * Keeps the Gemini API key secure on the server.
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchTrends } from '@/services/geminiService';

interface SearchTrendsRequest {
  niche: string;
  viralityLevel?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchTrendsRequest = await request.json();
    const { niche, viralityLevel = 50 } = body;

    if (!niche) {
      return NextResponse.json(
        { error: 'Missing required field: niche' },
        { status: 400 }
      );
    }

    console.log('[API] Searching trends for:', niche, 'at virality level:', viralityLevel);

    // Note: onStatusUpdate callback can't be used in API route
    // Status updates would need to be handled via SSE or WebSocket for real-time updates
    const trends = await searchTrends(niche, viralityLevel);

    return NextResponse.json({
      success: true,
      trends,
      count: trends.length,
    });
  } catch (error) {
    console.error('[API] Search trends error:', error);

    const message = error instanceof Error ? error.message : 'Failed to search trends';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
