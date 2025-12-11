/**
 * Prisma Client Singleton
 *
 * Ensures only one instance of PrismaClient is created throughout the app
 * Prevents connection exhaustion in development (Next.js hot reload)
 *
 * For Neon PostgreSQL in serverless environments, ensure your DATABASE_URL
 * uses the pooled connection string (-pooler) with appropriate timeouts:
 * ?connect_timeout=30&pool_timeout=30&sslmode=require
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
