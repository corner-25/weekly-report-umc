/**
 * Điền odometer cho các chuyến đã nạp trước khi có cột này.
 *
 * Connector chỉ THÊM chuyến mới (để chạy lại không nhân bản), nên chuyến cũ
 * không tự nhận được giá trị odometer. Script này đọc lại Google Sheets, tính
 * odometer + trạng thái kiểm tra, rồi cập nhật theo `sourceRowHash`.
 *
 * Chạy một lần sau khi thêm cột. Chạy lại nhiều lần vô hại.
 *
 *   npx tsx prisma/backfill-odometer.ts
 */
import { PrismaClient } from '@prisma/client';
import { fetchAllSheets, parseCredentials } from '@/lib/ingestion/fetchers/google-sheets';
import { parseFleetSheets } from '@/lib/ingestion/parsers/fleet-rows';

/** Số bản ghi cập nhật mỗi lô. */
const BATCH_SIZE = 200;

async function main() {
  const spreadsheetId =
    process.env.FLEET_SPREADSHEET_ID ?? '1sYzuvnv-lzQcv-IZjT672LTpfUrqdWCesx4pW8mIuqM';
  const rawCredentials = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!rawCredentials) throw new Error('Chưa đặt GOOGLE_SERVICE_ACCOUNT_JSON');

  const prisma = new PrismaClient();

  console.log('Đọc Google Sheets…');
  const sheets = await fetchAllSheets(spreadsheetId, parseCredentials(rawCredentials));
  const parsed = parseFleetSheets(sheets);
  console.log(`${parsed.rows.length} chuyến trong nguồn\n`);

  const before = await prisma.fleetTrip.count({ where: { odometer: { not: null } } });
  const total = await prisma.fleetTrip.count();
  console.log(`Trước: ${before}/${total} chuyến có odometer`);

  let updated = 0;
  let notFound = 0;

  for (let i = 0; i < parsed.rows.length; i += BATCH_SIZE) {
    const batch = parsed.rows.slice(i, i + BATCH_SIZE);

    // Một lệnh UPDATE cho cả lô thay vì 200 lệnh riêng. Cập nhật từng bản qua
    // mạng mất hơn 10 phút cho 14.000 chuyến; cách này còn vài giây.
    const values = batch
      .map(
        (row) =>
          `('${row.sourceRowHash}', ${row.odometer ?? 'NULL'}::int, ` +
          `'${row.odometerStatus}', ${row.odometerDelta ?? 'NULL'}::int)`,
      )
      .join(',');

    const count = await prisma.$executeRawUnsafe(`
      UPDATE fleet_trips t
      SET "odometer" = v.odo, "odometerStatus" = v.status, "odometerDelta" = v.delta
      FROM (VALUES ${values}) AS v(hash, odo, status, delta)
      WHERE t."sourceRowHash" = v.hash
    `);

    updated += count;
    notFound += batch.length - count;

    process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, parsed.rows.length)}/${parsed.rows.length}`);
  }

  const after = await prisma.fleetTrip.count({ where: { odometer: { not: null } } });
  console.log(`\n\n✓ Cập nhật ${updated} chuyến`);
  if (notFound > 0) {
    console.log(`  ${notFound} chuyến trong nguồn chưa có trong database`);
  }
  console.log(`Sau: ${after}/${total} chuyến có odometer`);

  const byStatus = await prisma.fleetTrip.groupBy({
    by: ['odometerStatus'],
    _count: true,
    orderBy: { _count: { odometerStatus: 'desc' } },
  });
  console.log('\nTrạng thái odometer:');
  for (const s of byStatus) {
    console.log(
      `  ${s.odometerStatus.padEnd(14)} ${String(s._count).padStart(6)}  ` +
        `${((s._count / total) * 100).toFixed(2)}%`,
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
