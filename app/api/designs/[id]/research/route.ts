import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { fetchResearchData, researchDataExists } from '@/lib/r2-storage';

/**
 * GET /api/designs/{id}/research
 * Fetches research data for a design (used for creating variations)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: designId } = await params;

    // Find user
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await prisma.user.findUnique({ where: { clerkId: userId } });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify design belongs to user
    const design = await prisma.designHistory.findFirst({
      where: {
        id: designId,
        userId: user.id,
        deletedAt: null,
      },
      select: {
        id: true,
        runConfig: true, // Fallback to DB if R2 doesn't have it
      },
    });

    if (!design) {
      return NextResponse.json({ error: 'Design not found' }, { status: 404 });
    }

    // Try to fetch from R2 first
    console.log(`[Research API] Fetching research data for design ${designId}`);
    const researchData = await fetchResearchData(user.id, designId);

    if (researchData) {
      console.log(`[Research API] Found research data in R2`);
      return NextResponse.json({
        source: 'r2',
        data: researchData,
      });
    }

    // Fallback to database runConfig
    if (design.runConfig) {
      console.log(`[Research API] Using runConfig from database as fallback`);
      return NextResponse.json({
        source: 'database',
        data: design.runConfig,
      });
    }

    return NextResponse.json(
      { error: 'No research data available for this design' },
      { status: 404 }
    );
  } catch (error: any) {
    console.error('[Research API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch research data',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
