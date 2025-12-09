/**
 * POST /api/cron/learn-and-extract
 *
 * Weekly cron job that runs the learning system:
 * 1. Extracts new insights from accumulated data
 * 2. Validates existing insights
 * 3. Updates confidence scores
 * 4. Generates summary of discoveries
 *
 * Runs weekly via Vercel cron (Sunday 4am UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  extractAllInsights,
  validateAllInsights,
  getInsightsSummary,
  getValidationStatus,
} from '@/lib/merch/learning';

// Extended timeout for learning job (can take a while)
export const maxDuration = 300;

interface LearningSummary {
  extraction: {
    insightsCreated: number;
    insightsUpdated: number;
    candidatesAnalyzed: number;
    errors: string[];
  };
  validation: {
    validated: number;
    degraded: number;
    invalidated: number;
    errors: string[];
  };
  summary: {
    total: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
    highConfidence: number;
    recentlyValidated: number;
  };
  duration: string;
}

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

    console.log('[Cron] Starting weekly learning cycle');
    const startTime = Date.now();

    // Step 1: Extract new insights from accumulated data
    console.log('[Cron] Step 1: Extracting insights...');
    const extractionResult = await extractAllInsights();
    console.log(`[Cron] Extraction complete: ${extractionResult.insightsCreated} created, ${extractionResult.insightsUpdated} updated`);

    // Step 2: Validate existing insights
    console.log('[Cron] Step 2: Validating insights...');
    const validationResult = await validateAllInsights();
    console.log(`[Cron] Validation complete: ${validationResult.validated} validated, ${validationResult.degraded} degraded, ${validationResult.invalidated} invalidated`);

    // Step 3: Get summary stats
    console.log('[Cron] Step 3: Generating summary...');
    const summary = await getInsightsSummary();

    const duration = Date.now() - startTime;
    console.log(`[Cron] Learning cycle complete in ${duration}ms`);

    const learningSummary: LearningSummary = {
      extraction: extractionResult,
      validation: validationResult,
      summary,
      duration: `${duration}ms`,
    };

    // Log notable discoveries
    if (extractionResult.insightsCreated > 0) {
      console.log(`[Cron] 🎉 New insights discovered: ${extractionResult.insightsCreated}`);
    }
    if (validationResult.invalidated > 0) {
      console.log(`[Cron] ⚠️ Insights invalidated: ${validationResult.invalidated}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Learning cycle complete',
      ...learningSummary,
    });
  } catch (error) {
    console.error('[Cron] Error during learning:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Learning cycle failed',
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
