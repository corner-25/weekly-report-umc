// Status classification for master tasks based on the activity window.
// A task is "in progress" when (a) it has never had progress yet, or
// (b) it appears in any of the last N reported weeks. Otherwise it is
// considered "completed" — no activity for at least N weeks means the
// recurring work has settled.

import { prisma } from '@/lib/prisma';

export const ACTIVITY_WINDOW_WEEKS = 4;

export type MasterTaskStatus = 'IN_PROGRESS' | 'COMPLETED';

interface WeekKey {
  weekNumber: number;
  year: number;
}

/**
 * Build the set of (year, weekNumber) pairs that fall inside the activity
 * window. The window starts at the most recent week present in the DB and
 * walks `ACTIVITY_WINDOW_WEEKS` weeks backwards. If the DB has no weeks at
 * all, we return an empty set — every task ends up "in progress" by the
 * never-reported rule.
 */
export async function getActivityWindow(): Promise<{ weeks: WeekKey[]; latest: WeekKey | null }> {
  const latest = await prisma.week.findFirst({
    orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }],
    select: { weekNumber: true, year: true },
  });
  if (!latest) return { weeks: [], latest: null };

  const weeks: WeekKey[] = [];
  let { weekNumber: wn, year: y } = latest;
  for (let i = 0; i < ACTIVITY_WINDOW_WEEKS; i++) {
    weeks.push({ weekNumber: wn, year: y });
    wn -= 1;
    if (wn < 1) {
      y -= 1;
      // ISO years sometimes have 53 weeks but we treat 52 as safe default for
      // bookkeeping. The dataset only spans 2025-2026 so this is fine.
      wn = 52;
    }
  }
  return { weeks, latest };
}

/**
 * Aggregate counts (total, inProgress, completed) for all MasterTasks under
 * the activity-window rule. Computed in two SQL passes:
 *   1. total count
 *   2. count of master tasks that have at least one progress in window
 * The "completed" bucket = total − inProgress − neverReported.
 * Plus tasks that never had a row at all are counted as "inProgress".
 */
export async function getMasterTaskStatusCounts(): Promise<{
  total: number;
  inProgress: number;
  completed: number;
}> {
  const { weeks } = await getActivityWindow();
  const total = await prisma.masterTask.count();
  if (weeks.length === 0) {
    // No weeks → everything is in progress by the never-reported rule.
    return { total, inProgress: total, completed: 0 };
  }

  // Master tasks whose latest week_progress entry falls in the activity window.
  // Use raw SQL to keep this efficient (no N+1).
  const weekKeys = weeks.map((w) => `(${w.year}, ${w.weekNumber})`).join(',');
  const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT COUNT(*)::bigint AS count
    FROM master_tasks mt
    WHERE NOT EXISTS (SELECT 1 FROM week_task_progress wtp WHERE wtp."masterTaskId" = mt.id)
       OR EXISTS (
         SELECT 1
         FROM week_task_progress wtp
         JOIN weeks w ON w.id = wtp."weekId"
         WHERE wtp."masterTaskId" = mt.id
           AND (w.year, w."weekNumber") IN (${weekKeys})
       )
  `);
  const inProgress = Number(rows[0]?.count ?? 0);
  const completed = Math.max(total - inProgress, 0);
  return { total, inProgress, completed };
}

/**
 * Classify a single master task given the list of weeks it has activity in.
 * Caller passes the activity window (so we don't refetch per task).
 */
export function classifyMasterTask(args: {
  weekKeys: WeekKey[];
  taskWeekKeys: WeekKey[]; // weeks where this master task has any progress
}): MasterTaskStatus {
  if (args.taskWeekKeys.length === 0) return 'IN_PROGRESS'; // never reported
  const set = new Set(args.weekKeys.map((w) => `${w.year}-${w.weekNumber}`));
  for (const k of args.taskWeekKeys) {
    if (set.has(`${k.year}-${k.weekNumber}`)) return 'IN_PROGRESS';
  }
  return 'COMPLETED';
}
