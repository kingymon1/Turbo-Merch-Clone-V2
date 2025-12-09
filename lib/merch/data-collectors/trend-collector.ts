/**
 * Trend Data Collector
 *
 * Collects trend data from multiple sources and caches it in the database.
 * Runs as a cron job to build market intelligence over time.
 */

import { prisma } from '@/lib/prisma';
import { searchTrends } from '@/services/geminiService';
import { TrendData } from '@/types';

// Categories and their search queries
const CATEGORY_QUERIES: Record<string, string[]> = {
  // Proven niches - evergreen, consistent demand
  proven: [
    'nurse gifts trending',
    'teacher appreciation gifts',
    'dog mom shirts',
    'cat lover gifts',
    'coffee addict shirts',
    'dad jokes funny',
    'mom life humor',
    'gaming shirts trending',
    'fishing gifts funny',
    'camping outdoor shirts',
  ],
  // Emerging niches - growing trends
  emerging: [
    'work from home humor',
    'introvert gifts trending',
    'plant parent shirts',
    'true crime fan gifts',
    'book lover aesthetic',
    'yoga mindfulness shirts',
    'running marathon shirts',
    'self care aesthetic',
    'mental health awareness',
    'millennial gen z humor',
  ],
  // Moonshot - viral potential
  moonshot: [
    'trending memes today',
    'viral tiktok trends',
    'internet culture 2024',
    'gen z slang shirts',
    'chronically online humor',
    'viral moments trending',
    'pop culture references',
    'breaking trends viral',
  ],
};

// Virality levels for each category
const CATEGORY_VIRALITY: Record<string, number> = {
  proven: 25,    // Safe mode
  emerging: 50,  // Balanced mode
  moonshot: 85,  // Aggressive/Predictive mode
};

/**
 * Collect trend data for a specific category
 */
export async function collectTrendData(
  category: 'proven' | 'emerging' | 'moonshot'
): Promise<number> {
  const queries = CATEGORY_QUERIES[category];
  const viralityLevel = CATEGORY_VIRALITY[category];
  let savedCount = 0;

  console.log(`[TrendCollector] Starting ${category} collection (${queries.length} queries)`);

  for (const query of queries) {
    try {
      console.log(`[TrendCollector] Searching: "${query}"`);

      // Use the existing multi-agent search
      const trends = await searchTrends(query, viralityLevel);

      if (trends && trends.length > 0) {
        // Save to database
        await prisma.marketData.create({
          data: {
            source: 'multi-agent',
            category,
            query,
            data: trends as any,
            metadata: {
              viralityLevel,
              trendCount: trends.length,
              collectedAt: new Date().toISOString(),
            } as any,
          },
        });

        savedCount++;
        console.log(`[TrendCollector] Saved ${trends.length} trends for "${query}"`);
      }

      // Rate limiting between queries
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`[TrendCollector] Error for query "${query}":`, error);
      // Continue with next query
    }
  }

  console.log(`[TrendCollector] ${category} collection complete: ${savedCount} datasets saved`);
  return savedCount;
}

/**
 * Collect moonshot trends using test mode (all agents)
 */
export async function collectMoonshotTrends(): Promise<number> {
  const queries = CATEGORY_QUERIES.moonshot;
  let savedCount = 0;

  console.log(`[TrendCollector] Starting MOONSHOT collection with test mode`);

  for (const query of queries) {
    try {
      console.log(`[TrendCollector] Moonshot search: "${query}"`);

      // Use test mode for maximum exploration
      const trends = await searchTrends(query, 90, undefined, true);

      if (trends && trends.length > 0) {
        await prisma.marketData.create({
          data: {
            source: 'multi-agent',
            category: 'moonshot',
            query,
            data: trends as any,
            metadata: {
              viralityLevel: 90,
              testMode: true,
              trendCount: trends.length,
              collectedAt: new Date().toISOString(),
            } as any,
          },
        });

        savedCount++;
        console.log(`[TrendCollector] Saved ${trends.length} moonshot trends`);
      }

      // Longer delay for test mode (more API intensive)
      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
      console.error(`[TrendCollector] Moonshot error for "${query}":`, error);
    }
  }

  console.log(`[TrendCollector] Moonshot collection complete: ${savedCount} datasets saved`);
  return savedCount;
}

/**
 * Smart cleanup of market data with intelligent retention
 *
 * RETENTION PHILOSOPHY (Phase 6):
 * Raw data can be deleted, but we preserve valuable historical data for learning.
 * Different categories have different retention periods based on their value:
 *
 * - PROVEN/EMERGING: 180 days (high value for pattern learning)
 * - MOONSHOT: 30 days (volatile, less reliable for long-term learning)
 * - DATA LINKED TO SUCCESSFUL DESIGNS: Never deleted (success evidence)
 *
 * This enables the learning system to extract ProvenInsights from historical
 * patterns while not bloating the database with stale viral data.
 */
export async function cleanOldMarketData(): Promise<{
  provenEmerging: number;
  moonshot: number;
  preserved: number;
}> {
  // Calculate cutoff dates for each category
  const now = new Date();

  // Proven/Emerging: Keep for 180 days (6 months of learning data)
  const provenEmergingCutoff = new Date(now);
  provenEmergingCutoff.setDate(provenEmergingCutoff.getDate() - 180);

  // Moonshot: Keep for 30 days (viral data is time-sensitive)
  const moonshotCutoff = new Date(now);
  moonshotCutoff.setDate(moonshotCutoff.getDate() - 30);

  // First, find IDs of market data linked to successful designs
  // A "successful" design is one that was approved OR has sales > 0 OR has userRating >= 4
  const successfulDesigns = await prisma.merchDesign.findMany({
    where: {
      OR: [
        { approved: true },
        { sales: { gt: 0 } },
        { userRating: { gte: 4 } },
      ],
      sourceData: { not: null },
    },
    select: {
      sourceData: true,
    },
  });

  // Extract market data IDs from successful designs' sourceData
  const preservedIds = new Set<string>();
  for (const design of successfulDesigns) {
    const sourceData = design.sourceData as any;
    if (sourceData?.marketDataId) {
      preservedIds.add(sourceData.marketDataId);
    }
    if (sourceData?.marketDataIds && Array.isArray(sourceData.marketDataIds)) {
      sourceData.marketDataIds.forEach((id: string) => preservedIds.add(id));
    }
  }

  console.log(`[TrendCollector] Preserving ${preservedIds.size} market data records linked to successful designs`);

  // Delete old proven/emerging data (except preserved)
  const provenEmergingResult = await prisma.marketData.deleteMany({
    where: {
      category: { in: ['proven', 'emerging'] },
      createdAt: { lt: provenEmergingCutoff },
      id: { notIn: Array.from(preservedIds) },
    },
  });

  // Delete old moonshot data (except preserved)
  const moonshotResult = await prisma.marketData.deleteMany({
    where: {
      category: 'moonshot',
      createdAt: { lt: moonshotCutoff },
      id: { notIn: Array.from(preservedIds) },
    },
  });

  console.log(`[TrendCollector] Smart cleanup complete:`);
  console.log(`  - Proven/Emerging deleted: ${provenEmergingResult.count} (older than 180 days)`);
  console.log(`  - Moonshot deleted: ${moonshotResult.count} (older than 30 days)`);
  console.log(`  - Preserved (linked to success): ${preservedIds.size}`);

  return {
    provenEmerging: provenEmergingResult.count,
    moonshot: moonshotResult.count,
    preserved: preservedIds.size,
  };
}

/**
 * Get recent market data for a category
 */
export async function getRecentMarketData(
  category: 'proven' | 'emerging' | 'moonshot',
  hoursBack: number = 24
): Promise<TrendData[]> {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hoursBack);

  const records = await prisma.marketData.findMany({
    where: {
      category,
      createdAt: {
        gte: cutoffDate,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  });

  // Flatten all trends from all records
  const allTrends: TrendData[] = [];
  for (const record of records) {
    const trends = record.data as unknown as TrendData[];
    if (Array.isArray(trends)) {
      allTrends.push(...trends);
    }
  }

  console.log(`[TrendCollector] Found ${allTrends.length} cached trends for ${category}`);
  return allTrends;
}

/**
 * Check if we have recent data for a category
 */
export async function hasRecentData(
  category: string,
  hoursBack: number = 6
): Promise<boolean> {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - hoursBack);

  const count = await prisma.marketData.count({
    where: {
      category,
      createdAt: {
        gte: cutoffDate,
      },
    },
  });

  return count > 0;
}
