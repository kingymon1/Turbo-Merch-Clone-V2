/**
 * Test Script for Phase 7A: Marketplace Keywords Integration
 *
 * Run with: npx tsx scripts/test-marketplace-keywords.ts
 */

import {
  getOptimizedKeywordsForNiche,
  getQuickKeywordSuggestions,
  isDatabaseConfigured,
} from '../services/marketplaceLearning';

async function testMarketplaceKeywords() {
  console.log('=== Phase 7A: Marketplace Keywords Test ===\n');

  // Check database configuration
  const dbConfigured = await isDatabaseConfigured();
  console.log(`Database configured: ${dbConfigured}`);

  if (!dbConfigured) {
    console.log('\n⚠️  Database not configured. Set DATABASE_URL to test with real data.');
    console.log('The system will gracefully fall back when no marketplace data exists.\n');
    return;
  }

  // Test niche
  const testNiche = 'nurse gifts';
  console.log(`\nTesting niche: "${testNiche}"\n`);

  // Test quick keyword suggestions
  console.log('--- Quick Keyword Suggestions ---');
  const quickKeywords = await getQuickKeywordSuggestions(testNiche, 10);
  if (quickKeywords.length > 0) {
    console.log(`Found ${quickKeywords.length} keywords:`);
    quickKeywords.forEach((kw, i) => console.log(`  ${i + 1}. ${kw}`));
  } else {
    console.log('No keywords found for this niche.');
    console.log('Try running: POST /api/marketplace/scrape with {"niche": "nurse gifts"}');
  }

  // Test full optimized keywords
  console.log('\n--- Full Optimized Keywords ---');
  const optimized = await getOptimizedKeywordsForNiche(testNiche);

  if (optimized) {
    console.log(`Niche: ${optimized.niche}`);
    console.log(`Confidence: ${optimized.confidence}%`);
    console.log(`Saturation: ${optimized.saturation}`);
    console.log(`Entry Recommendation: ${optimized.entryRecommendation}`);
    console.log(`\nPrimary Keywords (${optimized.primaryKeywords.length}):`);
    optimized.primaryKeywords.slice(0, 5).forEach((kw, i) => console.log(`  ${i + 1}. ${kw}`));
    console.log(`\nLong-tail Phrases (${optimized.longTailPhrases.length}):`);
    optimized.longTailPhrases.slice(0, 3).forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    console.log(`\nMBA Insights:`);
    console.log(`  - Product count: ${optimized.mbaInsights.productCount}`);
    console.log(`  - Avg title length: ${optimized.mbaInsights.avgTitleLength}`);
    console.log(`  - Common tones: ${optimized.mbaInsights.commonTones.join(', ')}`);
  } else {
    console.log('No optimized keywords found.');
    console.log('\nTo populate data, run the scraper first:');
    console.log('  POST /api/marketplace/scrape with {"niche": "nurse gifts"}');
  }

  console.log('\n=== Test Complete ===');
}

testMarketplaceKeywords().catch(console.error);
