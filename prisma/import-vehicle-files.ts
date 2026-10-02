/**
 * Đưa file hồ sơ gốc (ảnh, PDF) từ thư mục máy tính lên hồ sơ từng xe.
 *
 * Thư mục nguồn có một thư mục con cho mỗi xe, đặt tên theo biển số viết liền
 * (vd "50A00720"). Hai thư mục bị gõ sai đầu biển số 50/51 — đã đối chiếu ảnh
 * khi nhập thông tin xe ngày 28/08 (prisma/import-vehicle-documents-20260828.ts,
 * khớp cả số tài liệu) nên ánh xạ cứng ở FOLDER_OVERRIDES.
 *
 * Chạy thử (không ghi gì) rồi mới ghi thật:
 *   npx tsx prisma/import-vehicle-files.ts "/Users/quang/Downloads/HOSO_Xe UMC"
 *   npx tsx prisma/import-vehicle-files.ts "/Users/quang/Downloads/HOSO_Xe UMC" --confirm
 *
 * Chạy lại nhiều lần an toàn: file trùng nội dung (SHA-256) với file đã có thì bỏ qua.
 */
import 'dotenv/config';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { MAX_VEHICLE_DOCUMENT_BYTES, sha256, sniffMimeType } from '@/lib/vehicle-documents';

const FOLDER_OVERRIDES: Record<string, string> = {
  '50A1212': '51A1212',
  '50B50951': '51B50951',
};

const prisma = new PrismaClient();
const root = process.argv[2];
const confirm = process.argv.includes('--confirm');

async function main(): Promise<void> {
  if (!root) throw new Error('Thiếu đường dẫn thư mục hồ sơ');
  const vehicles = await prisma.vehicle.findMany({
    where: { deletedAt: null },
    select: { id: true, licensePlate: true, licensePlateNormalized: true },
  });
  const byPlate = new Map(vehicles.map((v) => [v.licensePlateNormalized, v]));

  const folders = readdirSync(root).filter((name) => statSync(join(root, name)).isDirectory()).sort();
  let toAdd = 0;
  let duplicates = 0;
  let rejected = 0;

  for (const folder of folders) {
    const plate = FOLDER_OVERRIDES[folder] ?? folder;
    const vehicle = byPlate.get(plate);
    if (!vehicle) throw new Error(`Thư mục "${folder}" không khớp xe nào (biển ${plate})`);

    const existing = new Set(
      (await prisma.vehicleDocument.findMany({ where: { vehicleId: vehicle.id }, select: { sha256: true } })).map((d) => d.sha256),
    );
    const files = readdirSync(join(root, folder)).filter((f) => !f.startsWith('.')).sort();
    console.info(`${folder}${plate !== folder ? ` → ${plate}` : ''} (${vehicle.licensePlate}): ${files.length} file`);

    let index = existing.size;
    for (const fileName of files) {
      const bytes = new Uint8Array(readFileSync(join(root, folder, fileName)));
      const mimeType = sniffMimeType(bytes);
      if (!mimeType || bytes.length > MAX_VEHICLE_DOCUMENT_BYTES) {
        console.warn(`   bỏ qua ${fileName}: ${!mimeType ? 'không phải ảnh/PDF' : 'quá lớn'}`);
        rejected += 1;
        continue;
      }
      const hash = sha256(bytes);
      if (existing.has(hash)) {
        duplicates += 1;
        continue;
      }
      existing.add(hash);
      index += 1;
      // Tên ảnh chụp từ Zalo là chuỗi số vô nghĩa — đặt tiêu đề theo xe và thứ tự.
      const title = mimeType === 'application/pdf'
        ? `Hồ sơ xe ${vehicle.licensePlate}`
        : `Hồ sơ ${vehicle.licensePlate} — ảnh ${index}`;
      toAdd += 1;
      if (confirm) {
        await prisma.vehicleDocument.create({
          data: {
            vehicleId: vehicle.id, title, fileName, mimeType, size: bytes.length, sha256: hash,
            data: Buffer.from(bytes), uploadedBy: 'Nhập từ thư mục HOSO_Xe UMC',
          },
        });
      }
    }
  }

  console.info(`\n${confirm ? 'Đã thêm' : 'Sẽ thêm'} ${toAdd} file · trùng đã có ${duplicates} · bỏ qua ${rejected}`);
  if (!confirm) console.info('(chạy thử — thêm --confirm để ghi)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
