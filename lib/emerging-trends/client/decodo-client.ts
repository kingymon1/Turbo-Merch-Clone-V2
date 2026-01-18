/**
 * Emerging Trends Pipeline - Decodo API Client
 *
 * Wrapper for the Decodo web scraping API.
 * Handles authentication, retries, and error handling.
 */

import {
  DecodoCredentials,
  DecodoScrapeParams,
  DecodoScrapeResult,
  DecodoResponse,
} from '../types';
import { DECODO_CONFIG, isDecodoConfigured, log, logError } from '../config';

// =============================================================================
// CLIENT CLASS
// =============================================================================

export class DecodoClient {
  private credentials: DecodoCredentials;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(config?: Partial<typeof DECODO_CONFIG>) {
    this.credentials = {
      username: config?.username || DECODO_CONFIG.username,
      password: config?.password || DECODO_CONFIG.password,
    };
    this.baseUrl = config?.baseUrl || DECODO_CONFIG.baseUrl;
    this.timeout = config?.timeout || DECODO_CONFIG.timeout;
    this.maxRetries = config?.maxRetries || DECODO_CONFIG.maxRetries;
    this.retryDelayMs = config?.retryDelayMs || DECODO_CONFIG.retryDelayMs;
  }

  /**
   * Check if the client is configured with credentials
   */
  isConfigured(): boolean {
    return Boolean(this.credentials.username && this.credentials.password);
  }

  /**
   * Get Basic Auth header value
   */
  private getAuthHeader(): string {
    const encoded = Buffer.from(
      `${this.credentials.username}:${this.credentials.password}`
    ).toString('base64');
    return `Basic ${encoded}`;
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Make a synchronous scrape request
   */
  async scrape(params: DecodoScrapeParams): Promise<DecodoScrapeResult[]> {
    if (!this.isConfigured()) {
      throw new Error('Decodo API not configured. Set DECODO_USERNAME and DECODO_PASSWORD environment variables.');
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.baseUrl}/scrape`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.getAuthHeader(),
          },
          body: JSON.stringify(params),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');

          // Don't retry on client errors (except 429)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(`Decodo API error ${response.status}: ${errorText}`);
          }

          // Retry on server errors and rate limits
          throw new Error(`Decodo API error ${response.status}: ${errorText}`);
        }

        const data: DecodoResponse = await response.json();
        return data.results || [];

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on abort (timeout) or non-retryable errors
        if (lastError.name === 'AbortError') {
          throw new Error(`Decodo API timeout after ${this.timeout}ms`);
        }

        // Last attempt, throw error
        if (attempt === this.maxRetries) {
          break;
        }

        // Calculate exponential backoff delay
        const delay = this.retryDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
        log(`Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`);
        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Decodo API request failed');
  }

  /**
   * Scrape a Reddit subreddit
   */
  async scrapeRedditSubreddit(subreddit: string): Promise<DecodoScrapeResult[]> {
    const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=50`;

    log(`Scraping Reddit: r/${subreddit}`);

    return this.scrape({
      target: 'reddit_subreddit',
      url,
      parse: true,
    });
  }

  /**
   * Scrape a specific Reddit post
   */
  async scrapeRedditPost(postUrl: string): Promise<DecodoScrapeResult[]> {
    log(`Scraping Reddit post: ${postUrl}`);

    return this.scrape({
      target: 'reddit_post',
      url: postUrl,
      parse: true,
    });
  }

  /**
   * Scrape a TikTok video
   */
  async scrapeTikTokVideo(videoUrl: string): Promise<DecodoScrapeResult[]> {
    log(`Scraping TikTok video: ${videoUrl}`);

    return this.scrape({
      target: 'tiktok_post',
      url: videoUrl,
      parse: true,
    });
  }

  /**
   * Scrape any URL with the universal target
   */
  async scrapeUniversal(
    url: string,
    options?: { headless?: boolean; markdown?: boolean }
  ): Promise<DecodoScrapeResult[]> {
    log(`Scraping URL: ${url}`);

    return this.scrape({
      target: 'universal',
      url,
      headless: options?.headless ? 'html' : undefined,
      markdown: options?.markdown,
    });
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let clientInstance: DecodoClient | null = null;

export function getDecodoClient(): DecodoClient {
  if (!clientInstance) {
    clientInstance = new DecodoClient();
  }
  return clientInstance;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if Decodo is configured and available
 */
export async function checkDecodoStatus(): Promise<{
  configured: boolean;
  working: boolean;
  error?: string;
}> {
  if (!isDecodoConfigured()) {
    return {
      configured: false,
      working: false,
      error: 'DECODO_USERNAME and DECODO_PASSWORD not set',
    };
  }

  try {
    const client = getDecodoClient();
    // Try a simple scrape to verify credentials work
    await client.scrapeUniversal('https://example.com');
    return { configured: true, working: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('Decodo health check failed', error);
    return {
      configured: true,
      working: false,
      error: message,
    };
  }
}
