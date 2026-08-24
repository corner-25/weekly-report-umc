/**
 * Kiểm tra tính hợp lý của số km trong lịch sử bảo dưỡng.
 *
 * Số km chỉ tăng, không lùi. Chỗ nào lùi thì hoặc lý lịch gốc ghi sai, hoặc AI
 * đọc nhầm — cả hai đều cần người đối chiếu lại, không nên để lặng lẽ nằm trong
 * thống kê.
 *
 * Lỗi thật đã gặp: lý lịch xe 50M-004.37 ghi "170.00km" (thiếu một số 0) giữa
 * chuỗi đang ở 165.000, nên đọc ra 17.000. Đây là lỗi đánh máy của người nhập
 * chứ không phải AI đọc sai — nhưng hậu quả giống nhau.
 *
 *   npx tsx prisma/check-maintenance-odometer.ts            # chạy thử
 *   npx tsx prisma/check-maintenance-odometer.ts --confirm  # ghi trạng thái
 */
import { PrismaClient } from '@prisma/client';

/**
 * Mức tăng km tối đa coi là hợp lý giữa hai lần bảo dưỡng liên tiếp.
 *
 * Xe cơ quan chạy nhiều nhất khoảng 50.000 km/năm; bảo dưỡng thưa nhất vài
 * tháng một lần. Trên 100.000 km giữa hai mốc gần như chắc là lỗi đọc số.
 */
const MAX_PLAUSIBLE_JUMP = 100_000;

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  const vehicles = await prisma.vehicle.findMany({
    where: { maintenanceLogs: { some: {} } },
    select: {
      id: true,
      licensePlate: true,
      maintenanceLogs: {
        where: { odometer: { not: null }, date: { not: null } },
        orderBy: { date: 'asc' },
        select: { id: true, date: true, odometer: true, description: true },
      },
    },
  });

  const updates: Array<{ id: string; status: string }> = [];
  const issues: Array<{
    plate: string;
    date: Date;
    prev: number;
    current: number;
    status: string;
    description: string;
  }> = [];

  for (const v of vehicles) {
    let previous: number | null = null;

    for (const log of v.maintenanceLogs) {
      const km = log.odometer!;
      let status = 'OK';

      if (previous === null) {
        status = 'NO_PREVIOUS';
      } else if (km < previous) {
        status = 'DECREASED';
      } else if (km - previous > MAX_PLAUSIBLE_JUMP) {
        status = 'BIG_JUMP';
      }

      if (status !== 'OK') {
        updates.push({ id: log.id, status });
        if (status !== 'NO_PREVIOUS') {
          issues.push({
            plate: v.licensePlate,
            date: log.date!,
            prev: previous!,
            current: km,
            status,
            description: log.description,
          });
        }
      }

      // Mốc bất thường không dùng làm chuẩn cho lần sau — nếu không, một số sai
      // sẽ kéo theo mọi mốc kế tiếp bị đánh dấu oan.
      if (status === 'OK' || status === 'NO_PREVIOUS') previous = km;
    }
  }

  const totalWithKm = vehicles.reduce((sum, v) => sum + v.maintenanceLogs.length, 0);
  console.log(`${totalWithKm} bản ghi có số km\n`);
  console.log(`Cần rà soát: ${issues.length}`);

  for (const i of issues) {
    console.log(
      `  ${i.plate.padEnd(13)} ${i.date.toISOString().slice(0, 10)}  ` +
        `${String(i.prev).padStart(7)} → ${String(i.current).padStart(7)}  ` +
        `${i.status.padEnd(10)} ${i.description.slice(0, 38)}`,
    );
  }

  if (!confirm) {
    console.log('\nChạy thử — chưa ghi gì. Thêm --confirm để ghi trạng thái.');
    await prisma.$disconnect();
    return;
  }

  // Đặt lại toàn bộ về OK trước, rồi đánh dấu các trường hợp bất thường —
  // chạy lại sau khi sửa dữ liệu thì trạng thái cũ tự biến mất.
  await prisma.vehicleMaintenance.updateMany({ data: { odometerStatus: 'OK' } });

  for (const u of updates) {
    await prisma.vehicleMaintenance.update({
      where: { id: u.id },
      data: { odometerStatus: u.status },
    });
  }

  console.log(`\n✓ Đánh dấu ${updates.length} bản ghi (${issues.length} cần rà soát)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
