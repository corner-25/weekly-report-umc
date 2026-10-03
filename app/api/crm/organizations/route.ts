import { NextResponse } from 'next/server';
import type { CrmOrganizationType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { organizationInputSchema } from '@/lib/crm/schemas';
import { normalizeOrganizationName, toSearchKey } from '@/lib/crm/constants';
import { handle, HttpError, importantDateSource, parseTier, requireSession, upcomingFor } from '@/lib/crm/server';

const ORG_TYPES = new Set(['HOSPITAL', 'UNIVERSITY', 'COMPANY', 'GOVERNMENT', 'INTERNATIONAL', 'PRESS', 'OTHER']);

export const GET = handle(async (request: Request) => {
  await requireSession();
  const params = new URL(request.url).searchParams;
  const search = params.get('search')?.trim();
  const tier = parseTier(params.get('tier'));
  const type = params.get('type');

  const where: Prisma.CrmOrganizationWhereInput = {
    ...(tier && { tier }),
    ...(type && ORG_TYPES.has(type) && { type: type as CrmOrganizationType }),
    ...(search && { searchKey: { contains: toSearchKey(search) } }),
  };

  const organizations = await prisma.crmOrganization.findMany({
    where,
    orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    take: 500,
    select: {
      id: true, name: true, type: true, tier: true, ownerName: true, tags: true,
      _count: { select: { positions: { where: { isCurrent: true } } } },
      interactions: { orderBy: { occurredAt: 'desc' }, take: 1, select: { occurredAt: true } },
      importantDates: true,
    },
  });

  return NextResponse.json(
    organizations.map(({ _count, interactions, importantDates, ...o }) => {
      const next = upcomingFor(importantDates.map(importantDateSource))[0];
      return {
        ...o,
        contactCount: _count.positions,
        lastInteractionAt: interactions[0]?.occurredAt.toISOString() ?? null,
        nextAnniversary: next ? { date: next.date, label: next.label } : null,
      };
    }),
  );
});

export const POST = handle(async (request: Request) => {
  await requireSession();
  const data = organizationInputSchema.parse(await request.json());
  const normalizedName = normalizeOrganizationName(data.name);
  const searchKey = toSearchKey(data.name);
  // Trùng tên, kể cả khác dấu ("Benh vien X" với "Bệnh viện X").
  const existing = await prisma.crmOrganization.findFirst({
    where: { OR: [{ normalizedName }, { searchKey }] },
    select: { id: true },
  });
  if (existing) throw new HttpError(409, `Tổ chức "${data.name}" đã có trong danh bạ`);
  const organization = await prisma.crmOrganization.create({
    data: { ...data, name: data.name.replace(/\s+/g, ' '), normalizedName, searchKey },
  });
  return NextResponse.json(organization, { status: 201 });
});
