/**
 * Chạy lại trích xuất AI cho toàn bộ các tuần với prompt mới.
 *
 * Dùng khi prompt đổi đủ nhiều để dữ liệu cũ không còn nhất quán với dữ liệu
 * mới. Ví dụ v4 dạy AI đặt tên phân biệt nội trú/ngoại trú ngay từ đầu — 33
 * nhóm số liệu cũ mất phần phân biệt này không sửa được bằng script, phải trích
 * lại từ văn bản gốc.
 *
 * Làm TỪNG TUẦN MỘT và chỉ xoá dữ liệu cũ SAU KHI nạp mới xong. Nếu giữa chừng
 * lỗi hoặc mất mạng, các tuần chưa tới lượt vẫn giữ nguyên dữ liệu cũ thay vì
 * mất sạch.
 *
 *   npx tsx prisma/reextract-all-weeks.ts                 # xem kế hoạch
 *   npx tsx prisma/reextract-all-weeks.ts --week=35       # thử một tuần
 *   npx tsx prisma/reextract-all-weeks.ts --confirm       # chạy tất cả
 *   npx tsx prisma/reextract-all-weeks.ts --confirm --from=20  # tiếp từ tuần 20
 */
import { PrismaClient } from '@prisma/client';
import { downloadSharedFile } from '@/lib/ingestion/fetchers/onedrive-share';
import { parseHospitalReport } from '@/lib/ingestion/parsers/hospital-report';
import { extractWeekTasksByDepartment } from '@/lib/ingestion/parsers/hospital-week-tasks';
import { matchDepartment } from '@/lib/ingestion/parsers/department-matcher';
import { importWeekForDepartment } from '@/lib/ai/week-import';
import { PROMPT_VERSION } from '@/lib/ai/prompts';

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const singleWeek = arg('week') ? Number(arg('week')) : undefined;
  const fromWeek = arg('from') ? Number(arg('from')) : undefined;

  // Cùng biến môi trường mà connector hospital-ai-import dùng.
  const shareUrl = process.env.ONEDRIVE_HOSPITAL_REPORT_SHARE_URL;
  if (!shareUrl) throw new Error('Chưa đặt ONEDRIVE_HOSPITAL_REPORT_SHARE_URL');

  const prisma = new PrismaClient();

  console.log(`Prompt hiện tại: ${PROMPT_VERSION}\n`);
  console.log('Tải file nguồn từ OneDrive…');
  const file = await downloadSharedFile(shareUrl);
  const { sheets } = parseHospitalReport(file.buffer);
  console.log(`${sheets.length} tuần trong file\n`);

  const departments = await prisma.department.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });

  // Chỉ xử lý tuần đã có trong hệ thống — script này trích lại, không tạo mới.
  const weeks = await prisma.week.findMany({
    select: { id: true, weekNumber: true, year: true },
    orderBy: [{ year: 'asc' }, { weekNumber: 'asc' }],
  });
  const weekById = new Map(weeks.map((w) => [`${w.year}-${w.weekNumber}`, w.id]));

  let targets = sheets.filter((s) => weekById.has(`${s.year}-${s.week}`));
  if (singleWeek !== undefined) {
    targets = targets.filter((s) => s.week === singleWeek);
  } else if (fromWeek !== undefined) {
    targets = targets.filter((s) => s.week >= fromWeek);
  }
  targets.sort((a, b) => a.year - b.year || a.week - b.week);

  console.log(`Sẽ trích lại ${targets.length} tuần: ${targets.map((t) => t.week).join(', ')}\n`);

  if (!confirm && singleWeek === undefined) {
    const metrics = await prisma.extractedMetric.count();
    const progress = await prisma.weekTaskProgress.count();
    console.log(`Dữ liệu hiện tại: ${metrics} số liệu · ${progress} bản ghi tiến độ`);
    console.log('\nXem kế hoạch — chưa chạy gì.');
    console.log('Thêm --confirm để chạy tất cả, hoặc --week=N để thử một tuần.');
    await prisma.$disconnect();
    return;
  }

  let totalTasks = 0;
  let totalMetrics = 0;
  let totalTokens = 0;
  let oldRemoved = 0;
  const failures: Array<{ week: number; department: string; error: string }> = [];

  for (const sheet of targets) {
    const weekId = weekById.get(`${sheet.year}-${sheet.week}`)!;
    const started = Date.now();

    let weekTasks = 0;
    let weekMetrics = 0;
    let weekTokens = 0;
    let weekFailed = false;

    process.stdout.write(`Tuần ${String(sheet.week).padStart(2)}  `);

    for (const deptTasks of extractWeekTasksByDepartment(sheet)) {
      const match = matchDepartment(deptTasks.departmentName, departments);
      if (!match.departmentId) continue;

      try {
        const summary = await importWeekForDepartment(
          prisma,
          {
            year: sheet.year,
            week: sheet.week,
            departmentId: match.departmentId,
            departmentName: match.dbName ?? deptTasks.departmentName,
            tasks: deptTasks.tasks,
          },
          { extractMetricsEnabled: true },
        );
        weekTasks += summary.tasksMatched;
        weekMetrics += summary.metricsExtracted;
        weekTokens += summary.totalTokens;
      } catch (error) {
        weekFailed = true;
        failures.push({
          week: sheet.week,
          department: match.dbName ?? deptTasks.departmentName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Xoá dữ liệu CŨ của tuần này, giữ lại phần vừa nạp.
    //
    // Nhận ra bằng mốc thời gian: bản ghi tạo trước lúc script bắt đầu xử lý
    // tuần này là của lần trích trước. `extractionModel` chỉ lưu tên model
    // ("glm-4.5") nên không phân biệt được phiên bản prompt.
    //
    // Xoá SAU khi nạp xong: nếu bước trên lỗi thì dữ liệu cũ vẫn còn nguyên,
    // thà có dữ liệu cũ còn hơn mất trắng một tuần.
    if (!weekFailed) {
      const cutoff = new Date(started);
      const removed = await prisma.extractedMetric.deleteMany({
        where: { weekId, createdAt: { lt: cutoff } },
      });
      await prisma.weekTaskProgress.deleteMany({
        where: { weekId, createdAt: { lt: cutoff } },
      });
      oldRemoved += removed.count;
    }

    const seconds = Math.round((Date.now() - started) / 1000);
    console.log(
      `${String(weekTasks).padStart(3)} nhiệm vụ · ${String(weekMetrics).padStart(3)} số liệu · ` +
        `${seconds}s · ${weekTokens.toLocaleString('vi-VN')} tokens` +
        (weekFailed ? '  ← CÓ LỖI, giữ dữ liệu cũ' : ''),
    );

    totalTasks += weekTasks;
    totalMetrics += weekMetrics;
    totalTokens += weekTokens;
  }

  console.log(
    `\nTổng: ${totalTasks} nhiệm vụ · ${totalMetrics} số liệu · ` +
      `${totalTokens.toLocaleString('vi-VN')} tokens`,
  );
  console.log(`Đã xoá ${oldRemoved} số liệu của lần trích trước`);

  if (failures.length > 0) {
    console.log(`\n${failures.length} phòng lỗi:`);
    for (const f of failures.slice(0, 10)) {
      console.log(`  tuần ${f.week} · ${f.department}: ${f.error.slice(0, 60)}`);
    }
  }

  const after = await prisma.extractedMetric.groupBy({ by: ['name'] });
  console.log(`\nCòn ${after.length} tên chỉ số riêng biệt`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
