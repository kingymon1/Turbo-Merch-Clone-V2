import { NextRequest, NextResponse } from 'next/server';
import {
  getOptimizedKeywordsForNiche,
  getQuickKeywordSuggestions,
  isDatabaseConfigured,
} from '@/services/marketplaceLearning';

/**
 * POST /api/marketplace/keywords
 *
 * Get optimized keywords for a niche from learned marketplace data.
 * This endpoint is useful for:
 * - Testing if marketplace data exists for a niche
 * - Previewing what keywords would be used in listing generation
 * - Debugging listing generation issues
 *
 * Body:
 * - niche: string (required) - The target niche (e.g., "nurse gifts", "dog mom")
 * - quick?: boolean - Return only keywords (faster, less data)
 *
 * Response:
 * - success: boolean
 * - data: OptimizedKeywords | string[] | null
 * - source: 'learned' | 'fallback' | 'none'
 * - message: string
 */
export async function POST(request: NextRequest) {
  try {
    // Check database configuration
    const dbConfigured = await isDatabaseConfigured();
    if (!dbConfigured) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          source: 'none',
          message: 'Database not configured. Set DATABASE_URL to enable marketplace learning.',
        },
        { status: 503 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { niche, quick = false } = body;

    if (!niche || typeof niche !== 'string') {
      return NextResponse.json(
        {
          success: false,
          data: null,
          source: 'none',
          message: 'Missing required parameter: niche (string)',
        },
        { status: 400 }
      );
    }

    console.log(`[KEYWORDS API] Fetching keywords for niche: "${niche}" (quick: ${quick})`);

    // Quick mode - just return keyword suggestions
    if (quick) {
      const keywords = await getQuickKeywordSuggestions(niche, 15);

      if (keywords.length === 0) {
        return NextResponse.json({
          success: false,
          data: null,
          source: 'none',
          message: `No marketplace data found for niche: "${niche}". Try running /api/marketplace/scrape first.`,
        });
      }

      return NextResponse.json({
        success: true,
        data: keywords,
        source: 'learned',
        message: `Found ${keywords.length} keywords for "${niche}"`,
      });
    }

    // Full mode - return complete optimized keywords
    const optimizedKeywords = await getOptimizedKeywordsForNiche(niche);

    if (!optimizedKeywords) {
      return NextResponse.json({
        success: false,
        data: null,
        source: 'none',
        message: `No marketplace data found for niche: "${niche}". Try running /api/marketplace/scrape first.`,
        suggestions: [
          'Run POST /api/marketplace/scrape with {"niche": "' + niche + '"}',
          'Run POST /api/marketplace/trending to populate trending niches',
          'Check if the niche name matches existing data (try broader terms)',
        ],
      });
    }

    // Check confidence level
    if (optimizedKeywords.confidence < 30) {
      return NextResponse.json({
        success: true,
        data: optimizedKeywords,
        source: 'learned',
        message: `Low confidence data (${optimizedKeywords.confidence}%). May need more scraping for reliable results.`,
        warning: 'Low confidence - results may not be reliable',
      });
    }

    return NextResponse.json({
      success: true,
      data: optimizedKeywords,
      source: 'learned',
      message: `Found optimized keywords for "${niche}" with ${optimizedKeywords.confidence}% confidence`,
      stats: {
        primaryKeywords: optimizedKeywords.primaryKeywords.length,
        longTailPhrases: optimizedKeywords.longTailPhrases.length,
        titlePatterns: optimizedKeywords.titlePatterns.length,
        mbaProducts: optimizedKeywords.mbaInsights.productCount,
        saturation: optimizedKeywords.saturation,
        entryRecommendation: optimizedKeywords.entryRecommendation,
      },
    });
  } catch (error) {
    console.error('[KEYWORDS API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        source: 'none',
        message: 'Failed to fetch keywords',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/marketplace/keywords
 *
 * Get information about the keywords endpoint and available niches
 */
export async function GET() {
  const dbConfigured = await isDatabaseConfigured();

  return NextResponse.json({
    endpoint: '/api/marketplace/keywords',
    description: 'Get optimized keywords for a niche from learned marketplace data',
    status: dbConfigured ? 'ready' : 'database_not_configured',
    usage: {
      method: 'POST',
      body: {
        niche: 'string (required) - Target niche e.g., "nurse gifts", "dog mom"',
        quick: 'boolean (optional) - Return only keyword list (faster)',
      },
    },
    examples: [
      {
        description: 'Get full keyword analysis',
        body: { niche: 'nurse gifts' },
      },
      {
        description: 'Quick keyword suggestions',
        body: { niche: 'dog mom', quick: true },
      },
    ],
    relatedEndpoints: [
      {
        path: '/api/marketplace/scrape',
        description: 'Scrape marketplace data for a niche',
      },
      {
        path: '/api/marketplace/trending',
        description: 'Scrape trending niches to populate learning engine',
      },
    ],
  });
}
