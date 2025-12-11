/**
 * POST /api/cron/cross-niche-scan
 *
 * Cron job endpoint for scanning niches and detecting cross-niche opportunities.
 * Uses AI to identify potential niche combinations, then validates against Amazon.
 *
 * Recommended schedule: Every 24-48 hours
 *
 * Cross-niche opportunities (e.g., "fishing + coffee", "nurse + dog mom") often
 * represent untapped markets with high passion and low competition.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getNichesForCrossNicheScanning,
  scanNichesForOpportunities
} from '@/lib/merch/cross-niche-engine';

// Extended timeout for cross-niche scanning
export const maxDuration = 600;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[CrossNicheScan] CRON_SECRET not configured');
      return NextResponse.json(
        { success: false, error: 'Cron not configured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[CrossNicheScan] Invalid authorization');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[CrossNicheScan] Starting cross-niche opportunity scan');
    const startTime = Date.now();

    // Parse request body for optional configuration
    let config = {
      maxNiches: 5,              // Maximum niches to scan per run
      maxOpportunitiesPerNiche: 3,  // Opportunities per niche
      minMbaProducts: 10,        // Minimum MBA products to consider a niche
      recentHours: 168,          // Skip niches scanned within this window
      specificNiches: [] as string[]  // If provided, only scan these
    };

    try {
      const body = await request.json();
      config = { ...config, ...body };
    } catch {
      // Use defaults if no body
    }

    // Step 1: Get niches to scan
    let nichesToScan: string[];

    if (config.specificNiches.length > 0) {
      nichesToScan = config.specificNiches;
      console.log(`[CrossNicheScan] Scanning ${nichesToScan.length} specified niches`);
    } else {
      nichesToScan = await getNichesForCrossNicheScanning({
        minMbaProducts: config.minMbaProducts,
        excludeRecentlyScanned: true,
        recentHours: config.recentHours,
        limit: config.maxNiches
      });
      console.log(`[CrossNicheScan] Found ${nichesToScan.length} niches to scan`);
    }

    if (nichesToScan.length === 0) {
      console.log('[CrossNicheScan] No niches need scanning at this time');
      return NextResponse.json({
        success: true,
        message: 'No niches need cross-niche scanning',
        stats: {
          processedCount: 0,
          duration: `${Date.now() - startTime}ms`
        }
      });
    }

    // Step 2: Scan niches for opportunities
    console.log(`[CrossNicheScan] Scanning niches: ${nichesToScan.join(', ')}`);

    const results = await scanNichesForOpportunities(nichesToScan, {
      maxOpportunitiesPerNiche: config.maxOpportunitiesPerNiche,
      concurrency: 2  // Conservative to avoid rate limits
    });

    // Step 3: Summarize results
    let totalOpportunities = 0;
    let strongEnterCount = 0;
    let enterCount = 0;
    let cautionCount = 0;
    let avoidCount = 0;

    const nicheSummary: Array<{
      niche: string;
      opportunitiesFound: number;
      topOpportunity?: {
        combination: string;
        score: number;
        recommendation: string;
      };
    }> = [];

    for (const [niche, opportunities] of results) {
      totalOpportunities += opportunities.length;

      for (const opp of opportunities) {
        switch (opp.recommendation) {
          case 'strong_enter': strongEnterCount++; break;
          case 'enter': enterCount++; break;
          case 'caution': cautionCount++; break;
          case 'avoid': avoidCount++; break;
        }
      }

      const topOpp = opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore)[0];

      nicheSummary.push({
        niche,
        opportunitiesFound: opportunities.length,
        topOpportunity: topOpp ? {
          combination: `${topOpp.primaryNiche} + ${topOpp.secondaryNiche}`,
          score: topOpp.opportunityScore,
          recommendation: topOpp.recommendation
        } : undefined
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[CrossNicheScan] Completed in ${duration}ms: ${totalOpportunities} opportunities found`);

    return NextResponse.json({
      success: true,
      message: 'Cross-niche scan complete',
      stats: {
        nichesScanned: nichesToScan.length,
        totalOpportunities,
        byRecommendation: {
          strong_enter: strongEnterCount,
          enter: enterCount,
          caution: cautionCount,
          avoid: avoidCount
        },
        duration: `${duration}ms`,
        niches: nicheSummary
      }
    });

  } catch (error) {
    console.error('[CrossNicheScan] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Cross-niche scan failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Support GET for Vercel cron
export async function GET(request: NextRequest): Promise<NextResponse> {
  return POST(request);
}
