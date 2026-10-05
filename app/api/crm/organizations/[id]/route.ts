import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { organizationPatchSchema } from '@/lib/crm/schemas';
import { normalizeOrganizationName, toSearchKey } from '@/lib/crm/constants';
import {
  careTaskInclude,
  handle,
  HttpError,
  importantDateSource,
  interactionInclude,
  requireSession,
  toCareTaskDto,
  toImportantDateDto,
  toInteractionDto,
  upcomingFor,
} from '@/lib/crm/server';

type Ctx = { params: Promise<{ id: string }> };

const CLEARABLE = ['address', 'website', 'phone', 'email', 'ownerName', 'note', 'category', 'scope'] as const;

/** Hồ sơ tổ chức: người liên hệ (theo chức vụ), ngày quan trọng, dòng thời gian. */
export const GET = handle(async (_request: Request, { params }: Ctx) => {
  await requireSession();
  const { id } = await params;
  const organization = await prisma.crmOrganization.findUnique({
    where: { id },
    include: {
      positions: {
        orderBy: [{ isCurrent: 'desc' }, { isFocalPoint: 'desc' }, { createdAt: 'desc' }],
        include: { contact: { select: { id: true, fullName: true, academicTitle: true, tier: true, phone: true, email: true, salutation: true } } },
      },
      importantDates: { orderBy: [{ month: 'asc' }, { day: 'asc' }] },
      interactions: { include: interactionInclude, orderBy: { occurredAt: 'desc' }, take: 200 },
      careTasks: { include: careTaskInclude, orderBy: { occasionDate: 'desc' }, take: 100 },
    },
  });
  if (!organization) throw new HttpError(404, 'Không tìm thấy tổ chức');

  const { positions, importantDates, interactions, careTasks, ...rest } = organization;
  return NextResponse.json({
    ...rest,
    contacts: positions.map((p) => ({
      id: p.contact.id, fullName: p.contact.fullName, academicTitle: p.contact.academicTitle,
      tier: p.contact.tier, title: p.title, isCurrent: p.isCurrent,
      positionId: p.id, isFocalPoint: p.isFocalPoint, phone: p.contact.phone, email: p.contact.email, department: p.department,
    })),
    importantDates: importantDates.map(toImportantDateDto),
    interactions: interactions.map(toInteractionDto),
    careTasks: careTasks.map(toCareTaskDto),
    upcoming: upcomingFor(importantDates.map(importantDateSource)),
  });
});

export const PATCH = handle(async (request: Request, { params }: Ctx) => {
  await requireSession();
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const cleared = CLEARABLE.filter((key) => key in body && (body[key] === null || body[key] === ''));
  const data = organizationPatchSchema.parse(
    Object.fromEntries(Object.entries(body).filter(([key]) => !(cleared as readonly string[]).includes(key))),
  );

  if (data.name) {
    const normalizedName = normalizeOrganizationName(data.name);
    const clash = await prisma.crmOrganization.findFirst({ where: { normalizedName, NOT: { id } }, select: { id: true } });
    if (clash) throw new HttpError(409, `Tổ chức "${data.name}" đã có trong danh bạ`);
  }

  const organization = await prisma.crmOrganization.update({
    where: { id },
    data: {
      ...data,
      ...(data.name && {
        name: data.name.replace(/\s+/g, ' '),
        normalizedName: normalizeOrganizationName(data.name),
        searchKey: toSearchKey(data.name),
      }),
      ...Object.fromEntries(cleared.map((key) => [key, null])),
    },
  });
  return NextResponse.json(organization);
});

/** Xoá tổ chức. Đã có người liên hệ hoặc lượt tương tác thì không xoá (quản trị viên: ?force=1). */
export const DELETE = handle(async (request: Request, { params }: Ctx) => {
  const session = await requireSession();
  const { id } = await params;
  const force = new URL(request.url).searchParams.get('force') === '1' && session.user.role === 'ADMIN';
  const [interactions, positions] = await Promise.all([
    prisma.crmInteraction.count({ where: { organizationId: id } }),
    prisma.crmPosition.count({ where: { organizationId: id } }),
  ]);
  if (interactions + positions > 0 && !force) {
    throw new HttpError(
      409,
      `Tổ chức đã có ${positions} người liên hệ và ${interactions} lượt tương tác — xoá sẽ mất tên đơn vị trong lịch sử.`,
    );
  }
  await prisma.crmOrganization.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
