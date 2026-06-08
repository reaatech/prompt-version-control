import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  });

if (process.env.NODE_ENV === 'development') {
  (
    prisma as {
      $on(event: 'query', callback: (e: { query: string; duration: number }) => void): void;
    }
  ).$on('query', (e) => {
    logger.debug({ query: e.query, duration: e.duration }, 'prisma query');
  });
  globalForPrisma.prisma = prisma;
}
