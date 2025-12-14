/**
 * POST /api/admin/trigger-collection
 *
 * Manual trigger for data collection - useful for testing.
 * Protected by CRON_SECRET in production.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  collectTrendData,
  collectMoonshotTrends,
  analyzeNicheTrends,
  cleanOldMarketData,
} from '@/lib/merch/data-collectors';
import {
  extractAllInsights,
  validateAllInsights,
  getInsightsSummary,
} from '@/lib/merch/learning';
import {
  runStyleMiner,
  getStyleMinerStatus,
} from '@/lib/style-intel/style-miner-service';

// Extended timeout for collection
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication - either CRON_SECRET or logged-in user
    const { userId } = await auth();
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    const isAuthorized =
      userId ||
      (cronSecret && authHeader === `Bearer ${cronSecret}`);

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'action is required (collect, moonshot, analyze, clean, learn, validate, insights, style-mine, style-mine-status)' },
        { status: 400 }
      );
    }

    console.log(`[Admin] Manual trigger: ${action}`);
    const startTime = Date.now();

    let result: any = {};

    switch (action) {
      case 'collect':
        // Collect proven and emerging trends
        const provenCount = await collectTrendData('proven');
        const emergingCount = await collectTrendData('emerging');
        result = {
          proven: provenCount,
          emerging: emergingCount,
        };
        break;

      case 'collect-proven':
        result = { proven: await collectTrendData('proven') };
        break;

      case 'collect-emerging':
        result = { emerging: await collectTrendData('emerging') };
        break;

      case 'moonshot':
        result = { moonshot: await collectMoonshotTrends() };
        break;

      case 'analyze':
        result = { nichesAnalyzed: await analyzeNicheTrends() };
        break;

      case 'clean':
        result = { cleaned: await cleanOldMarketData() };
        break;

      case 'full':
        // Run complete cycle
        const cleaned = await cleanOldMarketData();
        const proven = await collectTrendData('proven');
        const emerging = await collectTrendData('emerging');
        const moonshot = await collectMoonshotTrends();
        const analyzed = await analyzeNicheTrends();
        result = { cleaned, proven, emerging, moonshot, nichesAnalyzed: analyzed };
        break;

      case 'learn':
        // Phase 6: Extract insights from accumulated data
        const extraction = await extractAllInsights();
        result = {
          insightsCreated: extraction.insightsCreated,
          insightsUpdated: extraction.insightsUpdated,
          errors: extraction.errors,
        };
        break;

      case 'validate':
        // Phase 6: Validate existing insights
        const validation = await validateAllInsights();
        result = {
          validated: validation.validated,
          degraded: validation.degraded,
          invalidated: validation.invalidated,
          errors: validation.errors,
        };
        break;

      case 'insights':
        // Phase 6: Get insights summary
        result = await getInsightsSummary();
        break;

      case 'style-mine':
        // Style Miner: Mine design intelligence from configured URLs
        const passes = body.passes || 1;
        const group = body.group || 'all';
        const miningResult = await runStyleMiner(passes, group);
        result = {
          recipesUpserted: miningResult.totalRecipes,
          principlesUpserted: miningResult.totalPrinciples,
          errors: miningResult.totalErrors,
          duration: `${miningResult.duration}ms`,
          dbTotals: miningResult.dbTotals,
        };
        break;

      case 'style-mine-status':
        // Style Miner: Get database status
        result = await getStyleMinerStatus();
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    const duration = Date.now() - startTime;
    console.log(`[Admin] ${action} complete in ${duration}ms`);

    return NextResponse.json({
      success: true,
      action,
      result,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error('[Admin] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Operation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
