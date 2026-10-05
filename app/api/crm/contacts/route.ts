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
  const search = params.get('search')?.trim();
  const tier = parseTier(params.get('tier'));
  const tag = params.get('tag')?.trim();
  const owner = params.get('owner')?.trim();
  // Hai loại: VIP (Phòng HC tự gắn) và Đối tác (mọi người còn lại — đầu mối, người liên hệ của tổ chức).
  const kind = params.get('kind');
  const focalOnly = params.get('focal') === '1';

  const where: Prisma.CrmContactWhereInput = {
    ...(tier && { tier }),
    ...(kind === 'vip' && { tier: 'VIP' as const }),
    ...(kind === 'partner' && { tier: { not: 'VIP' as const } }),
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

  const contacts = await prisma.crmContact.findMany({
    where,
    orderBy: [{ tier: 'asc' }, { fullName: 'asc' }],
    take: 500,
    select: {
      id: true, fullName: true, academicTitle: true, salutation: true, tier: true, tags: true,
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

  return NextResponse.json(
    contacts.map(({ positions, interactions, participations, ...c }) => {
      const dates = [interactions[0]?.occurredAt, participations[0]?.interaction.occurredAt].filter(Boolean) as Date[];
      const last = dates.sort((a, b) => b.getTime() - a.getTime())[0];
      return {
        ...c,
        currentPosition: positions[0] ?? null,
        focalCount: positions.filter((p) => p.isFocalPoint).length,
        lastInteractionAt: last?.toISOString() ?? null,
      };
    }),
  );
});

/** Thêm cá nhân; có chức vụ + tổ chức hiện tại thì tạo luôn (tổ chức chưa có thì tạo mới). */
export const POST = handle(async (request: Request) => {
  await requireSession();
  const { currentTitle, currentOrganizationName, preferences, ...data } = contactInputSchema.parse(await request.json());

  const contact = await prisma.$transaction(async (tx) => {
    const organizationId = await resolveOrganization(tx, { organizationName: currentOrganizationName });
    return tx.crmContact.create({
      data: {
        ...data,
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
