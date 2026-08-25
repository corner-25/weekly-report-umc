/**
 * Tự động nạp báo cáo tuần bệnh viện: OneDrive → AI → Postgres.
 *
 * Chạy hằng ngày cùng các nguồn khác. Chỉ xử lý **tuần chưa có dữ liệu** — quét
 * workbook, so với những gì đã nạp, và bỏ qua phần không đổi. Nhờ vậy chạy mỗi
 * ngày mà chi phí gần bằng không khi chưa có tuần mới.
 *
 * Ba tầng bỏ qua, rẻ tới đắt:
 *   1. Checksum workbook không đổi → runner bỏ qua trước cả khi vào đây
 *   2. Tuần đã nạp đủ → không gọi AI cho tuần đó
 *   3. Nhiệm vụ khớp được bằng alias → không gọi AI cho dòng đó
 *
 * Xem docs/HOSPITAL-REPORT-PIPELINE.md.
 */
import { SyncSourceKind } from '@prisma/client';
import { computeChecksum } from '../checksum';
import { downloadSharedFile } from '../fetchers/onedrive-share';
import { parseHospitalReport, type HospitalWeekSheet } from '../parsers/hospital-report';
import { extractWeekTasksByDepartment } from '../parsers/hospital-week-tasks';
import { matchDepartment } from '../parsers/department-matcher';
import { importWeekForDepartment } from '@/lib/ai/week-import';
import { computeWeekDates } from '@/lib/report-week';
import type { Connector, FetchResult, SyncContext, UpsertResult } from '../types';

/**
 * Số tuần xử lý tối đa mỗi lần chạy.
 *
 * Mỗi tuần tốn vài phút và hàng chục nghìn token. Giới hạn để một lần chạy
 * không vượt `maxDuration` của route; tuần còn lại xử lý ở lần chạy sau.
 */
const MAX_WEEKS_PER_RUN = 3;

/**
 * Tỷ lệ so với tuần trung vị để coi một tuần là nạp dở.
 *
 * Các tuần đầy đủ dao động 75-95 nhiệm vụ, khá đều. Một tuần đứt gánh giữa
 * chừng chỉ có vài chục. Lấy nửa trung vị làm ranh giới: đủ rộng để không đụng
 * vào tuần thật sự ít việc, đủ chặt để bắt được lần nạp hỏng.
 */
const PARTIAL_LOAD_RATIO = 0.5;

/**
 * Lấy bản ghi tuần, tạo mới nếu chưa có.
 *
 * Trước đây connector chỉ tìm chứ không tạo, với lý do "bản ghi tuần là dữ liệu
 * nghiệp vụ". Nhưng không có bước nào khác tạo chúng, nên pipeline bế tắc: 12
 * tuần nằm chờ và mỗi ngày cron lại ghi warn rồi bỏ qua. Nay tự tạo ở trạng thái
 * DRAFT để người phụ trách vẫn duyệt trước khi công bố.
 */
async function findOrCreateWeek(
  sheet: HospitalWeekSheet,
  ctx: SyncContext,
): Promise<string | null> {
  const existing = await ctx.prisma.week.findUnique({
    where: { weekNumber_year: { weekNumber: sheet.week, year: sheet.year } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const dates = computeWeekDates(sheet.week, sheet.year);
  if (!dates) {
    await ctx.log(
      'warn',
      `Tuần ${sheet.week}/${sheet.year}: chưa biết mốc tuần của năm ${sheet.year}, bỏ qua`,
    );
    return null;
  }

  // Gán cho người đã tạo tuần gần nhất — họ là người phụ trách báo cáo.
  const lastWeek = await ctx.prisma.week.findFirst({
    orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }],
    select: { createdById: true },
  });
  if (!lastWeek) {
    await ctx.log('warn', `Tuần ${sheet.week}/${sheet.year}: hệ thống chưa có tuần nào để lấy người phụ trách`);
    return null;
  }

  const created = await ctx.prisma.week.create({
    data: {
      weekNumber: sheet.week,
      year: sheet.year,
      startDate: dates.startDate,
      endDate: dates.endDate,
      createdById: lastWeek.createdById,
      status: 'DRAFT',
    },
    select: { id: true },
  });

  const fmt = (d: Date) => d.toISOString().slice(0, 10).split('-').reverse().join('/');
  await ctx.log(
    'info',
    `Tạo tuần ${sheet.week}/${sheet.year} (${fmt(dates.startDate)} - ${fmt(dates.endDate)})`,
  );
  return created.id;
}

interface HospitalAiConfig {
  shareUrlEnv: string;
  /** Bỏ qua trích số liệu khi chỉ muốn khớp nhiệm vụ (tiết kiệm token). */
  extractMetrics?: boolean;
}

function readConfig(ctx: SyncContext): HospitalAiConfig {
  const config = ctx.source.config as Record<string, unknown> | null;
  const shareUrlEnv = typeof config?.shareUrlEnv === 'string' ? config.shareUrlEnv : null;
  if (!shareUrlEnv) throw new Error('Thiếu "shareUrlEnv" trong SyncSource.config');

  return {
    shareUrlEnv,
    extractMetrics: config?.extractMetrics !== false,
  };
}

export const hospitalAiImport: Connector<Buffer, HospitalWeekSheet> = {
  id: 'hospital-ai-import',
  name: 'Báo cáo bệnh viện — tự động nạp bằng AI',
  kind: SyncSourceKind.ONEDRIVE_SHARE,

  async fetch(ctx: SyncContext): Promise<FetchResult<Buffer>> {
    const { shareUrlEnv } = readConfig(ctx);
    const shareUrl = process.env[shareUrlEnv];
    if (!shareUrl) throw new Error(`Biến môi trường ${shareUrlEnv} chưa được đặt`);

    const file = await downloadSharedFile(shareUrl);
    await ctx.log('info', `Đã tải ${(file.byteLength / 1024).toFixed(0)}KB từ OneDrive`);
    return { raw: file.buffer, checksum: computeChecksum(file.buffer) };
  },

  /**
   * Lọc ra các tuần CHƯA nạp.
   *
   * Một tuần coi là đã nạp khi bản ghi `Week` tồn tại và đã có `WeekTaskProgress`
   * mang dấu vết trích xuất AI. Tuần người dùng nhập tay cũng được tôn trọng:
   * pipeline không ghi đè công sức nhập liệu của họ.
   */
  async parse(buffer: Buffer, ctx: SyncContext): Promise<HospitalWeekSheet[]> {
    const { sheets, skippedSheets } = parseHospitalReport(buffer);

    for (const s of skippedSheets) {
      await ctx.log('warn', `Bỏ qua sheet "${s.sheetName}": ${s.reason}`);
    }
    if (sheets.length === 0) {
      throw new Error('Không đọc được sheet tuần nào — kiểm tra lại định dạng file nguồn');
    }

    // Một tuần coi là xong khi bản ghi chờ của nó đã chuyển APPROVED — dấu do
    // upsert() đặt sau khi nạp trót lọt mọi phòng.
    //
    // Trước đây điều kiện là "tuần có ít nhất một WeekTaskProgress", nhưng
    // `some` không phân biệt được nạp xong với nạp dở: một lần mất mạng giữa
    // chừng để lại 18/82 nhiệm vụ, và tuần đó bị coi là đã xong rồi bỏ qua vĩnh
    // viễn — mất 64 nhiệm vụ mà không có dấu hiệu gì.
    const approved = await ctx.prisma.pendingAiImport.findMany({
      where: {
        status: 'APPROVED',
        OR: sheets.map((s) => ({ year: s.year, week: s.week })),
      },
      select: { year: true, week: true },
    });
    const done = new Set(approved.map((p) => `${p.year}-${p.week}`));

    // Tuần người dùng nhập tay không có bản ghi chờ nào, nhưng vẫn phải được
    // tôn trọng — pipeline không ghi đè công sức nhập liệu của họ.
    const manual = await ctx.prisma.week.findMany({
      where: {
        OR: sheets.map((s) => ({ year: s.year, weekNumber: s.week })),
        taskProgress: { some: { extractionModel: null } },
      },
      select: { year: true, weekNumber: true },
    });
    for (const w of manual) done.add(`${w.year}-${w.weekNumber}`);

    // Tuần nạp dở: có dữ liệu nhưng ít bất thường so với các tuần bình thường.
    //
    // Không thể chỉ dựa vào "chưa có dấu APPROVED": 21 tuần nạp trước khi có cơ
    // chế đánh dấu cũng không có dấu, và xoá chúng là mất 1.750 nhiệm vụ dữ liệu
    // tốt. Dùng số nhiệm vụ làm bằng chứng — một tuần đầy đủ có khoảng 80 nhiệm
    // vụ, tuần đứt gánh giữa chừng chỉ vài chục.
    const complete = await ctx.prisma.week.findMany({
      where: { taskProgress: { some: { extractionModel: { not: null } } } },
      select: { year: true, weekNumber: true, _count: { select: { taskProgress: true } } },
    });
    const counts = complete.map((w) => w._count.taskProgress).sort((a, b) => a - b);
    const median = counts.length > 0 ? counts[Math.floor(counts.length / 2)] : 0;
    const partialThreshold = Math.floor(median * PARTIAL_LOAD_RATIO);

    for (const w of complete) {
      const key = `${w.year}-${w.weekNumber}`;
      if (done.has(key)) continue;
      if (w._count.taskProgress >= partialThreshold) {
        // Đủ nhiều để coi là nạp xong, chỉ thiếu dấu vì nạp trước khi có cơ chế.
        done.add(key);
      }
    }

    // Phần còn lại mới thật sự là nạp dở — xoá để nạp lại từ đầu.
    for (const w of complete) {
      const key = `${w.year}-${w.weekNumber}`;
      if (done.has(key)) continue;

      const week = await ctx.prisma.week.findUnique({
        where: { weekNumber_year: { weekNumber: w.weekNumber, year: w.year } },
        select: { id: true },
      });
      if (!week) continue;

      await ctx.prisma.extractedMetric.deleteMany({ where: { weekId: week.id } });
      const removed = await ctx.prisma.weekTaskProgress.deleteMany({
        where: { weekId: week.id },
      });
      await ctx.log(
        'warn',
        `Tuần ${w.weekNumber}/${w.year}: chỉ có ${removed.count}/${median} nhiệm vụ ` +
          `— nạp dở ở lần trước, xoá để nạp lại`,
      );
    }

    const pending = sheets
      .filter((s) => !done.has(`${s.year}-${s.week}`))
      .sort((a, b) => a.year - b.year || a.week - b.week);

    await ctx.log(
      'info',
      `${sheets.length} tuần trong file · ${done.size} đã nạp · ${pending.length} cần xử lý`,
    );

    if (pending.length === 0) return [];

    const batch = pending.slice(0, MAX_WEEKS_PER_RUN);
    if (pending.length > batch.length) {
      await ctx.log(
        'info',
        `Xử lý ${batch.length} tuần lần này (tuần ${batch.map((s) => s.week).join(', ')}); ` +
          `${pending.length - batch.length} tuần còn lại chạy ở lần sau`,
      );
    }
    return batch;
  },

  async upsert(sheets: HospitalWeekSheet[], ctx: SyncContext): Promise<UpsertResult> {
    if (sheets.length === 0) {
      await ctx.log('info', 'Không có tuần mới — dữ liệu đã cập nhật');
      return { upserted: 0, skipped: 0 };
    }

    const { extractMetrics } = readConfig(ctx);
    const departments = await ctx.prisma.department.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    });

    let upserted = 0;
    let skipped = 0;

    for (const sheet of sheets) {
      const weekId = await findOrCreateWeek(sheet, ctx);
      if (!weekId) {
        skipped += 1;
        continue;
      }

      /** Có phòng nào lỗi không — quyết định tuần này đã xong hẳn chưa. */
      let weekHadError = false;

      for (const deptTasks of extractWeekTasksByDepartment(sheet)) {
        const match = matchDepartment(deptTasks.departmentName, departments);
        if (!match.departmentId) {
          await ctx.log(
            'warn',
            `Tuần ${sheet.week}: phòng "${deptTasks.departmentName}" chưa có trong hệ thống`,
          );
          skipped += 1;
          continue;
        }

        try {
          const summary = await importWeekForDepartment(
            ctx.prisma,
            {
              year: sheet.year,
              week: sheet.week,
              departmentId: match.departmentId,
              departmentName: match.dbName ?? deptTasks.departmentName,
              tasks: deptTasks.tasks,
            },
            { extractMetricsEnabled: extractMetrics },
          );

          upserted += summary.tasksMatched;
          skipped += summary.tasksUnmatched;

          await ctx.log(
            'info',
            `Tuần ${sheet.week} · ${match.dbName}: ${summary.tasksMatched} nhiệm vụ ` +
              `(${summary.freeMatches} khớp không tốn token) · ` +
              `${summary.metricsExtracted} số liệu · ${summary.totalTokens.toLocaleString('vi-VN')} tokens`,
          );

          if (summary.metricsFlagged > 0) {
            await ctx.log(
              'warn',
              `Tuần ${sheet.week} · ${match.dbName}: ${summary.metricsFlagged} số liệu cần rà soát`,
            );
          }
        } catch (error) {
          // Một phòng lỗi không nên chặn các phòng còn lại.
          const message = error instanceof Error ? error.message : 'Lỗi không xác định';
          await ctx.log('error', `Tuần ${sheet.week} · ${match.dbName}: ${message}`);
          skipped += deptTasks.tasks.length;
          weekHadError = true;
        }
      }

      // Đánh dấu đã xử lý để trang quản trị không báo "chờ duyệt" mãi. Tuần có
      // phòng lỗi thì giữ PENDING — còn việc phải làm lại.
      if (!weekHadError) {
        await ctx.prisma.pendingAiImport.updateMany({
          where: { year: sheet.year, week: sheet.week, status: 'PENDING' },
          data: { status: 'APPROVED', reviewedAt: new Date() },
        });
      }
    }

    return { upserted, skipped };
  },
};
