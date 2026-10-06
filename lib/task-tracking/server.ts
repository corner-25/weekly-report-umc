import type { Prisma, TaskThreadKind, TaskThreadStatus } from '@prisma/client';

export const threadListSelect = {
  id: true, title: true, rawName: true, parentGroup: true, firstWeek: true, lastWeek: true,
  kind: true, status: true, progress: true, completedWeek: true, evidence: true, reasoning: true,
  confidence: true, needsReview: true, aiUpdatedAt: true,
  overrideKind: true, overrideStatus: true, overrideProgress: true, overrideNote: true, overriddenBy: true, overriddenAt: true,
  entries: { orderBy: { week: 'asc' }, select: { week: true, progress: true, resultText: true } },
} satisfies Prisma.TaskThreadSelect;

type ThreadRow = Prisma.TaskThreadGetPayload<{ select: typeof threadListSelect }>;

/** Giá trị hiệu lực: Phòng HC sửa tay thắng AI. */
export function toThreadDto(t: ThreadRow) {
  const kind: TaskThreadKind | null = t.overrideKind ?? t.kind;
  const status: TaskThreadStatus | null = t.overrideStatus ?? t.status;
  const progress = kind === 'ROUTINE' ? null : t.overrideProgress ?? t.progress;
  const last = t.entries[t.entries.length - 1];
  return {
    id: t.id,
    title: t.title,
    rawName: t.rawName,
    parentGroup: t.parentGroup,
    firstWeek: t.firstWeek,
    lastWeek: t.lastWeek,
    weeksReported: t.entries.length,
    kind,
    status,
    progress,
    completedWeek: status === 'DONE' ? t.completedWeek ?? t.lastWeek : null,
    ai: { kind: t.kind, status: t.status, progress: t.progress, evidence: t.evidence, reasoning: t.reasoning, confidence: t.confidence, judged: Boolean(t.aiUpdatedAt) },
    needsReview: t.needsReview && !t.overriddenAt,
    override: t.overriddenAt ? { by: t.overriddenBy, at: t.overriddenAt.toISOString(), note: t.overrideNote } : null,
    progressHistory: t.entries.map((e) => e.progress),
    /** Các tuần có báo cáo việc này — vẽ dòng thời gian. */
    weeks: t.entries.map((e) => e.week),
    lastText: last ? last.resultText.replace(/\s+/g, ' ').slice(0, 240) : '',
  };
}
export type ThreadDto = ReturnType<typeof toThreadDto>;
