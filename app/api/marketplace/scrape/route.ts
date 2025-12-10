import { NextRequest, NextResponse } from 'next/server';
import {
  searchAmazonWithMbaDetection,
  searchEtsy,
  isApiConfigured,
  enhanceProductWithAnalysis,
} from '@/services/marketplaceIntelligence';
import { storeMarketplaceProduct, updateNicheMarketData, isDatabaseConfigured } from '@/services/marketplaceLearning';

// Increase timeout for scraping (MBA detection adds ~10-15s for product detail fetches)
export const maxDuration = 180;

/**
 * POST /api/marketplace/scrape
 *
 * Trigger marketplace scraping for t-shirt designs with hybrid MBA detection.
 *
 * The scraper uses a two-step approach for reliable MBA detection:
 * 1. Search Amazon for products (gets ASINs)
 * 2. Fetch product details for a sample to detect "Amazon Merch on Demand" tag
 *
 * Body:
 * - niche?: string - Specific niche to scrape (default: best sellers)
 * - sources?: ('amazon' | 'etsy')[] - Which marketplaces (default: both)
 * - limit?: number - Max products per source (default: 50)
 * - mbaSampleSize?: number - How many products to check for MBA (default: 5)
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
      mbaSampleSize = 5, // How many products to fetch details for MBA detection
    } = body;

    console.log(`[SCRAPE] Starting scrape for "${niche}" from ${sources.join(', ')}`);
    console.log(`[SCRAPE] MBA detection: will check ${mbaSampleSize} products via product detail fetch`);

    const results = {
      niche,
      amazon: {
        success: false,
        count: 0,
        mbaCount: 0,
        mbaChecked: 0,
        error: null as string | null,
      },
      etsy: { success: false, count: 0, error: null as string | null },
      stored: 0,
      mbaDetected: 0,
      timestamp: new Date().toISOString(),
    };

    // Scrape Amazon with hybrid MBA detection
    if (sources.includes('amazon')) {
      try {
        // Use hybrid search that fetches product details for MBA detection
        const amazonResult = await searchAmazonWithMbaDetection(niche, {
          mbaSampleSize,
        });

        if (amazonResult.success && amazonResult.products.length > 0) {
          results.amazon.success = true;
          results.amazon.count = amazonResult.products.length;
          results.amazon.mbaChecked = amazonResult.mbaStats.checked;

          console.log(`[SCRAPE] Amazon search returned ${amazonResult.products.length} products`);
          console.log(`[SCRAPE] MBA detection: ${amazonResult.mbaStats.found}/${amazonResult.mbaStats.checked} products are MBA`);

          // Store products for learning (enhanced with MBA detection and keyword analysis)
          for (const product of amazonResult.products) {
            const enhanced = enhanceProductWithAnalysis(product);

            // Track MBA products (from hybrid detection)
            if (enhanced.isMerchByAmazon) {
              results.amazon.mbaCount++;
              results.mbaDetected++;
            }

            await storeMarketplaceProduct({
              source: 'amazon',
              externalId: enhanced.asin || enhanced.id,
              title: enhanced.title,
              price: enhanced.price,
              url: enhanced.url,
              reviewCount: enhanced.reviewCount,
              avgRating: enhanced.avgRating,
              salesRank: enhanced.salesRank,
              category: enhanced.category,
              seller: enhanced.seller,
              imageUrl: enhanced.imageUrl,
              niche: niche,
              // Enhanced fields for MBA analysis
              isMerchByAmazon: enhanced.isMerchByAmazon,
              titleCharCount: enhanced.titleCharCount,
              primaryKeywords: enhanced.primaryKeywords,
              keywordRepetitions: enhanced.keywordRepetitions,
              designTextInTitle: enhanced.designTextInTitle,
              brandStyle: enhanced.brandStyle,
              brandName: enhanced.brandName,
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

          // Store products for learning (enhanced with keyword analysis)
          for (const product of etsyResult.products) {
            const enhanced = enhanceProductWithAnalysis(product);
            await storeMarketplaceProduct({
              source: 'etsy',
              externalId: enhanced.id,
              title: enhanced.title,
              price: enhanced.price,
              url: enhanced.url,
              reviewCount: enhanced.reviewCount,
              avgRating: enhanced.avgRating,
              seller: enhanced.seller,
              imageUrl: enhanced.imageUrl,
              niche: niche,
              // Enhanced fields
              titleCharCount: enhanced.titleCharCount,
              primaryKeywords: enhanced.primaryKeywords,
              keywordRepetitions: enhanced.keywordRepetitions,
              designTextInTitle: enhanced.designTextInTitle,
              brandStyle: enhanced.brandStyle,
              brandName: enhanced.brandName,
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

    console.log(`[SCRAPE] Complete: ${results.stored} products stored, ${results.mbaDetected} MBA products detected`);

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
