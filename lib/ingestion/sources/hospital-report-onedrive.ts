import { SyncSourceKind } from '@prisma/client';
import { computeChecksum } from '../checksum';
import { downloadSharedFile } from '../fetchers/onedrive-share';
import { matchDepartment } from '../parsers/department-matcher';
import { parseHospitalReport, type HospitalWeekSheet } from '../parsers/hospital-report';
import type { Connector, FetchResult, SyncContext, UpsertResult } from '../types';

/**
 * Báo cáo bệnh viện từ OneDrive → bảng PendingAiImport (chờ người duyệt).
 *
 * KHÔNG ghi thẳng vào Week/WeekTaskProgress. Nội dung là văn bản tự do cần khớp
 * với MasterTask đã có; khớp sai sẽ âm thầm làm hỏng số liệu báo cáo. Connector
 * chỉ tách sheet theo tuần và xếp hàng chờ; người dùng duyệt qua AiReportImportPanel
 * rồi /api/import/ai-save mới ghi thật.
 *
 * Xem docs/ONEDRIVE-DATA-ANALYSIS.md.
 */

interface HospitalReportConfig {
  shareUrlEnv: string;
}

function readConfig(ctx: SyncContext): HospitalReportConfig {
  const config = ctx.source.config as Record<string, unknown> | null;
  const shareUrlEnv = typeof config?.shareUrlEnv === 'string' ? config.shareUrlEnv : null;
  if (!shareUrlEnv) throw new Error('Thiếu "shareUrlEnv" trong SyncSource.config');
  return { shareUrlEnv };
}

/**
 * Dựng văn bản thô của một tuần để luồng AI xử lý sau.
 *
 * Giữ nguyên cấu trúc phòng ban → nhiệm vụ để prompt có ngữ cảnh khớp
 * MasterTask theo đúng phòng.
 */
function buildRawText(sheet: HospitalWeekSheet): string {
  const byDept = new Map<string, typeof sheet.rows>();
  for (const row of sheet.rows) {
    const list = byDept.get(row.department) ?? [];
    list.push(row);
    byDept.set(row.department, list);
  }

  const blocks: string[] = [];
  for (const [dept, rows] of byDept) {
    const lines = rows.map((r) => {
      const parts = [r.taskName && `Nhiệm vụ: ${r.taskName}`, r.result && `Kết quả: ${r.result}`];
      if (r.progress !== null) parts.push(`Tiến độ: ${r.progress}%`);
      if (r.timePeriod) parts.push(`Thời gian: ${r.timePeriod}`);
      if (r.nextWeekPlan) parts.push(`Kế hoạch tuần sau: ${r.nextWeekPlan}`);
      return `- ${parts.filter(Boolean).join(' | ')}`;
    });
    blocks.push(`## ${dept}\n${lines.join('\n')}`);
  }

  return blocks.join('\n\n');
}

export const hospitalReportOnedrive: Connector<Buffer, HospitalWeekSheet> = {
  id: 'hospital-report-onedrive',
  name: 'Báo cáo bệnh viện (OneDrive)',
  kind: SyncSourceKind.ONEDRIVE_SHARE,

  async fetch(ctx: SyncContext): Promise<FetchResult<Buffer>> {
    const { shareUrlEnv } = readConfig(ctx);
    const shareUrl = process.env[shareUrlEnv];
    if (!shareUrl) throw new Error(`Biến môi trường ${shareUrlEnv} chưa được đặt`);

    const file = await downloadSharedFile(shareUrl);
    await ctx.log('info', `Đã tải ${(file.byteLength / 1024).toFixed(0)}KB từ OneDrive`);
    return { raw: file.buffer, checksum: computeChecksum(file.buffer) };
  },

  async parse(buffer: Buffer, ctx: SyncContext): Promise<HospitalWeekSheet[]> {
    const { sheets, skippedSheets } = parseHospitalReport(buffer);

    for (const s of skippedSheets) {
      await ctx.log('warn', `Bỏ qua sheet "${s.sheetName}": ${s.reason}`);
    }

    if (sheets.length === 0) {
      throw new Error('Không đọc được sheet tuần nào — kiểm tra lại định dạng file nguồn');
    }

    const totalTasks = sheets.reduce((sum, s) => sum + s.rows.length, 0);
    await ctx.log('info', `Đọc được ${sheets.length} tuần, tổng ${totalTasks} nhiệm vụ`);

    // Cảnh báo phòng ban chưa có trong DB — người dùng cần tạo trước khi duyệt,
    // nếu không luồng AI sẽ không khớp được nhiệm vụ của phòng đó.
    const dbDepartments = await ctx.prisma.department.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
    });
    const excelDepts = new Set(sheets.flatMap((s) => s.departments));
    const unmatched = [...excelDepts].filter((d) => matchDepartment(d, dbDepartments).method === 'NONE');

    if (unmatched.length > 0) {
      await ctx.log(
        'warn',
        `${unmatched.length}/${excelDepts.size} phòng ban chưa có trong hệ thống, cần tạo trước khi duyệt`,
        { departments: unmatched },
      );
    }

    return sheets;
  },

  async upsert(sheets: HospitalWeekSheet[], ctx: SyncContext): Promise<UpsertResult> {
    const { prisma, source, runId } = ctx;
    let upserted = 0;
    let skipped = 0;

    for (const sheet of sheets) {
      // Tuần đã có báo cáo chính thức thì không xếp hàng lại — tránh người dùng
      // duyệt đè lên dữ liệu đã chốt.
      const existingWeek = await prisma.week.findUnique({
        where: { weekNumber_year: { weekNumber: sheet.week, year: sheet.year } },
        select: { id: true },
      });

      if (existingWeek) {
        skipped += 1;
        continue;
      }

      await prisma.pendingAiImport.upsert({
        where: {
          sourceId_year_week: { sourceId: source.id, year: sheet.year, week: sheet.week },
        },
        create: {
          sourceId: source.id,
          year: sheet.year,
          week: sheet.week,
          sheetName: sheet.sheetName,
          rawText: buildRawText(sheet),
          syncRunId: runId,
        },
        update: {
          // Chỉ làm mới nội dung của bản ghi CHƯA duyệt. Bản đã duyệt/từ chối
          // giữ nguyên để không xoá quyết định của người dùng.
          rawText: buildRawText(sheet),
          sheetName: sheet.sheetName,
          syncRunId: runId,
        },
      });
      upserted += 1;
    }

    await ctx.log(
      'info',
      `${upserted} tuần chờ duyệt, ${skipped} tuần bỏ qua vì đã có báo cáo chính thức`,
    );

    return { upserted, skipped };
  },
};
