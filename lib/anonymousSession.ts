/**
 * Anonymous Session Tracking
 *
 * Handles rate limiting for non-authenticated users:
 * - 3 designs per 24 hours
 * - 2 hour cooldown between each generation
 * - Session tracked via localStorage (client) and database (server)
 */

// Constants
export const ANON_DAILY_LIMIT = 3;
export const ANON_COOLDOWN_HOURS = 2;
export const ANON_WINDOW_HOURS = 24;
const STORAGE_KEY = 'turboMerchAnonSession';

export interface AnonymousSession {
  sessionId: string;
  timestamps: number[]; // Unix timestamps of generations
}

/**
 * Get or create anonymous session ID
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const session: AnonymousSession = JSON.parse(stored);
      return session.sessionId;
    }

    // Create new session
    const sessionId = `anon-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const session: AnonymousSession = {
      sessionId,
      timestamps: [],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return sessionId;
  } catch (error) {
    console.error('Error getting session ID:', error);
    return `anon-${Date.now()}`;
  }
}

/**
 * Get current anonymous session status
 */
export interface AnonymousStatus {
  allowed: boolean;
  reason?: string;
  remaining: number;
  used: number;
  nextAvailableAt?: Date;
  cooldownRemaining?: number; // minutes
}

export function getAnonymousStatus(): AnonymousStatus {
  if (typeof window === 'undefined') {
    return {
      allowed: true,
      remaining: ANON_DAILY_LIMIT,
      used: 0,
    };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {
        allowed: true,
        remaining: ANON_DAILY_LIMIT,
        used: 0,
      };
    }

    const session: AnonymousSession = JSON.parse(stored);
    const now = Date.now();
    const windowMs = ANON_WINDOW_HOURS * 60 * 60 * 1000;
    const cooldownMs = ANON_COOLDOWN_HOURS * 60 * 60 * 1000;
    const cutoff = now - windowMs;

    // Filter timestamps within 24 hour window
    const recentTimestamps = session.timestamps.filter(ts => ts > cutoff);

    // Update localStorage with filtered timestamps
    if (recentTimestamps.length !== session.timestamps.length) {
      session.timestamps = recentTimestamps;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }

    const used = recentTimestamps.length;
    const remaining = Math.max(0, ANON_DAILY_LIMIT - used);

    // Check daily limit
    if (used >= ANON_DAILY_LIMIT) {
      const oldestTimestamp = recentTimestamps[0];
      const nextAvailableAt = new Date(oldestTimestamp + windowMs);

      return {
        allowed: false,
        reason: `Anonymous users are limited to ${ANON_DAILY_LIMIT} designs per 24 hours. Sign up for a free account to continue!`,
        remaining: 0,
        used,
        nextAvailableAt,
      };
    }

    // Check cooldown (if user has generated before)
    if (recentTimestamps.length > 0) {
      const lastTimestamp = recentTimestamps[recentTimestamps.length - 1];
      const timeSinceLastGen = now - lastTimestamp;

      if (timeSinceLastGen < cooldownMs) {
        const cooldownRemaining = Math.ceil((cooldownMs - timeSinceLastGen) / (60 * 1000));
        const nextAvailableAt = new Date(lastTimestamp + cooldownMs);

        return {
          allowed: false,
          reason: `Please wait ${cooldownRemaining} minutes between designs. Sign up for a free account to remove cooldowns!`,
          remaining,
          used,
          nextAvailableAt,
          cooldownRemaining,
        };
      }
    }

    // All checks passed
    return {
      allowed: true,
      remaining,
      used,
    };
  } catch (error) {
    console.error('Error checking anonymous status:', error);
    return {
      allowed: true,
      remaining: ANON_DAILY_LIMIT,
      used: 0,
    };
  }
}

/**
 * Record a new anonymous generation
 */
export function recordAnonymousGeneration(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const status = getAnonymousStatus();
    if (!status.allowed) {
      return false;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    const session: AnonymousSession = stored
      ? JSON.parse(stored)
      : { sessionId: getSessionId(), timestamps: [] };

    session.timestamps.push(Date.now());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));

    return true;
  } catch (error) {
    console.error('Error recording anonymous generation:', error);
    return false;
  }
}

/**
 * Clear anonymous session (called after user signs up)
 */
export function clearAnonymousSession(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing anonymous session:', error);
  }
}

/**
 * Get anonymous session for server-side tracking
 */
export function getAnonymousSessionData(): AnonymousSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error getting anonymous session data:', error);
    return null;
  }
}
