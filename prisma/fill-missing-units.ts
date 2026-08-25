/**
 * Điền đơn vị cho metric bị thiếu, suy từ bản ghi cùng tên.
 *
 * 324 metric không có đơn vị. Không chặn gì nhưng bảng số liệu hiện trống ở cột
 * đơn vị, và người xem không biết "267" là lần, lượt hay hồ sơ.
 *
 * 309 trong số đó suy được: cùng một chỉ số ở tuần khác đã có đơn vị, chỉ là
 * tuần này AI bỏ sót. Lấy đơn vị phổ biến nhất của chỉ số đó.
 *
 * 15 metric còn lại chưa từng có đơn vị ở bất kỳ tuần nào — để trống, vì đoán
 * đơn vị từ tên chỉ số là bịa.
 *
 *   npx tsx prisma/fill-missing-units.ts            # chạy thử
 *   npx tsx prisma/fill-missing-units.ts --confirm  # ghi thật
 */
import { PrismaClient } from '@prisma/client';
import { backupBeforeWrite } from '@/lib/db-backup';

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  // Đơn vị phổ biến nhất của mỗi chỉ số.
  const unitCounts = await prisma.extractedMetric.groupBy({
    by: ['name', 'unit'],
    _count: true,
    where: { unit: { not: null } },
  });

  const dominant = new Map<string, { unit: string; count: number }>();
  for (const u of unitCounts) {
    const current = dominant.get(u.name);
    if (!current || u._count > current.count) {
      dominant.set(u.name, { unit: u.unit!, count: u._count });
    }
  }

  const missing = await prisma.extractedMetric.findMany({
    where: { unit: null },
    select: { id: true, name: true, value: true },
  });

  const fills = new Map<string, { unit: string; ids: string[] }>();
  const unknown: string[] = [];

  for (const m of missing) {
    const found = dominant.get(m.name);
    if (!found) {
      unknown.push(m.name);
      continue;
    }
    const entry = fills.get(m.name) ?? { unit: found.unit, ids: [] };
    entry.ids.push(m.id);
    fills.set(m.name, entry);
  }

  const total = [...fills.values()].reduce((sum, f) => sum + f.ids.length, 0);

  console.log(`${missing.length} metric thiếu đơn vị\n`);
  console.log(`Suy được từ bản ghi cùng tên: ${total}`);

  for (const [name, f] of [...fills.entries()]
    .sort((a, b) => b[1].ids.length - a[1].ids.length)
    .slice(0, 12)) {
    console.log(`  ${String(f.ids.length).padStart(3)}×  ${name.slice(0, 46).padEnd(48)} → ${f.unit}`);
  }
  if (fills.size > 12) console.log(`  … và ${fills.size - 12} chỉ số nữa`);

  if (unknown.length > 0) {
    const distinct = [...new Set(unknown)];
    console.log(`\nKhông suy được: ${unknown.length} metric (${distinct.length} chỉ số)`);
    console.log('  Chưa từng có đơn vị ở tuần nào — để trống thay vì đoán:');
    for (const name of distinct.slice(0, 6)) {
      console.log(`    ${name.slice(0, 56)}`);
    }
  }

  if (!confirm) {
    console.log('\nChạy thử — chưa ghi gì. Thêm --confirm để ghi thật.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nSao lưu:');
  await backupBeforeWrite(prisma, ['extracted_metrics'], 'fillunit');

  let updated = 0;
  for (const f of fills.values()) {
    const result = await prisma.extractedMetric.updateMany({
      where: { id: { in: f.ids } },
      data: { unit: f.unit },
    });
    updated += result.count;
  }

  console.log(`✓ Điền đơn vị cho ${updated} metric`);

  const remaining = await prisma.extractedMetric.count({ where: { unit: null } });
  console.log(`Còn ${remaining} metric thiếu đơn vị.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
