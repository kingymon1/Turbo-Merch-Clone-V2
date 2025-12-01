/**
 * Server-side Anonymous Session Management
 *
 * Handles anonymous user tracking and rate limiting on the server
 * Works alongside client-side anonymousSession.ts
 */

import { NextRequest } from 'next/server';
import prisma from './prisma';
import { ANON_DAILY_LIMIT } from './anonymousSession';

export interface ServerAnonymousStatus {
  allowed: boolean;
  reason?: string;
  remaining: number;
  used: number;
  sessionDbId?: string; // Database ID for the session
}

/**
 * Get or create anonymous session in database
 */
export async function getOrCreateAnonymousSession(
  sessionId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  if (!sessionId || !sessionId.startsWith('anon-')) {
    throw new Error('Invalid anonymous session ID');
  }

  if (!prisma) {
    console.warn('Prisma not initialized - cannot track anonymous sessions');
    return null;
  }

  let session = await prisma.anonymousSession.findUnique({
    where: { sessionId },
  });

  if (!session) {
    session = await prisma.anonymousSession.create({
      data: {
        sessionId,
        generationTimestamps: [],
        generationCount: 0,
        ipAddress,
        userAgent,
      },
    });
  }

  return session;
}

/**
 * Check if anonymous user can generate (server-side validation)
 */
export async function canAnonymousUserGenerate(
  sessionId: string,
  req?: NextRequest
): Promise<ServerAnonymousStatus> {
  if (!prisma) {
    // Database not available - allow but warn
    console.warn('Prisma not available - anonymous rate limiting disabled');
    return {
      allowed: true,
      remaining: ANON_DAILY_LIMIT,
      used: 0,
    };
  }

  try {
    // Get IP and user agent
    const ipAddress = req?.headers.get('x-forwarded-for')?.split(',')[0] ||
                     req?.headers.get('x-real-ip') ||
                     'unknown';
    const userAgent = req?.headers.get('user-agent') || 'unknown';

    // Get or create session
    const session = await getOrCreateAnonymousSession(sessionId, ipAddress, userAgent);

    if (!session) {
      return {
        allowed: false,
        reason: 'Could not create anonymous session',
        remaining: 0,
        used: 0,
      };
    }

    // Use simple count-based limiting (no time restrictions)
    const used = session.generationCount || 0;
    const remaining = Math.max(0, ANON_DAILY_LIMIT - used);

    // Check limit
    if (used >= ANON_DAILY_LIMIT) {
      return {
        allowed: false,
        reason: `You've used all ${ANON_DAILY_LIMIT} free designs. Sign up to unlock unlimited designs and download your creations!`,
        remaining: 0,
        used,
        sessionDbId: session.id,
      };
    }

    // All checks passed
    return {
      allowed: true,
      remaining,
      used,
      sessionDbId: session.id,
    };
  } catch (error) {
    console.error('Error checking anonymous user status:', error);
    return {
      allowed: false,
      reason: 'Error validating session',
      remaining: 0,
      used: 0,
    };
  }
}

/**
 * Record anonymous generation in database
 */
export async function recordAnonymousGeneration(
  sessionId: string,
  runId: string
): Promise<boolean> {
  if (!prisma) {
    console.warn('Prisma not available - cannot record anonymous generation');
    return false;
  }

  try {
    const session = await prisma.anonymousSession.findUnique({
      where: { sessionId },
    });

    if (!session) {
      console.error('Anonymous session not found:', sessionId);
      return false;
    }

    // Increment count only (no timestamp tracking)
    await prisma.anonymousSession.update({
      where: { id: session.id },
      data: {
        generationCount: session.generationCount + 1,
      },
    });

    return true;
  } catch (error) {
    console.error('Error recording anonymous generation:', error);
    return false;
  }
}

/**
 * Link anonymous session to user account on signup
 */
export async function linkAnonymousSessionToUser(
  sessionId: string,
  userId: string
): Promise<boolean> {
  if (!prisma) {
    console.warn('Prisma not available - cannot link session to user');
    return false;
  }

  try {
    // Update session
    await prisma.anonymousSession.update({
      where: { sessionId },
      data: {
        linkedToUserId: userId,
        isConverted: true,
      },
    });

    // Update user with linked session
    await prisma.user.update({
      where: { id: userId },
      data: {
        linkedSessionId: sessionId,
      },
    });

    // Transfer anonymous designs to user account
    await prisma.designHistory.updateMany({
      where: { anonymousSessionId: sessionId },
      data: {
        userId: userId,
      },
    });

    return true;
  } catch (error) {
    console.error('Error linking anonymous session to user:', error);
    return false;
  }
}

/**
 * Extract session ID from request (from header or body)
 */
export function extractSessionId(req: NextRequest, body?: any): string | null {
  // Try to get from header first
  const headerSessionId = req.headers.get('x-session-id');
  if (headerSessionId) return headerSessionId;

  // Try to get from body
  if (body?.sessionId) return body.sessionId;

  return null;
}
