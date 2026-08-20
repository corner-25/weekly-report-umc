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

/** Ghi theo lô để không giữ transaction quá lâu; dữ liệu có hơn 11.000 chuyến. */
const UPSERT_BATCH_SIZE = 200;

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
    let upserted = 0;

    for (let i = 0; i < result.rows.length; i += UPSERT_BATCH_SIZE) {
      const batch = result.rows.slice(i, i + UPSERT_BATCH_SIZE);

      await prisma.$transaction(
        batch.map((row) =>
          prisma.fleetTrip.upsert({
            where: { sourceRowHash: row.sourceRowHash },
            create: { ...row, sourceId: source.id, syncRunId: runId },
            update: {
              vehicleId: row.vehicleId,
              driverName: row.driverName,
              vehicleType: row.vehicleType,
              recordDate: row.recordDate,
              startTime: row.startTime,
              endTime: row.endTime,
              durationHours: row.durationHours,
              durationSuspicious: row.durationSuspicious,
              distanceKm: row.distanceKm,
              distanceFixMethod: row.distanceFixMethod,
              fuelLiters: row.fuelLiters,
              revenueVnd: row.revenueVnd,
              destination: row.destination,
              workCategory: row.workCategory,
              areaType: row.areaType,
              tripDetails: row.tripDetails,
              syncRunId: runId,
            },
          }),
        ),
      );

      upserted += batch.length;
    }

    await ctx.log('info', `Đã ghi ${upserted} chuyến vào fleet_trips`);

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
