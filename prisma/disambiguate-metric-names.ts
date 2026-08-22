/**
 * Đặt tên phân biệt cho các chỉ số bị gộp nhầm.
 *
 * Một ô kết quả có nhiều dòng cùng nhắc một cụm chữ, ví dụ:
 *
 *   Ngoại trú: 259 lượt; tổng viện phí: 426.780.474 đồng ...
 *   Nội trú:   180 lượt; tổng viện phí: 296.915.500 đồng ...
 *
 * AI trích đúng cả hai, nhưng đặt cùng tên "Tổng viện phí" nên biểu đồ gộp hai
 * đường thành một và giá trị nhảy loạn giữa các tuần.
 *
 * Ngữ cảnh phân biệt nằm ngay trong `rawResultText` — chữ "Ngoại trú:" hoặc
 * "Nội trú:" đứng đầu dòng chứa số liệu. Không cần gọi lại AI: chỉ cần tìm cụm
 * đó ở phần văn bản TRƯỚC vị trí sourceText, trong cùng một dòng.
 *
 * Prompt v3 đã dặn AI tự đặt tên phân biệt; script này xử lý dữ liệu cũ.
 *
 *   npx tsx prisma/disambiguate-metric-names.ts            # chạy thử
 *   npx tsx prisma/disambiguate-metric-names.ts --confirm  # ghi thật
 */
import { PrismaClient } from '@prisma/client';

/**
 * Các chỉ số BHYT được báo cáo song song cho hai nhóm bệnh nhân.
 *
 * Chỉ liệt kê tên đã đo được là có xung đột thật trên dữ liệu, không đoán trước
 * — tên nào chưa gây gộp nhầm thì để nguyên, đổi tên vô cớ sẽ làm đứt chuỗi
 * lịch sử của chỉ số đó.
 */
const AMBIGUOUS_NAMES = new Set([
  'Tổng viện phí',
  'Số tiền được bảo lãnh',
  'Chi phí quản lý',
]);

/** Nhóm bệnh nhân, nhận ra từ chữ đứng đầu dòng chứa số liệu. */
const CONTEXTS = [
  { label: 'ngoại trú', pattern: /ngo[aạ]i\s*tr[uú]/i },
  { label: 'nội trú', pattern: /n[ộo]i\s*tr[uú]/i },
] as const;

/**
 * Tìm nhóm bệnh nhân của một số liệu, dựa trên phần văn bản đứng trước nó.
 *
 * Chỉ xét trong CÙNG MỘT DÒNG: nếu quét cả đoạn thì một dòng "Nội trú" ở trên
 * sẽ gán nhầm cho số liệu của dòng "Ngoại trú" bên dưới.
 */
function findContext(fullText: string, sourceText: string): string | null {
  const pos = fullText.indexOf(sourceText);
  if (pos < 0) return null;

  const before = fullText.slice(0, pos);
  const lineStart = Math.max(before.lastIndexOf('\n'), before.lastIndexOf('\r'));
  const line = before.slice(lineStart + 1);

  for (const ctx of CONTEXTS) {
    if (ctx.pattern.test(line)) return ctx.label;
  }
  return null;
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  const metrics = await prisma.extractedMetric.findMany({
    where: { name: { in: [...AMBIGUOUS_NAMES] } },
    select: {
      id: true, name: true, value: true, sourceText: true,
      weekId: true, masterTaskId: true,
    },
  });

  console.log(`${metrics.length} metric cần phân biệt\n`);

  const renames: Array<{ id: string; from: string; to: string; value: number }> = [];
  let noContext = 0;

  for (const m of metrics) {
    if (!m.masterTaskId) {
      noContext++;
      continue;
    }

    const progress = await prisma.weekTaskProgress.findFirst({
      where: { weekId: m.weekId, masterTaskId: m.masterTaskId },
      select: { rawResultText: true },
    });

    const context = findContext(progress?.rawResultText ?? '', m.sourceText);
    if (!context) {
      noContext++;
      continue;
    }

    renames.push({
      id: m.id,
      from: m.name,
      to: `${m.name} ${context}`,
      value: m.value,
    });
  }

  // Thống kê theo tên mới để thấy hai nhóm tách ra cân đối.
  const byNewName = new Map<string, number>();
  for (const r of renames) byNewName.set(r.to, (byNewName.get(r.to) ?? 0) + 1);

  for (const [name, count] of [...byNewName].sort()) {
    console.log(`  ${name.padEnd(40)} ${count}`);
  }
  if (noContext > 0) {
    console.log(`\n  ${noContext} metric giữ nguyên tên (không tìm được ngữ cảnh)`);
  }

  if (!confirm) {
    console.log('\nChạy thử — chưa ghi gì. Thêm --confirm để ghi thật.');
    await prisma.$disconnect();
    return;
  }

  for (const r of renames) {
    await prisma.extractedMetric.update({ where: { id: r.id }, data: { name: r.to } });
  }
  console.log(`\n✓ Đã đổi tên ${renames.length} metric`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
