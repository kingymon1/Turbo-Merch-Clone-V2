/**
 * GET /api/proven-niches/products
 *
 * Get products for a specific niche.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProductsForNiche, getTrackedNiche } from '@/lib/proven-niches';

/**
 * GET - List products for a niche
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const niche = searchParams.get('niche');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const sortBy = searchParams.get('sort') || 'bsr';

    if (!niche) {
      return NextResponse.json(
        { error: 'Missing required parameter: niche' },
        { status: 400 }
      );
    }

    // Check if niche exists
    const nicheData = await getTrackedNiche(niche);
    if (!nicheData) {
      return NextResponse.json(
        { error: 'Niche not found' },
        { status: 404 }
      );
    }

    // Get products
    let products = await getProductsForNiche(niche, Math.min(limit, 100));

    // Sort products
    switch (sortBy) {
      case 'bsr':
        products.sort((a, b) => (a.bsr || 999999999) - (b.bsr || 999999999));
        break;
      case 'reviews':
        products.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
      case 'price':
        products.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'rating':
        products.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
    }

    return NextResponse.json({
      success: true,
      data: {
        niche: nicheData,
        products,
        total: products.length,
      },
    });

  } catch (error) {
    console.error('[ProvenNiches] Products GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
