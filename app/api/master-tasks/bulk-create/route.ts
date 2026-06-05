import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';

const BodySchema = z.object({
  departmentId: z.string(),
  names: z.array(z.string().min(1)).min(1).max(50),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Payload không hợp lệ' }, { status: 400 });
  }

  const dept = await prisma.department.findUnique({ where: { id: body.departmentId } });
  if (!dept) return NextResponse.json({ error: 'Department not found' }, { status: 404 });

  // Skip names that already exist for this department.
  const existing = await prisma.masterTask.findMany({
    where: { departmentId: body.departmentId, name: { in: body.names } },
    select: { name: true },
  });
  const existingSet = new Set(existing.map((e) => e.name));
  const toCreate = body.names.filter((n) => !existingSet.has(n.trim()));

  if (toCreate.length === 0) {
    return NextResponse.json({ created: [], skipped: body.names, message: 'Tất cả task đã tồn tại' });
  }

  const created = await prisma.$transaction(
    toCreate.map((name) =>
      prisma.masterTask.create({
        data: {
          departmentId: body.departmentId,
          name: name.trim(),
          progressType: 'RECURRING',
        },
        select: { id: true, name: true },
      }),
    ),
  );

  return NextResponse.json({
    created,
    skipped: Array.from(existingSet),
  });
}
