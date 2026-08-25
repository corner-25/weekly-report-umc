/**
 * Tách chỉ số ghép gan thành các chỉ số riêng theo đúng bản chất.
 *
 * Bốn loại số liệu khác nhau đang mang cùng tên "Số thứ tự ca ghép gan":
 *
 *   "Tính đến ngày 22/8/2026, BV đã triển khai ca ghép gan thứ 133"  → tích luỹ
 *   "Trong tuần, Bệnh viện đã triển khai 02 ca ghép gan"             → trong tuần
 *   "Tham gia họp Hội đồng tư vấn lấy, ghép bộ phận cơ thể: 03"      → việc khác
 *   "Hỗ trợ 1,7 tỉ đồng viện phí cho hai bệnh nhi ghép gan"          → tiền
 *
 * Gộp chung làm biểu đồ nhảy loạn giữa 133 và 2. Số tích luỹ tăng đều 106 → 133
 * qua 35 tuần, là chỉ số theo dõi thật; ba loại còn lại phải tách ra.
 *
 *   npx tsx prisma/split-transplant-metrics.ts            # chạy thử
 *   npx tsx prisma/split-transplant-metrics.ts --confirm  # ghi thật
 */
import { PrismaClient } from '@prisma/client';
import { backupBeforeWrite } from '@/lib/db-backup';

/**
 * Ngưỡng phân biệt số tích luỹ với số đếm trong tuần.
 *
 * Số tích luỹ bắt đầu từ 106 ở tuần 1; số ca mỗi tuần nhiều nhất là 3. Khoảng
 * cách rộng nên ngưỡng 50 an toàn cho nhiều năm tới.
 */
const CUMULATIVE_THRESHOLD = 50;

/** Nhận ra số liệu về họp hội đồng — việc khác hẳn ca ghép. */
const COUNCIL_MEETING = /h[ộo]i\s*đ[ồo]ng\s*tư\s*v[ấa]n/i;

/** Tên đích cho từng loại. */
const NAMES = {
  cumulative: 'Ca ghép gan luỹ kế',
  weekly: 'Ca ghép gan trong tuần',
  council: 'Họp Hội đồng tư vấn ghép bộ phận cơ thể',
} as const;

interface Row {
  id: string;
  name: string;
  value: number;
  unit: string | null;
  sourceText: string;
  weekNumber: number;
}

/** Phân loại một bản ghi theo nội dung câu gốc và độ lớn giá trị. */
function classify(row: Row): keyof typeof NAMES | 'money' {
  if (COUNCIL_MEETING.test(row.sourceText)) return 'council';

  // Số tiền lọt vào vì câu có chữ "ghép gan" — nhận ra bằng đơn vị.
  if (row.unit === 'VND' || row.value > 1_000_000) return 'money';

  return row.value >= CUMULATIVE_THRESHOLD ? 'cumulative' : 'weekly';
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT m.id, m.name, m.value, m.unit, m."sourceText", w."weekNumber"
    FROM extracted_metrics m
    JOIN weeks w ON w.id = m."weekId"
    WHERE m.name ILIKE '%ghép gan%'
    ORDER BY w."weekNumber", m.value
  `;

  const plans = rows.map((r) => ({ row: r, kind: classify(r) }));

  const byKind = new Map<string, number>();
  for (const p of plans) byKind.set(p.kind, (byKind.get(p.kind) ?? 0) + 1);

  console.log(`${rows.length} bản ghi mang tên chứa "ghép gan"\n`);
  for (const [kind, count] of byKind) {
    const label =
      kind === 'money'
        ? 'số tiền → xoá (lọt vào vì câu có chữ "ghép gan")'
        : `→ "${NAMES[kind as keyof typeof NAMES]}"`;
    console.log(`  ${String(count).padStart(3)}  ${label}`);
  }

  console.log('\n  Mẫu mỗi loại:');
  for (const kind of ['cumulative', 'weekly', 'council', 'money'] as const) {
    const sample = plans.filter((p) => p.kind === kind).slice(0, 2);
    for (const s of sample) {
      console.log(
        `    ${kind.padEnd(11)} tuần ${String(s.row.weekNumber).padStart(2)}  ` +
          `${String(s.row.value).padStart(11)}  ${s.row.sourceText.slice(0, 40)}`,
      );
    }
  }

  // Kiểm tra chuỗi tích luỹ có tăng dần không — nếu lùi thì phân loại sai.
  const cumulative = plans
    .filter((p) => p.kind === 'cumulative')
    .sort((a, b) => a.row.weekNumber - b.row.weekNumber);
  const drops = cumulative.filter(
    (p, i) => i > 0 && p.row.value < cumulative[i - 1].row.value,
  );
  console.log(
    `\n  Chuỗi luỹ kế: ${cumulative[0]?.row.value} → ` +
      `${cumulative[cumulative.length - 1]?.row.value}, ${drops.length} lần lùi`,
  );

  if (!confirm) {
    console.log('\nChạy thử — chưa ghi gì. Thêm --confirm để ghi thật.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nSao lưu:');
  await backupBeforeWrite(prisma, ['extracted_metrics'], 'transplant');

  let renamed = 0;
  for (const p of plans) {
    if (p.kind === 'money') continue;
    const target = NAMES[p.kind];
    if (p.row.name === target) continue;

    await prisma.extractedMetric.update({
      where: { id: p.row.id },
      data: { name: target },
    });
    renamed += 1;
  }

  // Mỗi tuần chỉ giữ MỘT giá trị luỹ kế: số lớn nhất.
  //
  // Tuần có hai ca ghép thì báo cáo nêu cả hai số thứ tự ("ca thứ 109" và
  // "ca thứ 110"); luỹ kế đến cuối tuần là số lớn hơn. Tuần 15 còn lẫn câu
  // quảng bá "113 cuộc đời được hồi sinh" trong khi ca mới nhất là 115.
  const cumulativeRows = await prisma.extractedMetric.findMany({
    where: { name: NAMES.cumulative },
    select: { id: true, value: true, weekId: true },
  });

  const maxByWeek = new Map<string, { id: string; value: number }>();
  for (const r of cumulativeRows) {
    const current = maxByWeek.get(r.weekId);
    if (!current || r.value > current.value) {
      maxByWeek.set(r.weekId, { id: r.id, value: r.value });
    }
  }

  const keepIds = new Set([...maxByWeek.values()].map((v) => v.id));
  const extraIds = cumulativeRows.filter((r) => !keepIds.has(r.id)).map((r) => r.id);

  const extras = await prisma.extractedMetric.deleteMany({
    where: { id: { in: extraIds } },
  });
  if (extras.count > 0) {
    console.log(`✓ Xoá ${extras.count} số thứ tự nhỏ hơn trong cùng tuần`);
  }

  const moneyIds = plans.filter((p) => p.kind === 'money').map((p) => p.row.id);
  const deleted = await prisma.extractedMetric.deleteMany({
    where: { id: { in: moneyIds } },
  });

  console.log(`✓ Đổi tên ${renamed} bản ghi`);
  console.log(`✓ Xoá ${deleted.count} bản ghi số tiền lọt vào`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
