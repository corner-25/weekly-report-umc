import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizeOrganizationName, VIP_STAFF } from '@/lib/vip';

const visitSchema = z.object({
  visitDate: z.string().datetime(),
  guestName: z.string().trim().min(1).max(200),
  organizationName: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  contactInfo: z.string().trim().max(500).optional(),
  supportContent: z.string().trim().min(1),
  destination: z.string().trim().max(500).optional(),
  staffName: z.enum(VIP_STAFF),
  note: z.string().trim().max(2000).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const data = visitSchema.parse(await request.json());
    const existing = await prisma.vipGuestVisit.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Không tìm thấy lượt tiếp đón' }, { status: 404 });

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

      return tx.vipGuestVisit.update({
        where: { id },
        data: {
          visitDate: new Date(data.visitDate),
          guestName: data.guestName,
          organizationId: organization?.id ?? null,
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

    return NextResponse.json(visit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Không thể cập nhật lượt tiếp đón' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.vipGuestVisit.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Không tìm thấy lượt tiếp đón' }, { status: 404 });

  await prisma.vipGuestVisit.delete({ where: { id } });
  return NextResponse.json({ message: 'Đã xóa lượt tiếp đón' });
}
