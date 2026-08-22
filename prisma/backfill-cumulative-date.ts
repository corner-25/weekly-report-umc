/**
 * Điền mốc thời gian cho số liệu luỹ kế thiếu ngày.
 *
 * Số liệu luỹ kế mà không có mốc thì không so sánh được giữa các tuần: "luỹ kế
 * 1.315 công việc" tính đến bao giờ? Văn bản gốc thường không nêu ngày, nên lấy
 * ngày cuối tuần báo cáo — đó là mốc đúng theo nghĩa nghiệp vụ, vì số liệu được
 * chốt khi viết báo cáo tuần.
 *
 * Prompt v3 đã dặn AI tự điền, script này xử lý 21 tuần đã nạp trước đó.
 *
 *   npx tsx prisma/backfill-cumulative-date.ts            # chạy thử
 *   npx tsx prisma/backfill-cumulative-date.ts --confirm  # ghi thật
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  const metrics = await prisma.extractedMetric.findMany({
    where: { period: 'CUMULATIVE', asOfDate: null },
    select: {
      id: true,
      name: true,
      value: true,
      week: { select: { weekNumber: true, year: true, endDate: true } },
    },
  });

  console.log(`${metrics.length} metric luỹ kế thiếu mốc ngày\n`);

  // Tuần không có endDate thì bỏ qua — thà thiếu mốc còn hơn gán một ngày bịa.
  const withDate = metrics.filter((m) => m.week?.endDate != null);
  const skipped = metrics.length - withDate.length;

  for (const m of withDate.slice(0, 6)) {
    const d = m.week!.endDate!.toLocaleDateString('vi-VN');
    console.log(`  ${m.name.slice(0, 42).padEnd(44)} ${String(m.value).padStart(7)}  → ${d}`);
  }
  if (withDate.length > 6) console.log(`  … và ${withDate.length - 6} metric nữa`);
  if (skipped > 0) console.log(`\n  ${skipped} metric bỏ qua (tuần không có ngày kết thúc)`);

  if (!confirm) {
    console.log('\nChạy thử — chưa ghi gì. Thêm --confirm để ghi thật.');
    await prisma.$disconnect();
    return;
  }

  // Gom theo tuần: mỗi tuần một lệnh UPDATE thay vì mỗi metric một lệnh.
  const byWeek = new Map<string, string[]>();
  for (const m of withDate) {
    const key = m.week!.endDate!.toISOString();
    const list = byWeek.get(key) ?? [];
    list.push(m.id);
    byWeek.set(key, list);
  }

  let updated = 0;
  for (const [iso, ids] of byWeek) {
    const result = await prisma.extractedMetric.updateMany({
      where: { id: { in: ids } },
      data: { asOfDate: new Date(iso) },
    });
    updated += result.count;
  }

  console.log(`\n✓ Đã điền mốc cho ${updated} metric`);

  const remaining = await prisma.extractedMetric.count({
    where: { period: 'CUMULATIVE', asOfDate: null },
  });
  console.log(`Còn thiếu mốc: ${remaining}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
