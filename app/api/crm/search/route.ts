import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { handle, requireSession } from '@/lib/crm/server';
import { toSearchKey } from '@/lib/crm/constants';

const LIMIT = 15;

/** Gợi ý cho ô chọn khách/đơn vị/bác sĩ trong modal. */
export const GET = handle(async (request: Request) => {
  await requireSession();
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const filter = url.searchParams.get('filter')?.trim();

  const doctorCondition: Prisma.CrmContactWhereInput = {
    OR: [
      { tags: { has: 'Bác sĩ' } },
      { doctorVisits: { some: {} } },
      { positions: { some: { title: { contains: 'Bác sĩ', mode: 'insensitive' } } } },
      { positions: { some: { title: { contains: 'BS', mode: 'insensitive' } } } },
    ],
  };

  if (q.length === 0) {
    if (filter === 'doctor') {
      const contacts = await prisma.crmContact.findMany({
        where: doctorCondition,
        orderBy: [{ fullName: 'asc' }],
        take: LIMIT,
        select: {
          id: true, fullName: true, academicTitle: true, tags: true,
          positions: {
            where: { isCurrent: true }, take: 1, orderBy: { createdAt: 'desc' },
            select: { title: true, department: true, organization: { select: { name: true } } },
          },
        },
      });
      return NextResponse.json({
        contacts: contacts.map(({ positions, ...c }) => {
          const p = positions[0];
          const subtitle = p ? [p.title, p.department, p.organization?.name].filter(Boolean).join(', ') : null;
          return { ...c, department: p?.department ?? null, subtitle: subtitle || c.tags.join(', ') || null };
        }),
        organizations: [],
      });
    }
    return NextResponse.json({ contacts: [], organizations: [] });
  }

  const contactWhere: Prisma.CrmContactWhereInput = {
    ...(filter === 'doctor' ? doctorCondition : {}),
    OR: [
      { searchKey: { contains: toSearchKey(q) } },
      { phone: { contains: q } },
    ],
  };

  const [contacts, organizations] = await Promise.all([
    prisma.crmContact.findMany({
      where: contactWhere,
      orderBy: [{ tier: 'asc' }, { fullName: 'asc' }],
      take: LIMIT,
      select: {
        id: true, fullName: true, academicTitle: true, tags: true,
        positions: {
          where: { isCurrent: true }, take: 1, orderBy: { createdAt: 'desc' },
          select: { title: true, department: true, organization: { select: { name: true } } },
        },
      },
    }),
    filter === 'doctor'
      ? Promise.resolve([])
      : prisma.crmOrganization.findMany({
          where: { searchKey: { contains: toSearchKey(q) } },
          orderBy: [{ tier: 'asc' }, { name: 'asc' }],
          take: LIMIT,
          select: { id: true, name: true },
        }),
  ]);

  return NextResponse.json({
    contacts: contacts.map(({ positions, ...c }) => {
      const p = positions[0];
      const subtitle = p ? [p.title, p.department, p.organization?.name].filter(Boolean).join(', ') : null;
      return { ...c, department: p?.department ?? null, subtitle: subtitle || c.tags.join(', ') || null };
    }),
    organizations,
  });
});
