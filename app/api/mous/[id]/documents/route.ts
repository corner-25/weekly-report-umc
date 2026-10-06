import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { sha256, sniffMimeType } from '@/lib/vehicle-documents';

// GET - List documents for a MOU
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const documents = await prisma.mOUDocument.findMany({
      where: { mouId: id },
      orderBy: { createdAt: 'desc' },
      omit: { data: true },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error('Error fetching MOU documents:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}

const MAX_MOU_FILE_BYTES = 20 * 1024 * 1024;
const OFFICE_TYPES: Record<string, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/** Loại file nhận: ảnh/PDF nhận theo chữ ký đầu file; xlsx/docx là file zip có đuôi đúng. */
function mimeOf(bytes: Uint8Array, fileName: string): string | null {
  const sniffed = sniffMimeType(bytes);
  if (sniffed) return sniffed;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  return isZip ? OFFICE_TYPES[ext] ?? null : null;
}

const text = (form: FormData, name: string) => {
  const v = form.get(name);
  return typeof v === 'string' && v.trim() ? v.trim() : null;
};

// POST - Thêm văn bản: JSON (chỉ liên kết) hoặc multipart có field "file" (lưu file vào DB)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const uploadedBy = session.user?.name || session.user?.email || null;
    const exists = await prisma.mOU.count({ where: { id, deletedAt: null } });
    if (!exists) return NextResponse.json({ error: 'Không tìm thấy MOU' }, { status: 404 });

    if ((request.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({ error: 'Chưa chọn file' }, { status: 400 });
      }
      if (file.size > MAX_MOU_FILE_BYTES) {
        return NextResponse.json({ error: 'File quá 20 MB — nén PDF trước khi tải lên' }, { status: 400 });
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mimeType = mimeOf(bytes, file.name);
      if (!mimeType) {
        return NextResponse.json({ error: 'Chỉ nhận PDF, ảnh, Word (.docx) hoặc Excel (.xlsx)' }, { status: 400 });
      }
      const created = await prisma.mOUDocument.create({
        data: {
          mouId: id,
          title: text(form, 'title') ?? file.name.replace(/\.[^.]+$/, ''),
          description: text(form, 'description'),
          documentType: text(form, 'documentType'),
          fileName: file.name,
          fileSize: bytes.length,
          mimeType,
          sha256: sha256(bytes),
          data: Buffer.from(bytes),
          uploadedBy,
        },
        select: { id: true },
      });
      const document = await prisma.mOUDocument.update({
        where: { id: created.id },
        data: { fileUrl: `/api/mous/${id}/documents/${created.id}/file` },
        omit: { data: true },
      });
      return NextResponse.json(document, { status: 201 });
    }

    const body = await request.json();

    if (!body.title) {
      return NextResponse.json({ error: 'Tên văn bản là bắt buộc' }, { status: 400 });
    }

    const document = await prisma.mOUDocument.create({
      data: {
        mouId: id,
        title: body.title,
        description: body.description || null,
        documentType: body.documentType || null,
        fileUrl: body.fileUrl || null,
        fileName: body.fileName || null,
        fileSize: body.fileSize || null,
        uploadedBy,
      },
      omit: { data: true },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('Error creating MOU document:', error);
    return NextResponse.json({ error: 'Có lỗi xảy ra' }, { status: 500 });
  }
}
