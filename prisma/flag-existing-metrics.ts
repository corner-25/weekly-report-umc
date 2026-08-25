/**
 * Chạy bộ kiểm tra trên dữ liệu đã có, đánh dấu bản ghi đáng ngờ.
 *
 * Pipeline nay tự kiểm tra khi trích, nhưng 9.140 số liệu đã nạp trước đó chưa
 * qua bước này. Script đánh dấu ngược để người quản lý thấy được ngay chỗ nào
 * cần rà soát mà không phải chờ trích lại.
 *
 * Không sửa giá trị nào — chỉ ghi `reviewFlags`.
 *
 *   npx tsx prisma/flag-existing-metrics.ts            # chạy thử
 *   npx tsx prisma/flag-existing-metrics.ts --confirm  # ghi thật
 */
import { PrismaClient } from '@prisma/client';
import { validateMetric, validateMetricGroup } from '@/lib/ai/metric-validation';

interface Row {
  id: string;
  name: string;
  value: number;
  unit: string | null;
  sourceText: string;
  asOfDate: Date | null;
  weekId: string;
  departmentId: string;
  weekNumber: number;
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT m.id, m.name, m.value, m.unit, m."sourceText", m."asOfDate",
           m."weekId", m."departmentId", w."weekNumber"
    FROM extracted_metrics m
    JOIN weeks w ON w.id = m."weekId"
    ORDER BY w."weekNumber", m."departmentId", m.name
  `;

  // Trung vị mỗi chỉ số trong từng phòng ban, làm mốc so sánh.
  const stats = await prisma.$queryRaw<
    Array<{ departmentId: string; name: string; median: number; count: bigint }>
  >`
    SELECT "departmentId", name,
           percentile_disc(0.5) WITHIN GROUP (ORDER BY value) AS median,
           count(*)::bigint AS count
    FROM extracted_metrics WHERE value > 0
    GROUP BY 1, 2
  `;
  const history = new Map(
    stats.map((s) => [
      `${s.departmentId}|${s.name}`,
      { median: s.median, count: Number(s.count) },
    ]),
  );

  // Gom theo (tuần, phòng ban) để chạy kiểm tra nhóm.
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.weekId}|${r.departmentId}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const flagsById = new Map<string, string[]>();

  for (const group of groups.values()) {
    const groupIssues = validateMetricGroup(
      group.map((r) => ({
        name: r.name,
        value: r.value,
        unit: r.unit,
        sourceText: r.sourceText,
        asOfDate: r.asOfDate?.toISOString().slice(0, 10) ?? null,
      })),
    );

    group.forEach((row, index) => {
      const issues = [
        ...validateMetric(
          {
            name: row.name,
            value: row.value,
            unit: row.unit,
            sourceText: row.sourceText,
            asOfDate: row.asOfDate?.toISOString().slice(0, 10) ?? null,
          },
          history.get(`${row.departmentId}|${row.name}`),
        ),
        ...(groupIssues.get(index) ?? []),
      ];

      if (issues.length > 0) {
        flagsById.set(row.id, issues.map((i) => i.flag));
      }
    });
  }

  const byFlag = new Map<string, number>();
  for (const flags of flagsById.values()) {
    for (const f of flags) byFlag.set(f, (byFlag.get(f) ?? 0) + 1);
  }

  console.log(`${rows.length} số liệu · ${flagsById.size} bản ghi cần rà soát\n`);
  for (const [flag, count] of [...byFlag].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(4)}  ${flag}`);
  }

  // Vài ví dụ mỗi loại, để người dùng thấy ngay có bắt nhầm không.
  console.log('\n  Ví dụ:');
  const shown = new Set<string>();
  for (const row of rows) {
    const flags = flagsById.get(row.id);
    if (!flags) continue;
    const flag = flags[0];
    if (shown.has(flag)) continue;
    shown.add(flag);
    console.log(
      `    ${flag.padEnd(18)} tuần ${String(row.weekNumber).padStart(2)}  ` +
        `${String(row.value).padStart(12)} ${(row.unit ?? '—').padEnd(6)} ` +
        `${row.sourceText.slice(0, 40)}`,
    );
  }

  if (!confirm) {
    console.log('\nChạy thử — chưa ghi gì. Thêm --confirm để đánh dấu.');
    await prisma.$disconnect();
    return;
  }

  // Xoá dấu cũ trước để chạy lại không cộng dồn.
  await prisma.extractedMetric.updateMany({ data: { reviewFlags: [] } });

  let updated = 0;
  for (const [id, flags] of flagsById) {
    await prisma.extractedMetric.update({ where: { id }, data: { reviewFlags: flags } });
    updated += 1;
  }

  console.log(`\n✓ Đánh dấu ${updated} bản ghi`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
