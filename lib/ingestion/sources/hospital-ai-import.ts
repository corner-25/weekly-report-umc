/**
 * Tự động nạp báo cáo tuần bệnh viện: OneDrive → AI → Postgres.
 *
 * Chạy hằng ngày cùng các nguồn khác. Chỉ xử lý **tuần chưa có dữ liệu** — quét
 * workbook, so với những gì đã nạp, và bỏ qua phần không đổi. Nhờ vậy chạy mỗi
 * ngày mà chi phí gần bằng không khi chưa có tuần mới.
 *
 * Bốn tầng bỏ qua, rẻ tới đắt:
 *   1. Checksum workbook không đổi → runner bỏ qua trước cả khi vào đây
 *   2. Tuần cũ đã nạp đủ → không gọi AI cho tuần đó
 *   3. Tuần gần đây: phòng có nội dung không đổi so với lần nạp trước → bỏ qua
 *   4. Nhiệm vụ khớp được bằng alias → không gọi AI cho dòng đó
 *
 * Tầng 3 tồn tại vì sheet tuần mới được CHÉP từ tuần trước rồi các phòng sửa
 * dần. Trước đây tuần đã nạp thì đóng băng, nên tuần 35-39 giữ nguyên bản chép
 * — số liệu lệch đúng một tuần. Xem `parsers/department-snapshot.ts`.
 *
 * Xem docs/HOSPITAL-REPORT-PIPELINE.md.
 */
import { SyncSourceKind } from '@prisma/client';
import { computeChecksum } from '../checksum';
import { downloadSharedFile } from '../fetchers/onedrive-share';
import { parseHospitalReport, type HospitalWeekSheet } from '../parsers/hospital-report';
import { extractWeekTasksByDepartment } from '../parsers/hospital-week-tasks';
import { matchDepartment } from '../parsers/department-matcher';
import { departmentContentHash, isUneditedCopy } from '../parsers/department-snapshot';
import { importWeekForDepartment } from '@/lib/ai/week-import';
import { rowsFromSheets, syncDepartment } from '@/lib/task-tracking/pipeline';
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
 * Số tuần gần nhất được xét lại mỗi lần chạy để bắt nội dung sửa sau khi nạp.
 *
 * Phòng thường sửa báo cáo trong vòng 1-2 tuần; 6 tuần đủ rộng cho trường hợp
 * bổ sung muộn. Xét lại chỉ tốn hash, chỉ phòng có đổi mới gọi AI.
 */
const RECHECK_RECENT_WEEKS = 6;

/**
 * Số lượt nạp (phòng × tuần) tối đa mỗi lần chạy, cùng lý do với MAX_WEEKS_PER_RUN:
 * một bệnh viện có 14 phòng, nên 3 tuần ≈ 42 lượt.
 */
const MAX_DEPARTMENT_IMPORTS_PER_RUN = 42;

/** Một sheet cần xử lý, kèm hash từng phòng ở sheet tuần trước để nhận ra bản chép. */
interface HospitalWeekJob {
  sheet: HospitalWeekSheet;
  previousHashes: Map<string, string>;
  /** Mọi sheet trong file — bước theo dõi nhiệm vụ cần cả năm, không chỉ tuần đang nạp. */
  allSheets: HospitalWeekSheet[];
}

function weekKey(year: number, week: number): string {
  return `${year}-${week}`;
}

/** Hash từng phòng của một sheet, theo tên phòng ghi trong sheet. */
function departmentHashes(sheet: HospitalWeekSheet | undefined): Map<string, string> {
  const hashes = new Map<string, string>();
  if (!sheet) return hashes;
  for (const dept of extractWeekTasksByDepartment(sheet)) {
    hashes.set(dept.departmentName, departmentContentHash(dept.tasks));
  }
  return hashes;
}

/**
 * Gỡ dữ liệu AI đã nạp của một phòng trong một tuần mà sheet còn là bản chép
 * tuần trước — dữ liệu đó là số tuần trước dán nhãn tuần này.
 *
 * Chỉ xoá dòng AI tạo (extractionModel khác null) và số liệu chưa duyệt —
 * phần người làm giữ nguyên.
 */
async function clearDepartmentWeek(ctx: SyncContext, weekId: string, departmentId: string): Promise<number> {
  const metrics = await ctx.prisma.extractedMetric.deleteMany({
    where: { weekId, departmentId, reviewStatus: 'PENDING' },
  });
  const tasks = await ctx.prisma.weekTaskProgress.deleteMany({
    where: { weekId, extractionModel: { not: null }, masterTask: { departmentId } },
  });
  return metrics.count + tasks.count;
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

export const hospitalAiImport: Connector<Buffer, HospitalWeekJob> = {
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
   * Chọn các tuần cần xử lý: tuần CHƯA nạp, cộng với các tuần gần đây để xét lại.
   *
   * Một tuần coi là đã nạp khi bản ghi `Week` tồn tại và đã có `WeekTaskProgress`
   * mang dấu vết trích xuất AI. Tuần người dùng nhập tay cũng được tôn trọng:
   * pipeline không ghi đè công sức nhập liệu của họ — kể cả khi xét lại.
   */
  async parse(buffer: Buffer, ctx: SyncContext): Promise<HospitalWeekJob[]> {
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
    const done = new Set(approved.map((p) => weekKey(p.year, p.week)));

    // Tuần người dùng nhập tay không có bản ghi chờ nào, nhưng vẫn phải được
    // tôn trọng — pipeline không ghi đè công sức nhập liệu của họ.
    const manualWeeks = await ctx.prisma.week.findMany({
      where: {
        OR: sheets.map((s) => ({ year: s.year, weekNumber: s.week })),
        taskProgress: { some: { extractionModel: null } },
      },
      select: { year: true, weekNumber: true },
    });
    const manual = new Set(manualWeeks.map((w) => weekKey(w.year, w.weekNumber)));
    for (const key of manual) done.add(key);

    // Tuần có dấu vân tay được theo dõi từng phòng: phòng chưa cập nhật bản chép
    // thì cố ý chưa nạp, nên tuần TRÔNG như nạp dở. Không để bước dưới xoá nhầm —
    // đã xảy ra: tuần 40 có 1/14 phòng thật, bị xoá sạch rồi hash "không đổi"
    // nên không nạp lại. Việc xét lại tuần này do upsert() lo theo từng phòng.
    const tracked = await ctx.prisma.hospitalImportSnapshot.findMany({
      where: { OR: sheets.map((s) => ({ year: s.year, week: s.week })) },
      select: { year: true, week: true },
      distinct: ['year', 'week'],
    });
    for (const t of tracked) done.add(weekKey(t.year, t.week));

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

    const ordered = [...sheets].sort((a, b) => a.year - b.year || a.week - b.week);
    const pending = ordered.filter((s) => !done.has(weekKey(s.year, s.week)));
    const batch = pending.slice(0, MAX_WEEKS_PER_RUN);
    if (pending.length > batch.length) {
      await ctx.log(
        'info',
        `Xử lý ${batch.length} tuần mới lần này (tuần ${batch.map((s) => s.week).join(', ')}); ` +
          `${pending.length - batch.length} tuần còn lại chạy ở lần sau`,
      );
    }

    // Tuần gần đây đã nạp: xét lại theo hash từng phòng ở upsert().
    const recheck = ordered
      .slice(-RECHECK_RECENT_WEEKS)
      .filter((s) => done.has(weekKey(s.year, s.week)) && !manual.has(weekKey(s.year, s.week)));

    await ctx.log(
      'info',
      `${sheets.length} tuần trong file · ${done.size} đã nạp · ${pending.length} chưa nạp · ` +
        `xét lại ${recheck.length} tuần gần nhất`,
    );

    const bySheetKey = new Map(sheets.map((s) => [weekKey(s.year, s.week), s]));
    return [...batch, ...recheck]
      .sort((a, b) => a.year - b.year || a.week - b.week)
      .map((sheet) => ({
        sheet,
        previousHashes: departmentHashes(bySheetKey.get(weekKey(sheet.year, sheet.week - 1))),
        allSheets: sheets,
      }));
  },

  async upsert(jobs: HospitalWeekJob[], ctx: SyncContext): Promise<UpsertResult> {
    if (jobs.length === 0) {
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
    let importsLeft = MAX_DEPARTMENT_IMPORTS_PER_RUN;
    /** Phòng có nội dung mới trong lần chạy này — cập nhật theo dõi nhiệm vụ sau khi nạp. */
    const changedDepartments = new Set<string>();

    for (const { sheet, previousHashes } of jobs) {
      const weekId = await findOrCreateWeek(sheet, ctx);
      if (!weekId) {
        skipped += 1;
        continue;
      }

      const snapshots = await ctx.prisma.hospitalImportSnapshot.findMany({
        where: { year: sheet.year, week: sheet.week },
        select: { departmentId: true, contentHash: true },
      });
      const snapshotHash = new Map(snapshots.map((s) => [s.departmentId, s.contentHash]));

      /** Có phòng nào lỗi hoặc còn dở không — quyết định tuần này đã xong hẳn chưa. */
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
        const departmentId = match.departmentId;
        const label = `Tuần ${sheet.week} · ${match.dbName}`;
        const contentHash = departmentContentHash(deptTasks.tasks);

        // Nội dung không đổi so với lần nạp trước — không tốn gì.
        if (snapshotHash.get(departmentId) === contentHash) continue;

        // Phòng chưa sửa sheet chép từ tuần trước: nạp bây giờ là ghi số tuần
        // trước dưới nhãn tuần này. Gỡ bản đã lỡ nạp, chờ phòng cập nhật.
        const previousHash = previousHashes.get(deptTasks.departmentName);
        if (isUneditedCopy(contentHash, previousHash, deptTasks.tasks.length)) {
          const removed = await clearDepartmentWeek(ctx, weekId, departmentId);
          await ctx.prisma.hospitalImportSnapshot.deleteMany({
            where: { year: sheet.year, week: sheet.week, departmentId },
          });
          await ctx.log(
            'warn',
            `${label}: nội dung y hệt tuần ${sheet.week - 1} — phòng chưa cập nhật, chưa nạp` +
              (removed > 0 ? ` (gỡ ${removed} dòng đã nạp nhầm)` : ''),
          );
          skipped += deptTasks.tasks.length;
          continue;
        }

        if (importsLeft <= 0) {
          weekHadError = true; // còn việc, giữ tuần ở trạng thái chưa xong
          continue;
        }
        importsLeft -= 1;

        try {
          // Nạp TRƯỚC, dọn SAU: AI lỗi giữa chừng (hết tiền, mất mạng) thì bản cũ
          // vẫn còn nguyên. Trích số liệu tự thay bản cũ của phòng sau khi AI trả
          // về; chỉ còn nhiệm vụ AI cũ không xuất hiện lại là phải dọn.
          const importStartedAt = new Date();
          const summary = await importWeekForDepartment(
            ctx.prisma,
            {
              year: sheet.year,
              week: sheet.week,
              departmentId,
              departmentName: match.dbName ?? deptTasks.departmentName,
              tasks: deptTasks.tasks,
            },
            { extractMetricsEnabled: extractMetrics },
          );

          const stale = await ctx.prisma.weekTaskProgress.deleteMany({
            where: {
              weekId,
              extractionModel: { not: null },
              masterTask: { departmentId },
              updatedAt: { lt: importStartedAt },
            },
          });
          if (stale.count > 0) {
            await ctx.log('info', `${label}: nội dung đã thay đổi, gỡ ${stale.count} nhiệm vụ không còn trong báo cáo`);
          }

          // Ghi dấu SAU khi nạp trót lọt: nạp lỗi giữa chừng thì lần sau thử lại.
          const snapshot = { contentHash, taskCount: deptTasks.tasks.length, importedAt: new Date() };
          await ctx.prisma.hospitalImportSnapshot.upsert({
            where: { year_week_departmentId: { year: sheet.year, week: sheet.week, departmentId } },
            create: { year: sheet.year, week: sheet.week, departmentId, ...snapshot },
            update: snapshot,
          });

          upserted += summary.tasksMatched;
          skipped += summary.tasksUnmatched;
          changedDepartments.add(departmentId);

          await ctx.log(
            'info',
            `${label}: ${summary.tasksMatched} nhiệm vụ ` +
              `(${summary.freeMatches} khớp không tốn token) · ` +
              `${summary.metricsExtracted} số liệu · ${summary.totalTokens.toLocaleString('vi-VN')} tokens`,
          );

          if (summary.metricsFlagged > 0) {
            await ctx.log('warn', `${label}: ${summary.metricsFlagged} số liệu cần rà soát`);
          }
        } catch (error) {
          // Một phòng lỗi không nên chặn các phòng còn lại.
          const message = error instanceof Error ? error.message : 'Lỗi không xác định';
          await ctx.log('error', `${label}: ${message}`);
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

    await syncTaskTracking(ctx, jobs[0].allSheets, departments, changedDepartments);
    return { upserted, skipped };
  },
};

/**
 * Theo dõi nhiệm vụ (docs/TASK-TRACKING.md) cho các phòng vừa có nội dung mới:
 * nối dòng mới vào các việc, AI đánh giá lại việc đổi. Lỗi ở đây không làm hỏng
 * lần nạp báo cáo — chỉ ghi log, lần chạy sau làm lại.
 */
async function syncTaskTracking(
  ctx: SyncContext,
  sheets: HospitalWeekSheet[],
  departments: Array<{ id: string; name: string }>,
  changed: ReadonlySet<string>,
): Promise<void> {
  if (changed.size === 0) return;
  const years = [...new Set(sheets.map((s) => s.year))];
  for (const year of years) {
    for (const input of rowsFromSheets(sheets, departments, year).filter((d) => changed.has(d.departmentId))) {
      try {
        const r = await syncDepartment(ctx.prisma, input, { log: (m) => void ctx.log('warn', m) });
        await ctx.log('info', `Theo dõi nhiệm vụ · ${input.departmentName}: ${r.entries} dòng nối mới · AI đánh giá ${r.judged} việc · ${r.tokens.toLocaleString('vi-VN')} token`);
      } catch (error) {
        await ctx.log('error', `Theo dõi nhiệm vụ · ${input.departmentName}: ${error instanceof Error ? error.message.slice(0, 200) : error}`);
      }
    }
  }
}
