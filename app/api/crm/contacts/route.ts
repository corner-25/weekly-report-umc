import { contactLinks } from '@/lib/crm/contact-links';
import { crmPage, CRM_PAGE_SIZE } from '@/lib/crm/pagination';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { contactInputSchema } from '@/lib/crm/schemas';
import { handle, parseTier, requireSession, resolveOrganization, CRM_TRANSACTION } from '@/lib/crm/server';
import { toSearchKey } from '@/lib/crm/constants';

/** Danh bạ cá nhân: tìm theo tên/SĐT/email/tổ chức, lọc hạng, nhãn, người phụ trách. */
export const GET = handle(async (request: Request) => {
  await requireSession();
  const params = new URL(request.url).searchParams;
  const paginated = params.has('page');
  const search = params.get('search')?.trim();
  const tier = parseTier(params.get('tier'));
  const tag = params.get('tag')?.trim();
  const owner = params.get('owner')?.trim();
  // Hai loại: VIP (Phòng HC tự gắn) và Đối tác (mọi người còn lại — đầu mối, người liên hệ của tổ chức).
  const kind = params.get('kind');
  const focalOnly = params.get('focal') === '1';

  const where: Prisma.CrmContactWhereInput = {
    ...(kind === 'doctor' && {
      OR: [
        { tags: { has: 'Bác sĩ' } },
        { doctorVisits: { some: {} } },
      ],
    }),
    ...(kind === 'leader' && { tags: { hasSome: ['Người giới thiệu', 'Ban Giám đốc', 'Lãnh đạo Bệnh viện'] } }),
    ...(kind === 'vip' && { tier: 'VIP' as const }),
    ...(kind === 'partner' && {
      tier: { not: 'VIP' as const },
      NOT: {
        OR: [
          { tags: { hasSome: ['Người giới thiệu', 'Ban Giám đốc', 'Lãnh đạo Bệnh viện', 'Bác sĩ'] } },
          { doctorVisits: { some: {} } },
        ],
      },
    }),
    ...(focalOnly && { positions: { some: { isFocalPoint: true, isCurrent: true } } }),
    ...(tag && { tags: { has: tag } }),
    ...(owner && { ownerName: owner }),
    ...(search && {
      OR: [
        // Không dấu: "nguyen van a" ra "Nguyễn Văn A".
        { searchKey: { contains: toSearchKey(search) } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { positions: { some: { organization: { name: { contains: search, mode: 'insensitive' } } } } },
      ],
    }),
  };

  const filteredTotal = await prisma.crmContact.count({ where });
  const page = Math.min(crmPage(params), Math.max(1, Math.ceil(filteredTotal / CRM_PAGE_SIZE)));
  const contacts = await prisma.crmContact.findMany({
    where,
    orderBy: [{ tier: 'asc' }, { fullName: 'asc' }, { id: 'asc' }],
    take: paginated ? CRM_PAGE_SIZE : 500,
    skip: paginated ? (page - 1) * CRM_PAGE_SIZE : 0,
    select: {
      id: true, fullName: true, academicTitle: true, salutation: true, tier: true, tags: true,
      referrerContact: { select: { fullName: true } },
      ownerName: true, phone: true, email: true, status: true,
      positions: {
        where: { isCurrent: true },
        orderBy: [{ isFocalPoint: 'desc' }, { createdAt: 'desc' }],
        select: { title: true, isFocalPoint: true, organization: { select: { id: true, name: true } } },
      },
      interactions: { orderBy: { occurredAt: 'desc' }, take: 1, select: { occurredAt: true } },
      participations: {
        orderBy: { interaction: { occurredAt: 'desc' } },
        take: 1,
        select: { interaction: { select: { occurredAt: true } } },
      },
    },
  });

  const contactIds = contacts.map(c => c.id);
  const [visits, doctorVisits, referredVisits, latest] = await Promise.all([
    prisma.crmInteraction.groupBy({
      by: ['contactId'],
      where: { contactId: { in: contactIds }, type: 'VIP_ESCORT', status: 'DONE' },
      _count: true,
      _max: { occurredAt: true },
    }),
    prisma.crmVisitDoctor.groupBy({
      by: ['contactId'],
      where: { contactId: { in: contactIds } },
      _count: true,
    }),
    prisma.crmInteraction.groupBy({
      by: ['referrerContactId'],
      where: { referrerContactId: { in: contactIds }, type: 'VIP_ESCORT' },
      _count: true,
    }),
    prisma.crmInteraction.findMany({
      where: { contactId: { in: contactIds }, type: 'VIP_ESCORT', status: 'DONE' },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      distinct: ['contactId'],
      select: { contactId: true, referrer: true, referrerContact: { select: { fullName: true } } },
    }),
  ]);

  const items = contacts.map(({ positions, interactions, participations, ...c }) => {
    const dates = [interactions[0]?.occurredAt, participations[0]?.interaction.occurredAt].filter(Boolean) as Date[];
    const last = dates.sort((a, b) => b.getTime() - a.getTime())[0];
    const docCount = doctorVisits.find(d => d.contactId === c.id)?._count ?? 0;
    const refCount = referredVisits.find(r => r.referrerContactId === c.id)?._count ?? 0;
    return {
      ...c,
      escortCount: visits.find(v => v.contactId === c.id)?._count ?? 0,
      doctorVisitCount: docCount,
      referredVisitCount: refCount,
      lastEscortAt: visits.find(v => v.contactId === c.id)?._max.occurredAt?.toISOString() ?? null,
      latestReferrer: latest.find(v => v.contactId === c.id)?.referrerContact?.fullName ?? latest.find(v => v.contactId === c.id)?.referrer ?? c.referrerContact?.fullName ?? null,
      currentPosition: positions[0] ?? null,
      focalCount: positions.filter((p) => p.isFocalPoint).length,
      lastInteractionAt: last?.toISOString() ?? null,
    };
  });
  const tagRows = paginated ? await prisma.$queryRaw<Array<{ tag: string }>>`SELECT DISTINCT unnest(tags) AS tag FROM crm_contacts ORDER BY tag` : [];
  return NextResponse.json(paginated ? { items, total: filteredTotal, page, tags: tagRows.map(r => r.tag) } : items);
});

/** Thêm cá nhân; có chức vụ + tổ chức hiện tại thì tạo luôn (tổ chức chưa có thì tạo mới). */
export const POST = handle(async (request: Request) => {
  await requireSession();
  const { currentTitle, currentOrganizationName, preferences, newReferrerName, referrerContactId, relatedVipContactId, vipRelationship, ...data } = contactInputSchema.parse(await request.json());

  const contact = await prisma.$transaction(async (tx) => {
    const organizationId = await resolveOrganization(tx, { organizationName: currentOrganizationName });
    const links = await contactLinks(tx, { newReferrerName, referrerContactId, relatedVipContactId, vipRelationship });
    return tx.crmContact.create({
      data: {
        ...data, ...links,
        searchKey: toSearchKey(data.fullName, data.phone),
        preferences: preferences ?? undefined,
        ...((currentTitle || organizationId) && {
          positions: { create: { title: currentTitle ?? 'Liên hệ', organizationId, isCurrent: true } },
        }),
      },
    });
  }, CRM_TRANSACTION);

  return NextResponse.json(contact, { status: 201 });
});
