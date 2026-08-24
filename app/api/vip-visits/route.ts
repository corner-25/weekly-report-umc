import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizeOrganizationName, VIP_STAFF } from '@/lib/vip';

const visitSchema = z.object({
  visitDate: z.string().datetime(),
  guestName: z.string().trim().min(1, 'Tên khách là bắt buộc').max(200),
  organizationName: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  contactInfo: z.string().trim().max(500).optional(),
  supportContent: z.string().trim().min(1, 'Nội dung hỗ trợ là bắt buộc'),
  destination: z.string().trim().max(500).optional(),
  staffName: z.enum(VIP_STAFF),
  note: z.string().trim().max(2000).optional(),
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const search = params.get('search')?.trim();
  const staffName = params.get('staffName')?.trim();
  const startDate = params.get('startDate');
  const endDate = params.get('endDate');

  const visits = await prisma.vipGuestVisit.findMany({
    where: {
      ...(staffName && { staffName }),
      ...((startDate || endDate) && {
        visitDate: {
          ...(startDate && { gte: new Date(`${startDate}T00:00:00`) }),
          ...(endDate && { lte: new Date(`${endDate}T23:59:59.999`) }),
        },
      }),
      ...(search && {
        OR: [
          { guestName: { contains: search, mode: 'insensitive' } },
          { organization: { name: { contains: search, mode: 'insensitive' } } },
          { supportContent: { contains: search, mode: 'insensitive' } },
          { destination: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
    include: { organization: true },
    orderBy: [{ visitDate: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json(visits);
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const data = visitSchema.parse(await request.json());
    const visit = await prisma.$transaction(async (tx) => {
      const organization = data.organizationName
        ? await tx.vipOrganization.upsert({
            where: { normalizedName: normalizeOrganizationName(data.organizationName) },
            update: {},
            create: {
              name: data.organizationName.trim().replace(/\s+/g, ' '),
              normalizedName: normalizeOrganizationName(data.organizationName),
            },
          })
        : null;

      return tx.vipGuestVisit.create({
        data: {
          visitDate: new Date(data.visitDate),
          guestName: data.guestName,
          organizationId: organization?.id,
          phone: data.phone || null,
          contactInfo: data.contactInfo || null,
          supportContent: data.supportContent,
          destination: data.destination || null,
          staffName: data.staffName,
          note: data.note || null,
        },
        include: { organization: true },
      });
    });

    return NextResponse.json(visit, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Không thể lưu lượt tiếp đón' }, { status: 500 });
  }
}
