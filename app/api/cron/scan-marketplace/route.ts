/**
 * GET /api/cron/scan-marketplace
 *
 * Daily cron job for scanning Amazon marketplace and identifying opportunities.
 * Called by Vercel Cron at 6 AM UTC daily.
 *
 * Add to vercel.json:
 * {
 *   "path": "/api/cron/scan-marketplace",
 *   "schedule": "0 6 * * *"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  runFullScan,
  checkProvenNichesHealth,
  initializeSeedNiches,
  CRON_CONFIG,
} from '@/lib/proven-niches';

// Allow long timeout for marketplace scanning
export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = CRON_CONFIG.secret;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[Cron:Marketplace] Unauthorized request');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if cron is enabled
    if (!CRON_CONFIG.enabled) {
      console.log('[Cron:Marketplace] Cron job disabled');
      return NextResponse.json({
        success: true,
        message: 'Cron job disabled',
        skipped: true,
      });
    }

    // Health check
    const health = await checkProvenNichesHealth();

    if (!health.configured) {
      console.log('[Cron:Marketplace] Decodo not configured, skipping');
      return NextResponse.json({
        success: false,
        error: 'Decodo API not configured',
        health,
      });
    }

    console.log('[Cron:Marketplace] Starting marketplace scan');

    // Initialize seed niches if none exist
    if (health.details.trackedNichesCount === 0) {
      console.log('[Cron:Marketplace] Initializing seed niches');
      await initializeSeedNiches();
    }

    // Run the full scan
    const result = await runFullScan({
      maxProductsPerNiche: CRON_CONFIG.maxProductsPerNiche,
    });

    const duration = Date.now() - startTime;

    console.log('[Cron:Marketplace] Scan complete', {
      nichesScanned: result.scanResult.nichesScanned,
      productsFound: result.scanResult.productsFound,
      productsStored: result.scanResult.productsStored,
      opportunitiesFound: result.opportunitiesFound,
      duration,
      errors: result.errors.length,
    });

    return NextResponse.json({
      success: result.success,
      data: {
        nichesScanned: result.scanResult.nichesScanned,
        productsFound: result.scanResult.productsFound,
        productsStored: result.scanResult.productsStored,
        opportunitiesFound: result.opportunitiesFound,
        duration: result.scanResult.duration,
        cronDuration: duration,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Cron:Marketplace] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Marketplace scan failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration,
      },
      { status: 500 }
    );
  }
}
