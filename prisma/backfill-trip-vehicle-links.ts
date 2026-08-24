/**
 * Nối chuyến đi với hồ sơ xe bằng khoá ngoại thật.
 *
 * `fleet_trips.vehicleId` là chuỗi biển số tài xế nhập trên Google Sheets, không
 * phải id. Trước đây muốn biết chuyến nào của xe nào phải so chuỗi — mà hai bên
 * viết biển số khác nhau ("50A-007.39" và "50A-007-39") nên chỉ khớp 4/19 xe.
 *
 * Đã chuẩn hoá cách viết, nhưng so chuỗi vẫn mong manh: ai sửa biển số trong hồ
 * sơ là toàn bộ chuyến đi của xe đó mất liên kết ngay, không có gì ngăn. Cột
 * `vehicleRefId` là khoá ngoại thật, giữ liên kết kể cả khi biển số đổi.
 *
 *   npx tsx prisma/backfill-trip-vehicle-links.ts            # chạy thử
 *   npx tsx prisma/backfill-trip-vehicle-links.ts --confirm  # ghi thật
 */
import { PrismaClient } from '@prisma/client';

/** Rút biển số về khoá so khớp: chỉ chữ và số, viết hoa. */
function plateKey(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  const vehicles = await prisma.vehicle.findMany({
    select: { id: true, licensePlate: true },
  });
  const byPlate = new Map(vehicles.map((v) => [plateKey(v.licensePlate), v.id]));

  const groups = await prisma.fleetTrip.groupBy({
    by: ['vehicleId'],
    _count: true,
  });

  console.log(`${groups.length} biển số trong dữ liệu chuyến đi\n`);

  let linked = 0;
  let unlinked = 0;
  const plans: Array<{ plate: string; vehicleId: string; trips: number }> = [];

  for (const g of groups) {
    const vehicleId = byPlate.get(plateKey(g.vehicleId));
    if (!vehicleId) {
      console.log(`  ${g.vehicleId.padEnd(14)} ${String(g._count).padStart(5)} chuyến  ← chưa có hồ sơ xe`);
      unlinked += g._count;
      continue;
    }
    plans.push({ plate: g.vehicleId, vehicleId, trips: g._count });
    linked += g._count;
  }

  for (const p of plans) {
    console.log(`  ${p.plate.padEnd(14)} ${String(p.trips).padStart(5)} chuyến`);
  }

  console.log(`\nNối được: ${linked} chuyến · Chưa nối: ${unlinked} chuyến`);

  if (!confirm) {
    console.log('\nChạy thử — chưa ghi gì. Thêm --confirm để ghi thật.');
    await prisma.$disconnect();
    return;
  }

  // Một lệnh UPDATE cho mỗi biển số thay vì mỗi chuyến một lệnh: 14.000 lệnh
  // riêng qua mạng mất hàng chục phút, cách này còn vài giây.
  let updated = 0;
  for (const p of plans) {
    const result = await prisma.fleetTrip.updateMany({
      where: { vehicleId: p.plate },
      data: { vehicleRefId: p.vehicleId },
    });
    updated += result.count;
  }

  console.log(`\n✓ Nối ${updated} chuyến với hồ sơ xe`);

  const remaining = await prisma.fleetTrip.count({ where: { vehicleRefId: null } });
  console.log(`Còn ${remaining} chuyến chưa nối được.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
