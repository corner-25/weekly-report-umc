import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizeOrganizationName } from '@/lib/vip';

const organizationSchema = z.object({
  name: z.string().trim().min(1, 'Tên cơ quan là bắt buộc').max(200),
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const query = new URL(request.url).searchParams.get('q')?.trim();
  const organizations = await prisma.vipOrganization.findMany({
    where: query ? { name: { contains: query, mode: 'insensitive' } } : undefined,
    orderBy: { name: 'asc' },
    take: 100,
  });

  return NextResponse.json(organizations);
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name } = organizationSchema.parse(await request.json());
    const normalizedName = normalizeOrganizationName(name);
    const organization = await prisma.vipOrganization.upsert({
      where: { normalizedName },
      update: {},
      create: { name: name.trim().replace(/\s+/g, ' '), normalizedName },
    });

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Không thể lưu cơ quan' }, { status: 500 });
  }
}
