/**
 * Dọn hai loại rác còn sót sau audit: bản trùng và thông số kỹ thuật.
 *
 * 1. TRÙNG — cùng tuần, phòng ban, tên, giá trị VÀ cùng câu văn gốc. Xảy ra khi
 *    một ô kết quả nhắc lại số liệu ở hai chỗ, AI trích cả hai lần. Giữ bản cũ
 *    nhất, xoá phần còn lại.
 *
 * 2. THÔNG SỐ KỸ THUẬT — "Hỗ trợ 16 KB memory page sizes" trích ra thành metric
 *    giá trị 16 đơn vị KB. Đó là quy cách của Android, không phải kết quả tuần;
 *    nó không bao giờ đổi. Cùng loại lỗi với "gồm 606 phần" đã xử lý trước đó.
 *
 *   npx tsx prisma/cleanup-duplicate-metrics.ts            # chạy thử
 *   npx tsx prisma/cleanup-duplicate-metrics.ts --confirm  # xoá thật
 */
import { PrismaClient } from '@prisma/client';

/**
 * Đơn vị chỉ dùng cho quy cách máy móc, không đo lường công việc.
 *
 * Không lọc "GB"/"TB" vì dung lượng lưu trữ đã dùng CÓ tăng theo tuần và là chỉ
 * số vận hành thật.
 */
const TECH_SPEC_UNITS = new Set(['kb', 'mb', 'bit', 'px', 'dpi', 'mhz', 'ghz']);

interface Row {
  id: string;
  name: string;
  value: number;
  unit: string | null;
  createdAt: Date;
  weekId: string;
  departmentId: string;
  sourceText: string;
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  const all: Row[] = await prisma.extractedMetric.findMany({
    select: {
      id: true,
      name: true,
      value: true,
      unit: true,
      createdAt: true,
      weekId: true,
      departmentId: true,
      sourceText: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // 1. Gom theo khoá nghiệp vụ; bản đầu tiên (cũ nhất) được giữ.
  const seen = new Set<string>();
  const duplicates: Row[] = [];
  for (const row of all) {
    const key = [row.weekId, row.departmentId, row.name, row.value, row.sourceText].join(' | ');
    if (seen.has(key)) duplicates.push(row);
    else seen.add(key);
  }

  // 2. Thông số kỹ thuật — xét trên các bản còn lại sau khi loại trùng.
  const dupIds = new Set(duplicates.map((d) => d.id));
  const techSpecs = all.filter(
    (r) => !dupIds.has(r.id) && TECH_SPEC_UNITS.has((r.unit ?? '').toLowerCase().trim()),
  );

  console.log(`${all.length} metric\n`);
  console.log(`Trùng lặp:         ${duplicates.length}`);
  for (const d of duplicates.slice(0, 6)) {
    console.log(`  ${d.name.slice(0, 44).padEnd(46)} ${d.value}`);
  }

  console.log(`\nThông số kỹ thuật: ${techSpecs.length}`);
  for (const t of techSpecs) {
    console.log(`  ${t.name.slice(0, 44).padEnd(46)} ${t.value} ${t.unit}`);
  }

  const toDelete = [...duplicates.map((d) => d.id), ...techSpecs.map((t) => t.id)];
  console.log(`\nTổng cần xoá: ${toDelete.length}`);

  if (!confirm) {
    console.log('\nChạy thử — chưa xoá gì. Thêm --confirm để xoá thật.');
    await prisma.$disconnect();
    return;
  }

  const result = await prisma.extractedMetric.deleteMany({ where: { id: { in: toDelete } } });
  console.log(`\n✓ Đã xoá ${result.count} metric`);
  console.log(`Còn lại: ${all.length - result.count}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
