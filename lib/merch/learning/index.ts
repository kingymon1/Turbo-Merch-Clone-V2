/**
 * Learning System Index
 *
 * Exports all learning and insight-related functions.
 * This module provides the brain for the Merch Generator,
 * enabling it to learn from historical data and improve over time.
 */

// Insight Extraction
export {
  extractAllInsights,
  getInsightsSummary,
} from './insight-extractor';

// Insight Validation
export {
  validateAllInsights,
  validateSpecificInsight,
  getValidationStatus,
} from './insight-validator';

// Insight Application (for autopilot integration)
export {
  getRelevantInsights,
  applyInsightsToGeneration,
  logInsightUsage,
  getBestPhraseTemplate,
  getRecommendedStyle,
  isNichePeakSeason,
} from './insight-applier';
