/**
 * Nối ba nơi quản lý phương tiện lại với nhau qua biển số xe.
 *
 * Trước đây ba nơi rời rạc hoàn toàn:
 *
 *   - Dashboard (fleet_trips): 15 xe, biển số dạng "50A-007.39"
 *   - Quản lý phương tiện (vehicles): 19 xe, dạng "50A-007-39", có cái thừa
 *     dấu cách như "50A- 004-55"
 *   - Giấy phép (licenses): 13 giấy tờ, biển số nằm trong TÊN chứ không có
 *     cột riêng, và 0/19 xe được nối
 *
 * Cùng một chiếc xe mang ba cách viết khác nhau nên đối chiếu trực tiếp chỉ khớp
 * 4/19. Chuẩn hoá bằng cách bỏ hết ký tự không phải chữ-số thì khớp được 13.
 *
 * Dashboard là nguồn chuẩn cho biển số: đó là dữ liệu tài xế nhập hằng ngày từ
 * Google Sheets, phản ánh xe đang thực sự chạy.
 *
 *   npx tsx prisma/link-fleet-vehicles.ts            # chạy thử
 *   npx tsx prisma/link-fleet-vehicles.ts --confirm  # ghi thật
 */
import { PrismaClient } from '@prisma/client';

/**
 * Rút biển số về khoá so khớp: chỉ chữ và số, viết hoa.
 *
 * "50A-007.39", "50A-007-39", "50A- 007-39" → "50A00739"
 */
function plateKey(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Tìm biển số trong tên giấy phép.
 *
 * Tên có dạng "Giấy phép đèn còi ưu tiên - 50M-002.19 (TOYOTA)" — biển số nằm
 * giữa câu, không có cột riêng. Bắt theo khuôn dạng biển số Việt Nam: hai chữ
 * số, một chữ cái, rồi nhóm số phân cách bằng chấm hoặc gạch.
 */
function extractPlate(text: string): string | null {
  const match = text.match(/\b\d{2}\s*[A-Z]\s*[-\s]?\s*\d{2,3}[.\-]?\d{2,3}\b/i);
  return match ? match[0] : null;
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  // Dashboard là nguồn chuẩn — biển số tài xế nhập hằng ngày.
  const trips = await prisma.fleetTrip.groupBy({
    by: ['vehicleId'],
    _count: true,
    _max: { recordDate: true },
  });
  const dashboardPlates = new Map(
    trips.map((t) => [
      plateKey(t.vehicleId),
      { plate: t.vehicleId, trips: t._count, lastTrip: t._max.recordDate },
    ]),
  );

  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, licensePlate: true, brand: true, manufactureYear: true },
  });
  const licenses = await prisma.license.findMany({
    select: { id: true, name: true, licenseNumber: true, vehicleId: true },
  });

  console.log(
    `${dashboardPlates.size} xe trong dashboard · ${vehicles.length} xe trong quản lý · ` +
      `${licenses.length} giấy tờ\n`,
  );

  // 1. Đổi biển số trong bảng xe về đúng cách viết của dashboard.
  const plateFixes: Array<{ id: string; from: string; to: string }> = [];
  for (const v of vehicles) {
    const match = dashboardPlates.get(plateKey(v.licensePlate));
    if (match && match.plate !== v.licensePlate) {
      plateFixes.push({ id: v.id, from: v.licensePlate, to: match.plate });
    }
  }

  console.log(`Chuẩn hoá biển số: ${plateFixes.length}`);
  for (const f of plateFixes) {
    console.log(`  ${f.from.padEnd(14)} → ${f.to}`);
  }

  // 2. Xe có trong dashboard nhưng chưa có hồ sơ.
  const knownKeys = new Set(vehicles.map((v) => plateKey(v.licensePlate)));
  const missing = [...dashboardPlates.entries()].filter(([k]) => !knownKeys.has(k));

  console.log(`\nXe chạy thật nhưng thiếu hồ sơ: ${missing.length}`);
  for (const [, m] of missing) {
    console.log(`  ${m.plate.padEnd(14)} ${m.trips} chuyến`);
  }

  // 3. Nối giấy tờ với xe qua biển số trong tên.
  const plateToVehicleId = new Map<string, string>();
  for (const v of vehicles) plateToVehicleId.set(plateKey(v.licensePlate), v.id);

  const licenseLinks: Array<{ id: string; name: string; vehicleId: string; plate: string }> = [];
  const licenseOrphans: string[] = [];

  for (const lic of licenses) {
    const found = extractPlate(lic.name);
    const vehicleId = found ? plateToVehicleId.get(plateKey(found)) : undefined;

    if (!vehicleId) {
      licenseOrphans.push(`${lic.name.slice(0, 48)}${found ? ` (biển ${found})` : ''}`);
      continue;
    }
    if (lic.vehicleId === vehicleId) continue;

    licenseLinks.push({ id: lic.id, name: lic.name, vehicleId, plate: found! });
  }

  console.log(`\nNối giấy tờ với xe: ${licenseLinks.length}`);
  for (const l of licenseLinks) {
    console.log(`  ${l.plate.padEnd(14)} ← ${l.name.slice(0, 46)}`);
  }
  if (licenseOrphans.length > 0) {
    console.log(`\n  ${licenseOrphans.length} giấy tờ chưa nối được:`);
    for (const o of licenseOrphans) console.log(`    ${o}`);
  }

  // 4. Xe trong hồ sơ nhưng không chạy chuyến nào — báo để người dùng quyết,
  //    không tự xoá: có thể là xe đã thanh lý cần giữ hồ sơ, hoặc rác nhập liệu.
  const extras = vehicles.filter((v) => !dashboardPlates.has(plateKey(v.licensePlate)));
  console.log(`\nXe trong hồ sơ nhưng không có chuyến nào: ${extras.length}`);
  for (const v of extras) {
    const empty = !v.brand && !v.manufactureYear;
    console.log(
      `  ${v.licensePlate.padEnd(14)} ${(v.brand ?? '—').padEnd(14)} ` +
        `${v.manufactureYear ?? '—'}${empty ? '   ← không có thông tin gì' : ''}`,
    );
  }

  if (!confirm) {
    console.log('\nChạy thử — chưa ghi gì. Thêm --confirm để ghi thật.');
    await prisma.$disconnect();
    return;
  }

  for (const f of plateFixes) {
    await prisma.vehicle.update({ where: { id: f.id }, data: { licensePlate: f.to } });
  }
  for (const l of licenseLinks) {
    await prisma.license.update({ where: { id: l.id }, data: { vehicleId: l.vehicleId } });
  }

  console.log(`\n✓ Chuẩn hoá ${plateFixes.length} biển số`);
  console.log(`✓ Nối ${licenseLinks.length} giấy tờ với xe`);
  if (missing.length > 0) {
    console.log(`\nCòn ${missing.length} xe chạy thật chưa có hồ sơ — cần nhập tay.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
