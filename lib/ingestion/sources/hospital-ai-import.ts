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
import type { Connector, FetchResult, SyncContext, UpsertResult } from '../types';

/**
 * Số tuần xử lý tối đa mỗi lần chạy.
 *
 * Mỗi tuần tốn vài phút và hàng chục nghìn token. Giới hạn để một lần chạy
 * không vượt `maxDuration` của route; tuần còn lại xử lý ở lần chạy sau.
 */
const MAX_WEEKS_PER_RUN = 3;

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

    const imported = await ctx.prisma.week.findMany({
      where: {
        OR: sheets.map((s) => ({ year: s.year, weekNumber: s.week })),
        taskProgress: { some: { extractionModel: { not: null } } },
      },
      select: { year: true, weekNumber: true },
    });
    const done = new Set(imported.map((w) => `${w.year}-${w.weekNumber}`));

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
      // Bản ghi tuần là dữ liệu nghiệp vụ; pipeline không tự tạo tuần mới.
      const week = await ctx.prisma.week.findUnique({
        where: { weekNumber_year: { weekNumber: sheet.week, year: sheet.year } },
        select: { id: true },
      });
      if (!week) {
        await ctx.log(
          'warn',
          `Tuần ${sheet.week}/${sheet.year}: chưa có bản ghi tuần trong hệ thống, bỏ qua`,
        );
        skipped += 1;
        continue;
      }

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
        }
      }
    }

    return { upserted, skipped };
  },
};
