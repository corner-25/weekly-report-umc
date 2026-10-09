import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { handle, HttpError } from '@/lib/crm/server';
import { requireImporter } from '@/lib/import-token';
import { knownMouFiles, upsertMouFile } from '@/lib/mou/office-import';

export const maxDuration = 120;

/** Một file sau nén vẫn hiếm khi quá ngần này; quá thì báo để nén mạnh hơn. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** File office đã lưu (mã file → sha256) — script so để chỉ tải lên file mới hoặc đổi nội dung. */
export const GET = handle(async (request: Request) => {
  await requireImporter(request);
  return NextResponse.json(await knownMouFiles(prisma));
});

const metaSchema = z.object({
  taskId: z.string().min(1),
  attchFileID: z.string().min(1),
  fileName: z.string().min(1),
  extension: z.string().optional(),
  contentType: z.string().optional(),
  createdDate: z.string().optional(),
  createdBy: z.string().optional(),
  originalSize: z.coerce.number().int().nonnegative().optional(),
  ocrText: z.string().optional(),
  pageCount: z.coerce.number().int().nonnegative().optional(),
  attachType: z.string().optional(),
});

/** Tải một file đính kèm của MOU (đã nén ở máy cào, kèm chữ OCR nếu có). */
export const POST = handle(async (request: Request) => {
  await requireImporter(request);
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) throw new HttpError(400, 'Thiếu file');
  if (file.size > MAX_FILE_BYTES) throw new HttpError(413, 'File quá 25 MB');
  const meta = metaSchema.parse(Object.fromEntries([...form.entries()].filter(([k]) => k !== 'file')));
  const mou = await prisma.mOU.findUnique({ where: { externalCode: meta.taskId }, select: { id: true } });
  if (!mou) throw new HttpError(404, `Chưa có MOU mã ${meta.taskId} — nạp danh sách trước`);
  const result = await upsertMouFile(prisma, mou.id, meta, new Uint8Array(await file.arrayBuffer()), {
    originalSize: meta.originalSize,
    ocrText: meta.ocrText,
    pageCount: meta.pageCount,
    attachType: meta.attachType,
  });
  return NextResponse.json({ ...result, mouId: mou.id });
});
