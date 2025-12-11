/**
 * Prisma Client with Neon Serverless Adapter
 *
 * Optimized for serverless environments (Vercel) with Neon PostgreSQL.
 * Uses WebSocket connections instead of TCP for better cold start performance.
 *
 * Key features:
 * - Uses @neondatabase/serverless for WebSocket connections
 * - Handles Neon cold starts gracefully (database suspension on free tier)
 * - Singleton pattern prevents connection exhaustion
 */

import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { Pool, neonConfig } from '@neondatabase/serverless';

// Enable WebSocket support for local development
// In production (Vercel Edge), WebSockets are natively supported
if (typeof globalThis.WebSocket === 'undefined') {
  // Dynamic import for ws in Node.js environments
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ws = require('ws');
  neonConfig.webSocketConstructor = ws;
}

// Configure Neon for better reliability
neonConfig.poolQueryViaFetch = true; // Use fetch for pooled connections (more reliable)
neonConfig.fetchConnectionCache = true; // Cache connections

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Create a Neon serverless pool
  const pool = new Pool({ connectionString });

  // Create the Prisma adapter
  const adapter = new PrismaNeon(pool);

  // Create Prisma client with the Neon adapter
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
