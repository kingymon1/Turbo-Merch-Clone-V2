/**
 * Emerging Trends Pipeline - Reddit Scraper
 *
 * Scrapes Reddit subreddits for posts and extracts engagement data.
 * Uses Decodo API with reddit_subreddit target for structured data.
 */

import { getDecodoClient } from '../client/decodo-client';
import {
  RawSocialSignal,
  RedditPost,
  RedditSubredditInfo,
  CommunityBaseline,
} from '../types';
import { log, logError, logWarn } from '../config';

// =============================================================================
// TYPES
// =============================================================================

interface RedditScraperOptions {
  maxPosts?: number;
  sortBy?: 'hot' | 'new' | 'top' | 'rising';
  timeFilter?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
}

interface RedditScrapeResult {
  success: boolean;
  signals: RawSocialSignal[];
  subredditInfo?: {
    name: string;
    subscribers: number;
    description?: string;
  };
  baseline?: CommunityBaseline;
  error?: string;
}

// =============================================================================
// SCRAPER
// =============================================================================

/**
 * Scrape a Reddit subreddit for posts
 */
export async function scrapeRedditSubreddit(
  subreddit: string,
  options: RedditScraperOptions = {}
): Promise<RedditScrapeResult> {
  const {
    maxPosts = 50,
    sortBy = 'hot',
    timeFilter = 'day',
  } = options;

  const client = getDecodoClient();

  if (!client.isConfigured()) {
    return {
      success: false,
      signals: [],
      error: 'Decodo API not configured',
    };
  }

  try {
    // Build Reddit URL
    const timeParam = sortBy === 'top' ? `&t=${timeFilter}` : '';
    const url = `https://www.reddit.com/r/${subreddit}/${sortBy}.json?limit=${maxPosts}${timeParam}`;

    log(`Scraping r/${subreddit} (${sortBy}, max ${maxPosts} posts)`);

    const results = await client.scrape({
      target: 'reddit_subreddit',
      url,
      parse: true,
    });

    if (!results.length || !results[0].content) {
      logWarn(`No data returned for r/${subreddit}`);
      return {
        success: false,
        signals: [],
        error: 'No data returned from Decodo',
      };
    }

    // Parse the response
    const content = results[0].content;
    const signals: RawSocialSignal[] = [];
    let subredditInfo: RedditScrapeResult['subredditInfo'] | undefined;
    let baseline: CommunityBaseline | undefined;

    // Handle different response formats
    if (typeof content === 'object' && content !== null) {
      const data = content as Record<string, unknown>;

      // Extract posts
      const posts = extractPostsFromContent(data);

      if (posts.length > 0) {
        // Calculate baseline from posts
        baseline = calculateBaseline(posts);

        // Extract subreddit info from first post
        const firstPost = posts[0];
        if (firstPost) {
          subredditInfo = {
            name: firstPost.subreddit || subreddit,
            subscribers: firstPost.subreddit_subscribers || 0,
          };
        }

        // Convert posts to signals
        for (const post of posts) {
          const signal = convertPostToSignal(post, subreddit, subredditInfo?.subscribers);
          if (signal) {
            signals.push(signal);
          }
        }
      }
    }

    log(`Scraped ${signals.length} signals from r/${subreddit}`);

    return {
      success: true,
      signals,
      subredditInfo,
      baseline,
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError(`Failed to scrape r/${subreddit}`, error);
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
 * Extract posts from various Decodo response formats
 */
function extractPostsFromContent(content: Record<string, unknown>): RedditPost[] {
  const posts: RedditPost[] = [];

  // Format 1: Direct posts array
  if (Array.isArray(content.posts)) {
    return content.posts as RedditPost[];
  }

  // Format 2: Reddit API format with data.children
  if (content.data && typeof content.data === 'object') {
    const data = content.data as Record<string, unknown>;
    if (Array.isArray(data.children)) {
      for (const child of data.children) {
        if (child && typeof child === 'object' && 'data' in (child as object)) {
          const postData = (child as Record<string, unknown>).data;
          if (postData && typeof postData === 'object') {
            posts.push(postData as RedditPost);
          }
        }
      }
    }
  }

  // Format 3: Decodo parsed format
  if (Array.isArray(content.results)) {
    for (const result of content.results) {
      if (result && typeof result === 'object') {
        posts.push(result as RedditPost);
      }
    }
  }

  // Format 4: Flat array of posts
  if (Array.isArray(content)) {
    return content as RedditPost[];
  }

  return posts;
}

/**
 * Convert a Reddit post to a RawSocialSignal
 */
function convertPostToSignal(
  post: RedditPost,
  subreddit: string,
  communitySize?: number
): RawSocialSignal | null {
  if (!post.id || !post.title) {
    return null;
  }

  // Skip posts that are likely ads or announcements
  if (post.title.toLowerCase().includes('[ad]') ||
      post.title.toLowerCase().includes('announcement')) {
    return null;
  }

  // Parse posted time
  let postedAt: Date | undefined;
  if (post.created_utc) {
    postedAt = new Date(post.created_utc * 1000);
  }

  // Build permalink URL
  const url = post.permalink
    ? `https://www.reddit.com${post.permalink}`
    : post.url || `https://www.reddit.com/r/${subreddit}/comments/${post.id}`;

  return {
    platform: 'reddit',
    externalId: post.id,
    url,
    community: subreddit.toLowerCase(),
    communitySize: communitySize || post.subreddit_subscribers,
    title: post.title,
    content: post.selftext || undefined,
    author: post.author,
    hashtags: [], // Reddit doesn't have hashtags
    postedAt,
    upvotes: post.score || 0,
    downvotes: post.upvote_ratio
      ? Math.round((post.score || 0) * (1 - post.upvote_ratio) / post.upvote_ratio)
      : undefined,
    comments: post.num_comments || 0,
    shares: 0, // Reddit doesn't expose share count
    views: undefined, // Reddit doesn't expose view count publicly
    saves: undefined,
  };
}

/**
 * Calculate baseline engagement metrics from posts
 */
function calculateBaseline(posts: RedditPost[]): CommunityBaseline {
  if (posts.length === 0) {
    return {
      avgUpvotes: 100,
      avgComments: 10,
      avgShares: 0,
      sampleSize: 0,
      updatedAt: new Date(),
    };
  }

  const totalUpvotes = posts.reduce((sum, p) => sum + (p.score || 0), 0);
  const totalComments = posts.reduce((sum, p) => sum + (p.num_comments || 0), 0);

  return {
    avgUpvotes: totalUpvotes / posts.length,
    avgComments: totalComments / posts.length,
    avgShares: 0,
    sampleSize: posts.length,
    updatedAt: new Date(),
  };
}

/**
 * Scrape multiple subreddits
 */
export async function scrapeMultipleSubreddits(
  subreddits: string[],
  options: RedditScraperOptions = {}
): Promise<Map<string, RedditScrapeResult>> {
  const results = new Map<string, RedditScrapeResult>();

  for (const subreddit of subreddits) {
    const result = await scrapeRedditSubreddit(subreddit, options);
    results.set(subreddit, result);

    // Small delay between requests to be nice to the API
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}
