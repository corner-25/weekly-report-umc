import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { MAX_VEHICLE_DOCUMENT_BYTES, sha256, sniffMimeType } from '@/lib/vehicle-documents';

type Ctx = { params: Promise<{ id: string }> };

/** Danh sách file hồ sơ của xe — không kèm nội dung file. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const documents = await prisma.vehicleDocument.findMany({
    where: { vehicleId: id },
    orderBy: [{ createdAt: 'asc' }, { fileName: 'asc' }],
    select: { id: true, title: true, fileName: true, mimeType: true, size: true, uploadedBy: true, createdAt: true },
  });
  return NextResponse.json(documents);
}

/** Tải lên một hoặc nhiều file (form field "files"). File trùng nội dung với file đã có thì bỏ qua. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const vehicle = await prisma.vehicle.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!vehicle) return NextResponse.json({ error: 'Không tìm thấy xe' }, { status: 404 });

  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: 'Chưa chọn file nào' }, { status: 400 });

  const created: string[] = [];
  const skipped: Array<{ fileName: string; reason: string }> = [];
  for (const file of files) {
    if (file.size > MAX_VEHICLE_DOCUMENT_BYTES) {
      skipped.push({ fileName: file.name, reason: 'Quá 15 MB' });
      continue;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = sniffMimeType(bytes);
    if (!mimeType) {
      skipped.push({ fileName: file.name, reason: 'Chỉ nhận ảnh JPG, PNG, WEBP hoặc PDF' });
      continue;
    }
    try {
      const doc = await prisma.vehicleDocument.create({
        data: {
          vehicleId: id,
          title: file.name.replace(/\.[^.]+$/, ''),
          fileName: file.name,
          mimeType,
          size: bytes.length,
          sha256: sha256(bytes),
          data: Buffer.from(bytes),
          uploadedBy: session.user.name ?? session.user.email,
        },
        select: { id: true },
      });
      created.push(doc.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        skipped.push({ fileName: file.name, reason: 'Đã có file này trong hồ sơ xe' });
      } else {
        throw error;
      }
    }
  }

  return NextResponse.json({ created: created.length, skipped }, { status: created.length > 0 ? 201 : 400 });
}
