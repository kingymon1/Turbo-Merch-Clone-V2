/**
 * GET /api/proven-niches/opportunities
 *
 * Get identified market opportunities.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOpportunities, updateOpportunityStatus } from '@/lib/proven-niches';

/**
 * GET - List opportunities
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const niche = searchParams.get('niche') || undefined;
    const activeOnly = searchParams.get('active') !== 'false';
    const minScore = parseFloat(searchParams.get('minScore') || '0');

    let opportunities = await getOpportunities(niche, activeOnly);

    // Filter by minimum score
    if (minScore > 0) {
      opportunities = opportunities.filter((o) => o.opportunityScore >= minScore);
    }

    // Sort by opportunity score descending
    opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);

    return NextResponse.json({
      success: true,
      data: {
        opportunities,
        total: opportunities.length,
      },
    });

  } catch (error) {
    console.error('[ProvenNiches] Opportunities GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch opportunities' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update opportunity status
 */
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    if (!body.opportunityId || !body.status) {
      return NextResponse.json(
        { error: 'Missing required fields: opportunityId, status' },
        { status: 400 }
      );
    }

    const validStatuses = ['active', 'pursued', 'expired', 'dismissed'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    await updateOpportunityStatus(body.opportunityId, body.status);

    return NextResponse.json({
      success: true,
      data: {
        opportunityId: body.opportunityId,
        status: body.status,
      },
    });

  } catch (error) {
    console.error('[ProvenNiches] Opportunities PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update opportunity' },
      { status: 500 }
    );
  }
}
