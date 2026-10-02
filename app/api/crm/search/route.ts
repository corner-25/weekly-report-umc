import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handle, requireSession } from '@/lib/crm/server';

const LIMIT = 10;

/** Gợi ý cho ô chọn khách/đơn vị trong modal: tối đa 10 cá nhân và 10 tổ chức. */
export const GET = handle(async (request: Request) => {
  await requireSession();
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length === 0) return NextResponse.json({ contacts: [], organizations: [] });

  const [contacts, organizations] = await Promise.all([
    prisma.crmContact.findMany({
      where: {
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
        ],
      },
      orderBy: [{ tier: 'asc' }, { fullName: 'asc' }],
      take: LIMIT,
      select: {
        id: true, fullName: true, academicTitle: true,
        positions: {
          where: { isCurrent: true }, take: 1, orderBy: { createdAt: 'desc' },
          select: { title: true, organization: { select: { name: true } } },
        },
      },
    }),
    prisma.crmOrganization.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      orderBy: [{ tier: 'asc' }, { name: 'asc' }],
      take: LIMIT,
      select: { id: true, name: true },
    }),
  ]);

  return NextResponse.json({
    contacts: contacts.map(({ positions, ...c }) => {
      const p = positions[0];
      const subtitle = p ? [p.title, p.organization?.name].filter(Boolean).join(', ') : null;
      return { ...c, subtitle: subtitle || null };
    }),
    organizations,
  });
});
