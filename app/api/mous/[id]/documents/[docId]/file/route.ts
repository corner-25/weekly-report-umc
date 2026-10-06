import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { contentDisposition } from '@/lib/vehicle-documents';

type Ctx = { params: Promise<{ id: string; docId: string }> };

/** Nội dung file văn bản MOU lưu trong DB — xem trực tiếp, ?download=1 để tải về. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, docId } = await params;
  const doc = await prisma.mOUDocument.findFirst({
    where: { id: docId, mouId: id },
    select: { data: true, mimeType: true, fileName: true, title: true, sha256: true },
  });
  if (!doc?.data) return NextResponse.json({ error: 'Không tìm thấy file' }, { status: 404 });

  const etag = `"${doc.sha256}"`;
  if (doc.sha256 && req.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304 });

  const download = req.nextUrl.searchParams.get('download') === '1';
  return new NextResponse(new Uint8Array(doc.data), {
    headers: {
      'Content-Type': doc.mimeType ?? 'application/octet-stream',
      'Content-Length': String(doc.data.length),
      'Content-Disposition': contentDisposition(doc.fileName ?? doc.title, !download),
      'Cache-Control': 'private, max-age=86400',
      ...(doc.sha256 ? { ETag: etag } : {}),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
