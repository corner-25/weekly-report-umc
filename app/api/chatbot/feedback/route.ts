import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null) as { auditId?: string; helpful?: boolean } | null;
  if (!body?.auditId || typeof body.helpful !== 'boolean') return NextResponse.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  const updated = await prisma.chatbotAuditLog.updateMany({ where: { id: body.auditId, userId: session.user.id }, data: { feedback: body.helpful ? 'HELPFUL' : 'NOT_HELPFUL' } });
  if (!updated.count) return NextResponse.json({ error: 'Không tìm thấy lượt trả lời.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
