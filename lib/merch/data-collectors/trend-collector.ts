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
 * Clean up old market data (keep last 7 days)
 */
export async function cleanOldMarketData(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);

  const result = await prisma.marketData.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`[TrendCollector] Cleaned ${result.count} old market data records`);
  return result.count;
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
    const trends = record.data as TrendData[];
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
