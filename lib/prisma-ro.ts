import { PrismaClient } from '@prisma/client';

// Singleton Prisma client backed by the chatbot_readonly Postgres role.
// Used exclusively by the AI chatbot to execute SELECT-only queries.
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

export const prismaRo =
  globalForPrismaRo.prismaRo ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: buildReadOnlyUrl(),
      },
    },
  });

globalForPrismaRo.prismaRo = prismaRo;
