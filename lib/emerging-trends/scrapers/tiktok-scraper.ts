/**
 * Emerging Trends Pipeline - TikTok Scraper
 *
 * Scrapes TikTok videos for engagement data.
 * Uses Decodo API with tiktok_post target.
 *
 * NOTE: TikTok scraping is more limited than Reddit.
 * We can scrape individual videos but not hashtag feeds directly.
 * Consider using TikTok Shop search for product-related trends.
 */

import { getDecodoClient } from '../client/decodo-client';
import { RawSocialSignal, TikTokVideo } from '../types';
import { log, logError, logWarn } from '../config';

// =============================================================================
// TYPES
// =============================================================================

interface TikTokScrapeResult {
  success: boolean;
  signal?: RawSocialSignal;
  video?: TikTokVideo;
  error?: string;
}

interface TikTokShopSearchResult {
  success: boolean;
  signals: RawSocialSignal[];
  error?: string;
}

// =============================================================================
// VIDEO SCRAPER
// =============================================================================

/**
 * Scrape a single TikTok video
 */
export async function scrapeTikTokVideo(videoUrl: string): Promise<TikTokScrapeResult> {
  const client = getDecodoClient();

  if (!client.isConfigured()) {
    return {
      success: false,
      error: 'Decodo API not configured',
    };
  }

  try {
    log(`Scraping TikTok video: ${videoUrl}`);

    const results = await client.scrape({
      target: 'tiktok_post',
      url: videoUrl,
      parse: true,
    });

    if (!results.length || !results[0].content) {
      logWarn(`No data returned for TikTok video: ${videoUrl}`);
      return {
        success: false,
        error: 'No data returned from Decodo',
      };
    }

    const content = results[0].content;

    if (typeof content === 'object' && content !== null) {
      const video = extractVideoFromContent(content as Record<string, unknown>);

      if (video) {
        const signal = convertVideoToSignal(video);
        return {
          success: true,
          signal,
          video,
        };
      }
    }

    return {
      success: false,
      error: 'Could not parse TikTok video data',
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`Failed to scrape TikTok video: ${videoUrl}`, error);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Scrape TikTok Shop search results
 * This can be useful for finding trending products/hashtags
 */
export async function scrapeTikTokShopSearch(query: string): Promise<TikTokShopSearchResult> {
  const client = getDecodoClient();

  if (!client.isConfigured()) {
    return {
      success: false,
      signals: [],
      error: 'Decodo API not configured',
    };
  }

  try {
    log(`Searching TikTok Shop: "${query}"`);

    const results = await client.scrape({
      target: 'tiktok_shop_search',
      query,
      parse: true,
    });

    if (!results.length || !results[0].content) {
      logWarn(`No data returned for TikTok Shop search: ${query}`);
      return {
        success: false,
        signals: [],
        error: 'No data returned from Decodo',
      };
    }

    // TikTok Shop search returns products, not videos
    // We'll extract what we can for trend analysis
    const content = results[0].content;
    const signals: RawSocialSignal[] = [];

    if (typeof content === 'object' && content !== null) {
      const data = content as Record<string, unknown>;

      // Extract products if available
      if (Array.isArray(data.products)) {
        for (const product of data.products) {
          const signal = convertShopProductToSignal(product as Record<string, unknown>, query);
          if (signal) {
            signals.push(signal);
          }
        }
      }
    }

    log(`Found ${signals.length} signals from TikTok Shop search`);

    return {
      success: true,
      signals,
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`Failed TikTok Shop search: ${query}`, error);
    return {
      success: false,
      signals: [],
      error: message,
    };
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract video data from Decodo response
 */
function extractVideoFromContent(content: Record<string, unknown>): TikTokVideo | null {
  // Direct video object
  if (content.id && content.description !== undefined) {
    return normalizeVideoData(content);
  }

  // Nested video object
  if (content.video && typeof content.video === 'object') {
    return normalizeVideoData(content.video as Record<string, unknown>);
  }

  // itemInfo format (common TikTok API response)
  if (content.itemInfo && typeof content.itemInfo === 'object') {
    const itemInfo = content.itemInfo as Record<string, unknown>;
    if (itemInfo.itemStruct && typeof itemInfo.itemStruct === 'object') {
      return normalizeVideoData(itemInfo.itemStruct as Record<string, unknown>);
    }
  }

  return null;
}

/**
 * Normalize video data to our TikTokVideo interface
 */
function normalizeVideoData(data: Record<string, unknown>): TikTokVideo | null {
  const id = String(data.id || data.videoId || '');
  if (!id) return null;

  // Extract author info
  const authorData = (data.author || data.authorMeta || {}) as Record<string, unknown>;
  const author = {
    uniqueId: String(authorData.uniqueId || authorData.id || 'unknown'),
    nickname: String(authorData.nickname || authorData.name || 'Unknown'),
    followerCount: typeof authorData.followerCount === 'number' ? authorData.followerCount : undefined,
  };

  // Extract stats
  const statsData = (data.stats || data.statistics || {}) as Record<string, unknown>;
  const stats = {
    playCount: Number(statsData.playCount || statsData.views || data.playCount || 0),
    likeCount: Number(statsData.diggCount || statsData.likeCount || statsData.likes || data.diggCount || 0),
    commentCount: Number(statsData.commentCount || statsData.comments || data.commentCount || 0),
    shareCount: Number(statsData.shareCount || statsData.shares || data.shareCount || 0),
    saveCount: typeof statsData.collectCount === 'number' ? statsData.collectCount : undefined,
  };

  // Extract hashtags
  const hashtags: string[] = [];
  if (Array.isArray(data.challenges)) {
    for (const challenge of data.challenges) {
      if (typeof challenge === 'object' && challenge !== null) {
        const title = (challenge as Record<string, unknown>).title;
        if (typeof title === 'string') {
          hashtags.push(title);
        }
      }
    }
  }
  if (Array.isArray(data.hashtags)) {
    for (const tag of data.hashtags) {
      if (typeof tag === 'string') {
        hashtags.push(tag);
      } else if (typeof tag === 'object' && tag !== null) {
        const name = (tag as Record<string, unknown>).name || (tag as Record<string, unknown>).title;
        if (typeof name === 'string') {
          hashtags.push(name);
        }
      }
    }
  }

  // Extract description
  const description = String(data.desc || data.description || data.title || '');

  // Extract create time
  const createTime = Number(data.createTime || data.created_at || 0);

  // Build URL
  const url = typeof data.url === 'string'
    ? data.url
    : `https://www.tiktok.com/@${author.uniqueId}/video/${id}`;

  return {
    id,
    description,
    author,
    stats,
    hashtags,
    createTime,
    url,
  };
}

/**
 * Convert a TikTok video to a RawSocialSignal
 */
function convertVideoToSignal(video: TikTokVideo): RawSocialSignal {
  // Extract primary hashtag as community
  const primaryHashtag = video.hashtags[0] || 'tiktok';

  // Parse posted time
  let postedAt: Date | undefined;
  if (video.createTime > 0) {
    postedAt = new Date(video.createTime * 1000);
  }

  return {
    platform: 'tiktok',
    externalId: video.id,
    url: video.url,
    community: primaryHashtag.toLowerCase(),
    communitySize: video.author.followerCount,
    title: video.description.slice(0, 200), // First 200 chars as title
    content: video.description,
    author: video.author.uniqueId,
    hashtags: video.hashtags,
    postedAt,
    upvotes: video.stats.likeCount,
    comments: video.stats.commentCount,
    shares: video.stats.shareCount,
    views: video.stats.playCount,
    saves: video.stats.saveCount,
  };
}

/**
 * Convert a TikTok Shop product to a RawSocialSignal
 */
function convertShopProductToSignal(
  product: Record<string, unknown>,
  searchQuery: string
): RawSocialSignal | null {
  const id = String(product.id || product.productId || '');
  if (!id) return null;

  const title = String(product.title || product.name || '');
  const url = String(product.url || product.link || `https://www.tiktok.com/shop/product/${id}`);

  // Extract engagement metrics if available
  const sales = Number(product.soldCount || product.sales || 0);
  const reviews = Number(product.reviewCount || product.reviews || 0);

  return {
    platform: 'tiktok',
    externalId: `shop-${id}`,
    url,
    community: searchQuery.toLowerCase().replace(/\s+/g, '-'),
    title,
    content: String(product.description || ''),
    author: String(product.seller || product.shopName || 'unknown'),
    hashtags: [],
    upvotes: sales, // Use sales as proxy for popularity
    comments: reviews,
    shares: 0,
    views: undefined,
  };
}

/**
 * Scrape multiple TikTok videos
 */
export async function scrapeMultipleTikTokVideos(
  videoUrls: string[]
): Promise<Map<string, TikTokScrapeResult>> {
  const results = new Map<string, TikTokScrapeResult>();

  for (const url of videoUrls) {
    const result = await scrapeTikTokVideo(url);
    results.set(url, result);

    // Delay between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return results;
}
