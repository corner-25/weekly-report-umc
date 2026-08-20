import { SyncSourceKind } from '@prisma/client';
import { computeChecksum } from '../checksum';
import { fetchAllSheets, parseCredentials, type SheetData } from '../fetchers/google-sheets';
import { parseFleetSheets, type FleetParseResult } from '../parsers/fleet-rows';
import type { Connector, FetchResult, SyncContext, UpsertResult } from '../types';

/**
 * Dữ liệu đội xe từ Google Sheets → bảng FleetTrip.
 *
 * Thay cho manual_fleet_sync.py (repo UMC-APP/PHONGHC/umc-dashboard), vốn phải
 * đẩy JSON qua GitHub rồi app đọc lại. Sheets API gọi được từ Railway nên bỏ
 * hẳn khâu trung gian đó.
 */

/** Số dòng mỗi lô createMany. Lô lớn hơn ít lợi mà tốn bộ nhớ. */
const UPSERT_BATCH_SIZE = 500;

/** Số dòng lỗi ghi log chi tiết; phần còn lại chỉ đếm. */
const MAX_REJECTED_LOGGED = 20;

interface FleetConfig {
  spreadsheetId: string;
  credentialsEnv: string;
}

function readConfig(ctx: SyncContext): FleetConfig {
  const config = ctx.source.config as Record<string, unknown> | null;
  const spreadsheetId = typeof config?.spreadsheetId === 'string' ? config.spreadsheetId : null;
  const credentialsEnv = typeof config?.credentialsEnv === 'string' ? config.credentialsEnv : null;

  if (!spreadsheetId) throw new Error('Thiếu "spreadsheetId" trong SyncSource.config');
  if (!credentialsEnv) throw new Error('Thiếu "credentialsEnv" trong SyncSource.config');

  return { spreadsheetId, credentialsEnv };
}

export const fleetGoogleSheets: Connector<SheetData[], FleetParseResult> = {
  id: 'fleet-google-sheets',
  name: 'Dữ liệu đội xe (Google Sheets)',
  kind: SyncSourceKind.GOOGLE_SHEETS,

  async fetch(ctx: SyncContext): Promise<FetchResult<SheetData[]>> {
    const { spreadsheetId, credentialsEnv } = readConfig(ctx);

    const rawCredentials = process.env[credentialsEnv];
    if (!rawCredentials) {
      throw new Error(`Biến môi trường ${credentialsEnv} chưa được đặt`);
    }

    const credentials = parseCredentials(rawCredentials);
    const sheets = await fetchAllSheets(spreadsheetId, credentials);

    const totalRows = sheets.reduce((sum, s) => sum + Math.max(0, s.values.length - 1), 0);
    await ctx.log('info', `Đọc ${sheets.length} sheet (xe), tổng ${totalRows} dòng thô`);

    return { raw: sheets, checksum: computeChecksum(sheets) };
  },

  async parse(sheets: SheetData[], ctx: SyncContext): Promise<FleetParseResult[]> {
    const result = parseFleetSheets(sheets);

    await ctx.log(
      'info',
      `${result.rows.length} chuyến hợp lệ từ ${result.perVehicle.length} xe, ` +
        `${result.emptyRowsDropped} dòng trống, ${result.noIdentityDropped} dòng không rõ người nhập`,
    );

    if (result.rejected.length > 0) {
      await ctx.log('warn', `${result.rejected.length} dòng bị loại vì thiếu ngày ghi nhận`);
      for (const r of result.rejected.slice(0, MAX_REJECTED_LOGGED)) {
        await ctx.log('warn', `Xe ${r.vehicleId} dòng ${r.rowNumber}: ${r.reason}`);
      }
    }

    // Các dấu hiệu cần người rà soát — không chặn đồng bộ, chỉ báo.
    const suspicious = result.rows.filter((r) => r.durationSuspicious).length;
    const unfixable = result.rows.filter((r) => r.distanceFixMethod === 'UNFIXABLE').length;

    if (suspicious > 0) {
      await ctx.log('warn', `${suspicious} chuyến có giờ lái > 16h, nhiều khả năng nhầm giờ bắt đầu/kết thúc`);
    }
    if (result.duplicatesDropped > 0) {
      await ctx.log(
        'warn',
        `${result.duplicatesDropped} chuyến nghi trùng đã bỏ (giữ bản đầu) — ` +
          'cùng tài xế, xe, ngày, giờ và điểm đến',
      );
    }
    const lowConfidence = result.rows.filter((r) => r.durationConfidence === 'low').length;
    if (lowConfidence > 0) {
      await ctx.log('warn', `${lowConfidence} chuyến có giờ lái độ tin cậy thấp (ước từ km hoặc giờ bất thường)`);
    }
    if (unfixable > 0) {
      await ctx.log('warn', `${unfixable} chuyến không sửa được quãng đường, để trống chờ rà soát`);
    }

    if (result.rows.length === 0) {
      throw new Error('Không có chuyến hợp lệ nào — kiểm tra lại quyền truy cập hoặc cấu trúc sheet');
    }

    return [result];
  },

  async upsert([result]: FleetParseResult[], ctx: SyncContext): Promise<UpsertResult> {
    const { prisma, source, runId } = ctx;

    // Chỉ ghi những chuyến CHƯA có. Dữ liệu nguồn là bản ghi lịch sử — tài xế
    // không sửa chuyến đã nhập, nên chuyến cùng sourceRowHash chắc chắn giống
    // hệt bản đã lưu, ghi đè cũng ra kết quả đó.
    //
    // Ban đầu dùng upsert từng dòng thì 14.000 chuyến mất 271s trên Railway,
    // sát giới hạn maxDuration 300s. Lọc trước rồi createMany đưa xuống vài giây,
    // vì mỗi lô chỉ còn một câu lệnh thay vì 200.
    const existing = new Set(
      (
        await prisma.fleetTrip.findMany({
          where: { sourceId: source.id },
          select: { sourceRowHash: true },
        })
      ).map((r) => r.sourceRowHash),
    );

    const fresh = result.rows.filter((r) => !existing.has(r.sourceRowHash));
    let upserted = 0;

    for (let i = 0; i < fresh.length; i += UPSERT_BATCH_SIZE) {
      const batch = fresh.slice(i, i + UPSERT_BATCH_SIZE);
      const { count } = await prisma.fleetTrip.createMany({
        data: batch.map((row) => ({ ...row, sourceId: source.id, syncRunId: runId })),
        // Chặn trường hợp hiếm: hai lần chạy song song cùng chèn một chuyến.
        skipDuplicates: true,
      });
      upserted += count;
    }

    await ctx.log(
      'info',
      `Đã ghi ${upserted} chuyến mới vào fleet_trips (${existing.size} chuyến đã có sẵn)`,
    );

    return {
      upserted,
      skipped:
        result.emptyRowsDropped +
        result.noIdentityDropped +
        result.rejected.length +
        result.duplicatesDropped,
    };
  },
};
