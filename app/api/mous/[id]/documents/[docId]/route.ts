import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string; docId: string }> };

/** Xoá một văn bản của MOU (kèm file lưu trong DB). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, docId } = await params;
  const { count } = await prisma.mOUDocument.deleteMany({ where: { id: docId, mouId: id } });
  if (!count) return NextResponse.json({ error: 'Không tìm thấy văn bản' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
