/**
 * Đồng bộ kho tri thức chatbot (đoạn văn + vector). Chạy tay hoặc sau mỗi lần nạp dữ liệu:
 *   npx tsx prisma/index-knowledge.ts [--no-embed]
 */
import { PrismaClient } from '@prisma/client';
import { syncKnowledge } from '@/lib/chatbot/knowledge/indexer';

const prisma = new PrismaClient();
const started = Date.now();
syncKnowledge(prisma, { log: console.log, embed: !process.argv.includes('--no-embed') })
  .then((s) => console.log(`Xong sau ${Math.round((Date.now() - started) / 1000)} giây:`, s))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
