import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { isDatabaseConfigured } from '@/services/marketplaceLearning';

let prisma: PrismaClient | null = null;

const getPrisma = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
};

/**
 * GET /api/marketplace/niches
 *
 * Get all tracked niches with their market data
 *
 * Query params:
 * - sort?: 'opportunity' | 'products' | 'recent' (default: opportunity)
 * - limit?: number (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    const dbReady = await isDatabaseConfigured();
    if (!dbReady) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'opportunity';
    const limit = parseInt(searchParams.get('limit') || '20');

    const db = getPrisma();

    // Define sort order
    let orderBy: Record<string, 'desc' | 'asc'>;
    switch (sort) {
      case 'opportunity':
        orderBy = { opportunityScore: 'desc' };
        break;
      case 'products':
        orderBy = { totalProducts: 'desc' };
        break;
      case 'recent':
        orderBy = { lastAnalyzed: 'desc' };
        break;
      default:
        orderBy = { opportunityScore: 'desc' };
    }

    const niches = await db.nicheMarketData.findMany({
      orderBy,
      take: limit,
      select: {
        id: true,
        niche: true,
        totalProducts: true,
        amazonProducts: true,
        etsyProducts: true,
        saturationLevel: true,
        avgPrice: true,
        minPrice: true,
        maxPrice: true,
        avgReviewCount: true,
        avgRating: true,
        opportunityScore: true,
        effectiveKeywords: true,
        winningDesignStyles: true,
        detectedGaps: true,
        queryCount: true,
        lastAnalyzed: true,
        lastQueriedAt: true,
      },
    });

    // Get total count
    const totalCount = await db.nicheMarketData.count();

    return NextResponse.json({
      success: true,
      niches: niches.map(niche => ({
        ...niche,
        avgPrice: niche.avgPrice ? Number(niche.avgPrice) : null,
        minPrice: niche.minPrice ? Number(niche.minPrice) : null,
        maxPrice: niche.maxPrice ? Number(niche.maxPrice) : null,
        avgReviewCount: niche.avgReviewCount ? Number(niche.avgReviewCount) : null,
        avgRating: niche.avgRating ? Number(niche.avgRating) : null,
        opportunityScore: niche.opportunityScore ? Number(niche.opportunityScore) : null,
      })),
      total: totalCount,
      limit,
      sort,
    });
  } catch (error) {
    console.error('[NICHES] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get niches', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/marketplace/niches/[niche]
 *
 * Get detailed data for a specific niche
 */
export async function POST(request: NextRequest) {
  try {
    const dbReady = await isDatabaseConfigured();
    if (!dbReady) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { niche } = body;

    if (!niche) {
      return NextResponse.json(
        { error: 'Niche parameter required' },
        { status: 400 }
      );
    }

    const db = getPrisma();

    // Get niche data
    const nicheData = await db.nicheMarketData.findUnique({
      where: { niche: niche.toLowerCase() },
    });

    if (!nicheData) {
      return NextResponse.json(
        { error: 'Niche not found', niche },
        { status: 404 }
      );
    }

    // Get top products for this niche
    const topProducts = await db.marketplaceProduct.findMany({
      where: { niche: niche.toLowerCase() },
      orderBy: { reviewCount: 'desc' },
      take: 20,
      select: {
        id: true,
        source: true,
        title: true,
        price: true,
        reviewCount: true,
        avgRating: true,
        salesRank: true,
        url: true,
        imageUrl: true,
        designStyle: true,
        hasGiftKeyword: true,
        hasFunnyKeyword: true,
        lastScrapedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      niche: {
        ...nicheData,
        avgPrice: nicheData.avgPrice ? Number(nicheData.avgPrice) : null,
        minPrice: nicheData.minPrice ? Number(nicheData.minPrice) : null,
        maxPrice: nicheData.maxPrice ? Number(nicheData.maxPrice) : null,
        avgReviewCount: nicheData.avgReviewCount ? Number(nicheData.avgReviewCount) : null,
        avgRating: nicheData.avgRating ? Number(nicheData.avgRating) : null,
        opportunityScore: nicheData.opportunityScore ? Number(nicheData.opportunityScore) : null,
      },
      topProducts: topProducts.map(p => ({
        ...p,
        price: Number(p.price),
        avgRating: p.avgRating ? Number(p.avgRating) : null,
      })),
    });
  } catch (error) {
    console.error('[NICHES] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get niche data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
