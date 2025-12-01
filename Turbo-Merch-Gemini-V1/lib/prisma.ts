/**
 * Prisma Client Singleton
 *
 * Ensures only one instance of PrismaClient is created throughout the app
 * Prevents connection exhaustion in development (Next.js hot reload)
 *
 * NOTE: This file requires @prisma/client to be installed.
 * To use this module, run:
 *   npm install @prisma/client
 *   npm install -D prisma
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
