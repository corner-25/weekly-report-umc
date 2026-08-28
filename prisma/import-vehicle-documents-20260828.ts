/**
 * Import the verified fields from /Users/quang/Downloads/HOSO_Xe UMC.
 *
 * Every value below was checked against the 26 images and the six-page PDF.
 * The script is dry-run by default and updates existing vehicles only. It does
 * not replace newer permits already stored in License records.
 *
 *   npx tsx prisma/import-vehicle-documents-20260828.ts
 *   npx tsx prisma/import-vehicle-documents-20260828.ts --confirm
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const confirm = process.argv.includes('--confirm');
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

type ImportItem = {
  lookupPlate: string;
  documentCount: number;
  data: Prisma.VehicleUpdateInput;
};

const items: ImportItem[] = [
  {
    lookupPlate: '50A-007.20',
    documentCount: 6,
    data: {
      brand: 'TOYOTA', model: 'FORTUNER', category: 'ADMIN_CAR', color: 'XÁM',
      engineNumber: '2TR-7445546', chassisNumber: 'RL4ZX69G1C9002346', seatCount: '07 chỗ',
      manufactureYear: 2011, manufactureCountry: 'VIỆT NAM', expiryYear: 'Không thời hạn',
      registrationNumber: '057370', registrationDate: date('2011-12-12'), firstRegistrationDate: date('2011-12-12'),
      inspectionCertNumber: 'VA-0507761', inspectionExpiry: date('2026-05-18'), insuranceExpiry: date('2026-03-18'),
      ownerName: 'BỆNH VIỆN ĐẠI HỌC Y DƯỢC TPHCM', ownerAddress: '215 Hồng Bàng, P.11, Q.5, TP.HCM',
      dimensions: '4705x1840x1850 mm', tireSpecification: '265/65R17', wheelTrack: '1540/1540 mm',
      wheelbase: '2750 mm', fuelType: 'Xăng', engineType: '2TR-FE', displacement: '2694 cm3', maxPower: '118 kW/5200 rpm',
    },
  },
  {
    lookupPlate: '50A-018.35',
    documentCount: 4,
    data: {
      brand: 'TOYOTA', model: 'HIACE', category: 'AMBULANCE', color: 'TRẮNG',
      engineNumber: '23205682TR', chassisNumber: 'JTFSX22P906207503', seatCount: '07 ngồi + 1 nằm',
      manufactureYear: 2021, manufactureCountry: 'NHẬT BẢN', expiryYear: '2041',
      registrationNumber: '50 0500242', registrationDate: date('2021-09-09'), firstRegistrationDate: date('2021-09-09'),
      inspectionCertNumber: 'VA-1322467', inspectionExpiry: date('2026-09-03'), insuranceExpiry: date('2026-07-13'),
      ownerName: 'BỆNH VIỆN ĐẠI HỌC Y DƯỢC TPHCM', ownerAddress: '215 Hồng Bàng, P.11, Q.5, TP.HCM',
    },
  },
  {
    lookupPlate: '50A-019.90',
    documentCount: 4,
    data: {
      brand: 'HYUNDAI', model: 'SOLATI S', category: 'AMBULANCE', color: 'TRẮNG',
      engineNumber: 'K971359D4CB', chassisNumber: 'RLUUE37RPMB000106', seatCount: '07 ngồi + 1 nằm',
      manufactureYear: 2021, manufactureCountry: 'VIỆT NAM', expiryYear: '2041',
      registrationNumber: '50 074938', registrationDate: date('2022-02-14'), firstRegistrationDate: date('2022-02-14'),
      inspectionCertNumber: 'VA-1321079', inspectionExpiry: date('2026-08-07'), insuranceExpiry: date('2027-02-21'),
      ownerName: 'BỆNH VIỆN ĐẠI HỌC Y DƯỢC TPHCM', ownerAddress: '215 Hồng Bàng, P.11, Q.5, TP.HCM',
      dimensions: '6195x2038x2855 mm', tireSpecification: '235/65R16', wheelTrack: '1712/1718 mm',
      wheelbase: '3670 mm', fuelType: 'Diesel', engineType: 'D4CB', displacement: '2497 cm3', maxPower: '125 kW/3600 rpm',
    },
  },
  {
    lookupPlate: '51A-1212',
    documentCount: 5,
    data: {
      brand: 'TOYOTA', model: 'ZACE-GL', category: 'ADMIN_CAR', color: 'GHI - XÁM',
      engineNumber: '7K-0622165', chassisNumber: 'KF3-6906078', seatCount: '08 chỗ',
      manufactureYear: 2003, manufactureCountry: 'VIỆT NAM', expiryYear: 'Không thời hạn',
      registrationNumber: 'A0214452', registrationDate: date('2003-08-25'), firstRegistrationDate: date('2003-08-25'),
      inspectionCertNumber: 'VA-1474904', inspectionExpiry: date('2026-05-16'), insuranceExpiry: date('2026-03-24'),
      ownerName: 'BỆNH VIỆN ĐẠI HỌC Y DƯỢC TPHCM', ownerAddress: '215 Hồng Bàng, P.11, Q.5, TP.HCM',
      dimensions: '4520x1720x1850 mm', tireSpecification: '195/70R14', wheelTrack: '1445/1430 mm',
      wheelbase: '2650 mm', fuelType: 'Xăng', engineType: '7K', displacement: '1781 cm3', maxPower: '62 kW/4800 rpm',
    },
  },
  {
    lookupPlate: '50M-004.37',
    documentCount: 4,
    data: {
      brand: 'TOYOTA', model: 'HIACE 2.0', category: 'AMBULANCE', color: 'TRẮNG',
      engineNumber: '2TR-8466514', chassisNumber: 'JTGJX02PXD5027356', seatCount: '06 ngồi + 1 nằm',
      manufactureYear: 2012, manufactureCountry: 'NHẬT BẢN', expiryYear: '2032',
      registrationNumber: '087485', registrationDate: date('2013-03-07'), firstRegistrationDate: date('2013-03-07'),
      inspectionCertNumber: 'VA-4317474', inspectionExpiry: date('2026-08-08'), insuranceExpiry: date('2027-02-21'),
      ownerName: 'BỆNH VIỆN ĐẠI HỌC Y DƯỢC TPHCM', ownerAddress: '215 Hồng Bàng, P.11, Q.5, TP.HCM',
      dimensions: '4695x1695x2100 mm', tireSpecification: '195R15', wheelTrack: '1470/1465 mm',
      wheelbase: '2570 mm', fuelType: 'Xăng', engineType: '2TR', displacement: '2694 cm3', maxPower: '111 kW/4800 rpm',
    },
  },
  {
    lookupPlate: '51B-509.51',
    documentCount: 1,
    data: {
      brand: 'HYUNDAI', model: 'GRAND STAREX', category: 'AMBULANCE', color: 'TRẮNG',
      engineNumber: 'G4KGMD010751', chassisNumber: 'KMJWA37RAMU190268', seatCount: '04 ngồi + 1 nằm',
      manufactureYear: 2021, manufactureCountry: 'HÀN QUỐC', expiryYear: '2041',
      registrationNumber: '50 049381', registrationDate: date('2021-07-30'), firstRegistrationDate: date('2021-07-30'),
      inspectionCertNumber: 'VA-1469716', inspectionExpiry: date('2026-07-10'),
      ownerName: 'NGUYỄN THANH HIỀN', ownerAddress: '40 Trần Phú, P.4, Q.5, TP.HCM',
      dimensions: '5150x1920x2135 mm', tireSpecification: '215/70R16', wheelTrack: '1685/1660 mm',
      wheelbase: '3200 mm', fuelType: 'Xăng', engineType: 'G4KG', displacement: '2359 cm3', maxPower: '129 kW/6000 rpm',
    },
  },
  {
    lookupPlate: '50M-002.19',
    documentCount: 1,
    data: {
      brand: 'TOYOTA', model: 'HIACE', category: 'AMBULANCE', color: 'TRẮNG',
      engineNumber: '2TR-8376301', chassisNumber: '02P3B5022884', seatCount: '06 ngồi + 1 nằm',
      manufactureYear: 2011, manufactureCountry: 'NHẬT BẢN', expiryYear: '2031',
      registrationNumber: '052403', registrationDate: date('2012-03-16'), firstRegistrationDate: date('2012-03-16'),
      inspectionCertNumber: 'VA-4501170', inspectionExpiry: date('2026-05-26'),
      ownerName: 'BỆNH VIỆN ĐẠI HỌC Y DƯỢC TPHCM', ownerAddress: '215 Hồng Bàng, P.11, Q.5, TP.HCM',
      dimensions: '4695x1695x2245 mm', tireSpecification: '195R15', wheelTrack: '1470/1465 mm',
      wheelbase: '2570 mm', fuelType: 'Xăng', engineType: '2TR', displacement: '2694 cm3', maxPower: '111 kW/4800 rpm',
    },
  },
  {
    lookupPlate: '51B-330.67',
    documentCount: 1,
    data: {
      brand: 'THACO', model: 'TB85S', category: 'BUS', color: 'TRẮNG - XANH',
      engineNumber: 'WP5.200E41', chassisNumber: 'RN5B34SACJN000783', seatCount: '29 chỗ',
      manufactureYear: 2018, manufactureCountry: 'VIỆT NAM', expiryYear: '2038',
      registrationNumber: '561571', registrationDate: date('2020-02-28'), firstRegistrationDate: date('2020-02-28'),
      inspectionCertNumber: 'VA-1476619', inspectionExpiry: date('2026-06-04'),
      ownerName: 'LÊ TƯỜNG LÂN', ownerAddress: '34.04 CC C4, T15 KP6, P. Hiệp Phú, TP. Thủ Đức, TP.HCM',
      dimensions: '8460x2300x3100 mm', tireSpecification: '245/70R19.5', wheelTrack: '1985/1745 mm',
      wheelbase: '4100 mm', fuelType: 'Diesel', engineType: 'WP5.200E41', displacement: '4980 cm3', maxPower: '147 kW/2100 rpm',
    },
  },
  {
    // The old database record has a transcription error: 50A-002-00.
    lookupPlate: '50A-002-00',
    documentCount: 6,
    data: {
      licensePlate: '50M-002.00', brand: 'FORD', model: 'TRANSIT', category: 'AMBULANCE', color: 'TRẮNG',
      engineNumber: 'HFFA6A-07197', chassisNumber: 'NM0XXXTTFX6A-07197', seatCount: '07 ngồi + 1 nằm',
      manufactureYear: 2006, manufactureCountry: 'THỔ NHĨ KỲ', expiryYear: '2026',
      firstRegistrationDate: date('2007-03-16'), inspectionCertNumber: 'DA-0681114', inspectionExpiry: date('2022-09-13'),
      insuranceExpiry: date('2023-03-07'), ownerName: 'BỆNH VIỆN ĐẠI HỌC Y DƯỢC TPHCM',
      ownerAddress: '215 Hồng Bàng, P.11, Q.5, TP.HCM', dimensions: '5770x1974x2850 mm',
      tireSpecification: '215/75R16', wheelTrack: '1737/1700 mm', wheelbase: '3750 mm',
      fuelType: 'Diesel', displacement: '2402 cm3', maxPower: '88 kW/4000 rpm',
    },
  },
];

async function main() {
  const existing = await prisma.vehicle.findMany({
    where: { licensePlate: { in: items.map((item) => item.lookupPlate) } },
    select: { id: true, licensePlate: true },
  });
  const byPlate = new Map(existing.map((vehicle) => [vehicle.licensePlate, vehicle]));
  const missing = items.filter((item) => !byPlate.has(item.lookupPlate));
  if (missing.length) throw new Error(`Không tìm thấy xe: ${missing.map((item) => item.lookupPlate).join(', ')}`);

  console.log(`${items.length} xe, ${items.reduce((sum, item) => sum + item.documentCount, 0)} ảnh/trang hồ sơ đã đối chiếu.`);
  for (const item of items) {
    console.log(`- ${item.lookupPlate}${item.data.licensePlate ? ` → ${String(item.data.licensePlate)}` : ''}: ${item.documentCount} tài liệu`);
  }
  if (!confirm) {
    console.log('Chạy thử — chưa ghi dữ liệu. Thêm --confirm để cập nhật production.');
    return;
  }

  await prisma.$transaction(
    items.map((item) => prisma.vehicle.update({
      where: { id: byPlate.get(item.lookupPlate)!.id },
      data: item.data,
    })),
  );
  console.log(`Đã cập nhật ${items.length} xe trong một transaction.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
