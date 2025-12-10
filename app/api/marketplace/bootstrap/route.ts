import { NextRequest, NextResponse } from 'next/server';
import {
  bootstrapMarketplace,
  bootstrapQuick,
  getBootstrapStatus,
  CORE_MBA_NICHES,
} from '@/services/marketplaceBootstrap';
import { isApiConfigured } from '@/services/marketplaceIntelligence';
import { isDatabaseConfigured } from '@/services/marketplaceLearning';

// Long timeout for full bootstrap (can take 5-10 minutes)
export const maxDuration = 600;

/**
 * POST /api/marketplace/bootstrap
 *
 * Bootstrap the marketplace database with real Amazon MBA data.
 *
 * This endpoint seeds the marketplace intelligence system with product data
 * from core MBA niches, enabling getOptimizedKeywordsForNiche() to return
 * useful results with 30-40% confidence scores.
 *
 * Body options:
 * - mode?: 'full' | 'quick' - Full bootstrap (20 niches) or quick (5 niches)
 * - niches?: string[] - Custom niches to bootstrap (overrides mode)
 * - productsPerNiche?: number - Target products per niche (default: 20)
 * - mbaSampleSize?: number - Products to check for MBA (default: 8)
 *
 * Example:
 * POST /api/marketplace/bootstrap
 * { "mode": "full" }
 *
 * POST /api/marketplace/bootstrap
 * { "niches": ["nurse shirt funny", "dog mom shirt"], "productsPerNiche": 15 }
 */
export async function POST(request: NextRequest) {
  try {
    // Check configuration
    if (!isApiConfigured()) {
      return NextResponse.json(
        {
          error: 'Decodo API not configured',
          details: 'Set DECODO_USERNAME and DECODO_PASSWORD environment variables',
        },
        { status: 503 }
      );
    }

    const dbReady = await isDatabaseConfigured();
    if (!dbReady) {
      return NextResponse.json(
        {
          error: 'Database not configured',
          details: 'DATABASE_URL environment variable required',
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      mode = 'full',
      niches,
      productsPerNiche = 20,
      mbaSampleSize = 8,
    } = body;

    console.log(`[BOOTSTRAP API] Starting bootstrap - mode: ${mode}`);

    // Run bootstrap
    let result;
    if (niches && Array.isArray(niches) && niches.length > 0) {
      // Custom niches
      console.log(`[BOOTSTRAP API] Custom niches: ${niches.join(', ')}`);
      result = await bootstrapMarketplace({
        niches,
        productsPerNiche,
        mbaSampleSize,
      });
    } else if (mode === 'quick') {
      // Quick mode (5 niches)
      console.log('[BOOTSTRAP API] Running quick bootstrap (5 niches)');
      result = await bootstrapQuick();
    } else {
      // Full mode (all core niches)
      console.log(`[BOOTSTRAP API] Running full bootstrap (${CORE_MBA_NICHES.length} niches)`);
      result = await bootstrapMarketplace({
        productsPerNiche,
        mbaSampleSize,
      });
    }

    return NextResponse.json({
      success: result.status === 'complete',
      bootstrap: {
        status: result.status,
        startedAt: result.startedAt.toISOString(),
        completedAt: result.completedAt?.toISOString(),
        totalNiches: result.totalNiches,
        nichesCompleted: result.nichesCompleted,
      },
      summary: result.summary,
      results: result.results.map(r => ({
        niche: r.niche,
        productsStored: r.productsStored,
        mbaProductsStored: r.mbaProductsStored,
        confidenceBefore: r.confidenceBefore,
        confidenceAfter: r.confidenceAfter,
        confidenceGain: r.confidenceGain,
        error: r.error,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[BOOTSTRAP API] Error:', error);
    return NextResponse.json(
      {
        error: 'Bootstrap failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/marketplace/bootstrap
 *
 * Check current bootstrap status - how much data exists and confidence levels.
 *
 * Returns:
 * - Configuration status (API, database)
 * - Current data coverage across core niches
 * - Confidence levels per niche
 * - Recommendation for next steps
 *
 * Example:
 * GET /api/marketplace/bootstrap
 */
export async function GET() {
  try {
    const apiConfigured = isApiConfigured();
    const dbConfigured = await isDatabaseConfigured();

    // If database not ready, return config status only
    if (!dbConfigured) {
      return NextResponse.json({
        ready: false,
        configuration: {
          decodoApi: apiConfigured ? 'configured' : 'missing',
          database: 'not configured',
        },
        recommendation: 'Configure DATABASE_URL to enable bootstrap',
        availableNiches: CORE_MBA_NICHES,
      });
    }

    // Get detailed status
    const status = await getBootstrapStatus();

    return NextResponse.json({
      ready: apiConfigured && dbConfigured,
      configuration: {
        decodoApi: apiConfigured ? 'configured' : 'missing',
        database: 'connected',
      },
      status: {
        totalNiches: status.totalNiches,
        nichesWithData: status.nichesWithData,
        nichesWithGoodConfidence: status.nichesWithGoodConfidence,
        totalProducts: status.totalProducts,
        totalMbaProducts: status.totalMbaProducts,
        avgConfidence: status.avgConfidence,
      },
      niches: status.nicheDetails,
      recommendation: status.recommendation,
      usage: {
        fullBootstrap: 'POST /api/marketplace/bootstrap {"mode": "full"}',
        quickBootstrap: 'POST /api/marketplace/bootstrap {"mode": "quick"}',
        customNiches: 'POST /api/marketplace/bootstrap {"niches": ["niche1", "niche2"]}',
      },
    });
  } catch (error) {
    console.error('[BOOTSTRAP API] Status check error:', error);
    return NextResponse.json(
      {
        error: 'Status check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
