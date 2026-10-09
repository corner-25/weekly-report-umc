/**
 * Nạp tay MOU cào từ office (thư mục kết quả của tools/qlcv-scraper/mou.py) vào DB.
 * Đường thường dùng là tools/qlcv-scraper/sync_all.py — cào và đẩy thẳng lên
 * production qua API; script này để nạp lại một lần cào cũ.
 *
 *   npx tsx prisma/import-mou-office.ts ~/.qlcv/out/mou-<thời điểm>
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import type { OfficeMouDetail, OfficeMouRow } from '@/lib/mou/office';
import { importMouRows, upsertMouFile } from '@/lib/mou/office-import';

const prisma = new PrismaClient();

interface Bundle {
  source: string;
  rows: OfficeMouRow[];
  details: Record<string, OfficeMouDetail>;
  files: Record<string, { path: string; originalSize: number; size: number }>;
}

async function main() {
  const [dir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!dir) throw new Error('Cần thư mục kết quả cào (xem đầu file)');
  const bundle = JSON.parse(readFileSync(join(dir, 'mou.json'), 'utf-8')) as Bundle;
  const s = await importMouRows(prisma, bundle);
  let files = 0;
  for (const row of bundle.rows) {
    const mouId = s.mouIds[String(row.taskID)];
    for (const f of bundle.details[String(row.taskID)]?.files ?? []) {
      const saved = bundle.files[String(f.attchFileID)];
      const path = saved && join(dir, 'files', saved.path);
      if (!path || !existsSync(path)) continue;
      await upsertMouFile(prisma, mouId, f, new Uint8Array(readFileSync(path)), { originalSize: saved.originalSize });
      files += 1;
    }
  }
  console.log(`${bundle.rows.length} MOU: ${s.created} mới, ${s.updated} cập nhật; ${s.progress} dòng tiến độ mới; ${files} file`);
  if (s.noDepartment.length) console.log(`Không khớp phòng ban: ${s.noDepartment.join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
