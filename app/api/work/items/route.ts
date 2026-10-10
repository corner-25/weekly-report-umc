import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { handle, requireSession } from '@/lib/crm/server';
import { toSearchKey } from '@/lib/crm/constants';
import { CLOSED_STATUSES } from '@/lib/work/constants';
import { workItemCreateSchema } from '@/lib/work/schemas';
import { toWorkItemDto, workItemInclude } from '@/lib/work/server';
import { compressedJson } from '@/lib/http/compressed-json';

const STATUSES = new Set(['NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'DONE', 'CANCELLED']);
const KINDS = new Set(['DIRECTIVE', 'PLAN', 'OTHER']);
const LIST_LIMIT = 1000;

/**
 * Danh sách công việc. Lọc: status, kind, departmentId, q (tìm không dấu theo
 * tên), view = open | overdue | stale | done.
 */
export const GET = handle(async (request: Request) => {
  await requireSession();
  const params = new URL(request.url).searchParams;
  const now = new Date();
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  const and: Prisma.WorkItemWhereInput[] = [];

  const status = params.get('status');
  if (status && STATUSES.has(status)) and.push({ status: status as Prisma.EnumWorkStatusFilter['equals'] });
  const kind = params.get('kind');
  if (kind && KINDS.has(kind)) and.push({ kind: kind as Prisma.EnumWorkKindFilter['equals'] });
  const departmentId = params.get('departmentId');
  if (departmentId) and.push({ departmentId });
  // Năm giao việc: theo ngày chỉ đạo, việc không ghi ngày chỉ đạo thì theo ngày tạo.
  const year = params.get('nam');
  if (year && /^\d{4}$/.test(year)) {
    const range = { gte: new Date(`${year}-01-01T00:00:00Z`), lt: new Date(`${Number(year) + 1}-01-01T00:00:00Z`) };
    and.push({ OR: [{ directedAt: range }, { directedAt: null, createdAt: range }] });
  }

  const open: Prisma.WorkItemWhereInput = { status: { notIn: [...CLOSED_STATUSES] } };
  const activeOnly: Prisma.WorkItemWhereInput = { status: { in: ['NOT_STARTED', 'IN_PROGRESS'] } };
  switch (params.get('view')) {
    case 'open': and.push(open); break;
    case 'overdue': and.push(activeOnly, { dueDate: { lt: today } }); break;
    case 'stale': and.push(activeOnly); break; // lọc tiếp theo workHealth bên dưới
    case 'done': and.push({ status: 'DONE' }); break;
  }

  const items = await prisma.workItem.findMany({
    where: { AND: and },
    include: workItemInclude,
    orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: LIST_LIMIT,
  });

  // Tìm không dấu ở tầng ứng dụng: danh sách đã giới hạn, không cần thêm cột tìm kiếm.
  const q = toSearchKey(params.get('q'));
  const staleOnly = params.get('view') === 'stale';
  const dtos = items
    .filter((i) => !q || toSearchKey(i.title, i.leadUnit, i.directedBy, i.externalId, ...i.assignees).includes(q))
    .map((i) => toWorkItemDto(i, now))
    .filter((d) => !staleOnly || d.health.isStale);
  return compressedJson(request, dtos);
});

/** Mở việc mới bằng tay — thường là việc theo kế hoạch của phòng. */
export const POST = handle(async (request: Request) => {
  const session = await requireSession();
  const data = workItemCreateSchema.parse(await request.json());
  const created = await prisma.workItem.create({
    data: {
      ...data,
      source: 'MANUAL',
      directedAt: data.directedAt ? new Date(`${data.directedAt}T00:00:00Z`) : null,
      dueDate: data.dueDate ? new Date(`${data.dueDate}T00:00:00Z`) : null,
      completedAt: data.status === 'DONE' ? new Date() : null,
      createdById: session.user.id,
      lastActivityAt: new Date(),
    },
    include: workItemInclude,
  });
  return NextResponse.json(toWorkItemDto(created), { status: 201 });
});
