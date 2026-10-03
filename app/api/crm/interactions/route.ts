import { NextResponse } from 'next/server';
import type { CrmInteractionStatus, CrmInteractionType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { interactionInputSchema } from '@/lib/crm/schemas';
import { INTERACTION_STATUS_LABELS, INTERACTION_TYPE_LABELS, toSearchKey } from '@/lib/crm/constants';
import { handle, interactionInclude, requireSession, toInteractionDto } from '@/lib/crm/server';
import { saveInteraction } from './save';

const TYPES = new Set(Object.keys(INTERACTION_TYPE_LABELS));
const STATUSES = new Set(Object.keys(INTERACTION_STATUS_LABELS));

/** Danh sách tương tác (tiếp đón, dẫn khám, dẫn đoàn…), mới nhất trước. */
export const GET = handle(async (request: Request) => {
  await requireSession();
  const params = new URL(request.url).searchParams;
  const type = params.get('type');
  const staffName = params.get('staffName')?.trim();
  const from = params.get('from');
  const to = params.get('to');
  const search = params.get('search')?.trim();
  const contactId = params.get('contactId');
  const organizationId = params.get('organizationId');
  const status = params.get('status');

  // Mỗi bộ lọc là một điều kiện trong AND: nhiều bộ lọc cùng dùng OR, trải
  // chung vào một object thì cái sau ghi đè cái trước.
  const conditions: Prisma.CrmInteractionWhereInput[] = [];
  if (type && TYPES.has(type)) conditions.push({ type: type as CrmInteractionType });
  if (status && STATUSES.has(status)) conditions.push({ status: status as CrmInteractionStatus });
  if (staffName) conditions.push({ OR: [{ staffName }, { companions: { has: staffName } }] });
  if (from || to) {
    conditions.push({
      occurredAt: {
        // Ngày lọc theo giờ Việt Nam.
        ...(from && { gte: new Date(`${from}T00:00:00+07:00`) }),
        ...(to && { lte: new Date(`${to}T23:59:59.999+07:00`) }),
      },
    });
  }
  if (contactId) conditions.push({ OR: [{ contactId }, { participants: { some: { contactId } } }] });
  if (organizationId) conditions.push({ organizationId });
  if (search) {
    conditions.push({
      OR: [
        { content: { contains: search, mode: 'insensitive' } },
        { destination: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { patientName: { contains: search, mode: 'insensitive' } },
        { contact: { searchKey: { contains: toSearchKey(search) } } },
        { organization: { searchKey: { contains: toSearchKey(search) } } },
      ],
    });
  }
  const where: Prisma.CrmInteractionWhereInput = { AND: conditions };

  const interactions = await prisma.crmInteraction.findMany({
    where,
    include: interactionInclude,
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  });
  return NextResponse.json(interactions.map(toInteractionDto));
});

export const POST = handle(async (request: Request) => {
  const session = await requireSession();
  const data = interactionInputSchema.parse(await request.json());
  const interaction = await saveInteraction(data, { createdById: session.user.id });
  return NextResponse.json(interaction, { status: 201 });
});
