/**
 * POST /api/proven-niches/scan
 * GET /api/proven-niches/scan
 *
 * Trigger marketplace scan and get scan status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  runFullScan,
  checkProvenNichesHealth,
  initializeSeedNiches,
} from '@/lib/proven-niches';

// Allow longer timeout for scanning
export const maxDuration = 300; // 5 minutes

interface ScanRequest {
  niches?: string[];
  maxProductsPerNiche?: number;
  initializeSeeds?: boolean;
}

/**
 * POST - Trigger a marketplace scan
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ScanRequest = await request.json().catch(() => ({}));

    // Health check first
    const health = await checkProvenNichesHealth();
    if (!health.configured) {
      return NextResponse.json(
        {
          success: false,
          error: 'Decodo API not configured',
          details: 'Set DECODO_USERNAME and DECODO_PASSWORD environment variables',
        },
        { status: 503 }
      );
    }

    // Initialize seed niches if requested or if none exist
    if (body.initializeSeeds || health.details.trackedNichesCount === 0) {
      await initializeSeedNiches();
    }

    // Run the full scan
    const result = await runFullScan({
      niches: body.niches,
      maxProductsPerNiche: body.maxProductsPerNiche,
    });

    return NextResponse.json({
      success: result.success,
      data: {
        nichesScanned: result.scanResult.nichesScanned,
        productsFound: result.scanResult.productsFound,
        productsStored: result.scanResult.productsStored,
        opportunitiesFound: result.opportunitiesFound,
        duration: result.scanResult.duration,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });

  } catch (error) {
    console.error('[ProvenNiches] Scan error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Scan failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get scan configuration and status
 */
export async function GET() {
  try {
    const health = await checkProvenNichesHealth();

    return NextResponse.json({
      status: health.working ? 'ready' : 'not_configured',
      health,
      config: {
        defaultMaxProductsPerNiche: 100,
        scanFrequencies: ['daily', 'weekly', 'manual'],
        seedNichesAvailable: health.details.seedNichesCount,
      },
    });

  } catch (error) {
    console.error('[ProvenNiches] Scan status error:', error);
    return NextResponse.json(
      { error: 'Failed to get scan status' },
      { status: 500 }
    );
  }
}
