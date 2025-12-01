/**
 * Server-Side Rate Limiting
 *
 * Provides robust rate limiting for API endpoints using the database
 * for persistence. Supports multiple rate limit keys per user for
 * different actions (generation, export, etc.)
 */

import prisma from './prisma';

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Key prefix for this rate limit (e.g., 'generation', 'export') */
  key: string;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** When the rate limit resets (Unix timestamp) */
  resetAt: Date;
  /** Current count of requests in the window */
  current: number;
  /** Maximum requests allowed */
  limit: number;
  /** If blocked, how many seconds until reset */
  retryAfter?: number;
}

/**
 * Default rate limit configurations for different actions
 */
export const RATE_LIMITS = {
  /** Design generation rate limit */
  generation: {
    maxRequests: 10,
    windowSeconds: 60, // 10 per minute
    key: 'generation',
  },
  /** Design export rate limit */
  export: {
    maxRequests: 20,
    windowSeconds: 300, // 20 per 5 minutes
    key: 'export',
  },
  /** Search requests rate limit */
  search: {
    maxRequests: 30,
    windowSeconds: 60, // 30 per minute
    key: 'search',
  },
  /** General API rate limit */
  api: {
    maxRequests: 100,
    windowSeconds: 60, // 100 per minute
    key: 'api',
  },
  /** Anonymous user rate limit (stricter) */
  anonymous: {
    maxRequests: 5,
    windowSeconds: 3600, // 5 per hour
    key: 'anonymous',
  },
} as const;

/**
 * Check and update rate limit for a user
 *
 * @param userId - User ID or anonymous session ID
 * @param config - Rate limit configuration
 * @returns Rate limit check result
 *
 * @example
 * const result = await checkRateLimit(userId, RATE_LIMITS.generation);
 * if (!result.allowed) {
 *   return NextResponse.json(
 *     { error: 'Rate limit exceeded', retryAfter: result.retryAfter },
 *     { status: 429 }
 *   );
 * }
 */
export async function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowSeconds * 1000);
  const resetAt = new Date(now.getTime() + config.windowSeconds * 1000);

  try {
    // Get or create rate limit record
    const rateLimit = await prisma.rateLimit.upsert({
      where: {
        userId_key: {
          userId,
          key: config.key,
        },
      },
      create: {
        userId,
        key: config.key,
        count: 1,
        resetAt,
      },
      update: {
        // If window has passed, reset count
        count: {
          set: 1,
        },
        resetAt: {
          set: resetAt,
        },
      },
    });

    // Check if we need to reset the window
    if (rateLimit.resetAt <= now) {
      // Window has passed, reset count
      const updated = await prisma.rateLimit.update({
        where: {
          userId_key: {
            userId,
            key: config.key,
          },
        },
        data: {
          count: 1,
          resetAt,
          blockedAt: null,
        },
      });

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt,
        current: 1,
        limit: config.maxRequests,
      };
    }

    // Increment count within current window
    if (rateLimit.count < config.maxRequests) {
      const updated = await prisma.rateLimit.update({
        where: {
          userId_key: {
            userId,
            key: config.key,
          },
        },
        data: {
          count: { increment: 1 },
        },
      });

      return {
        allowed: true,
        remaining: config.maxRequests - updated.count,
        resetAt: rateLimit.resetAt,
        current: updated.count,
        limit: config.maxRequests,
      };
    }

    // Rate limit exceeded
    const retryAfterSeconds = Math.ceil(
      (rateLimit.resetAt.getTime() - now.getTime()) / 1000
    );

    // Mark as blocked if not already
    if (!rateLimit.blockedAt) {
      await prisma.rateLimit.update({
        where: {
          userId_key: {
            userId,
            key: config.key,
          },
        },
        data: {
          blockedAt: now,
        },
      });
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt: rateLimit.resetAt,
      current: rateLimit.count,
      limit: config.maxRequests,
      retryAfter: retryAfterSeconds,
    };
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error);
    // Fail open - allow request if rate limit check fails
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt,
      current: 0,
      limit: config.maxRequests,
    };
  }
}

/**
 * Reset rate limit for a specific user and key
 * Useful for admin operations or after successful payment
 *
 * @param userId - User ID
 * @param key - Rate limit key
 */
export async function resetRateLimit(userId: string, key: string): Promise<void> {
  try {
    await prisma.rateLimit.delete({
      where: {
        userId_key: {
          userId,
          key,
        },
      },
    });
  } catch {
    // Ignore if record doesn't exist
  }
}

/**
 * Get current rate limit status without incrementing
 *
 * @param userId - User ID
 * @param config - Rate limit configuration
 * @returns Current rate limit status
 */
export async function getRateLimitStatus(
  userId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + config.windowSeconds * 1000);

  try {
    const rateLimit = await prisma.rateLimit.findUnique({
      where: {
        userId_key: {
          userId,
          key: config.key,
        },
      },
    });

    if (!rateLimit || rateLimit.resetAt <= now) {
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt,
        current: 0,
        limit: config.maxRequests,
      };
    }

    const allowed = rateLimit.count < config.maxRequests;
    const retryAfterSeconds = allowed
      ? undefined
      : Math.ceil((rateLimit.resetAt.getTime() - now.getTime()) / 1000);

    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - rateLimit.count),
      resetAt: rateLimit.resetAt,
      current: rateLimit.count,
      limit: config.maxRequests,
      retryAfter: retryAfterSeconds,
    };
  } catch (error) {
    console.error('[RateLimit] Error getting status:', error);
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt,
      current: 0,
      limit: config.maxRequests,
    };
  }
}

/**
 * Middleware helper to add rate limit headers to response
 *
 * @param result - Rate limit result
 * @returns Headers object to spread into NextResponse
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toISOString(),
    ...(result.retryAfter && { 'Retry-After': result.retryAfter.toString() }),
  };
}

/**
 * Higher-order function to wrap an API handler with rate limiting
 *
 * @example
 * export const POST = withRateLimit(
 *   RATE_LIMITS.generation,
 *   async (request, { userId }) => {
 *     // Your handler logic
 *   }
 * );
 */
export function createRateLimitedHandler<T>(
  config: RateLimitConfig,
  getUserId: (request: Request) => Promise<string | null>
) {
  return async function checkLimit(request: Request): Promise<RateLimitResult | null> {
    const userId = await getUserId(request);
    if (!userId) {
      return null;
    }
    return checkRateLimit(userId, config);
  };
}
