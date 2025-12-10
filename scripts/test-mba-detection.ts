/**
 * Test script for hybrid MBA detection
 *
 * Run with: npx tsx scripts/test-mba-detection.ts
 */

import {
  searchAmazon,
  searchAmazonWithMbaDetection,
  getAmazonProduct,
  isApiConfigured,
} from '../services/marketplaceIntelligence';

async function main() {
  console.log('='.repeat(60));
  console.log('MBA DETECTION TEST');
  console.log('='.repeat(60));

  // Check API config
  if (!isApiConfigured()) {
    console.log('\n❌ Decodo API not configured!');
    console.log('Set DECODO_USERNAME and DECODO_PASSWORD in .env');
    process.exit(1);
  }
  console.log('\n✓ Decodo API configured');

  const testNiche = 'nurse shirt funny';
  console.log(`\nTest niche: "${testNiche}"`);

  // Step 1: Regular search (no MBA detection)
  console.log('\n' + '-'.repeat(60));
  console.log('STEP 1: Regular Amazon search (no MBA detection)');
  console.log('-'.repeat(60));

  const regularResult = await searchAmazon(testNiche);
  console.log(`\nProducts found: ${regularResult.products.length}`);

  if (regularResult.products.length > 0) {
    console.log('\nSample product from search:');
    const sample = regularResult.products[0];
    console.log(`  ASIN: ${sample.asin}`);
    console.log(`  Title: ${sample.title?.slice(0, 60)}...`);
    console.log(`  Seller: "${sample.seller || 'N/A'}"`);
    console.log(`  Reviews: ${sample.reviewCount}`);
    console.log(`  MBA (from search): ${sample.isMerchByAmazon || false}`);
  }

  // Step 2: Fetch product details for one ASIN
  console.log('\n' + '-'.repeat(60));
  console.log('STEP 2: Fetch product details (MBA tag should appear here)');
  console.log('-'.repeat(60));

  if (regularResult.products.length > 0 && regularResult.products[0].asin) {
    const testAsin = regularResult.products[0].asin;
    console.log(`\nFetching details for ASIN: ${testAsin}`);

    const productDetails = await getAmazonProduct(testAsin);

    if (productDetails) {
      console.log('\nProduct details:');
      console.log(`  ASIN: ${productDetails.asin}`);
      console.log(`  Title: ${productDetails.title?.slice(0, 60)}...`);
      console.log(`  Seller: "${productDetails.seller}"`);
      console.log(`  MBA detected: ${productDetails.isMerchByAmazon}`);
    } else {
      console.log('❌ Failed to fetch product details');
    }
  }

  // Step 3: Hybrid search with MBA detection
  console.log('\n' + '-'.repeat(60));
  console.log('STEP 3: Hybrid search with MBA detection (5 products)');
  console.log('-'.repeat(60));

  const hybridResult = await searchAmazonWithMbaDetection(testNiche, {
    mbaSampleSize: 5,
  });

  console.log(`\nProducts found: ${hybridResult.products.length}`);
  console.log(`MBA checked: ${hybridResult.mbaStats.checked}`);
  console.log(`MBA found: ${hybridResult.mbaStats.found}`);

  // Count MBA products in results
  const mbaProducts = hybridResult.products.filter(p => p.isMerchByAmazon);
  console.log(`\nMBA products in results: ${mbaProducts.length}`);

  if (mbaProducts.length > 0) {
    console.log('\nMBA products detected:');
    mbaProducts.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.title?.slice(0, 50)}... (${p.asin})`);
    });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total products: ${hybridResult.products.length}`);
  console.log(`MBA products detected: ${mbaProducts.length}/${hybridResult.mbaStats.checked} checked`);
  console.log(`Detection rate: ${hybridResult.mbaStats.checked > 0
    ? Math.round((hybridResult.mbaStats.found / hybridResult.mbaStats.checked) * 100)
    : 0}%`);

  if (hybridResult.mbaStats.found > 0) {
    console.log('\n✓ MBA detection is working!');
  } else {
    console.log('\n⚠ No MBA products detected in sample.');
    console.log('  This could mean:');
    console.log('  - The sampled products are not MBA');
    console.log('  - The API response format changed');
    console.log('  - Check the logs above for seller field values');
  }
}

main().catch(console.error);
