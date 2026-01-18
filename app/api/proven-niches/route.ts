/**
 * GET /api/proven-niches
 * POST /api/proven-niches
 *
 * List and manage tracked niches.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getTrackedNiches,
  upsertTrackedNiche,
  TrackedNicheData,
} from '@/lib/proven-niches';

/**
 * GET - List all tracked niches
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    const sortBy = searchParams.get('sort') || 'name';
    const order = searchParams.get('order') || 'asc';

    const niches = await getTrackedNiches(activeOnly);

    // Sort niches
    const sorted = [...niches].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'opportunityScore':
          comparison = (b.opportunityScore || 0) - (a.opportunityScore || 0);
          break;
        case 'competitionScore':
          comparison = (a.competitionScore || 0) - (b.competitionScore || 0);
          break;
        case 'productCount':
          comparison = b.productCount - a.productCount;
          break;
        case 'lastScannedAt':
          const aTime = a.lastScannedAt?.getTime() || 0;
          const bTime = b.lastScannedAt?.getTime() || 0;
          comparison = bTime - aTime;
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }

      return order === 'desc' ? -comparison : comparison;
    });

    return NextResponse.json({
      success: true,
      data: {
        niches: sorted,
        total: sorted.length,
        activeCount: sorted.filter((n) => n.isActive).length,
      },
    });

  } catch (error) {
    console.error('[ProvenNiches] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch niches' },
      { status: 500 }
    );
  }
}

/**
 * POST - Add or update a tracked niche
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.searchKeywords || !Array.isArray(body.searchKeywords)) {
      return NextResponse.json(
        { error: 'Missing required fields: name, searchKeywords' },
        { status: 400 }
      );
    }

    const nicheData: TrackedNicheData = {
      name: body.name.toLowerCase().replace(/\s+/g, '-'),
      displayName: body.displayName || body.name,
      searchKeywords: body.searchKeywords,
      description: body.description,
      productCount: 0,
      isActive: body.isActive !== false,
    };

    await upsertTrackedNiche(nicheData);

    return NextResponse.json({
      success: true,
      data: nicheData,
    });

  } catch (error) {
    console.error('[ProvenNiches] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create/update niche' },
      { status: 500 }
    );
  }
}
