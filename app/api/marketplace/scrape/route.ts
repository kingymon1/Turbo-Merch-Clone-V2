import { NextRequest, NextResponse } from 'next/server';
import { searchAmazon, searchEtsy, isApiConfigured } from '@/services/marketplaceIntelligence';
import { storeMarketplaceProduct, updateNicheMarketData, isDatabaseConfigured } from '@/services/marketplaceLearning';

// Increase timeout for scraping
export const maxDuration = 120;

/**
 * POST /api/marketplace/scrape
 *
 * Trigger marketplace scraping for t-shirt designs
 *
 * Body:
 * - niche?: string - Specific niche to scrape (default: best sellers)
 * - sources?: ('amazon' | 'etsy')[] - Which marketplaces (default: both)
 * - limit?: number - Max products per source (default: 50)
 */
export async function POST(request: NextRequest) {
  try {
    // Check if API is configured
    if (!isApiConfigured()) {
      return NextResponse.json(
        { error: 'Decodo API not configured', details: 'Set DECODO_USERNAME and DECODO_PASSWORD' },
        { status: 503 }
      );
    }

    // Check if database is configured
    const dbReady = await isDatabaseConfigured();
    if (!dbReady) {
      return NextResponse.json(
        { error: 'Database not configured', details: 'DATABASE_URL required for learning engine' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      niche = 'graphic tshirt best seller',
      sources = ['amazon', 'etsy'],
      limit = 50,
    } = body;

    console.log(`[SCRAPE] Starting scrape for "${niche}" from ${sources.join(', ')}`);

    const results = {
      niche,
      amazon: { success: false, count: 0, error: null as string | null },
      etsy: { success: false, count: 0, error: null as string | null },
      stored: 0,
      timestamp: new Date().toISOString(),
    };

    // Scrape Amazon
    if (sources.includes('amazon')) {
      try {
        const amazonResult = await searchAmazon(niche, limit);
        if (amazonResult.success && amazonResult.products.length > 0) {
          results.amazon.success = true;
          results.amazon.count = amazonResult.products.length;

          // Store products for learning
          for (const product of amazonResult.products) {
            await storeMarketplaceProduct({
              source: 'amazon',
              externalId: product.asin || product.id,
              title: product.title,
              price: product.price,
              url: product.url,
              reviewCount: product.reviewCount,
              avgRating: product.avgRating,
              salesRank: product.salesRank,
              category: product.category,
              seller: product.seller,
              imageUrl: product.imageUrl,
              niche: niche,
            });
            results.stored++;
          }
        } else {
          results.amazon.error = amazonResult.error || 'No products found';
        }
      } catch (error) {
        results.amazon.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Scrape Etsy
    if (sources.includes('etsy')) {
      try {
        const etsyResult = await searchEtsy(niche, limit);
        if (etsyResult.success && etsyResult.products.length > 0) {
          results.etsy.success = true;
          results.etsy.count = etsyResult.products.length;

          // Store products for learning
          for (const product of etsyResult.products) {
            await storeMarketplaceProduct({
              source: 'etsy',
              externalId: product.id,
              title: product.title,
              price: product.price,
              url: product.url,
              reviewCount: product.reviewCount,
              avgRating: product.avgRating,
              seller: product.seller,
              imageUrl: product.imageUrl,
              niche: niche,
            });
            results.stored++;
          }
        } else {
          results.etsy.error = etsyResult.error || 'No products found';
        }
      } catch (error) {
        results.etsy.error = error instanceof Error ? error.message : 'Unknown error';
      }
    }

    // Update niche aggregate data
    if (results.stored > 0) {
      await updateNicheMarketData(niche);
    }

    console.log(`[SCRAPE] Complete: ${results.stored} products stored`);

    return NextResponse.json({
      success: results.stored > 0,
      results,
    });
  } catch (error) {
    console.error('[SCRAPE] Error:', error);
    return NextResponse.json(
      { error: 'Scrape failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/marketplace/scrape
 *
 * Get scraping status and configuration
 */
export async function GET() {
  const apiConfigured = isApiConfigured();
  const dbConfigured = await isDatabaseConfigured();

  return NextResponse.json({
    status: apiConfigured && dbConfigured ? 'ready' : 'not_configured',
    decodoApi: apiConfigured ? 'configured' : 'missing DECODO_USERNAME/DECODO_PASSWORD',
    database: dbConfigured ? 'connected' : 'missing DATABASE_URL',
    suggestedNiches: [
      'graphic tshirt best seller',
      'funny t shirt',
      'vintage t shirt',
      'dad shirt',
      'nurse shirt',
      'fishing shirt',
      'dog lover shirt',
      'coffee shirt',
    ],
  });
}
