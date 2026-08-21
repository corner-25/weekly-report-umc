/**
 * Nạp thử báo cáo tuần bệnh viện từ OneDrive vào database.
 *
 * Dùng để kiểm chứng pipeline trước khi bật chạy tự động. Chạy thật thì dùng
 * connector `hospital-ai-import` qua /api/cron/sync.
 *
 * Chạy:
 *   npx tsx prisma/import-hospital-week.ts --week=17 [--year=2026] [--dept="TÊN"]
 *   npx tsx prisma/import-hospital-week.ts --week=17 --no-metrics
 */
import { PrismaClient } from '@prisma/client';
import { downloadSharedFile } from '@/lib/ingestion/fetchers/onedrive-share';
import { parseHospitalReport } from '@/lib/ingestion/parsers/hospital-report';
import { extractWeekTasksByDepartment } from '@/lib/ingestion/parsers/hospital-week-tasks';
import { matchDepartment } from '@/lib/ingestion/parsers/department-matcher';
import { importWeekForDepartment } from '@/lib/ai/week-import';

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
}

async function main() {
  const week = Number(arg('week'));
  const year = Number(arg('year') ?? 2026);
  const onlyDept = arg('dept');
  const withMetrics = !process.argv.includes('--no-metrics');

  if (!week) throw new Error('Thiếu --week=<số tuần>');

  const shareUrl = process.env.ONEDRIVE_HOSPITAL_REPORT_SHARE_URL;
  if (!shareUrl) throw new Error('Chưa đặt ONEDRIVE_HOSPITAL_REPORT_SHARE_URL');

  const prisma = new PrismaClient();

  console.log(`Tải workbook từ OneDrive…`);
  const file = await downloadSharedFile(shareUrl);
  const { sheets } = parseHospitalReport(file.buffer);

  const sheet = sheets.find((s) => s.week === week && s.year === year);
  if (!sheet) {
    throw new Error(
      `Không có sheet tuần ${week}/${year}. Các tuần có trong file: ` +
        sheets.map((s) => s.week).join(', '),
    );
  }

  const departments = await prisma.department.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });

  const byDept = extractWeekTasksByDepartment(sheet).filter(
    (d) => !onlyDept || d.departmentName === onlyDept,
  );

  console.log(`Tuần ${week}/${year}: ${byDept.length} phòng, ` +
    `${byDept.reduce((s, d) => s + d.tasks.length, 0)} nhiệm vụ\n`);

  let totalTokens = 0;
  let totalMatched = 0;
  let totalFree = 0;
  let totalMetrics = 0;
  let totalFlagged = 0;

  for (const deptTasks of byDept) {
    const match = matchDepartment(deptTasks.departmentName, departments);
    if (!match.departmentId) {
      console.log(`✗ ${deptTasks.departmentName} — không khớp phòng trong DB`);
      continue;
    }

    process.stdout.write(`▸ ${match.dbName} (${deptTasks.tasks.length})… `);
    try {
      const s = await importWeekForDepartment(
        prisma,
        {
          year,
          week,
          departmentId: match.departmentId,
          departmentName: match.dbName ?? deptTasks.departmentName,
          tasks: deptTasks.tasks,
        },
        { extractMetricsEnabled: withMetrics },
      );

      totalTokens += s.totalTokens;
      totalMatched += s.tasksMatched;
      totalFree += s.freeMatches;
      totalMetrics += s.metricsExtracted;
      totalFlagged += s.metricsFlagged;

      const flag = s.metricsFlagged > 0 ? ` · ${s.metricsFlagged} cần rà soát` : '';
      const miss = s.tasksUnmatched > 0 ? ` · ${s.tasksUnmatched} KHÔNG KHỚP` : '';
      console.log(
        `${s.tasksMatched} khớp (${s.freeMatches} miễn phí)${miss} · ` +
          `${s.metricsExtracted} số liệu${flag} · ${s.totalTokens.toLocaleString('vi-VN')} tokens`,
      );
    } catch (error) {
      console.log(`LỖI: ${error instanceof Error ? error.message.slice(0, 100) : error}`);
    }
  }

  console.log(`\n═══ TỔNG ═══`);
  console.log(`${totalMatched} nhiệm vụ khớp (${totalFree} không tốn token)`);
  console.log(`${totalMetrics} số liệu trích được, ${totalFlagged} cần rà soát`);
  console.log(`${totalTokens.toLocaleString('vi-VN')} tokens`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
