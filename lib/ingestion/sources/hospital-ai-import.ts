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

/**
 * Mốc neo để suy ngày của một tuần báo cáo, đo từ dữ liệu đã có.
 *
 * Bệnh viện đánh số tuần theo lịch riêng, không dùng được ISO week. Tuần chạy
 * từ Thứ Bảy đến Thứ Sáu, nhưng hai tuần đầu năm đều lệch nhịp:
 *
 *   tuần 1:  28/12 Chủ Nhật → 03/01 Thứ Bảy
 *   tuần 2:  02/01 Thứ Sáu  → 08/01 Thứ Năm
 *   tuần 3:  10/01 Thứ Bảy  → 16/01 Thứ Sáu   ← nhịp chuẩn bắt đầu từ đây
 *
 * Nên neo vào tuần 3. Đã đối chiếu với 9 tuần có thật trải từ tháng 1 đến tháng
 * 5 trong hệ thống: khớp toàn bộ.
 */
const WEEK_ANCHOR: Record<number, { weekNumber: number; startIso: string }> = {
  2026: { weekNumber: 3, startIso: '2026-01-10' },
};

/** Một tuần báo cáo dài 7 ngày: Thứ Bảy đến Thứ Sáu. */
const DAYS_PER_WEEK = 7;

/**
 * Suy ngày bắt đầu và kết thúc của một tuần báo cáo.
 *
 * Dùng Date.UTC chứ không phải `new Date(y, m, d)`: hàm sau tính theo múi giờ
 * máy chủ, ở Việt Nam (UTC+7) sẽ lưu lệch về ngày hôm trước.
 */
function computeWeekDates(
  weekNumber: number,
  year: number,
): { startDate: Date; endDate: Date } | null {
  const anchor = WEEK_ANCHOR[year];
  if (!anchor) return null;

  const base = new Date(`${anchor.startIso}T00:00:00.000Z`);
  const offset = (weekNumber - anchor.weekNumber) * DAYS_PER_WEEK * 86_400_000;
  const startDate = new Date(base.getTime() + offset);
  const endDate = new Date(startDate.getTime() + (DAYS_PER_WEEK - 1) * 86_400_000);
  return { startDate, endDate };
}

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
      const weekId = await findOrCreateWeek(sheet, ctx);
      if (!weekId) {
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
