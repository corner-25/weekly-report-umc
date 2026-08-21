/**
 * Theo dõi tiến độ nạp báo cáo tuần bệnh viện theo thời gian thực.
 *
 * Vẽ lại bảng mỗi vài giây, hiện tuần nào xong, tuần nào đang chạy, và cảnh báo
 * khi tiến trình đứng im quá lâu — dấu hiệu bị treo do mất mạng.
 *
 * Chạy:
 *   npx tsx prisma/watch-import.ts            # làm mới mỗi 10 giây
 *   npx tsx prisma/watch-import.ts --interval=30
 *   npx tsx prisma/watch-import.ts --once     # in một lần rồi thoát
 *
 * Nhấn Ctrl+C để dừng.
 */
import { PrismaClient } from '@prisma/client';

/** Không ghi gì quá ngần này giây thì nhiều khả năng đã treo. */
const STALL_WARNING_SECONDS = 300;

/** Ngưỡng coi một tuần là đã nạp xong. */
const MIN_RECORDS_DONE = 60;

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';

interface WeekRow {
  weekNumber: number;
  newCount: bigint;
  oldCount: bigint;
  metricCount: bigint;
}

function bar(done: number, total: number, width = 28): string {
  const filled = total > 0 ? Math.round((done / total) * width) : 0;
  return '█'.repeat(filled) + DIM + '░'.repeat(width - filled) + RESET;
}

function formatAgo(seconds: number): string {
  if (seconds < 60) return `${seconds}s trước`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} phút trước`;
  return `${Math.floor(m / 60)}g${m % 60}p trước`;
}

async function render(prisma: PrismaClient): Promise<void> {
  const weeks = await prisma.$queryRaw<WeekRow[]>`
    SELECT w."weekNumber",
           count(*) FILTER (WHERE p."extractionModel" IS NOT NULL) AS "newCount",
           count(*) FILTER (WHERE p."extractionModel" IS NULL)     AS "oldCount",
           (SELECT count(*) FROM extracted_metrics m WHERE m."weekId" = w.id) AS "metricCount"
    FROM weeks w
    LEFT JOIN week_task_progress p ON p."weekId" = w.id
    GROUP BY w.id, w."weekNumber"
    ORDER BY w."weekNumber"
  `;

  const [lastWrite] = await prisma.$queryRaw<Array<{ seconds: number | null }>>`
    SELECT EXTRACT(epoch FROM (now() - max("createdAt")))::int AS seconds
    FROM extracted_metrics
  `;

  const done = weeks.filter((w) => Number(w.newCount) >= MIN_RECORDS_DONE).length;
  const running = weeks.filter(
    (w) => Number(w.newCount) > 0 && Number(w.newCount) < MIN_RECORDS_DONE,
  );
  const totalNew = weeks.reduce((s, w) => s + Number(w.newCount), 0);
  const totalOld = weeks.reduce((s, w) => s + Number(w.oldCount), 0);
  const totalMetrics = weeks.reduce((s, w) => s + Number(w.metricCount), 0);

  // Xoá màn hình rồi vẽ lại — trông như một bảng đứng yên đang tự cập nhật.
  process.stdout.write('\x1b[2J\x1b[H');

  console.log(`${BOLD}NẠP BÁO CÁO TUẦN BỆNH VIỆN${RESET}   ${DIM}${new Date().toLocaleTimeString('vi-VN')}${RESET}\n`);
  console.log(`  ${bar(done, weeks.length)}  ${BOLD}${done}/${weeks.length}${RESET} tuần\n`);

  console.log(`  ${DIM}Tuần   Mới    Cũ  Số liệu${RESET}`);
  for (const w of weeks) {
    const n = Number(w.newCount);
    const o = Number(w.oldCount);
    const m = Number(w.metricCount);

    let mark: string;
    if (n >= MIN_RECORDS_DONE) mark = `${GREEN}✓${RESET}`;
    else if (n > 0) mark = `${YELLOW}▶${RESET}`;
    else mark = `${DIM}·${RESET}`;

    const oldPart = o > 0 ? `${DIM}${String(o).padStart(5)}${RESET}` : '     ';
    console.log(
      `  ${mark} ${String(w.weekNumber).padStart(3)} ` +
        `${String(n).padStart(5)} ${oldPart} ` +
        `${String(m).padStart(7)}`,
    );
  }

  console.log(
    `\n  ${BOLD}${totalNew}${RESET} nhiệm vụ mới · ` +
      `${DIM}${totalOld} bản ghi cũ${RESET} · ` +
      `${CYAN}${totalMetrics.toLocaleString('vi-VN')}${RESET} số liệu`,
  );

  if (running.length > 0) {
    console.log(`  Đang chạy: tuần ${running.map((w) => w.weekNumber).join(', ')}`);
  }

  const stalled = lastWrite?.seconds ?? null;
  if (stalled === null) {
    console.log(`  ${DIM}Chưa có số liệu nào${RESET}`);
  } else if (stalled > STALL_WARNING_SECONDS) {
    console.log(
      `  ${RED}⚠ Không ghi gì ${formatAgo(stalled)} — nhiều khả năng tiến trình đã treo${RESET}`,
    );
  } else {
    console.log(`  ${DIM}Ghi gần nhất: ${formatAgo(stalled)}${RESET}`);
  }

  if (done === weeks.length) {
    console.log(`\n  ${GREEN}${BOLD}✅ ĐÃ NẠP XONG TẤT CẢ${RESET}`);
  }
}

async function main() {
  const once = process.argv.includes('--once');
  const interval = Number(
    process.argv.find((a) => a.startsWith('--interval='))?.split('=')[1] ?? 10,
  );

  const prisma = new PrismaClient();

  if (once) {
    await render(prisma);
    await prisma.$disconnect();
    return;
  }

  console.log('Đang kết nối…');
  let stopping = false;

  process.on('SIGINT', () => {
    stopping = true;
    process.stdout.write(`\n${DIM}Đã dừng theo dõi.${RESET}\n`);
    void prisma.$disconnect().then(() => process.exit(0));
  });

  while (!stopping) {
    try {
      await render(prisma);
    } catch (error) {
      console.error(`${RED}Lỗi đọc database:${RESET}`, error instanceof Error ? error.message : error);
    }
    await new Promise((r) => setTimeout(r, interval * 1000));
  }
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
