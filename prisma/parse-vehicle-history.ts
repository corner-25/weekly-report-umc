/**
 * Chuẩn hoá lý lịch xe: văn bản thô → bảng bảo dưỡng tra cứu được.
 *
 * Chạy AI trên cột `rawHistory` của từng xe rồi ghi vào
 * `vehicle_maintenance_logs`. Giữ nguyên `rawHistory` làm bản gốc để đối chiếu
 * khi nghi ngờ.
 *
 *   npx tsx prisma/parse-vehicle-history.ts                    # chạy thử 1 xe
 *   npx tsx prisma/parse-vehicle-history.ts --plate=50A-018.35 # một xe cụ thể
 *   npx tsx prisma/parse-vehicle-history.ts --confirm          # ghi thật, mọi xe
 */
import { PrismaClient } from '@prisma/client';
import { parseVehicleHistory } from '@/lib/ai/vehicle-history';

async function main() {
  const confirm = process.argv.includes('--confirm');
  const plateArg = process.argv.find((a) => a.startsWith('--plate='))?.split('=')[1];

  const prisma = new PrismaClient();

  const vehicles = await prisma.vehicle.findMany({
    where: {
      rawHistory: { not: null },
      ...(plateArg ? { licensePlate: plateArg } : {}),
    },
    select: { id: true, licensePlate: true, rawHistory: true },
    orderBy: { licensePlate: 'asc' },
  });

  if (vehicles.length === 0) {
    console.log('Không có xe nào có lý lịch để xử lý.');
    await prisma.$disconnect();
    return;
  }

  // Chạy thử không nêu xe cụ thể thì chỉ làm một xe — đủ để xem chất lượng mà
  // không tốn token cho cả 18 xe.
  const targets = confirm || plateArg ? vehicles : vehicles.slice(0, 1);

  console.log(`${targets.length}/${vehicles.length} xe sẽ xử lý\n`);

  let totalRecords = 0;
  let totalTokens = 0;

  for (const vehicle of targets) {
    const started = Date.now();
    process.stdout.write(`${vehicle.licensePlate.padEnd(14)} `);

    try {
      const result = await parseVehicleHistory(
        vehicle.licensePlate,
        vehicle.rawHistory!,
      );
      const seconds = Math.round((Date.now() - started) / 1000);

      console.log(
        `${String(result.records.length).padStart(3)} bản ghi · ` +
          `${result.chunkCount} đoạn · ${seconds}s · ` +
          `${result.totalTokens.toLocaleString('vi-VN')} tokens`,
      );

      totalRecords += result.records.length;
      totalTokens += result.totalTokens;

      if (!confirm) {
        console.log('\n  Mẫu 8 bản ghi đầu:');
        for (const r of result.records.slice(0, 8)) {
          console.log(
            `    ${(r.date ?? '(không rõ ngày)').padEnd(16)} ` +
              `${String(r.odometer ?? '—').padStart(8)} km  ` +
              `${r.category.padEnd(10)} ${r.description.slice(0, 42)}` +
              `${r.workshop ? `  [${r.workshop}]` : ''}`,
          );
        }
        continue;
      }

      // Xoá bản ghi cũ của xe này trước khi ghi mới, để chạy lại không nhân bản.
      await prisma.vehicleMaintenance.deleteMany({ where: { vehicleId: vehicle.id } });

      if (result.records.length > 0) {
        await prisma.vehicleMaintenance.createMany({
          data: result.records.map((r) => ({
            vehicleId: vehicle.id,
            date: r.date ? new Date(`${r.date}T00:00:00.000Z`) : null,
            odometer: r.odometer,
            category: r.category,
            description: r.description,
            workshop: r.workshop,
          })),
        });
      }
    } catch (error) {
      // Một xe lỗi không nên chặn các xe còn lại.
      console.log(`LỖI: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(
    `\nTổng: ${totalRecords} bản ghi · ${totalTokens.toLocaleString('vi-VN')} tokens`,
  );

  if (!confirm) {
    console.log('\nChạy thử — chưa ghi gì. Thêm --confirm để ghi thật cho mọi xe.');
  } else {
    const count = await prisma.vehicleMaintenance.count();
    console.log(`Bảng bảo dưỡng hiện có ${count} bản ghi.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
