/**
 * Đẩy file kết quả cào phân hệ Quản lý công việc lên hệ thống — chạy trên máy
 * trong mạng bệnh viện, ngay sau script cào. Không cần mật khẩu database: chỉ
 * cần mã nạp dữ liệu (WORK_IMPORT_TOKEN, lấy từ quản trị viên).
 *
 *   WORK_IMPORT_TOKEN=... npx tsx prisma/push-work-file.ts ket-qua-cao.json
 *   WORK_IMPORT_TOKEN=... APP_URL=http://localhost:3000 npx tsx prisma/push-work-file.ts ket-qua-cao.json
 */
import { readFileSync } from 'fs';

async function main(): Promise<void> {
  const file = process.argv[2];
  const token = process.env.WORK_IMPORT_TOKEN;
  const appUrl = process.env.APP_URL ?? 'https://umc.up.railway.app';
  if (!file) throw new Error('Cần đường dẫn file JSON: npx tsx prisma/push-work-file.ts <file.json>');
  if (!token) throw new Error('Thiếu biến môi trường WORK_IMPORT_TOKEN');

  const body = readFileSync(file, 'utf8');
  JSON.parse(body); // báo lỗi sớm nếu file hỏng, trước khi gửi
  const res = await fetch(`${appUrl}/api/work/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-import-token': token },
    body,
  });
  const result = await res.json();
  if (!res.ok) throw new Error(`Nạp thất bại (${res.status}): ${result.error ?? JSON.stringify(result)}`);
  console.info(
    `Đã nạp ${result.itemsSeen} việc: ${result.itemsCreated} mới, ${result.itemsChanged} thay đổi, ${result.updatesAdded} cập nhật mới`,
  );
  for (const p of result.problems ?? []) console.warn(`  Dòng ${p.index}${p.externalId ? ` (${p.externalId})` : ''}: ${p.message}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
