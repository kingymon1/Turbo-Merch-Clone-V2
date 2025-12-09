/**
 * Admin Insights API
 *
 * Provides CRUD operations for ProvenInsights.
 * GET - List all insights with filtering
 * POST - Manually create an insight
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/insights
 *
 * List all insights with optional filters:
 * - type: Filter by insightType
 * - category: Filter by category
 * - niche: Filter by niche
 * - relevant: Filter by stillRelevant (true/false)
 * - minConfidence: Minimum confidence threshold
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const niche = searchParams.get('niche');
    const relevant = searchParams.get('relevant');
    const minConfidence = searchParams.get('minConfidence');

    // Build where clause
    const where: any = {};

    if (type) where.insightType = type;
    if (category) where.category = category;
    if (niche) where.niche = niche;
    if (relevant !== null) where.stillRelevant = relevant === 'true';
    if (minConfidence) where.confidence = { gte: parseFloat(minConfidence) };

    const insights = await prisma.provenInsight.findMany({
      where,
      orderBy: [
        { stillRelevant: 'desc' },
        { confidence: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Get summary stats
    const stats = {
      total: insights.length,
      byType: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
      avgConfidence: 0,
      relevant: 0,
    };

    let confidenceSum = 0;
    for (const insight of insights) {
      stats.byType[insight.insightType] = (stats.byType[insight.insightType] || 0) + 1;
      stats.byCategory[insight.category] = (stats.byCategory[insight.category] || 0) + 1;
      confidenceSum += insight.confidence;
      if (insight.stillRelevant) stats.relevant++;
    }
    stats.avgConfidence = insights.length > 0 ? confidenceSum / insights.length : 0;

    return NextResponse.json({
      success: true,
      insights,
      stats,
    });
  } catch (error) {
    console.error('[Admin Insights] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch insights',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/insights
 *
 * Manually create a new insight
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      insightType,
      category,
      title,
      description,
      pattern,
      sampleSize,
      confidence,
      successRate,
      niche,
      niches,
      timeframe,
      riskLevel,
    } = body;

    // Validate required fields
    if (!insightType || !category || !title || !description || !pattern) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: insightType, category, title, description, pattern',
        },
        { status: 400 }
      );
    }

    const insight = await prisma.provenInsight.create({
      data: {
        insightType,
        category,
        title,
        description,
        pattern,
        sampleSize: sampleSize || 1,
        confidence: confidence || 0.8,
        successRate,
        niche,
        niches: niches || [],
        timeframe,
        riskLevel,
        sourceDataIds: [],
      },
    });

    console.log(`[Admin Insights] Created insight: ${insight.id}`);

    return NextResponse.json({
      success: true,
      insight,
    });
  } catch (error) {
    console.error('[Admin Insights] Error creating insight:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create insight',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
