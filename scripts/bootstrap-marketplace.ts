#!/usr/bin/env npx tsx
/**
 * CLI Script: Bootstrap Marketplace Database
 *
 * Run from console:
 *   npx tsx scripts/bootstrap-marketplace.ts
 *   npx tsx scripts/bootstrap-marketplace.ts --quick
 *   npx tsx scripts/bootstrap-marketplace.ts --status
 *
 * Or with npm script:
 *   npm run bootstrap:marketplace
 *   npm run bootstrap:marketplace:quick
 */

import {
  bootstrapMarketplace,
  bootstrapQuick,
  getBootstrapStatus,
  CORE_MBA_NICHES,
  BootstrapProgress,
} from '../services/marketplaceBootstrap';

// Parse command line arguments
const args = process.argv.slice(2);
const isQuick = args.includes('--quick') || args.includes('-q');
const isStatus = args.includes('--status') || args.includes('-s');
const isHelp = args.includes('--help') || args.includes('-h');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg: string) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
};

function showHelp() {
  console.log(`
${colors.bright}Marketplace Bootstrap CLI${colors.reset}

Seeds the marketplace database with Amazon MBA product data so that
getOptimizedKeywordsForNiche() returns useful keywords with 30-40% confidence.

${colors.bright}Usage:${colors.reset}
  npx tsx scripts/bootstrap-marketplace.ts [options]

${colors.bright}Options:${colors.reset}
  --status, -s    Check current bootstrap status (no scraping)
  --quick, -q     Quick bootstrap (5 niches instead of 20)
  --help, -h      Show this help message

${colors.bright}Examples:${colors.reset}
  # Check what data exists
  npx tsx scripts/bootstrap-marketplace.ts --status

  # Quick test (1-2 minutes)
  npx tsx scripts/bootstrap-marketplace.ts --quick

  # Full bootstrap (5-10 minutes)
  npx tsx scripts/bootstrap-marketplace.ts

${colors.bright}Core Niches (${CORE_MBA_NICHES.length}):${colors.reset}
${CORE_MBA_NICHES.map(n => `  • ${n}`).join('\n')}
`);
}

async function showStatus() {
  log.header('Marketplace Bootstrap Status');

  try {
    const status = await getBootstrapStatus();

    console.log(`${colors.bright}Configuration:${colors.reset}`);
    console.log(`  Total niches defined: ${status.totalNiches}`);
    console.log(`  Niches with data: ${status.nichesWithData}`);
    console.log(`  Niches with 30%+ confidence: ${status.nichesWithGoodConfidence}`);
    console.log(`  Total products: ~${status.totalProducts}`);
    console.log(`  MBA products: ${status.totalMbaProducts}`);
    console.log(`  Average confidence: ${status.avgConfidence}%`);

    console.log(`\n${colors.bright}Niche Details:${colors.reset}`);
    console.log('  Niche                          | Data | Confidence | MBA');
    console.log('  -------------------------------|------|------------|-----');

    for (const niche of status.nicheDetails) {
      const dataIcon = niche.hasData ? colors.green + '✓' + colors.reset : colors.red + '✗' + colors.reset;
      const confColor = niche.confidence >= 30 ? colors.green : niche.confidence > 0 ? colors.yellow : colors.red;
      const confStr = `${confColor}${niche.confidence.toString().padStart(3)}%${colors.reset}`;
      const mbaStr = niche.mbaCount.toString().padStart(3);
      console.log(`  ${niche.niche.padEnd(31)} | ${dataIcon}    | ${confStr}       | ${mbaStr}`);
    }

    console.log(`\n${colors.bright}Recommendation:${colors.reset}`);
    console.log(`  ${status.recommendation}`);

  } catch (error) {
    log.error(`Failed to get status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

async function runBootstrap() {
  const mode = isQuick ? 'quick' : 'full';
  const nicheCount = isQuick ? 5 : CORE_MBA_NICHES.length;

  log.header(`Marketplace Bootstrap (${mode} mode)`);
  log.info(`Will process ${nicheCount} niches`);
  log.info(`Target: ~${nicheCount * 20} products total`);
  log.info(`Estimated time: ${isQuick ? '1-2' : '5-10'} minutes\n`);

  const startTime = Date.now();

  // Progress callback
  const onProgress = (progress: BootstrapProgress) => {
    if (progress.currentNiche) {
      const pct = Math.round((progress.nichesCompleted / progress.totalNiches) * 100);
      process.stdout.write(`\r  [${pct}%] Processing: ${progress.currentNiche.padEnd(25)}`);
    }
  };

  try {
    console.log(`${colors.bright}Progress:${colors.reset}`);

    const result = isQuick
      ? await bootstrapQuick(onProgress)
      : await bootstrapMarketplace({}, onProgress);

    // Clear progress line
    process.stdout.write('\r' + ' '.repeat(60) + '\r');

    // Show results
    console.log(`\n${colors.bright}Results:${colors.reset}`);
    console.log('  Niche                          | Stored | MBA | Before | After | Gain');
    console.log('  -------------------------------|--------|-----|--------|-------|------');

    for (const r of result.results) {
      if (r.error) {
        console.log(`  ${r.niche.padEnd(31)} | ${colors.red}ERROR: ${r.error}${colors.reset}`);
      } else {
        const gainColor = r.confidenceGain > 0 ? colors.green : colors.yellow;
        console.log(
          `  ${r.niche.padEnd(31)} | ${r.productsStored.toString().padStart(6)} | ` +
          `${r.mbaProductsStored.toString().padStart(3)} | ${r.confidenceBefore.toString().padStart(5)}% | ` +
          `${r.confidenceAfter.toString().padStart(4)}% | ${gainColor}+${r.confidenceGain}%${colors.reset}`
        );
      }
    }

    // Summary
    if (result.summary) {
      const duration = Math.round((Date.now() - startTime) / 1000);
      console.log(`\n${colors.bright}Summary:${colors.reset}`);
      console.log(`  Total products stored: ${result.summary.totalProducts}`);
      console.log(`  MBA products stored: ${result.summary.totalMbaProducts}`);
      console.log(`  Average confidence gain: +${result.summary.avgConfidenceGain}%`);
      console.log(`  Niches with 30%+ confidence: ${result.summary.nichesWithGoodConfidence}/${result.totalNiches}`);
      console.log(`  Duration: ${duration}s`);
      console.log(`\n${colors.bright}Recommendation:${colors.reset}`);
      console.log(`  ${result.summary.recommendation}`);
    }

    if (result.status === 'complete') {
      log.success('Bootstrap complete!');
    } else {
      log.error(`Bootstrap failed: ${result.status}`);
      process.exit(1);
    }

  } catch (error) {
    log.error(`Bootstrap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Main
async function main() {
  if (isHelp) {
    showHelp();
    return;
  }

  if (isStatus) {
    await showStatus();
    return;
  }

  await runBootstrap();
}

main().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
