/**
 * Bỏ ngày tháng và số tuần khỏi tên chỉ số.
 *
 * Tên là danh tính của chỉ số, dùng để nối các tuần thành một đường trên biểu
 * đồ. Nhúng ngày vào thì mỗi tuần thành một chỉ số riêng chỉ có đúng một điểm:
 *
 *   Nhập kho hóa chất sát khuẩn từ ngày 01/01/2026 đến 08/01/2026   1 lần
 *   Nhập kho hóa chất sát khuẩn từ ngày 06/02/2026 đến 12/02/2026   1 lần
 *   Nhập kho hóa chất sát khuẩn từ ngày 06/03/2026 đến 12/03/2026   1 lần
 *
 * Đây là MỘT chỉ số cần vẽ thành một đường qua 34 tuần. Mốc thời gian đã có sẵn
 * ở cột weekId và asOfDate nên nhắc lại trong tên vừa thừa vừa phá vỡ chuỗi.
 *
 * Prompt v4 đã dặn AI không đưa ngày vào tên; script này xử lý dữ liệu cũ.
 *
 *   npx tsx prisma/clean-metric-names.ts            # chạy thử
 *   npx tsx prisma/clean-metric-names.ts --confirm  # ghi thật
 */
import { PrismaClient } from '@prisma/client';
import { backupBeforeWrite } from '@/lib/db-backup';

/**
 * Các mẫu ngày tháng cần bỏ khỏi tên.
 *
 * Xử lý theo thứ tự: cụm dài trước ("từ ngày X đến Y") rồi mới tới ngày lẻ, để
 * không để lại phần thừa như "từ ngày đến".
 */
const DATE_PATTERNS: RegExp[] = [
  // "từ ngày 01/01/2026 đến 08/01/2026" và các biến thể
  /\s*từ\s+ngày\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*(đến|-)\s*(hết\s+)?(ngày\s+)?\d{1,2}\/\d{1,2}\/\d{2,4}/gi,
  // "đến hết ngày 20/8/2026", "tính đến ngày 20/8/2026"
  /\s*(tính\s+)?đến\s+(hết\s+)?ngày\s+\d{1,2}\/\d{1,2}\/\d{2,4}/gi,
  // "ngày 20/8/2026" đứng lẻ
  /\s*(trong\s+)?ngày\s+\d{1,2}\/\d{1,2}\/\d{2,4}/gi,
  // Ngày trần không có chữ dẫn
  /\s*\d{1,2}\/\d{1,2}\/\d{4}/g,
  // "so với tuần 19", "tuần 08"
  /\s*so\s+với\s+tuần\s+\d+/gi,
  /\s*tuần\s+\d{1,2}\b/gi,
];

/**
 * Chỉ số SO SÁNH giữa hai kỳ — không phải số liệu mới.
 *
 * "Tăng tổng viện phí so với tuần 12: 12%" là phép trừ giữa hai tuần, hệ thống
 * tự tính được từ chuỗi gốc chính xác hơn. Lưu chúng gây ba vấn đề: phồng số
 * lượng chỉ số, mỗi tên chỉ dùng một lần, và đổi mốc so sánh lại sinh tên mới.
 *
 * Prompt v4 đã cấm trích; ở đây xoá phần đã lỡ lưu.
 */
const COMPARISON_NAME = /\bso\s+với\s+(tuần|kỳ|tháng)\b/i;

/**
 * Đơn vị của một chỉ số so sánh thật.
 *
 * Không phải cứ bắt đầu bằng "Tăng/Giảm" là so sánh: "Tăng số lượt theo dõi
 * trang: 395 lượt" là số lượt tăng thêm trong tuần — đo được, đơn vị `lượt`, và
 * xuất hiện đều đặn 19 tuần. Xoá nó là mất dữ liệu thật.
 *
 * Chỉ số so sánh suy diễn luôn mang đơn vị phần trăm và nêu mốc ("so với tuần
 * 12"). Dùng cả hai dấu hiệu để không bắt nhầm.
 */
const COMPARISON_UNIT = '%';

/** Dọn phần thừa còn lại sau khi bỏ ngày: dấu câu treo, khoảng trắng đôi. */
function tidy(name: string): string {
  return name
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*[,:;-]\s*$/, '')
    .replace(/\(\s*\)/g, '')
    .trim();
}

function cleanName(name: string): string {
  let result = name;
  for (const pattern of DATE_PATTERNS) result = result.replace(pattern, '');
  return tidy(result);
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  const grouped = await prisma.extractedMetric.groupBy({
    by: ['name'],
    _count: true,
  });

  // Tên nào chỉ từng xuất hiện với đơn vị phần trăm — dấu hiệu của số suy diễn.
  const byUnit = await prisma.extractedMetric.groupBy({
    by: ['name', 'unit'],
  });
  const nonPercentNames = new Set(
    byUnit.filter((u) => u.unit !== COMPARISON_UNIT).map((u) => u.name),
  );
  const comparisonUnits = new Set(
    byUnit.filter((u) => u.unit === COMPARISON_UNIT && !nonPercentNames.has(u.name))
      .map((u) => u.name),
  );

  const renames: Array<{ from: string; to: string; count: number }> = [];
  const comparisons: Array<{ name: string; count: number }> = [];
  let skipped = 0;

  for (const g of grouped) {
    // Chỉ số so sánh thì xoá chứ không dọn tên — dọn xong vẫn vô dụng.
    if (COMPARISON_NAME.test(g.name) && comparisonUnits.has(g.name)) {
      comparisons.push({ name: g.name, count: g._count });
      continue;
    }

    const cleaned = cleanName(g.name);

    // Tên rỗng hoặc quá ngắn sau khi dọn nghĩa là toàn bộ nội dung là ngày —
    // giữ nguyên còn hơn tạo ra tên vô nghĩa.
    if (cleaned.length < 4) {
      skipped += 1;
      continue;
    }
    if (cleaned === g.name) continue;

    renames.push({ from: g.name, to: cleaned, count: g._count });
  }

  const comparisonMetrics = comparisons.reduce((sum, c) => sum + c.count, 0);

  console.log(`${grouped.length} tên hiện tại`);
  console.log(`${renames.length} tên cần dọn ngày tháng`);
  console.log(`${comparisons.length} tên là chỉ số so sánh → xoá (${comparisonMetrics} metric)\n`);

  for (const r of [...renames].sort((a, b) => b.count - a.count).slice(0, 12)) {
    console.log(`  ${String(r.count).padStart(3)}×  ${r.from.slice(0, 56)}`);
    console.log(`        → ${r.to.slice(0, 56)}`);
  }
  if (renames.length > 12) console.log(`\n  … và ${renames.length - 12} tên nữa`);
  if (skipped > 0) console.log(`\n  ${skipped} tên giữ nguyên (dọn xong sẽ rỗng)`);

  console.log('\n  Ví dụ chỉ số so sánh sắp xoá:');
  for (const c of comparisons.slice(0, 5)) {
    console.log(`    ${c.name.slice(0, 56)}`);
  }

  const afterNames = new Set(
    grouped
      .filter((g) => !(COMPARISON_NAME.test(g.name) && comparisonUnits.has(g.name)))
      .map((g) => cleanName(g.name) || g.name),
  );
  console.log(
    `\nSau khi dọn: ${grouped.length} → ${afterNames.size} tên riêng biệt`,
  );

  if (!confirm) {
    console.log('\nChạy thử — chưa ghi gì. Thêm --confirm để ghi thật.');
    await prisma.$disconnect();
    return;
  }

  // Sao lưu trước khi ghi — script sửa hàng loạt không lùi được.
  console.log('Sao lưu:');
  await backupBeforeWrite(prisma, ['extracted_metrics'], 'cleanname');

  const deleted = await prisma.extractedMetric.deleteMany({
    where: { name: { in: comparisons.map((c) => c.name) } },
  });
  console.log(`\n✓ Xoá ${deleted.count} metric so sánh`);

  let updated = 0;
  for (const r of renames) {
    const result = await prisma.extractedMetric.updateMany({
      where: { name: r.from },
      data: { name: r.to },
    });
    updated += result.count;
  }

  console.log(`✓ Dọn tên cho ${updated} metric`);

  const after = await prisma.extractedMetric.groupBy({ by: ['name'] });
  console.log(`Còn ${after.length} tên riêng biệt`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
