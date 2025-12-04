import { NextRequest, NextResponse } from 'next/server';
import {
  scrapeTrendingTshirts,
  getSeasonalQueries,
  TRENDING_SCRAPE_QUERIES,
  isApiConfigured,
} from '@/services/marketplaceIntelligence';
import { runLearningEngine, isDatabaseConfigured } from '@/services/marketplaceLearning';

// Long timeout for full scrape
export const maxDuration = 300;

/**
 * POST /api/marketplace/trending
 *
 * Scrape trending t-shirts across all pre-defined niches
 * This is the main function for populating the learning engine
 *
 * Body:
 * - includeSeasonalqueries?: boolean - Include seasonal queries (default: true)
 * - sources?: ('amazon' | 'etsy')[] - Which marketplaces (default: both)
 * - limitPerQuery?: number - Max products per query per source (default: 30)
 * - runLearning?: boolean - Run learning engine after scrape (default: true)
 */
export async function POST(request: NextRequest) {
  try {
    // Check configuration
    if (!isApiConfigured()) {
      return NextResponse.json(
        { error: 'Decodo API not configured', details: 'Set DECODO_USERNAME and DECODO_PASSWORD' },
        { status: 503 }
      );
    }

    const dbReady = await isDatabaseConfigured();
    if (!dbReady) {
      return NextResponse.json(
        { error: 'Database not configured', details: 'DATABASE_URL required for learning engine' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      includeSeasonal = true,
      sources = ['amazon', 'etsy'],
      limitPerQuery = 30,
      runLearning = true,
    } = body;

    // Build query list
    let queries = [...TRENDING_SCRAPE_QUERIES];
    if (includeSeasonal) {
      const seasonalQueries = getSeasonalQueries();
      queries = [...queries, ...seasonalQueries];
    }

    console.log(`[TRENDING API] Starting scrape of ${queries.length} queries`);
    const startTime = Date.now();

    // Run the scrape
    const scrapeResults = await scrapeTrendingTshirts({
      queries,
      sources,
      limitPerQuery,
    });

    const scrapeDuration = Date.now() - startTime;

    // Optionally run learning engine
    let learningRan = false;
    if (runLearning && scrapeResults.productsStored >= 50) {
      console.log('[TRENDING API] Running learning engine...');
      await runLearningEngine();
      learningRan = true;
    }

    const totalDuration = Date.now() - startTime;

    return NextResponse.json({
      success: scrapeResults.success,
      scrape: {
        queriesProcessed: scrapeResults.queriesProcessed,
        productsFound: scrapeResults.productsFound,
        productsStored: scrapeResults.productsStored,
        errors: scrapeResults.errors.slice(0, 10), // Limit error output
        totalErrors: scrapeResults.errors.length,
        durationMs: scrapeDuration,
      },
      learning: {
        ran: learningRan,
        reason: learningRan
          ? 'Learning engine updated patterns'
          : scrapeResults.productsStored < 50
            ? 'Not enough data (need 50+ products)'
            : 'Learning disabled in request',
      },
      timing: {
        totalDurationMs: totalDuration,
        avgPerQuery: Math.round(scrapeDuration / scrapeResults.queriesProcessed),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[TRENDING API] Error:', error);
    return NextResponse.json(
      { error: 'Trending scrape failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/marketplace/trending
 *
 * Get information about trending scrape queries and status
 */
export async function GET() {
  const apiConfigured = isApiConfigured();
  const dbConfigured = await isDatabaseConfigured();
  const seasonalQueries = getSeasonalQueries();

  return NextResponse.json({
    status: apiConfigured && dbConfigured ? 'ready' : 'not_configured',
    configuration: {
      decodoApi: apiConfigured ? 'configured' : 'missing',
      database: dbConfigured ? 'connected' : 'missing',
    },
    queries: {
      standard: TRENDING_SCRAPE_QUERIES,
      seasonal: seasonalQueries,
      totalCount: TRENDING_SCRAPE_QUERIES.length + seasonalQueries.length,
    },
    categories: {
      professions: ['nurse', 'teacher', 'trucker', 'mechanic', 'electrician'],
      hobbies: ['fishing', 'hunting', 'gardening', 'camping', 'golf'],
      family: ['dad', 'mom', 'grandpa', 'grandma'],
      animals: ['dog', 'cat', 'horse'],
      foodDrink: ['coffee', 'beer', 'bbq'],
    },
    estimatedTime: {
      fullScrape: `${TRENDING_SCRAPE_QUERIES.length * 5} seconds (approx)`,
      withSeasonal: `${(TRENDING_SCRAPE_QUERIES.length + seasonalQueries.length) * 5} seconds (approx)`,
    },
  });
}
