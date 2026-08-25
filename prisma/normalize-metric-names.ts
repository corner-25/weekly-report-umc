/**
 * Gom các biến thể cách viết của cùng một chỉ số về một tên chuẩn.
 *
 * Mỗi tuần AI đặt tên độc lập nên cùng một chỉ số ra nhiều cách viết. Ba kiểu
 * biến thể đo được trên dữ liệu thật:
 *
 *   1. Hoa/thường:   "thanh toán Ngoại trú"  vs  "thanh toán ngoại trú"
 *   2. Đảo thứ tự:   "Tổng viện phí ngoại trú"  vs  "Ngoại trú tổng viện phí"
 *   3. Khoảng trắng: thừa dấu cách giữa các từ
 *
 * Biểu đồ nhóm theo tên nên mỗi biến thể thành một đường riêng, chuỗi bị cắt vụn.
 *
 * Cách gom: rút mỗi tên về một "khoá so khớp" (bỏ dấu hoa thường, sắp xếp lại
 * cụm nội trú/ngoại trú về cuối), rồi trong mỗi nhóm chọn tên xuất hiện nhiều
 * nhất làm chuẩn — đó là cách viết mà AI dùng nhất quán nhất.
 *
 *   npx tsx prisma/normalize-metric-names.ts            # chạy thử
 *   npx tsx prisma/normalize-metric-names.ts --confirm  # ghi thật
 */
import { PrismaClient } from '@prisma/client';
import { backupBeforeWrite } from '@/lib/db-backup';

/**
 * Cụm phân loại bệnh nhân, có thể đứng đầu hoặc cuối tên.
 *
 * "Ngoại trú tổng viện phí" và "Tổng viện phí ngoại trú" là một chỉ số; chuẩn
 * hoá bằng cách luôn đẩy cụm này về cuối.
 */
const PATIENT_GROUPS = ['ngoại trú', 'nội trú'] as const;

/**
 * Rút một tên về khoá so khớp.
 *
 * Hai tên cho cùng khoá nghĩa là cùng một chỉ số, dù viết khác nhau.
 */
function matchKey(name: string): string {
  let s = name.toLowerCase().replace(/\s+/g, ' ').trim();

  // Đẩy cụm nội trú/ngoại trú về cuối, ở đâu cũng vậy.
  for (const group of PATIENT_GROUPS) {
    if (!s.includes(group)) continue;
    s = `${s.split(group).join(' ').replace(/\s+/g, ' ').trim()} ${group}`;
  }

  return s;
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  const grouped = await prisma.extractedMetric.groupBy({
    by: ['name'],
    _count: true,
  });

  // Gom các tên cùng khoá; nhóm chỉ có một tên thì không cần đụng tới.
  const byKey = new Map<string, Array<{ name: string; count: number }>>();
  for (const g of grouped) {
    const key = matchKey(g.name);
    const list = byKey.get(key) ?? [];
    list.push({ name: g.name, count: g._count });
    byKey.set(key, list);
  }

  const renames: Array<{ from: string; to: string; count: number }> = [];
  for (const variants of byKey.values()) {
    if (variants.length < 2) continue;

    // Tên phổ biến nhất làm chuẩn; hoà thì lấy tên ngắn hơn cho gọn.
    const canonical = [...variants].sort(
      (a, b) => b.count - a.count || a.name.length - b.name.length,
    )[0];

    for (const v of variants) {
      if (v.name !== canonical.name) {
        renames.push({ from: v.name, to: canonical.name, count: v.count });
      }
    }
  }

  console.log(`${grouped.length} tên riêng biệt`);
  console.log(`${renames.length} biến thể cần gom\n`);

  for (const r of [...renames].sort((a, b) => b.count - a.count).slice(0, 14)) {
    console.log(`  ${String(r.count).padStart(3)}×  ${r.from.slice(0, 44)}`);
    console.log(`        → ${r.to.slice(0, 44)}`);
  }
  if (renames.length > 14) console.log(`\n  … và ${renames.length - 14} biến thể nữa`);

  const affected = renames.reduce((sum, r) => sum + r.count, 0);
  console.log(`\nẢnh hưởng ${affected} metric, gộp về ${grouped.length - renames.length} tên`);

  if (!confirm) {
    console.log('\nChạy thử — chưa ghi gì. Thêm --confirm để ghi thật.');
    await prisma.$disconnect();
    return;
  }

  // Sao lưu trước khi ghi — script sửa hàng loạt không lùi được.
  console.log('Sao lưu:');
  await backupBeforeWrite(prisma, ['extracted_metrics'], 'normname');

  let updated = 0;
  for (const r of renames) {
    const result = await prisma.extractedMetric.updateMany({
      where: { name: r.from },
      data: { name: r.to },
    });
    updated += result.count;
  }

  console.log(`\n✓ Đã gom ${updated} metric`);

  const after = await prisma.extractedMetric.groupBy({ by: ['name'] });
  console.log(`Còn lại ${after.length} tên riêng biệt`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
