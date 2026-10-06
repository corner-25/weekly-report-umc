/**
 * Viết sẵn báo cáo tóm tắt cho mọi tuần còn thiếu (và làm mới bản nháp AI chưa ai sửa khi dữ liệu đổi).
 *   npx tsx prisma/backfill-weekly-summaries.ts [--limit 10] [--concurrency 3]
 */
import { PrismaClient } from '@prisma/client';
import { ensureWeeklySummaries } from '@/lib/weekly-summary/auto';

const prisma = new PrismaClient();
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : undefined;
};
const started = Date.now();
ensureWeeklySummaries(prisma, { limit: arg('limit'), concurrency: arg('concurrency') ?? 3, log: console.log })
  .then((r) => {
    const tokens = r.written.reduce((s, w) => s + w.tokens, 0);
    console.log(`Xong sau ${Math.round((Date.now() - started) / 1000)} giây: viết ${r.written.length} tuần (${tokens} token), lỗi ${r.failed.length}, còn ${r.pending}`);
  })
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
