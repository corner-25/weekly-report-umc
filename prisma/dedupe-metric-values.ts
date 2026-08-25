/**
 * Gỡ trường hợp một chỉ số có nhiều giá trị trong cùng một tuần.
 *
 * Sau khi bỏ ngày tháng khỏi tên chỉ số, các dòng vốn khác nhau nhờ ngày nay
 * mang cùng một tên. Biểu đồ vì thế có hai điểm ở cùng một tuần và không biết
 * lấy cái nào.
 *
 * Ba nguyên nhân khác nhau, xử lý khác nhau:
 *
 *   1. NHẮC LẠI KỲ TRƯỚC (300 metric) — báo cáo tuần 34 nêu cả tồn kho đến
 *      13/8 (tuần trước) lẫn 20/8 (tuần này) để so sánh. Giữ dòng có asOfDate
 *      gần ngày kết thúc tuần nhất, bỏ dòng nhắc lại.
 *
 *   2. ĐƠN VỊ LẪN LỘN — một dòng lấy nhầm con số ở phần so sánh:
 *        "chi phí quản lý: 2.800.000 đồng (tăng 2% so với...)"
 *        → hai bản ghi: 2.800.000 VND và 2 %
 *      Giữ bản có đơn vị phổ biến nhất của chỉ số đó, bỏ bản lạc loài.
 *
 *   3. HAI SỐ LIỆU THẬT — "Chi phí quản lý" nội trú và ngoại trú cùng tên do
 *      mất phần phân biệt. KHÔNG xoá: mất dữ liệu thật. Chỉ báo để người dùng
 *      biết cần chạy lại trích xuất với prompt v4.
 *
 *   npx tsx prisma/dedupe-metric-values.ts            # chạy thử
 *   npx tsx prisma/dedupe-metric-values.ts --confirm  # ghi thật
 */
import { PrismaClient } from '@prisma/client';
import { backupBeforeWrite } from '@/lib/db-backup';

interface Row {
  id: string;
  name: string;
  value: number;
  unit: string | null;
  asOfDate: Date | null;
  sourceText: string;
  weekId: string;
  departmentId: string;
  weekEndDate: Date;
  weekNumber: number;
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT m.id, m.name, m.value, m.unit, m."asOfDate", m."sourceText",
           m."weekId", m."departmentId",
           w."endDate" AS "weekEndDate", w."weekNumber"
    FROM extracted_metrics m
    JOIN weeks w ON w.id = m."weekId"
    WHERE EXISTS (
      SELECT 1 FROM extracted_metrics b
      WHERE b."weekId" = m."weekId"
        AND b."departmentId" = m."departmentId"
        AND b.name = m.name
        AND b.value <> m.value
    )
    ORDER BY m.name, w."weekNumber"
  `;

  /**
   * Đơn vị chính của mỗi chỉ số, và các đơn vị hiếm gặp.
   *
   * Chỉ coi một đơn vị là "lạc loài" khi nó thực sự hiếm. Không đủ nếu chỉ so
   * nhiều/ít: "Đi đào tạo nước ngoài" dùng cả `lượt` (25 lần) lẫn `người`
   * (11 lần) vì đó là HAI chỉ số khác nhau — lượt mới trong tuần và tổng người
   * đang đi. Bỏ cái ít hơn là mất số liệu thật.
   */
  const unitCounts = await prisma.extractedMetric.groupBy({
    by: ['name', 'unit'],
    _count: true,
  });

  const unitsByName = new Map<string, Array<{ unit: string | null; count: number }>>();
  for (const u of unitCounts) {
    unitsByName.set(u.name, [
      ...(unitsByName.get(u.name) ?? []),
      { unit: u.unit, count: u._count },
    ]);
  }

  /**
   * Đơn vị chiếm dưới ngần này so với đơn vị chính thì coi là dùng nhầm.
   *
   * Chỉ áp dụng cho phần trăm. Đơn vị đếm lệch nhau không phải dấu hiệu sai:
   * "Luỹ kế công việc" có bản ghi mang `văn bản` và bản mang `công việc`, nhưng
   * đó là hai mảng riêng của cùng một phòng — AI chỉ gán đơn vị thiếu nhất
   * quán, giá trị vẫn đúng cả hai.
   */
  const RARE_UNIT_RATIO = 0.2;

  /**
   * Đơn vị duy nhất được phép loại bỏ khi lệch.
   *
   * Phần trăm xuất hiện lạc lõng giữa các bản ghi đếm hay tiền tệ gần như luôn
   * là con số lấy nhầm từ mệnh đề so sánh:
   *   "chi phí quản lý: 2.800.000 đồng (tăng 2% so với tuần trước)"
   *     → hai bản ghi: 2.800.000 VND (đúng) và 2 % (nhầm)
   */
  const REMOVABLE_UNIT = '%';

  const rareUnits = new Map<string, Set<string | null>>();
  for (const [name, units] of unitsByName) {
    const top = units.reduce((a, b) => (b.count > a.count ? b : a));
    if (top.unit === REMOVABLE_UNIT) continue;

    const rare = new Set<string | null>();
    for (const u of units) {
      if (
        u.unit === REMOVABLE_UNIT &&
        u.count < top.count * RARE_UNIT_RATIO
      ) {
        rare.add(u.unit);
      }
    }
    if (rare.size > 0) rareUnits.set(name, rare);
  }

  // Gom theo (tuần, phòng ban, tên).
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.weekId}|${r.departmentId}|${r.name}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const toDelete: Array<{ row: Row; reason: string }> = [];
  const needsReview: Array<{ name: string; week: number; values: number[] }> = [];

  for (const group of groups.values()) {
    // 1. Mốc thời gian KHÁC NHAU → giữ dòng gần ngày kết thúc tuần nhất.
    //
    // Mốc bằng nhau thì không phải nhắc lại kỳ trước mà là hai số liệu riêng
    // của cùng một tuần — ví dụ "Luỹ kế công việc" có hai dòng cho hai mảng
    // (đề nghị/công văn và công việc thực hiện) cùng chốt ngày 23/01. Xoá một
    // trong hai là mất dữ liệu thật.
    const dated = group.filter((r) => r.asOfDate !== null);
    const distinctDates = new Set(dated.map((r) => r.asOfDate!.getTime()));
    if (dated.length === group.length && distinctDates.size === group.length) {
      const distance = (r: Row) =>
        Math.abs(r.asOfDate!.getTime() - r.weekEndDate.getTime());
      const keeper = dated.reduce((best, r) =>
        distance(r) < distance(best) ? r : best,
      );
      for (const r of group) {
        if (r.id !== keeper.id) {
          toDelete.push({ row: r, reason: 'nhắc lại kỳ trước' });
        }
      }
      continue;
    }

    // 2. Đơn vị hiếm gặp → bỏ, giữ phần dùng đơn vị bình thường của chỉ số.
    const rare = rareUnits.get(group[0].name);
    if (rare) {
      const bad = group.filter((r) => rare.has(r.unit));
      const good = group.filter((r) => !rare.has(r.unit));
      if (bad.length > 0 && good.length > 0) {
        for (const r of bad) {
          toDelete.push({ row: r, reason: `lấy nhầm số ở mệnh đề so sánh (${r.unit ?? '—'})` });
        }
        // Phần còn lại vẫn nhiều giá trị thì để người xem, không đoán tiếp.
        if (good.length > 1) {
          needsReview.push({
            name: good[0].name,
            week: good[0].weekNumber,
            values: good.map((r) => r.value),
          });
        }
        continue;
      }
    }

    // 3. Không phân biệt được → báo, không xoá.
    needsReview.push({
      name: group[0].name,
      week: group[0].weekNumber,
      values: group.map((r) => r.value),
    });
  }

  console.log(`${groups.size} nhóm có nhiều giá trị trong cùng một tuần\n`);
  console.log(`Xoá được: ${toDelete.length} metric`);

  const byReason = new Map<string, number>();
  for (const d of toDelete) {
    byReason.set(d.reason, (byReason.get(d.reason) ?? 0) + 1);
  }
  for (const [reason, count] of byReason) {
    console.log(`  ${String(count).padStart(4)}  ${reason}`);
  }

  console.log('\n  Ví dụ:');
  for (const d of toDelete.slice(0, 6)) {
    console.log(
      `    tuần ${String(d.row.weekNumber).padStart(2)}  ` +
        `${d.row.name.slice(0, 32).padEnd(34)} ${String(d.row.value).padStart(12)}  ` +
        `${d.reason}`,
    );
  }

  console.log(`\nCần người xem lại: ${needsReview.length} nhóm`);
  for (const n of needsReview.slice(0, 8)) {
    console.log(
      `    tuần ${String(n.week).padStart(2)}  ${n.name.slice(0, 34).padEnd(36)} ` +
        `${n.values.join(' · ')}`,
    );
  }
  if (needsReview.length > 8) {
    console.log(`    … và ${needsReview.length - 8} nhóm nữa`);
  }

  if (!confirm) {
    console.log('\nChạy thử — chưa xoá gì. Thêm --confirm để xoá thật.');
    await prisma.$disconnect();
    return;
  }

  // Sao lưu trước khi ghi — script sửa hàng loạt không lùi được.
  console.log('Sao lưu:');
  await backupBeforeWrite(prisma, ['extracted_metrics'], 'dedupe');

  const result = await prisma.extractedMetric.deleteMany({
    where: { id: { in: toDelete.map((d) => d.row.id) } },
  });

  console.log(`\n✓ Xoá ${result.count} metric`);

  const remaining = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*)::bigint AS count FROM (
      SELECT "weekId", "departmentId", name
      FROM extracted_metrics
      GROUP BY 1, 2, 3
      HAVING count(DISTINCT value) > 1
    ) x
  `;
  console.log(`Còn ${Number(remaining[0].count)} nhóm cần người xem lại.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
