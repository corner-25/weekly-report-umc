import { SyncSourceKind } from '@prisma/client';
import { computeChecksum } from '../checksum';
import { downloadSharedFile } from '../fetchers/onedrive-share';
import { parseDeptReport, type DeptReportParseResult } from '../parsers/dept-report';
import type { Connector, FetchResult, SyncContext, UpsertResult } from '../types';

/** Số dòng ghi mỗi lô, cân giữa tốc độ và áp lực lên connection pool. */
const UPSERT_BATCH_SIZE = 100;

/** Số dòng lỗi ghi log chi tiết; phần còn lại chỉ đếm. */
const MAX_REJECTED_LOGGED = 20;

interface DeptReportConfig {
  /** Tên biến môi trường chứa share link — link không nằm trong DB. */
  shareUrlEnv: string;
}

function readConfig(ctx: SyncContext): DeptReportConfig {
  const config = ctx.source.config as Record<string, unknown> | null;
  const shareUrlEnv = typeof config?.shareUrlEnv === 'string' ? config.shareUrlEnv : null;
  if (!shareUrlEnv) {
    throw new Error('Thiếu "shareUrlEnv" trong SyncSource.config');
  }
  return { shareUrlEnv };
}

/**
 * Báo cáo phòng từ OneDrive → bảng HcMetric.
 *
 * Chỉ đọc sheet "Số liệu tuần (<năm>)"; hai sheet còn lại trong workbook là
 * bản trình bày, không phải nguồn số liệu. Xem docs/ONEDRIVE-DATA-ANALYSIS.md.
 */
export const deptReportOnedrive: Connector<Buffer, DeptReportParseResult> = {
  id: 'dept-report-onedrive',
  name: 'Báo cáo phòng (OneDrive)',
  kind: SyncSourceKind.ONEDRIVE_SHARE,

  async fetch(ctx: SyncContext): Promise<FetchResult<Buffer>> {
    const { shareUrlEnv } = readConfig(ctx);
    const shareUrl = process.env[shareUrlEnv];
    if (!shareUrl) {
      throw new Error(`Biến môi trường ${shareUrlEnv} chưa được đặt`);
    }

    const file = await downloadSharedFile(shareUrl);
    await ctx.log('info', `Đã tải ${(file.byteLength / 1024).toFixed(0)}KB từ OneDrive`);

    return { raw: file.buffer, checksum: computeChecksum(file.buffer) };
  },

  async parse(buffer: Buffer, ctx: SyncContext): Promise<DeptReportParseResult[]> {
    const result = parseDeptReport(buffer);

    await ctx.log(
      'info',
      `Sheet "${result.sheetName}" (năm ${result.year}): ${result.rows.length} dòng hợp lệ, ` +
        `${result.emptyValueCount} ô chưa nhập, ${result.notApplicableCount} ô không áp dụng`,
    );

    // Ô trống là chuyện bình thường (chưa tới kỳ nhập), không cảnh báo.
    // Dòng bị loại thì phải cho người rà soát biết.
    if (result.rejected.length > 0) {
      await ctx.log('warn', `${result.rejected.length} dòng bị loại vì dữ liệu không hợp lệ`);
      for (const r of result.rejected.slice(0, MAX_REJECTED_LOGGED)) {
        await ctx.log('warn', `Dòng ${r.rowNumber}: ${r.reason}`, r.raw);
      }
    }

    if (result.rows.length === 0) {
      throw new Error('Không có dòng hợp lệ nào — kiểm tra lại định dạng file nguồn');
    }

    // Bọc trong mảng để khớp chữ ký Connector; upsert cần cả metadata (năm, sheet).
    return [result];
  },

  async upsert([result]: DeptReportParseResult[], ctx: SyncContext): Promise<UpsertResult> {
    const { prisma, source, runId } = ctx;
    let upserted = 0;

    for (let i = 0; i < result.rows.length; i += UPSERT_BATCH_SIZE) {
      const batch = result.rows.slice(i, i + UPSERT_BATCH_SIZE);

      await prisma.$transaction(
        batch.map((row) =>
          prisma.hcMetric.upsert({
            where: {
              category_content_year_week: {
                category: row.category,
                content: row.content,
                year: result.year,
                week: row.week,
              },
            },
            create: {
              category: row.category,
              content: row.content,
              year: result.year,
              week: row.week,
              month: row.month,
              value: row.value,
              sourceId: source.id,
              syncRunId: runId,
            },
            update: {
              month: row.month,
              value: row.value,
              syncRunId: runId,
            },
          }),
        ),
      );

      upserted += batch.length;
    }

    await ctx.log('info', `Đã ghi ${upserted} dòng vào hc_metrics`);

    // Ô chưa nhập không phải dòng "bỏ qua do lỗi", nhưng vẫn đáng đếm để
    // trang quản trị cho thấy còn bao nhiêu số liệu chưa có.
    return { upserted, skipped: result.emptyValueCount + result.notApplicableCount };
  },
};
