/**
 * Tạo hồ sơ cho xe đang chạy nhưng chưa có trong bảng quản lý phương tiện.
 *
 * Hai xe 50A-032.80 và 50A-032.81 chạy 159 chuyến nhưng không có hồ sơ nào —
 * nên giấy cà-vẹt của chúng cũng treo lơ lửng không nối được vào đâu.
 *
 * Thông tin cơ bản (hãng, dòng xe) lấy từ chính tên giấy cà-vẹt, ví dụ
 * "Cavet xe - 50A-032.81 (TOYOTA FORTUNER)". Phần còn lại để trống cho người
 * quản lý bổ sung — thà thiếu còn hơn bịa.
 *
 *   npx tsx prisma/create-missing-vehicles.ts            # chạy thử
 *   npx tsx prisma/create-missing-vehicles.ts --confirm  # ghi thật
 */
import { PrismaClient } from '@prisma/client';
import { normalizePlate } from '../lib/fleet/plate';

function plateKey(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function extractPlate(text: string): string | null {
  const match = text.match(/\b\d{2}\s*[A-Z]\s*[-\s]?\s*\d{2,3}[.\-]?\d{2,3}\b/i);
  return match ? match[0] : null;
}

/** Hãng và dòng xe nằm trong ngoặc ở tên giấy tờ: "… (TOYOTA FORTUNER)". */
function extractBrandModel(text: string): { brand?: string; model?: string } {
  const match = text.match(/\(([^)]+)\)/);
  if (!match) return {};
  const parts = match[1].trim().split(/\s+/);
  return { brand: parts[0], model: parts.slice(1).join(' ') || undefined };
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  const prisma = new PrismaClient();

  const trips = await prisma.fleetTrip.groupBy({
    by: ['vehicleId'],
    _count: true,
    _min: { recordDate: true },
    _max: { recordDate: true },
  });
  const vehicles = await prisma.vehicle.findMany({ select: { licensePlate: true } });
  const known = new Set(vehicles.map((v) => plateKey(v.licensePlate)));

  const missing = trips.filter((t) => !known.has(plateKey(t.vehicleId)));
  if (missing.length === 0) {
    console.log('Mọi xe đang chạy đều đã có hồ sơ.');
    await prisma.$disconnect();
    return;
  }

  // Giấy tờ chưa nối xe — nguồn thông tin cho hồ sơ sắp tạo.
  const orphanLicenses = await prisma.license.findMany({
    where: { vehicleId: null },
    select: { id: true, name: true },
  });

  console.log(`${missing.length} xe chạy thật nhưng chưa có hồ sơ\n`);

  const plans = missing.map((t) => {
    const key = plateKey(t.vehicleId);
    const license = orphanLicenses.find((l) => {
      const p = extractPlate(l.name);
      return p && plateKey(p) === key;
    });
    const info = license ? extractBrandModel(license.name) : {};

    return {
      plate: t.vehicleId,
      trips: t._count,
      firstTrip: t._min.recordDate,
      lastTrip: t._max.recordDate,
      licenseId: license?.id,
      licenseName: license?.name,
      ...info,
    };
  });

  for (const p of plans) {
    console.log(`  ${p.plate}`);
    console.log(`    ${p.trips} chuyến, từ ${p.firstTrip?.toLocaleDateString('vi-VN')}`);
    console.log(`    hãng: ${p.brand ?? '(chưa rõ)'} ${p.model ?? ''}`);
    console.log(`    giấy tờ: ${p.licenseName?.slice(0, 50) ?? '(không có)'}`);
  }

  if (!confirm) {
    console.log('\nChạy thử — chưa ghi gì. Thêm --confirm để ghi thật.');
    await prisma.$disconnect();
    return;
  }

  for (const p of plans) {
    const created = await prisma.vehicle.create({
      data: {
        licensePlate: p.plate,
        licensePlateNormalized: normalizePlate(p.plate),
        brand: p.brand,
        model: p.model,
        // Xe chở người của tổ xe; người quản lý chỉnh lại nếu sai.
        category: 'ADMIN_CAR',
        status: 'IN_USE',
        sourceFile: 'tạo tự động từ dữ liệu chuyến đi',
      },
      select: { id: true },
    });

    if (p.licenseId) {
      await prisma.license.update({
        where: { id: p.licenseId },
        data: { vehicleId: created.id },
      });
    }
  }

  console.log(`\n✓ Tạo ${plans.length} hồ sơ xe`);
  console.log(`✓ Nối ${plans.filter((p) => p.licenseId).length} giấy tờ`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('LỖI:', e instanceof Error ? e.message : e);
  process.exit(1);
});
