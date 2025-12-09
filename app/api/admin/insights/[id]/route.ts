/**
 * Admin Insights API - Single Insight Operations
 *
 * GET /api/admin/insights/[id] - View specific insight
 * PATCH /api/admin/insights/[id] - Update insight
 * DELETE /api/admin/insights/[id] - Remove insight
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/insights/[id]
 *
 * Get a specific insight by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const insight = await prisma.provenInsight.findUnique({
      where: { id },
    });

    if (!insight) {
      return NextResponse.json(
        { success: false, error: 'Insight not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      insight,
    });
  } catch (error) {
    console.error('[Admin Insights] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch insight',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/insights/[id]
 *
 * Update an existing insight
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Remove fields that shouldn't be updated directly
    const { id: _, createdAt, ...updateData } = body;

    const insight = await prisma.provenInsight.update({
      where: { id },
      data: updateData,
    });

    console.log(`[Admin Insights] Updated insight: ${id}`);

    return NextResponse.json({
      success: true,
      insight,
    });
  } catch (error) {
    console.error('[Admin Insights] Error updating insight:', error);

    // Check if insight not found
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Insight not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update insight',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/insights/[id]
 *
 * Delete an insight
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    await prisma.provenInsight.delete({
      where: { id },
    });

    console.log(`[Admin Insights] Deleted insight: ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Insight deleted',
    });
  } catch (error) {
    console.error('[Admin Insights] Error deleting insight:', error);

    // Check if insight not found
    if ((error as any)?.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Insight not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete insight',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
