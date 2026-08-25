/**
 * Gỡ nốt các chỉ số trùng giá trị mà script trước không tự quyết được.
 *
 * Hai loại, xác định bằng cách đọc lại văn bản gốc:
 *
 * 1. MẤT PHẦN PHÂN BIỆT NỘI/NGOẠI TRÚ
 *
 *      "Ngoại trú: 191 lượt; ... chi phí quản lý: 19.382.999 đồng
 *       Nội trú:    13 lượt; ... chi phí quản lý:  4.900.000 đồng"
 *
 *    AI trích đúng cả hai nhưng đặt cùng tên "Chi phí quản lý". Ngữ cảnh nằm ở
 *    đầu dòng chứa số liệu, nên đọc ra được bằng mã — không cần gọi lại AI.
 *
 * 2. NGÀY THÁNG BỊ TÁCH THÀNH CHỈ SỐ
 *
 *      "biên bản đối chiếu công nợ ... thời điểm 31/12/2025"
 *        → ba bản ghi: 31 ngày, 12 tháng, 2025 năm
 *
 *    Đây là mốc thời gian của một sự việc, không phải số đo công việc. Xoá hẳn.
 *
 *   npx tsx prisma/fix-ambiguous-metrics.ts            # chạy thử
 *   npx tsx prisma/fix-ambiguous-metrics.ts --confirm  # ghi thật
 */
import { PrismaClient } from '@prisma/client';
import { backupBeforeWrite } from '@/lib/db-backup';

/** Đơn vị chỉ dùng cho thành phần ngày tháng, không đo lường công việc. */
const DATE_PART_UNITS = new Set(['ngày', 'tháng', 'năm']);

/** Nhóm bệnh nhân, nhận ra từ chữ đứng đầu dòng chứa số liệu. */
const PATIENT_GROUPS = [
  { label: 'ngoại trú', pattern: /ngo[aạ]i\s*tr[uú]/i },
  { label: 'nội trú', pattern: /n[ộo]i\s*tr[uú]/i },
] as const;

/**
 * Tìm nhóm bệnh nhân của một số liệu, dựa trên phần văn bản đứng trước nó.
 *
 * Chỉ xét trong CÙNG MỘT DÒNG: quét cả đoạn thì dòng "Nội trú" ở trên sẽ gán
 * nhầm cho số liệu của dòng "Ngoại trú" bên dưới.
 */
function findPatientGroup(fullText: string, sourceText: string): string | null {
  const pos = fullText.indexOf(sourceText);
  if (pos < 0) return null;

  const before = fullText.slice(0, pos);
  const lineStart = Math.max(before.lastIndexOf('\n'), before.lastIndexOf('\r'));
  const line = before.slice(lineStart + 1);

  for (const group of PATIENT_GROUPS) {
    if (group.pattern.test(line)) return group.label;
  }
  return null;
}

/**
 * Có phải bản ghi này chỉ là một mảnh của ngày tháng không.
 *
 * Dấu hiệu: đơn vị là ngày/tháng/năm VÀ câu gốc chứa một ngày đầy đủ.
 */
function isDatePart(unit: string | null, sourceText: string): boolean {
  if (!unit || !DATE_PART_UNITS.has(unit.toLowerCase().trim())) return false;
  return /\d{1,2}\/\d{1,2}\/\d{4}/.test(sourceText);
}

interface Row {
  id: string;
  name: string;
  value: number;
  unit: string | null;
  sourceText: string;
  weekId: string;
  departmentId: string;
  masterTaskId: string | null;
  weekNumber: number;
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT m.id, m.name, m.value, m.unit, m."sourceText",
           m."weekId", m."departmentId", m."masterTaskId", w."weekNumber"
    FROM extracted_metrics m
    JOIN weeks w ON w.id = m."weekId"
    WHERE EXISTS (
      SELECT 1 FROM extracted_metrics b
      WHERE b."weekId" = m."weekId"
        AND b."departmentId" = m."departmentId"
        AND b.name = m.name
        AND b.value <> m.value
    )
    ORDER BY w."weekNumber", m.name
  `;

  const renames: Array<{ id: string; from: string; to: string; week: number }> = [];
  const dateParts: Row[] = [];
  const unresolved: Row[] = [];

  // Gom theo nhóm để biết cả nhóm có giải quyết được không.
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.weekId}|${r.departmentId}|${r.name}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  for (const group of groups.values()) {
    // Mảnh ngày tháng: xoá cả nhóm nếu MỌI bản ghi đều là mảnh ngày.
    if (group.every((r) => isDatePart(r.unit, r.sourceText))) {
      dateParts.push(...group);
      continue;
    }

    // Thử tách theo nhóm bệnh nhân.
    const progress = group[0].masterTaskId
      ? await prisma.weekTaskProgress.findFirst({
          where: { weekId: group[0].weekId, masterTaskId: group[0].masterTaskId },
          select: { rawResultText: true },
        })
      : null;

    const labels = group.map((r) =>
      findPatientGroup(progress?.rawResultText ?? '', r.sourceText),
    );

    // Chỉ đổi tên khi MỌI bản ghi tìm được nhóm VÀ các nhóm khác nhau —
    // cùng nhóm nghĩa là hai số liệu riêng, đổi tên không giải quyết gì.
    const allFound = labels.every((l) => l !== null);
    const allDistinct = new Set(labels).size === group.length;

    if (allFound && allDistinct) {
      group.forEach((r, i) => {
        renames.push({
          id: r.id,
          from: r.name,
          to: `${r.name} ${labels[i]}`,
          week: r.weekNumber,
        });
      });
      continue;
    }

    unresolved.push(...group);
  }

  console.log(`${groups.size} nhóm trùng giá trị\n`);

  console.log(`Tách được theo nội/ngoại trú: ${renames.length} metric`);
  for (const r of renames.slice(0, 8)) {
    console.log(`  tuần ${String(r.week).padStart(2)}  ${r.from.slice(0, 34).padEnd(36)} → ${r.to.slice(0, 44)}`);
  }
  if (renames.length > 8) console.log(`  … và ${renames.length - 8} metric nữa`);

  console.log(`\nMảnh ngày tháng, xoá: ${dateParts.length} metric`);
  for (const d of dateParts.slice(0, 6)) {
    console.log(
      `  tuần ${String(d.weekNumber).padStart(2)}  ${String(d.value).padStart(5)} ${(d.unit ?? '').padEnd(7)} ` +
        `${d.sourceText.slice(0, 44)}`,
    );
  }

  if (unresolved.length > 0) {
    console.log(`\nVẫn chưa rõ: ${unresolved.length} metric`);
    for (const u of unresolved.slice(0, 6)) {
      console.log(
        `  tuần ${String(u.weekNumber).padStart(2)}  ${u.name.slice(0, 32).padEnd(34)} ` +
          `${String(u.value).padStart(12)}  ${u.sourceText.slice(0, 34)}`,
      );
    }
  }

  if (!confirm) {
    console.log('\nChạy thử — chưa ghi gì. Thêm --confirm để ghi thật.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nSao lưu:');
  await backupBeforeWrite(prisma, ['extracted_metrics'], 'ambiguous');

  for (const r of renames) {
    await prisma.extractedMetric.update({ where: { id: r.id }, data: { name: r.to } });
  }
  console.log(`✓ Đổi tên ${renames.length} metric`);

  const deleted = await prisma.extractedMetric.deleteMany({
    where: { id: { in: dateParts.map((d) => d.id) } },
  });
  console.log(`✓ Xoá ${deleted.count} mảnh ngày tháng`);

  const remaining = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*)::bigint AS count FROM (
      SELECT "weekId", "departmentId", name FROM extracted_metrics
      GROUP BY 1, 2, 3 HAVING count(DISTINCT value) > 1
    ) x
  `;
  console.log(`\nCòn ${Number(remaining[0].count)} nhóm trùng.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
