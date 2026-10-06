/**
 * Viết báo cáo tóm tắt hoạt động tuần bằng AI (chạy tay / thử chất lượng).
 *   npx tsx prisma/generate-weekly-summary.ts --year 2026 --week 40 [--save]
 * Không --save: chỉ in ra, không ghi đè bản Phòng HC đang sửa.
 */
import { PrismaClient } from '@prisma/client';
import { generateWeeklySummary } from '@/lib/weekly-summary/generate';

const prisma = new PrismaClient();
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const year = Number(arg('year'));
  const weekNumber = Number(arg('week'));
  const week = await prisma.week.findUniqueOrThrow({ where: { weekNumber_year: { weekNumber, year } } });
  const started = Date.now();
  const { content, model, tokens } = await generateWeeklySummary(prisma, week.id);
  console.log(JSON.stringify(content, null, 1));
  console.log(`\n${model} · ${tokens} token · ${Math.round((Date.now() - started) / 1000)} giây`);
  if (process.argv.includes('--save')) {
    const existing = await prisma.weeklySummary.findUnique({ where: { weekId: week.id }, select: { status: true } });
    if (existing?.status === 'FINAL') throw new Error('Tuần này đã chốt — không ghi đè');
    await prisma.weeklySummary.upsert({
      where: { weekId: week.id },
      create: { weekId: week.id, content, model, tokens, generatedAt: new Date() },
      update: { content, model, tokens, generatedAt: new Date(), status: 'DRAFT' },
    });
    console.log('Đã lưu bản nháp.');
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
