import { NextRequest, NextResponse } from 'next/server';
import { getLearnedPatterns, runLearningEngine, isDatabaseConfigured } from '@/services/marketplaceLearning';

/**
 * GET /api/marketplace/patterns
 *
 * Get learned patterns from marketplace data
 *
 * Query params:
 * - niche?: string - Filter patterns by niche
 */
export async function GET(request: NextRequest) {
  try {
    const dbReady = await isDatabaseConfigured();
    if (!dbReady) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const niche = searchParams.get('niche') || undefined;

    const patterns = await getLearnedPatterns(niche);

    return NextResponse.json({
      success: true,
      niche: niche || 'all',
      patterns: {
        titlePatterns: patterns.titlePatterns,
        effectiveKeywords: patterns.effectiveKeywords.slice(0, 50),
        priceStrategies: patterns.priceStrategies,
        designStyles: patterns.designStyles,
      },
      lastUpdated: patterns.lastUpdated,
      summary: {
        totalTitlePatterns: patterns.titlePatterns.length,
        totalKeywords: patterns.effectiveKeywords.length,
        totalPriceStrategies: patterns.priceStrategies.length,
        totalDesignStyles: patterns.designStyles.length,
      },
    });
  } catch (error) {
    console.error('[PATTERNS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get patterns', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/marketplace/patterns
 *
 * Trigger the learning engine to analyze patterns from stored data
 */
export async function POST() {
  try {
    const dbReady = await isDatabaseConfigured();
    if (!dbReady) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    console.log('[LEARNING] Triggering learning engine...');
    const startTime = Date.now();

    await runLearningEngine();

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: 'Learning engine completed',
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[LEARNING] Error:', error);
    return NextResponse.json(
      { error: 'Learning engine failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
