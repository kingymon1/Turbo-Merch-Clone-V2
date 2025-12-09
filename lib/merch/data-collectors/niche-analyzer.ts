/**
 * Niche Analyzer
 *
 * Analyzes collected market data to build NicheTrend records.
 * Extracts patterns, popular phrases, and success signals from cached data.
 */

import { prisma } from '@/lib/prisma';
import { TrendData } from '@/types';
import { GoogleGenAI } from '@google/genai';

// Lazy initialization of API client
let aiClient: GoogleGenAI | null = null;
const getAI = (): GoogleGenAI => {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
};

interface NicheAnalysis {
  niche: string;
  category: string;
  searchVolume: number;
  growthRate: number;
  competition: 'low' | 'medium' | 'high';
  popularPhrases: string[];
  commonKeywords: string[];
  successPatterns: {
    bestStyles: string[];
    bestTones: string[];
    bestColors: string[];
    peakTiming: string;
  };
}

/**
 * Analyze all collected market data and update NicheTrend records
 */
export async function analyzeNicheTrends(): Promise<number> {
  console.log('[NicheAnalyzer] Starting niche analysis');

  // Get all recent market data (last 48 hours)
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - 48);

  const marketData = await prisma.marketData.findMany({
    where: {
      createdAt: {
        gte: cutoffDate,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (marketData.length === 0) {
    console.log('[NicheAnalyzer] No recent market data to analyze');
    return 0;
  }

  console.log(`[NicheAnalyzer] Analyzing ${marketData.length} market data records`);

  // Group trends by extracted niche
  const nicheGroups: Record<string, TrendData[]> = {};

  for (const record of marketData) {
    const trends = record.data as unknown as TrendData[];
    if (!Array.isArray(trends)) continue;

    for (const trend of trends) {
      // Extract niche from topic or audienceProfile
      const niche = extractNiche(trend);
      if (!niche) continue;

      if (!nicheGroups[niche]) {
        nicheGroups[niche] = [];
      }
      nicheGroups[niche].push(trend);
    }
  }

  console.log(`[NicheAnalyzer] Found ${Object.keys(nicheGroups).length} unique niches`);

  // Analyze each niche
  let updatedCount = 0;
  for (const [niche, trends] of Object.entries(nicheGroups)) {
    try {
      const analysis = await analyzeNicheData(niche, trends);
      await saveNicheAnalysis(analysis);
      updatedCount++;
      console.log(`[NicheAnalyzer] Updated: ${niche}`);
    } catch (error) {
      console.error(`[NicheAnalyzer] Error analyzing ${niche}:`, error);
    }
  }

  console.log(`[NicheAnalyzer] Analysis complete: ${updatedCount} niches updated`);
  return updatedCount;
}

/**
 * Extract niche name from trend data
 */
function extractNiche(trend: TrendData): string | null {
  // Try audienceProfile first
  if (trend.audienceProfile) {
    // Extract first meaningful word/phrase
    const words = trend.audienceProfile.split(' ').slice(0, 2).join(' ');
    if (words.length > 2) return words.toLowerCase();
  }

  // Try topic
  if (trend.topic) {
    // Clean up topic to extract niche
    const cleaned = trend.topic
      .toLowerCase()
      .replace(/trending|viral|2024|2025|gifts?|shirts?|funny|best/gi, '')
      .trim()
      .split(' ')
      .slice(0, 2)
      .join(' ')
      .trim();
    if (cleaned.length > 2) return cleaned;
  }

  return null;
}

/**
 * Analyze trends for a specific niche
 */
async function analyzeNicheData(niche: string, trends: TrendData[]): Promise<NicheAnalysis> {
  // Collect all phrases, keywords, styles
  const allPhrases: string[] = [];
  const allKeywords: string[] = [];
  const allStyles: string[] = [];
  const allTones: string[] = [];
  const allColors: string[] = [];
  const volumes: string[] = [];

  for (const trend of trends) {
    // Collect design texts/phrases
    if (trend.designText) allPhrases.push(trend.designText);
    if (trend.customerPhrases) allPhrases.push(...trend.customerPhrases);

    // Collect keywords
    if (trend.keywords) allKeywords.push(...trend.keywords);

    // Collect visual styles
    if (trend.visualStyle) allStyles.push(trend.visualStyle);
    if (trend.designStyle) allStyles.push(trend.designStyle);

    // Collect tones/sentiments
    if (trend.sentiment) allTones.push(trend.sentiment);

    // Collect colors
    if (trend.colorPalette) allColors.push(trend.colorPalette);
    if (trend.recommendedShirtColor) allColors.push(trend.recommendedShirtColor);

    // Track volume indicators
    if (trend.volume) volumes.push(trend.volume);
  }

  // Calculate metrics
  const searchVolume = trends.length * 100; // Rough estimate
  const hasBreakout = volumes.some(v => v === 'Breakout' || v === 'High');
  const hasRising = volumes.some(v => v === 'Rising');
  const growthRate = hasBreakout ? 0.8 : hasRising ? 0.5 : 0.2;

  // Determine competition level
  let competition: 'low' | 'medium' | 'high' = 'medium';
  if (allKeywords.length < 20) competition = 'low';
  if (allKeywords.length > 50 || trends.length > 10) competition = 'high';

  // Get top items
  const popularPhrases = getTopItems(allPhrases, 10);
  const commonKeywords = getTopItems(allKeywords, 20);
  const bestStyles = getTopItems(allStyles, 5);
  const bestTones = getTopItems(allTones, 3);
  const bestColors = getTopItems(allColors, 3);

  // Determine category
  let category = 'emerging';
  if (competition === 'high' && growthRate < 0.3) category = 'proven';
  if (growthRate > 0.6 || hasBreakout) category = 'moonshot';

  return {
    niche,
    category,
    searchVolume,
    growthRate,
    competition,
    popularPhrases,
    commonKeywords,
    successPatterns: {
      bestStyles,
      bestTones,
      bestColors,
      peakTiming: 'Daily collection', // Could be enhanced with time analysis
    },
  };
}

/**
 * Get top N most frequent items from an array
 */
function getTopItems(items: string[], topN: number): string[] {
  const counts: Record<string, number> = {};

  for (const item of items) {
    const normalized = item.toLowerCase().trim();
    if (normalized.length < 2) continue;
    counts[normalized] = (counts[normalized] || 0) + 1;
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([item]) => item);
}

/**
 * Save or update niche analysis
 */
async function saveNicheAnalysis(analysis: NicheAnalysis): Promise<void> {
  await prisma.nicheTrend.upsert({
    where: { niche: analysis.niche },
    update: {
      category: analysis.category,
      searchVolume: analysis.searchVolume,
      growthRate: analysis.growthRate,
      competition: analysis.competition,
      popularPhrases: analysis.popularPhrases,
      commonKeywords: analysis.commonKeywords,
      successPatterns: analysis.successPatterns as any,
      lastAnalyzed: new Date(),
    },
    create: {
      niche: analysis.niche,
      category: analysis.category,
      searchVolume: analysis.searchVolume,
      growthRate: analysis.growthRate,
      competition: analysis.competition,
      popularPhrases: analysis.popularPhrases,
      commonKeywords: analysis.commonKeywords,
      successPatterns: analysis.successPatterns as any,
    },
  });
}

/**
 * Get best niches for design generation
 */
export async function getBestNiches(
  category?: string,
  limit: number = 10
): Promise<Array<{
  niche: string;
  category: string;
  growthRate: number;
  popularPhrases: string[];
}>> {
  const where = category ? { category } : {};

  const niches = await prisma.nicheTrend.findMany({
    where,
    orderBy: [
      { growthRate: 'desc' },
      { searchVolume: 'desc' },
    ],
    take: limit,
    select: {
      niche: true,
      category: true,
      growthRate: true,
      popularPhrases: true,
    },
  });

  return niches;
}

/**
 * Get a random high-performing niche with its data
 */
export async function getRandomHighPerformingNiche(): Promise<{
  niche: string;
  category: string;
  phrases: string[];
  keywords: string[];
  patterns: any;
} | null> {
  // Get niches with good growth rate
  const niches = await prisma.nicheTrend.findMany({
    where: {
      growthRate: { gte: 0.3 },
    },
    orderBy: {
      lastAnalyzed: 'desc',
    },
    take: 20,
  });

  if (niches.length === 0) return null;

  // Random selection
  const selected = niches[Math.floor(Math.random() * niches.length)];

  return {
    niche: selected.niche,
    category: selected.category,
    phrases: selected.popularPhrases,
    keywords: selected.commonKeywords,
    patterns: selected.successPatterns,
  };
}

/**
 * Use AI to generate design concept from cached niche data
 */
export async function generateConceptFromCachedData(
  nicheData: {
    niche: string;
    phrases: string[];
    keywords: string[];
    patterns: any;
  }
): Promise<{
  phrase: string;
  style: string;
  tone: string;
  visualDirection: string;
}> {
  const ai = getAI();

  const prompt = `You are a t-shirt design strategist. Based on this niche intelligence, create ONE design concept.

NICHE: ${nicheData.niche}

POPULAR PHRASES IN THIS NICHE:
${nicheData.phrases.slice(0, 10).join('\n')}

KEYWORDS:
${nicheData.keywords.slice(0, 15).join(', ')}

SUCCESS PATTERNS:
${JSON.stringify(nicheData.patterns, null, 2)}

Create a unique, original phrase that fits this niche's vibe but ISN'T a direct copy.

Respond with ONLY valid JSON:
{
  "phrase": "2-5 word catchy t-shirt text",
  "style": "Bold Modern | Vintage Retro | Minimalist | Distressed | Playful",
  "tone": "Funny | Inspirational | Sarcastic | Heartfelt | Proud | Edgy",
  "visualDirection": "brief description of design aesthetic"
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[NicheAnalyzer] Error generating concept:', error);

    // Fallback
    return {
      phrase: nicheData.phrases[0] || `${nicheData.niche} Vibes`,
      style: 'Bold Modern',
      tone: 'Funny',
      visualDirection: 'Modern bold text design',
    };
  }
}
