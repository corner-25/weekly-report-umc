import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handle, HttpError } from '@/lib/crm/server';
import { requireImporter } from '@/lib/import-token';
import { sha256, sniffMimeType } from '@/lib/vehicle-documents';

export const maxDuration = 120;

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const OFFICE_TYPES: Record<string, string> = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
};

/** File đính kèm công việc đã lưu (mã file office → sha256) — script chỉ tải lên file mới hoặc đổi nội dung. */
export const GET = handle(async (request: Request) => {
  await requireImporter(request);
  const rows = await prisma.workAttachment.findMany({ select: { externalCode: true, sha256: true } });
  return NextResponse.json(Object.fromEntries(rows.map((r) => [r.externalCode, r.sha256])));
});

const metaSchema = z.object({
  externalId: z.string().min(1),
  attchFileID: z.string().min(1),
  fileName: z.string().min(1),
  extension: z.string().optional(),
  contentType: z.string().optional(),
  createdDate: z.string().optional(),
  createdBy: z.string().optional(),
  originalSize: z.coerce.number().int().nonnegative().optional(),
});

/** Tải một file đính kèm của công việc (đã nén PDF ở máy cào). */
export const POST = handle(async (request: Request) => {
  await requireImporter(request);
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, 'Thiếu file');
  if (file.size > MAX_FILE_BYTES) throw new HttpError(413, 'File quá 25 MB');
  const meta = metaSchema.parse(Object.fromEntries([...form.entries()].filter(([k]) => k !== 'file')));
  const item = await prisma.workItem.findUnique({ where: { source_externalId: { source: 'QLCV', externalId: meta.externalId } }, select: { id: true } });
  if (!item) throw new HttpError(404, `Chưa có công việc mã ${meta.externalId} — nạp danh sách trước`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const data = {
    workItemId: item.id,
    fileName: meta.fileName,
    mimeType: sniffMimeType(bytes) ?? OFFICE_TYPES[(meta.extension ?? '').toLowerCase()] ?? meta.contentType ?? 'application/octet-stream',
    fileSize: bytes.length,
    originalSize: meta.originalSize ?? null,
    sha256: sha256(bytes),
    data: Buffer.from(bytes),
    uploadedBy: meta.createdBy ?? null,
  };
  const saved = await prisma.workAttachment.upsert({
    where: { externalCode: meta.attchFileID },
    create: { ...data, externalCode: meta.attchFileID, ...(meta.createdDate ? { createdAt: new Date(`${meta.createdDate.replace(' ', 'T')}+07:00`) } : {}) },
    update: data,
    select: { id: true },
  });
  return NextResponse.json({ id: saved.id, workItemId: item.id });
});
