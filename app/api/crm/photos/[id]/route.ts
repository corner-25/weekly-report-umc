import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handle, HttpError, requireSession } from '@/lib/crm/server';

type Ctx = { params: Promise<{ id: string }> };

/** Nội dung ảnh. Ảnh không bao giờ sửa (chỉ xoá), nên trình duyệt được giữ lâu. */
export const GET = handle(async (_request: Request, { params }: Ctx) => {
  await requireSession();
  const { id } = await params;
  const photo = await prisma.crmPhoto.findUnique({ where: { id }, select: { data: true, mimeType: true } });
  if (!photo) throw new HttpError(404, 'Không tìm thấy ảnh');
  return new NextResponse(new Uint8Array(photo.data), {
    headers: {
      'Content-Type': photo.mimeType,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

/** Xoá ảnh: người đã tải lên hoặc quản trị viên. */
export const DELETE = handle(async (_request: Request, { params }: Ctx) => {
  const session = await requireSession();
  const { id } = await params;
  const photo = await prisma.crmPhoto.findUnique({ where: { id }, select: { uploadedById: true } });
  if (!photo) throw new HttpError(404, 'Không tìm thấy ảnh');
  if (session.user.role !== 'ADMIN' && photo.uploadedById !== session.user.id) {
    throw new HttpError(403, 'Chỉ người tải ảnh lên hoặc quản trị viên được xoá');
  }
  await prisma.crmPhoto.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
