import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sha256 } from '@/lib/vehicle-documents';
import { MAX_CRM_PHOTO_BYTES, MAX_PHOTOS_PER_ITEM, sniffPhotoMime } from '@/lib/crm/photos';
import { handle, HttpError, requireSession, toPhotoDto } from '@/lib/crm/server';

const ownerSchema = z
  .object({
    interactionId: z.string().min(1).optional(),
    careTaskId: z.string().min(1).optional(),
    kind: z.enum(['RECEIVED', 'GIVEN', 'OTHER']).default('OTHER'),
    caption: z.string().trim().max(300).optional(),
  })
  .refine((v) => Boolean(v.interactionId) !== Boolean(v.careTaskId), {
    message: 'Ảnh phải gắn với đúng một lượt tương tác hoặc một việc quà/hoa',
    path: ['interactionId'],
  });

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' && value !== '' ? value : undefined;
};

/** Tải ảnh quà, hoa (form field "files", nhiều file). Ảnh trùng nội dung trong cùng mục thì bỏ qua. */
export const POST = handle(async (request: Request) => {
  const session = await requireSession();
  const form = await request.formData();
  const owner = ownerSchema.parse({
    interactionId: field(form, 'interactionId'),
    careTaskId: field(form, 'careTaskId'),
    kind: field(form, 'kind'),
    caption: field(form, 'caption'),
  });
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) throw new HttpError(400, 'Chưa chọn ảnh nào');

  const where = owner.interactionId ? { interactionId: owner.interactionId } : { careTaskId: owner.careTaskId };
  const exists = owner.interactionId
    ? await prisma.crmInteraction.count({ where: { id: owner.interactionId } })
    : await prisma.crmCareTask.count({ where: { id: owner.careTaskId } });
  if (!exists) throw new HttpError(404, 'Không tìm thấy mục để gắn ảnh');
  const already = await prisma.crmPhoto.count({ where });
  if (already + files.length > MAX_PHOTOS_PER_ITEM) {
    throw new HttpError(400, `Mỗi mục tối đa ${MAX_PHOTOS_PER_ITEM} ảnh (đang có ${already})`);
  }

  const created = [];
  const skipped: Array<{ fileName: string; reason: string }> = [];
  for (const file of files) {
    if (file.size > MAX_CRM_PHOTO_BYTES) {
      skipped.push({ fileName: file.name, reason: 'Ảnh quá 8 MB' });
      continue;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = sniffPhotoMime(bytes);
    if (!mimeType) {
      skipped.push({ fileName: file.name, reason: 'Chỉ nhận ảnh JPG, PNG hoặc WEBP' });
      continue;
    }
    try {
      const photo = await prisma.crmPhoto.create({
        data: {
          ...where,
          kind: owner.kind,
          caption: owner.caption || null,
          mimeType,
          size: bytes.length,
          sha256: sha256(bytes),
          data: Buffer.from(bytes),
          uploadedById: session.user.id,
          uploadedBy: session.user.name ?? session.user.email ?? null,
        },
        select: { id: true, kind: true, caption: true, uploadedById: true },
      });
      created.push(toPhotoDto(photo));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        skipped.push({ fileName: file.name, reason: 'Ảnh này đã có' });
      } else {
        throw error;
      }
    }
  }
  return NextResponse.json({ created, skipped }, { status: created.length > 0 ? 201 : 400 });
});
