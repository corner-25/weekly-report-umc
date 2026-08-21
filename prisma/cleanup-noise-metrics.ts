/**
 * Dọn các số liệu nhiễu do AI trích thừa.
 *
 * AI đôi khi trích cả những con số MÔ TẢ thay vì ĐO LƯỜNG công việc:
 *   "QĐ 1599/QĐ-BVĐHYD ... (gồm 606 phần): 30%"
 *    → trích đúng "Tỷ lệ sử dụng = 30%"  (giữ)
 *    → trích thừa "Số phần = 606"        (xoá — đó là quy mô quyết định)
 *
 * Đo trên production: 66/1.968 metric (3,4%) thuộc loại này.
 *
 * MẶC ĐỊNH CHẠY THỬ. Phải truyền --confirm mới thật sự xoá.
 *
 * Chạy:
 *   npx tsx prisma/cleanup-noise-metrics.ts            # xem trước
 *   npx tsx prisma/cleanup-noise-metrics.ts --confirm  # xoá thật
 */
import { PrismaClient } from '@prisma/client';

/**
 * Mẫu nhận diện metric nhiễu.
 *
 * Chỉ nhắm vào số MÔ TẢ một văn bản (số hiệu, quy mô), không đụng tới chỉ số
 * đo lường. Chú ý: "Tỷ lệ sử dụng QĐ 1599" PHẢI được giữ — nó đo công việc.
 */
const NOISE_PATTERNS: Array<{ label: string; sql: string }> = [
  {
    label: 'Số phần / số mục của quyết định mua sắm',
    sql: `name ~* '^(số |tổng số )?(phần|mục|gói)( của)? ?(QĐ|quyết định)' OR name ~* '^số phần '`,
  },
  {
    label: 'Số hiệu văn bản dùng làm giá trị',
    sql: `name ~* '^(số hiệu|mã số) ' OR (name ~* '^(QĐ|Quyết định|Thông tư|Nghị định) [0-9]' AND name !~* 'tỷ lệ|số lượng|đã')`,
  },
];

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  const total = await prisma.extractedMetric.count();
  console.log(`Tổng metric: ${total.toLocaleString('vi-VN')}\n`);

  const ids = new Set<string>();

  for (const pattern of NOISE_PATTERNS) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; value: number }>>(
      `SELECT id, name, value FROM extracted_metrics
       WHERE (${pattern.sql}) AND "reviewStatus" = 'PENDING'
       ORDER BY name LIMIT 500`,
    );
    console.log(`▸ ${pattern.label}: ${rows.length}`);
    for (const r of rows.slice(0, 5)) {
      console.log(`    ${r.name.slice(0, 56)} = ${r.value}`);
    }
    if (rows.length > 5) console.log(`    … và ${rows.length - 5} mục nữa`);
    for (const r of rows) ids.add(r.id);
    console.log();
  }

  console.log(`═══ TÓM TẮT ═══`);
  console.log(`Sẽ xoá: ${ids.size}/${total} (${((ids.size / total) * 100).toFixed(1)}%)`);

  // Kiểm chứng không xoá nhầm chỉ số đo lường thật.
  const keptRates = await prisma.extractedMetric.count({
    where: { name: { contains: 'Tỷ lệ sử dụng' }, id: { notIn: [...ids] } },
  });
  console.log(`Giữ nguyên "Tỷ lệ sử dụng …": ${keptRates}`);

  if (!confirm) {
    console.log(`\n⚠ CHẠY THỬ — chưa xoá gì. Thêm --confirm để xoá thật.`);
    await prisma.$disconnect();
    return;
  }

  if (ids.size === 0) {
    console.log('\nKhông có gì để xoá.');
    await prisma.$disconnect();
    return;
  }

  const deleted = await prisma.extractedMetric.deleteMany({
    where: { id: { in: [...ids] }, reviewStatus: 'PENDING' },
  });
  console.log(`\n✓ Đã xoá ${deleted.count} metric nhiễu`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
