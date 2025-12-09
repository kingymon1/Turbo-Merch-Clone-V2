/**
 * Data Collectors Index
 *
 * Exports all data collection and analysis functions for the market intelligence system.
 */

// Trend Collection
export {
  collectTrendData,
  collectMoonshotTrends,
  cleanOldMarketData,
  getRecentMarketData,
  hasRecentData,
} from './trend-collector';

// Niche Analysis
export {
  analyzeNicheTrends,
  getBestNiches,
  getRandomHighPerformingNiche,
  generateConceptFromCachedData,
} from './niche-analyzer';
