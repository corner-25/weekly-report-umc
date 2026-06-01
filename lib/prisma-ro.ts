import { PrismaClient } from '@prisma/client';

// Lazy-initialized Prisma client backed by the chatbot_readonly Postgres role.
// We avoid throwing at module-load time so Next.js can collect page data even
// when DATABASE_URL_RO isn't configured (e.g. during the Railway build step).
const globalForPrismaRo = globalThis as unknown as {
  prismaRo: PrismaClient | undefined;
};

function buildReadOnlyUrl(): string {
  const url = process.env.DATABASE_URL_RO;
  if (!url) {
    throw new Error('DATABASE_URL_RO is not configured');
  }
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}connection_limit=3&pool_timeout=10&connect_timeout=10`;
}

export function getPrismaRo(): PrismaClient {
  if (globalForPrismaRo.prismaRo) return globalForPrismaRo.prismaRo;
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: buildReadOnlyUrl(),
      },
    },
  });
  globalForPrismaRo.prismaRo = client;
  return client;
}
