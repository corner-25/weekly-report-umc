import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handle, HttpError, requireSession } from '@/lib/crm/server';
import { contentDisposition } from '@/lib/vehicle-documents';

type Ctx = { params: Promise<{ id: string; attId: string }> };

/** Nội dung file đính kèm công việc — xem trực tiếp, ?download=1 để tải về. */
export const GET = handle(async (req: NextRequest, { params }: Ctx) => {
  await requireSession();
  const { id, attId } = await params;
  const f = await prisma.workAttachment.findFirst({ where: { id: attId, workItemId: id }, select: { data: true, mimeType: true, fileName: true, sha256: true } });
  if (!f) throw new HttpError(404, 'Không tìm thấy file');
  const etag = `"${f.sha256}"`;
  if (req.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304 });
  return new NextResponse(new Uint8Array(f.data), {
    headers: {
      'Content-Type': f.mimeType,
      'Content-Length': String(f.data.length),
      'Content-Disposition': contentDisposition(f.fileName, req.nextUrl.searchParams.get('download') !== '1'),
      'Cache-Control': 'private, max-age=86400',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
    },
  });
});
