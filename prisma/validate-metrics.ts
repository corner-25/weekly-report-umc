/**
 * Chạy kiểm tra theo danh mục chỉ số chuẩn trên số liệu đã nạp.
 *
 * Mặc định chỉ BÁO CÁO (không ghi gì). Thêm --apply để gắn cờ vào
 * extracted_metrics.reviewFlags — cờ cũ của cùng loại được thay, cờ khác giữ.
 *
 * Chạy: npx tsx prisma/validate-metrics.ts [--apply] [--year 2026]
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { validateAgainstCatalog, type CatalogFlag, type CatalogNodeInfo } from '@/lib/ai/catalog-validation';

const CATALOG_FLAGS: readonly CatalogFlag[] = ['UNIT_MISMATCH', 'CHILD_EXCEEDS_PARENT', 'COPIED_VALUE', 'EXCEL_MISMATCH'];
const APPLY = process.argv.includes('--apply');
const yearArg = process.argv.indexOf('--year');
const YEAR = yearArg > 0 ? Number(process.argv[yearArg + 1]) : 2026;

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const nodes = await prisma.metricNode.findMany({
    select: { code: true, unit: true, parentCode: true, aggregation: true, hcCategory: true, hcContent: true },
  });
  const nodeInfo = new Map<string, CatalogNodeInfo>(
    nodes.map((n) => [n.code, { unit: n.unit, parentCode: n.parentCode, aggregation: n.aggregation }]),
  );
  const aliases = await prisma.metricAlias.findMany({
    where: { status: 'MAPPED' },
    select: { departmentId: true, aliasName: true, unit: true, nodeCode: true },
  });
  const nodeOf = new Map(aliases.map((a) => [`${a.departmentId}|${a.aliasName}|${a.unit}`, a.nodeCode]));

  // Số Excel chính thức theo (mã chỉ số, tuần).
  const hcNodes = nodes.filter((n) => n.hcCategory && n.hcContent);
  const hc = await prisma.hcMetric.findMany({ where: { year: YEAR }, select: { category: true, content: true, week: true, value: true } });
  const excel = new Map<number, Map<string, number>>();
  for (const n of hcNodes) {
    for (const h of hc) {
      if (h.category !== n.hcCategory || h.content !== n.hcContent) continue;
      excel.set(h.week, (excel.get(h.week) ?? new Map()).set(n.code, h.value));
    }
  }

  const metrics = await prisma.extractedMetric.findMany({
    where: { week: { year: YEAR }, period: 'WEEK' },
    select: {
      id: true, name: true, unit: true, value: true, departmentId: true, reviewFlags: true, sourceText: true,
      week: { select: { weekNumber: true } }, department: { select: { name: true } },
    },
  });

  // Nhóm theo phòng × tuần.
  const groups = new Map<string, typeof metrics>();
  for (const m of metrics) {
    const key = `${m.departmentId}|${m.week.weekNumber}`;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }

  const counts = new Map<string, number>();
  const samples = new Map<string, string[]>();
  const updates: Array<{ id: string; reviewFlags: string[] }> = [];

  for (const rows of groups.values()) {
    const week = rows[0].week.weekNumber;
    const input = rows.map((m) => ({
      nodeCode: nodeOf.get(`${m.departmentId}|${m.name}|${m.unit ?? ''}`) ?? null,
      value: m.value,
      unit: m.unit,
    }));
    const issues = validateAgainstCatalog(input, nodeInfo, excel.get(week));

    rows.forEach((m, i) => {
      const found = issues.get(i) ?? [];
      for (const issue of found) {
        counts.set(`${m.department.name}|${issue.flag}`, (counts.get(`${m.department.name}|${issue.flag}`) ?? 0) + 1);
        const list = samples.get(issue.flag) ?? [];
        if (list.length < 4) {
          list.push(`T${week} ${m.department.name} · "${m.name}" = ${m.value.toLocaleString('vi-VN')} — ${issue.message}`);
          samples.set(issue.flag, list);
        }
      }
      const kept = m.reviewFlags.filter((f) => !(CATALOG_FLAGS as readonly string[]).includes(f));
      const next = [...kept, ...new Set(found.map((x) => x.flag))];
      if (next.join() !== m.reviewFlags.join()) updates.push({ id: m.id, reviewFlags: next });
    });
  }

  console.info(`${metrics.length} số liệu · ${groups.size} phòng-tuần · ${updates.length} cần cập nhật cờ\n`);
  const byFlag = new Map<string, number>();
  for (const [key, n] of counts) byFlag.set(key.split('|')[1], (byFlag.get(key.split('|')[1]) ?? 0) + n);
  for (const flag of CATALOG_FLAGS) {
    console.info(`${flag}: ${byFlag.get(flag) ?? 0}`);
    for (const s of samples.get(flag) ?? []) console.info(`   ${s.slice(0, 220)}`);
  }
  console.info('\nTheo phòng:');
  for (const [key, n] of [...counts].sort((a, b) => b[1] - a[1])) console.info(`  ${n.toString().padStart(4)}  ${key.replace('|', ' · ')}`);

  if (!APPLY) {
    console.info('\n(chạy thử — chưa ghi gì; thêm --apply để gắn cờ)');
    return;
  }
  for (const u of updates) {
    await prisma.extractedMetric.update({ where: { id: u.id }, data: { reviewFlags: u.reviewFlags } });
  }
  console.info(`\n✓ Đã cập nhật cờ cho ${updates.length} số liệu`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
