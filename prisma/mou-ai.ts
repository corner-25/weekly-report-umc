/**
 * AI đọc biên bản MOU hàng loạt (chạy sau prisma/mou-ocr.ts):
 *
 *   npx tsx prisma/mou-ai.ts extract [--force] [--mou <id>]   trích khía cạnh từ văn bản ký
 *   npx tsx prisma/mou-ai.ts assess  [--force] [--mou <id>]   đối chiếu bằng chứng triển khai
 *   npx tsx prisma/mou-ai.ts all     [--force]                 cả hai
 *
 * Mặc định chỉ chạy MOU chưa làm; --force làm lại.
 */
import { PrismaClient } from '@prisma/client';
import { assessMou, extractMou } from '@/lib/mou/ai-run';

const prisma = new PrismaClient();

async function main() {
  const step = process.argv[2];
  if (!['extract', 'assess', 'all'].includes(step)) throw new Error('Dùng: mou-ai.ts extract|assess|all [--force] [--mou <id>]');
  const force = process.argv.includes('--force');
  const one = process.argv.indexOf('--mou') > 0 ? process.argv[process.argv.indexOf('--mou') + 1] : null;
  const mous = await prisma.mOU.findMany({
    where: { deletedAt: null, ...(one ? { id: one } : {}) },
    select: { id: true, partnerName: true, extractedAt: true, assessedAt: true },
    orderBy: { signedDate: 'asc' },
  });
  let tokens = 0;
  for (const m of mous) {
    if (step !== 'assess' && (force || !m.extractedAt)) {
      try {
        const r = await extractMou(prisma, m.id);
        tokens += r.tokens;
        console.log(`trích  ${r.ok ? '✓' : '–'} ${m.partnerName}: ${r.message}`);
      } catch (e) {
        console.error(`trích  ✗ ${m.partnerName}: ${(e as Error).message}`);
      }
    }
    if (step !== 'extract' && (force || !m.assessedAt)) {
      try {
        const r = await assessMou(prisma, m.id);
        tokens += r.tokens;
        console.log(`đánh giá ✓ ${m.partnerName}: ${r.message}`);
      } catch (e) {
        console.error(`đánh giá ✗ ${m.partnerName}: ${(e as Error).message}`);
      }
    }
  }
  console.log(`Xong ${mous.length} MOU · ${tokens.toLocaleString('vi-VN')} token`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
