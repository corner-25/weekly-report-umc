/**
 * Ghi MOU cào từ office vào DB — dùng chung cho API nạp (script cào gọi qua mạng)
 * và script nạp tay prisma/import-mou-office.ts.
 *
 * Chạy lại được: MOU khớp theo mã công việc, tiến độ theo mã dòng, file theo mã file
 * office. Phần Phòng HC tự ghi (số hiệu, ghi chú, điều khoản, liên hệ, phạm vi,
 * đánh giá) không bị ghi đè.
 */
import type { PrismaClient } from '@prisma/client';
import { matchDepartment } from '@/lib/ingestion/parsers/department-matcher';
import { UNIT_ABBREVIATIONS } from '@/lib/work/import';
import { sha256, sniffMimeType } from '@/lib/vehicle-documents';
import { documentTypeOf, toMouRecord, toProgressRecords, type OfficeMouDetail, type OfficeMouRow } from './office';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface MouRowsSummary {
  created: number;
  updated: number;
  progress: number;
  noDepartment: string[];
  /** Mã công việc office → id MOU trong hệ thống. */
  mouIds: Record<string, string>;
}

export async function importMouRows(
  db: PrismaClient,
  bundle: { source: string; rows: OfficeMouRow[]; details: Record<string, OfficeMouDetail> },
): Promise<MouRowsSummary> {
  const departments = await db.department.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
  const departmentOf = (unit: string | null) => {
    if (!unit) return null;
    const full = UNIT_ABBREVIATIONS[unit] ?? unit;
    return departments.find((d) => d.name === full)?.id ?? matchDepartment(full, departments).departmentId ?? null;
  };
  const summary: MouRowsSummary = { created: 0, updated: 0, progress: 0, noDepartment: [], mouIds: {} };
  for (const row of bundle.rows) {
    const detail = bundle.details[String(row.taskID)];
    const rec = toMouRecord(row, detail);
    const departmentId = departmentOf(rec.leadUnit);
    if (rec.leadUnit && !departmentId) summary.noDepartment.push(rec.leadUnit);
    const { leadUnit: _unit, ...fields } = rec;
    const data = { ...fields, departmentId, externalUrl: bundle.source };
    const existing = await db.mOU.findUnique({ where: { externalCode: rec.externalCode }, select: { id: true } });
    const mou = existing
      ? await db.mOU.update({ where: { id: existing.id }, data, select: { id: true } })
      : await db.mOU.create({ data, select: { id: true } });
    summary[existing ? 'updated' : 'created'] += 1;
    summary.mouIds[rec.externalCode] = mou.id;
    for (const p of toProgressRecords(rec.externalCode, detail)) {
      const done = await db.mOUProgress.findUnique({ where: { externalKey: p.externalKey }, select: { id: true } });
      if (done) continue;
      await db.mOUProgress.create({ data: { ...p, mouId: mou.id } });
      summary.progress += 1;
    }
  }
  summary.noDepartment = [...new Set(summary.noDepartment)];
  return summary;
}

export interface OfficeFileMeta {
  attchFileID: number | string;
  fileName: string;
  extension?: string | null;
  contentType?: string | null;
  createdDate?: string | null;
  createdBy?: string | null;
}

/** Mã file office → sha256 nội dung đã lưu — script bỏ qua file không đổi, khỏi tải và nén lại. */
export async function knownMouFiles(db: PrismaClient): Promise<Record<string, string | null>> {
  const docs = await db.mOUDocument.findMany({ where: { externalCode: { not: null } }, select: { externalCode: true, sha256: true } });
  return Object.fromEntries(docs.map((d) => [d.externalCode!, d.sha256]));
}

/**
 * Lưu một file đính kèm (đã nén) vào văn bản của MOU. Nội dung đổi thì chữ OCR cũ
 * không còn đúng — thay bằng chữ mới gửi kèm, hoặc xoá để đọc lại.
 */
export async function upsertMouFile(
  db: PrismaClient,
  mouId: string,
  f: OfficeFileMeta,
  bytes: Uint8Array,
  extra: { originalSize?: number | null; ocrText?: string | null; pageCount?: number | null; attachType?: string | null } = {},
): Promise<{ id: string; changed: boolean }> {
  const externalCode = String(f.attchFileID);
  const hash = sha256(bytes);
  const before = await db.mOUDocument.findUnique({ where: { externalCode }, select: { sha256: true } });
  const changed = before?.sha256 !== hash;
  const mimeType = sniffMimeType(bytes) ?? (String(f.extension ?? '').toLowerCase() === '.xlsx' ? XLSX_MIME : f.contentType ?? 'application/octet-stream');
  const content = {
    title: f.fileName.replace(/\.[^.]+$/, ''),
    // File kèm dòng tiến độ / trao đổi trên office không phải biên bản ký.
    documentType: (extra.attachType ?? '').toUpperCase() === 'NOTES' ? 'Trao đổi' : (extra.attachType ?? '').toUpperCase() === 'LOGTIME' ? 'Báo cáo tiến độ' : documentTypeOf(f.fileName),
    fileName: f.fileName,
    fileSize: bytes.length,
    originalSize: extra.originalSize ?? null,
    mimeType,
    sha256: hash,
    data: Buffer.from(bytes),
    uploadedBy: f.createdBy ? `office · ${f.createdBy}` : 'office',
    ...(changed ? { ocrText: extra.ocrText ?? null, pageCount: extra.pageCount ?? null, ocrAt: extra.ocrText ? new Date() : null } : {}),
  };
  const doc = await db.mOUDocument.upsert({
    where: { externalCode },
    create: { ...content, externalCode, mouId, ...(f.createdDate ? { createdAt: new Date(`${f.createdDate.replace(' ', 'T')}+07:00`) } : {}) },
    update: { ...content, mouId },
    select: { id: true },
  });
  await db.mOUDocument.update({ where: { id: doc.id }, data: { fileUrl: `/api/mous/${mouId}/documents/${doc.id}/file` } });
  return { id: doc.id, changed };
}
