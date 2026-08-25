import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { addChecklistPayloadSchema, createEventPayloadSchema, createWeekDraftPayloadSchema } from '@/lib/chatbot/actions';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['ADMIN', 'ANALYST'].includes(session.user.role ?? 'STAFF')) return NextResponse.json({ error: 'Bạn không có quyền thực hiện hành động AI.' }, { status: 403 });
  const body = await req.json().catch(() => null) as { proposalId?: string } | null;
  if (!body?.proposalId) return NextResponse.json({ error: 'Thiếu mã đề xuất.' }, { status: 400 });

  try {
    const candidate = await prisma.chatbotActionProposal.findFirst({ where: { id: body.proposalId, userId: session.user.id, status: 'PENDING' } });
    if (!candidate) return NextResponse.json({ error: 'Đề xuất không tồn tại hoặc đã được thực hiện.' }, { status: 409 });
    if (candidate.expiresAt <= new Date()) {
      await prisma.chatbotActionProposal.update({ where: { id: candidate.id }, data: { status: 'EXPIRED' } });
      return NextResponse.json({ error: 'Đề xuất đã hết hạn.' }, { status: 410 });
    }
    const result = await prisma.$transaction(async (tx) => {
      const proposal = await tx.chatbotActionProposal.findFirst({ where: { id: body.proposalId, userId: session.user.id, status: 'PENDING' } });
      if (!proposal) throw new Error('PROPOSAL_NOT_FOUND');
      const claimed = await tx.chatbotActionProposal.updateMany({ where: { id: proposal.id, status: 'PENDING' }, data: { status: 'EXECUTED', executedAt: new Date() } });
      if (claimed.count !== 1) throw new Error('PROPOSAL_NOT_FOUND');
      let entity: { id: string; href: string; message: string };
      if (proposal.actionType === 'CREATE_HOSPITAL_EVENT') {
        const payload = createEventPayloadSchema.parse(proposal.payload);
        const templates = await tx.checklistTemplate.findMany({ where: { isDefault: true, isActive: true }, orderBy: { orderNumber: 'asc' } });
        const event = await tx.hospitalEvent.create({ data: { name: payload.name, date: new Date(payload.date), time: payload.time ?? undefined, description: payload.description ?? undefined, meetingRoomId: payload.meetingRoomId ?? undefined, eventType: payload.eventType, status: 'UNCONFIRMED' } });
        if (templates.length) await tx.eventChecklistItem.createMany({ data: templates.map((item) => ({ hospitalEventId: event.id, title: item.title, description: item.description, orderNumber: item.orderNumber })) });
        entity = { id: event.id, href: `/dashboard/hospital-events/${event.id}`, message: 'Đã tạo sự kiện ở trạng thái chưa xác nhận.' };
      } else if (proposal.actionType === 'ADD_EVENT_CHECKLIST_ITEM') {
        const payload = addChecklistPayloadSchema.parse(proposal.payload);
        const exists = await tx.hospitalEvent.findFirst({ where: { id: payload.eventId, deletedAt: null }, select: { id: true } });
        if (!exists) throw new Error('EVENT_NOT_FOUND');
        const max = await tx.eventChecklistItem.aggregate({ where: { hospitalEventId: payload.eventId }, _max: { orderNumber: true } });
        const item = await tx.eventChecklistItem.create({ data: { hospitalEventId: payload.eventId, title: payload.title, description: payload.description ?? undefined, orderNumber: (max._max.orderNumber ?? -1) + 1 } });
        entity = { id: item.id, href: `/dashboard/hospital-events/${payload.eventId}`, message: 'Đã thêm mục checklist vào sự kiện.' };
      } else if (proposal.actionType === 'CREATE_WEEK_DRAFT') {
        const payload = createWeekDraftPayloadSchema.parse(proposal.payload);
        const week = await tx.week.create({ data: { weekNumber: payload.weekNumber, year: payload.year, startDate: new Date(payload.startDate), endDate: new Date(payload.endDate), status: 'DRAFT', createdById: session.user.id } });
        entity = { id: week.id, href: `/dashboard/weeks/${week.id}/edit`, message: 'Đã tạo báo cáo tuần ở trạng thái nháp.' };
      } else throw new Error('ACTION_NOT_ALLOWED');
      await tx.chatbotActionProposal.update({ where: { id: proposal.id }, data: { resultId: entity.id } });
      return entity;
    });
    return NextResponse.json({ message: result.message, entity: { id: result.id, href: result.href } });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'PROPOSAL_EXPIRED') return NextResponse.json({ error: 'Đề xuất đã hết hạn.' }, { status: 410 });
    if (code === 'PROPOSAL_NOT_FOUND') return NextResponse.json({ error: 'Đề xuất không tồn tại hoặc đã được thực hiện.' }, { status: 409 });
    return NextResponse.json({ error: 'Không thể thực hiện đề xuất.' }, { status: 400 });
  }
}
