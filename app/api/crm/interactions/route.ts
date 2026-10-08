import { crmPage, CRM_PAGE_SIZE } from '@/lib/crm/pagination';
import { NextResponse } from 'next/server';
import type { CrmInteractionStatus, CrmInteractionType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { interactionInputSchema } from '@/lib/crm/schemas';
import { INTERACTION_STATUS_LABELS, INTERACTION_TYPE_LABELS, toSearchKey } from '@/lib/crm/constants';
import { handle, interactionInclude, requireSession, toInteractionDto, canSeeHealth } from '@/lib/crm/server';
import { saveInteraction } from './save';
import { compressedJson } from '@/lib/http/compressed-json';
import { todayInVietnam } from '@/lib/crm/upcoming';

const TYPES = new Set(Object.keys(INTERACTION_TYPE_LABELS));
const STATUSES = new Set(Object.keys(INTERACTION_STATUS_LABELS));

/** Danh sách tương tác (tiếp đón, dẫn khám, dẫn đoàn…), mới nhất trước. */
export const GET = handle(async (request: Request) => {
  const health = canSeeHealth(await requireSession());
  const params = new URL(request.url).searchParams;
  const type = params.get('type');
  const staffName = params.get('staffName')?.trim();
  const from = params.get('from');
  const to = params.get('to');
  const search = params.get('search')?.trim();
  const contactId = params.get('contactId');
  const organizationId = params.get('organizationId');
  const status = params.get('status');
  const purpose = params.get('purpose')?.trim();
  const topic = params.get('topic')?.trim();
  const hostDepartmentId = params.get('hostDepartmentId');
  const year = params.get('year');
  const needsReview = params.get('needsReview') === '1';

  const isFollowUp = params.get('followUp') === '1';
  const followUpScope = params.get('followUpScope');

  // Mỗi bộ lọc là một điều kiện trong AND: nhiều bộ lọc cùng dùng OR, trải
  // chung vào một object thì cái sau ghi đè cái trước.
  const conditions: Prisma.CrmInteractionWhereInput[] = [];
  if (type === 'OTHER_GROUP') conditions.push({ type: { notIn: ['VIP_ESCORT', 'DELEGATION'] } });
  if (type && TYPES.has(type)) conditions.push({ type: type as CrmInteractionType });
  if (status && STATUSES.has(status)) conditions.push({ status: status as CrmInteractionStatus });
  if (staffName) conditions.push({ OR: [{ staffName }, { companions: { has: staffName } }] });
  if (isFollowUp) {
    if (from || to) {
      conditions.push({
        followUpDate: {
          ...(from && { gte: new Date(`${from}T00:00:00+07:00`) }),
          ...(to && { lte: new Date(`${to}T23:59:59.999+07:00`) }),
        },
      });
    } else if (followUpScope === 'today') {
      const today = todayInVietnam();
      const todayStart = new Date(`${today}T00:00:00+07:00`);
      conditions.push({
        followUpDate: {
          gte: todayStart,
          lt: new Date(todayStart.getTime() + 86_400_000),
        },
      });
    } else if (followUpScope === 'window7') {
      const today = todayInVietnam();
      const todayStart = new Date(`${today}T00:00:00+07:00`);
      conditions.push({
        followUpDate: {
          gte: new Date(todayStart.getTime() - 7 * 86_400_000),
          lt: new Date(todayStart.getTime() + 8 * 86_400_000),
        },
      });
    } else if (followUpScope === 'upcoming14') {
      const today = todayInVietnam();
      const todayStart = new Date(`${today}T00:00:00+07:00`);
      conditions.push({
        followUpDate: {
          gte: todayStart,
          lt: new Date(todayStart.getTime() + 15 * 86_400_000),
        },
      });
    } else if (followUpScope === 'upcoming30') {
      const today = todayInVietnam();
      const todayStart = new Date(`${today}T00:00:00+07:00`);
      conditions.push({
        followUpDate: {
          gte: todayStart,
          lt: new Date(todayStart.getTime() + 31 * 86_400_000),
        },
      });
    } else if (followUpScope === 'overdue') {
      const today = todayInVietnam();
      const todayStart = new Date(`${today}T00:00:00+07:00`);
      conditions.push({
        followUpDate: {
          lt: todayStart,
        },
      });
    } else {
      conditions.push({
        OR: [
          { followUpDate: { not: null } },
          { followUp: { not: null } },
        ],
      });
    }
  } else if (from || to) {
    conditions.push({
      occurredAt: {
        // Ngày lọc theo giờ Việt Nam.
        ...(from && { gte: new Date(`${from}T00:00:00+07:00`) }),
        ...(to && { lte: new Date(`${to}T23:59:59.999+07:00`) }),
      },
    });
  }
  if (contactId) conditions.push({ OR: [{ contactId }, { participants: { some: { contactId } } }] });
  if (params.get('referrerId')) conditions.push({ referrerContactId: params.get('referrerId')! });
  if (params.get('doctorId')) conditions.push({ doctors: { some: { contactId: params.get('doctorId')! } } });
  if (organizationId) conditions.push({ organizationId });
  if (purpose) conditions.push({ purpose });
  if (topic) conditions.push({ topics: { has: topic } });
  if (hostDepartmentId) conditions.push({ hostDepartmentId });
  if (needsReview) conditions.push({ needsReview: true });
  if (year && /^\d{4}$/.test(year)) {
    conditions.push({ occurredAt: { gte: new Date(`${year}-01-01T00:00:00+07:00`), lt: new Date(`${Number(year) + 1}-01-01T00:00:00+07:00`) } });
  }
  if (search) {
    conditions.push({
      OR: [
        { content: { contains: search, mode: 'insensitive' } },
        { destination: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { referrerContact: { searchKey: { contains: toSearchKey(search) } } },
        { doctors: { some: { contact: { searchKey: { contains: toSearchKey(search) } } } } },
        { patientName: { contains: search, mode: 'insensitive' } },
        { hostUnit: { contains: search, mode: 'insensitive' } },
        { guestMembers: { contains: search, mode: 'insensitive' } },
        { hospitalAttendees: { contains: search, mode: 'insensitive' } },
        { externalCode: { equals: search.toUpperCase() } },
        { contact: { searchKey: { contains: toSearchKey(search) } } },
        { organization: { searchKey: { contains: toSearchKey(search) } } },
      ],
    });
  }
  const where: Prisma.CrmInteractionWhereInput = { AND: conditions };

  const paginated = params.has('page');
  const total = paginated ? await prisma.crmInteraction.count({ where }) : 0;
  const page = Math.min(crmPage(params), Math.max(1, Math.ceil(total / CRM_PAGE_SIZE)));
  const statsRows = paginated || params.get('stats') === '1' ? await prisma.crmInteraction.findMany({ where, select: { type: true, status: true, contactId: true, referrerContactId: true, guestCount: true, referrerContact: { select: { id: true, fullName: true } }, doctors: { select: { contactId: true, contact: { select: { id: true, fullName: true } } } } } }) : [];
  const done = statsRows.filter(i => i.status === 'DONE');
  const ranked = (people: Array<{ id: string; fullName: string }>) => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const p of people) { const row = map.get(p.id) ?? { id: p.id, name: p.fullName, count: 0 }; row.count++; map.set(p.id, row); }
    return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi')).slice(0, 20);
  };
  const stats = {
    byReferrer: ranked(done.flatMap(i => i.referrerContact ? [i.referrerContact] : [])),
    byDoctor: ranked(done.flatMap(i => i.doctors.map(d => d.contact))), done: done.length, planned: statsRows.filter(i => i.status === 'PLANNED').length, guests: done.filter(i => i.type === 'DELEGATION').reduce((n, i) => n + (i.guestCount ?? 0), 0), patients: new Set(done.map(i => i.contactId).filter(Boolean)).size, referrers: new Set(done.map(i => i.referrerContactId).filter(Boolean)).size, doctors: new Set(done.flatMap(i => i.doctors.map(d => d.contactId))).size, escorts: done.filter(i => i.type === 'VIP_ESCORT').length, delegations: done.filter(i => i.type === 'DELEGATION').length, others: done.filter(i => !['VIP_ESCORT', 'DELEGATION'].includes(i.type)).length };
  if (params.get('stats') === '1') return NextResponse.json(stats);
  const orderBy: Prisma.CrmInteractionOrderByWithRelationInput[] = isFollowUp
    ? followUpScope === 'overdue'
      ? [{ followUpDate: 'desc' }, { occurredAt: 'desc' }, { id: 'desc' }]
      : [{ followUpDate: 'asc' }, { occurredAt: 'desc' }, { id: 'desc' }]
    : [{ occurredAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }];
  const interactions = await prisma.crmInteraction.findMany({
    where,
    include: interactionInclude,
    orderBy,
    take: paginated ? CRM_PAGE_SIZE : 500,
    skip: paginated ? (page - 1) * CRM_PAGE_SIZE : 0,
  });
  const items = interactions.map(i => toInteractionDto(i, health));
  return compressedJson(request, paginated ? { items, total, page, stats } : items);
});

export const POST = handle(async (request: Request) => {
  const session = await requireSession();
  const data = interactionInputSchema.parse(await request.json());
  const interaction = await saveInteraction(data, { createdById: session.user.id });
  return NextResponse.json(interaction, { status: 201 });
});
