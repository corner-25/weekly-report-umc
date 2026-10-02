import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { contentDisposition } from '@/lib/vehicle-documents';

type Ctx = { params: Promise<{ docId: string }> };

/** Trả nội dung file để xem trực tiếp (ảnh, PDF). Chỉ người đã đăng nhập. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { docId } = await params;
  const doc = await prisma.vehicleDocument.findUnique({
    where: { id: docId },
    select: { data: true, mimeType: true, fileName: true, sha256: true },
  });
  if (!doc) return NextResponse.json({ error: 'Không tìm thấy file' }, { status: 404 });

  // File không đổi sau khi tải lên: dùng hash làm ETag để trình duyệt khỏi tải lại.
  const etag = `"${doc.sha256}"`;
  if (req.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304 });

  const download = req.nextUrl.searchParams.get('download') === '1';
  return new NextResponse(new Uint8Array(doc.data), {
    headers: {
      'Content-Type': doc.mimeType,
      'Content-Length': String(doc.data.length),
      'Content-Disposition': contentDisposition(doc.fileName, !download),
      'Cache-Control': 'private, max-age=86400',
      ETag: etag,
      // Chỉ phát đúng loại đã kiểm khi tải lên, không để trình duyệt đoán.
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { docId } = await params;
  await prisma.vehicleDocument.delete({ where: { id: docId } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
