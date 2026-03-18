import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        // Append connection pool params to reduce cold-start latency on Railway
        url: process.env.DATABASE_URL?.includes('?')
          ? `${process.env.DATABASE_URL}&connection_limit=5&pool_timeout=20&connect_timeout=10`
          : `${process.env.DATABASE_URL}?connection_limit=5&pool_timeout=20&connect_timeout=10`,
      },
    },
  });

// Keep singleton to prevent connection pool exhaustion on both dev and production
globalForPrisma.prisma = prisma;

export default prisma;
