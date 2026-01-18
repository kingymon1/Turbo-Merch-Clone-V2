/**
 * Proven Niches Pipeline - Product Scraper
 *
 * Scrapes Amazon products for tracked niches and stores results.
 */

import { getAmazonClient } from '../client/amazon-client';
import {
  AmazonProductData,
  TrackedNicheData,
  ScanOptions,
  ScanResult,
} from '../types';
import { SCRAPE_CONFIG, SEED_NICHES, log, logError, logWarn } from '../config';
import {
  storeProducts,
  updateNicheMetrics,
  getTrackedNiches,
  upsertTrackedNiche,
} from '../storage/niche-store';

// =============================================================================
// MAIN SCRAPING FUNCTION
// =============================================================================

/**
 * Scan niches and scrape products from Amazon
 */
export async function scanNiches(options?: ScanOptions): Promise<ScanResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  let nichesScanned = 0;
  let productsFound = 0;
  let productsStored = 0;

  const client = getAmazonClient();

  if (!client.isConfigured()) {
    return {
      success: false,
      nichesScanned: 0,
      productsFound: 0,
      productsStored: 0,
      opportunitiesFound: 0,
      errors: ['Decodo API not configured'],
      duration: Date.now() - startTime,
    };
  }

  try {
    // Get niches to scan
    let niches: TrackedNicheData[];

    if (options?.niches && options.niches.length > 0) {
      // Scan specific niches
      const allNiches = await getTrackedNiches();
      niches = allNiches.filter((n) => options.niches!.includes(n.name));
    } else {
      // Scan all active niches
      niches = await getTrackedNiches(true);
    }

    // If no niches exist, initialize from seeds
    if (niches.length === 0) {
      log('No tracked niches found, initializing from seeds...');
      await initializeSeedNiches();
      niches = await getTrackedNiches(true);
    }

    log(`Starting scan of ${niches.length} niches`);

    // Scan each niche
    for (const niche of niches) {
      try {
        const result = await scrapeNiche(niche, options);

        nichesScanned++;
        productsFound += result.productsFound;
        productsStored += result.productsStored;

        if (result.error) {
          errors.push(`${niche.name}: ${result.error}`);
        }

        // Rate limiting between niches
        if (nichesScanned < niches.length) {
          await sleep(SCRAPE_CONFIG.delayBetweenRequests);
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${niche.name}: ${message}`);
        logError(`Failed to scan niche ${niche.name}`, error);
      }
    }

    const duration = Date.now() - startTime;
    log(`Scan complete: ${nichesScanned} niches, ${productsFound} products found, ${productsStored} stored in ${duration}ms`);

    return {
      success: errors.length < niches.length,
      nichesScanned,
      productsFound,
      productsStored,
      opportunitiesFound: 0, // Calculated separately
      errors,
      duration,
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('Scan failed', error);
    return {
      success: false,
      nichesScanned,
      productsFound,
      productsStored,
      opportunitiesFound: 0,
      errors: [...errors, message],
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Scrape products for a single niche
 */
async function scrapeNiche(
  niche: TrackedNicheData,
  options?: ScanOptions
): Promise<{ productsFound: number; productsStored: number; error?: string }> {
  const client = getAmazonClient();
  const maxProducts = options?.maxProductsPerNiche || SCRAPE_CONFIG.maxProductsPerNiche;

  log(`Scanning niche: ${niche.name} with ${niche.searchKeywords.length} keywords`);

  // Search using all keywords for the niche
  const result = await client.searchMultipleKeywords(niche.searchKeywords, {
    maxResultsPerKeyword: Math.ceil(maxProducts / niche.searchKeywords.length),
    dedupeByAsin: true,
  });

  if (!result.success) {
    return {
      productsFound: 0,
      productsStored: 0,
      error: result.error,
    };
  }

  const products = result.products.slice(0, maxProducts);

  // Filter out products with BSR too high
  const validProducts = products.filter(
    (p) => !p.bsr || p.bsr <= SCRAPE_CONFIG.maxBsr
  );

  if (validProducts.length === 0) {
    logWarn(`No valid products found for ${niche.name}`);
    return {
      productsFound: products.length,
      productsStored: 0,
      error: 'No products with valid BSR',
    };
  }

  // Store products in database
  const storedCount = await storeProducts(validProducts, niche.name);

  // Update niche metrics based on scraped products
  await updateNicheMetrics(niche.name, validProducts);

  log(`Stored ${storedCount} products for ${niche.name}`);

  return {
    productsFound: products.length,
    productsStored: storedCount,
  };
}

/**
 * Initialize tracked niches from seed data
 */
export async function initializeSeedNiches(): Promise<void> {
  log(`Initializing ${SEED_NICHES.length} seed niches`);

  for (const seed of SEED_NICHES) {
    await upsertTrackedNiche({
      name: seed.name,
      displayName: seed.displayName,
      searchKeywords: seed.searchKeywords,
      description: `Seed niche: ${seed.category}`,
      productCount: 0,
      isActive: true,
    });
  }

  log('Seed niches initialized');
}

/**
 * Scrape a single keyword (for testing or on-demand)
 */
export async function scrapeKeyword(
  keyword: string,
  maxResults?: number
): Promise<AmazonProductData[]> {
  const client = getAmazonClient();

  if (!client.isConfigured()) {
    throw new Error('Decodo API not configured');
  }

  const result = await client.searchProducts(keyword, {
    maxResults: maxResults || SCRAPE_CONFIG.maxProductsPerSearch,
  });

  if (!result.success) {
    throw new Error(result.error || 'Search failed');
  }

  return result.products;
}

// =============================================================================
// HELPERS
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
