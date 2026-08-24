/**
 * Xoá hẳn hồ sơ các xe không còn sử dụng.
 *
 * Bốn xe này không có chuyến đi nào trong dữ liệu tổ xe — xe đã thanh lý hoặc
 * chuyển giao. Người quản lý quyết định xoá hẳn thay vì giữ hồ sơ.
 *
 * Xoá vĩnh viễn: mất cả lịch sử bảo dưỡng và lý lịch gốc, không khôi phục được.
 * Vì vậy in đầy đủ những gì sắp mất trước khi ghi.
 *
 *   npx tsx prisma/delete-retired-vehicles.ts            # xem trước
 *   npx tsx prisma/delete-retired-vehicles.ts --confirm  # xoá thật
 */
import { PrismaClient } from '@prisma/client';

/**
 * Biển số xe cần xoá, do người quản lý chỉ định.
 *
 * So khớp theo dạng chuẩn hoá vì cách viết trong hồ sơ không nhất quán
 * ("51A -40-66" có dấu cách thừa, "51 D 2150" cũng vậy).
 */
const PLATES_TO_DELETE = ['51F 22-17', '51A -40-66', '51 D 2150', '51D 24-11'];

function plateKey(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  const targetKeys = new Set(PLATES_TO_DELETE.map(plateKey));

  const all = await prisma.vehicle.findMany({
    select: {
      id: true,
      licensePlate: true,
      brand: true,
      manufactureYear: true,
      rawHistory: true,
      _count: { select: { maintenanceLogs: true, licenses: true, trips: true } },
    },
  });

  const targets = all.filter((v) => targetKeys.has(plateKey(v.licensePlate)));

  const notFound = PLATES_TO_DELETE.filter(
    (p) => !targets.some((t) => plateKey(t.licensePlate) === plateKey(p)),
  );
  if (notFound.length > 0) {
    console.log(`Không tìm thấy: ${notFound.join(', ')}\n`);
  }

  console.log(`${targets.length} xe sẽ bị xoá vĩnh viễn:\n`);

  let totalLogs = 0;
  let hasTrips = false;

  for (const v of targets) {
    console.log(`  ${v.licensePlate}`);
    console.log(`    ${v.brand ?? '(không rõ hãng)'} ${v.manufactureYear ?? ''}`);
    console.log(
      `    ${v._count.maintenanceLogs} bản ghi bảo dưỡng · ` +
        `${v._count.licenses} giấy tờ · ${v._count.trips} chuyến đi`,
    );
    console.log(`    lý lịch gốc: ${v.rawHistory?.length ?? 0} ký tự`);

    totalLogs += v._count.maintenanceLogs;
    if (v._count.trips > 0) hasTrips = true;
  }

  // Chốt an toàn: xe còn chuyến đi nghĩa là vẫn đang chạy, không phải xe thanh lý.
  if (hasTrips) {
    console.log('\nDỪNG: có xe còn chuyến đi — xem lại danh sách trước khi xoá.');
    await prisma.$disconnect();
    return;
  }

  console.log(`\nTổng cộng mất ${totalLogs} bản ghi bảo dưỡng.`);

  if (!confirm) {
    console.log('\nXem trước — chưa xoá gì. Thêm --confirm để xoá thật.');
    await prisma.$disconnect();
    return;
  }

  // Giấy tờ dùng onDelete: SetNull nên không tự mất theo; gỡ liên kết trước để
  // chúng không trỏ vào xe đã biến mất.
  await prisma.license.updateMany({
    where: { vehicleId: { in: targets.map((t) => t.id) } },
    data: { vehicleId: null },
  });

  // maintenanceLogs dùng onDelete: Cascade nên tự xoá theo xe.
  const result = await prisma.vehicle.deleteMany({
    where: { id: { in: targets.map((t) => t.id) } },
  });

  console.log(`\n✓ Đã xoá ${result.count} xe và ${totalLogs} bản ghi bảo dưỡng`);

  const remaining = await prisma.vehicle.count();
  console.log(`Còn lại ${remaining} xe trong hệ thống.`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
