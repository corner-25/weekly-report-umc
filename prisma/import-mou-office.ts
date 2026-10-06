/**
 * Nạp MOU cào từ office.umc.edu.vn (tools/qlcv-scraper/mou.py) vào phân hệ MOU:
 * mỗi công việc của dự án "Theo dõi ký kết hợp tác toàn viện" thành một MOU,
 * dòng "Theo dõi tiến độ" thành nhật ký tiến độ, file đính kèm (PDF đã nén)
 * lưu thẳng vào DB.
 *
 *   python3 tools/qlcv-scraper/mou.py
 *   npx tsx prisma/import-mou-office.ts ~/.qlcv/out/mou-<thời điểm> [--dry-run]
 *
 * Chạy lại được: MOU khớp theo mã công việc, tiến độ theo mã dòng, file theo mã
 * file office. Phần Phòng HC tự ghi trong hệ thống (số hiệu, ghi chú, điều khoản,
 * email/điện thoại liên hệ, phạm vi) không bị ghi đè.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { matchDepartment } from '@/lib/ingestion/parsers/department-matcher';
import { UNIT_ABBREVIATIONS } from '@/lib/work/import';
import { documentTypeOf, toMouRecord, toProgressRecords, type OfficeMouDetail, type OfficeMouRow } from '@/lib/mou/office';
import { sha256, sniffMimeType } from '@/lib/vehicle-documents';

const prisma = new PrismaClient();

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

interface Bundle {
  source: string;
  rows: OfficeMouRow[];
  details: Record<string, OfficeMouDetail>;
  files: Record<string, { path: string; originalSize: number; size: number }>;
}

async function main() {
  const [dir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dryRun = process.argv.includes('--dry-run');
  if (!dir) throw new Error('Cần thư mục kết quả cào (xem đầu file)');
  const bundle = JSON.parse(readFileSync(join(dir, 'mou.json'), 'utf-8')) as Bundle;

  const departments = await prisma.department.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
  const departmentOf = (unit: string | null) => {
    if (!unit) return null;
    const full = UNIT_ABBREVIATIONS[unit] ?? unit;
    return departments.find((d) => d.name === full)?.id ?? matchDepartment(full, departments).departmentId ?? null;
  };

  const stats = { created: 0, updated: 0, progress: 0, files: 0, bytes: 0, noDepartment: [] as string[] };
  for (const row of bundle.rows) {
    const detail = bundle.details[String(row.taskID)];
    const rec = toMouRecord(row, detail);
    const departmentId = departmentOf(rec.leadUnit);
    if (rec.leadUnit && !departmentId) stats.noDepartment.push(rec.leadUnit);
    const { leadUnit: _unit, ...fields } = rec;
    const data = { ...fields, departmentId, externalUrl: bundle.source };
    if (dryRun) {
      console.log(`${rec.status.padEnd(10)} ${rec.category.padEnd(13)} ${rec.partnerName} [${rec.leadUnit ?? '—'}]`);
      continue;
    }

    const existing = await prisma.mOU.findUnique({ where: { externalCode: rec.externalCode }, select: { id: true } });
    const mou = existing
      ? await prisma.mOU.update({ where: { id: existing.id }, data, select: { id: true } })
      : await prisma.mOU.create({ data, select: { id: true } });
    stats[existing ? 'updated' : 'created'] += 1;

    for (const p of toProgressRecords(rec.externalCode, detail)) {
      const done = await prisma.mOUProgress.findUnique({ where: { externalKey: p.externalKey }, select: { id: true } });
      if (done) continue;
      await prisma.mOUProgress.create({ data: { ...p, mouId: mou.id } });
      stats.progress += 1;
    }

    for (const f of detail?.files ?? []) {
      const saved = bundle.files[String(f.attchFileID)];
      const path = saved && join(dir, 'files', saved.path);
      if (!path || !existsSync(path)) continue;
      const bytes = new Uint8Array(readFileSync(path));
      const mimeType = sniffMimeType(bytes) ?? (f.extension === '.xlsx' ? XLSX_MIME : f.contentType ?? 'application/octet-stream');
      const content = {
        title: f.fileName.replace(/\.[^.]+$/, ''),
        documentType: documentTypeOf(f.fileName),
        fileName: f.fileName,
        fileSize: bytes.length,
        originalSize: saved.originalSize,
        mimeType,
        sha256: sha256(bytes),
        data: Buffer.from(bytes),
        uploadedBy: f.createdBy ? `office · ${f.createdBy}` : 'office',
      };
      const externalCode = String(f.attchFileID);
      const doc = await prisma.mOUDocument.upsert({
        where: { externalCode },
        create: { ...content, externalCode, mouId: mou.id, ...(f.createdDate ? { createdAt: new Date(`${f.createdDate.replace(' ', 'T')}+07:00`) } : {}) },
        update: { ...content, mouId: mou.id },
        select: { id: true },
      });
      await prisma.mOUDocument.update({ where: { id: doc.id }, data: { fileUrl: `/api/mous/${mou.id}/documents/${doc.id}/file` } });
      stats.files += 1;
      stats.bytes += bytes.length;
    }
  }

  console.log(
    `${dryRun ? '(chạy thử) ' : ''}${bundle.rows.length} MOU: ${stats.created} mới, ${stats.updated} cập nhật; ` +
      `${stats.progress} dòng tiến độ mới; ${stats.files} file (${Math.round(stats.bytes / 1024)} KB)`,
  );
  if (stats.noDepartment.length) console.log(`Không khớp phòng ban: ${[...new Set(stats.noDepartment)].join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
