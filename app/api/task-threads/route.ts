import { prisma } from '@/lib/prisma';
import { handle, requireSession } from '@/lib/crm/server';
import { compressedJson } from '@/lib/http/compressed-json';
import { threadListSelect, toThreadDto } from '@/lib/task-tracking/server';

/**
 * Danh sách phòng (kèm cách báo cáo, số việc theo tình trạng) và các việc của
 * một phòng. Không truyền departmentId thì chỉ trả danh sách phòng.
 */
export const GET = handle(async (request: Request) => {
  await requireSession();
  const params = new URL(request.url).searchParams;
  const year = Number(params.get('year')) || new Date().getFullYear();
  const departmentId = params.get('departmentId');

  const [profiles, counts] = await Promise.all([
    prisma.departmentReportProfile.findMany({
      where: { year },
      select: { departmentId: true, summary: true, stats: true, department: { select: { name: true } } },
    }),
    prisma.$queryRaw<Array<{ departmentId: string; total: bigint; projects: bigint; review: bigint; latest: number; done: bigint; stalled: bigint; stopped: bigint; routine: bigint; avg_progress: number | null }>>`
      SELECT "departmentId", count(*) AS total,
             count(*) FILTER (WHERE coalesce("overrideKind", kind) = 'PROJECT' AND coalesce("overrideStatus", status) IN ('IN_PROGRESS', 'STALLED')) AS projects,
             count(*) FILTER (WHERE coalesce("overrideStatus", status) = 'DONE') AS done,
             count(*) FILTER (WHERE coalesce("overrideStatus", status) = 'STALLED') AS stalled,
             count(*) FILTER (WHERE coalesce("overrideStatus", status) = 'STOPPED') AS stopped,
             count(*) FILTER (WHERE coalesce("overrideKind", kind) = 'ROUTINE' AND coalesce("overrideStatus", status) = 'IN_PROGRESS') AS routine,
             avg(coalesce("overrideProgress", progress)) FILTER (WHERE coalesce("overrideKind", kind) = 'PROJECT' AND coalesce("overrideStatus", status) IN ('IN_PROGRESS', 'STALLED')) AS avg_progress,
             count(*) FILTER (WHERE "needsReview" AND "overriddenAt" IS NULL) AS review,
             max("lastWeek") AS latest
      FROM task_threads WHERE year = ${year} GROUP BY 1`,
  ]);
  const countOf = new Map(counts.map((c) => [c.departmentId, c]));
  const departments = profiles
    .map((p) => {
      const c = countOf.get(p.departmentId);
      return {
        id: p.departmentId,
        name: p.department.name,
        summary: p.summary,
        style: (p.stats as { style?: string }).style ?? 'MIXED',
        total: Number(c?.total ?? 0),
        activeProjects: Number(c?.projects ?? 0),
        needsReview: Number(c?.review ?? 0),
        latestWeek: c?.latest ?? 0,
        done: Number(c?.done ?? 0),
        stalled: Number(c?.stalled ?? 0),
        stopped: Number(c?.stopped ?? 0),
        routine: Number(c?.routine ?? 0),
        avgProgress: c?.avg_progress == null ? null : Math.round(Number(c.avg_progress)),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  const threads = departmentId
    ? (await prisma.taskThread.findMany({ where: { departmentId, year, entries: { some: {} } }, select: threadListSelect })).map(toThreadDto)
    : [];
  return compressedJson(request, { year, departments, threads });
});
