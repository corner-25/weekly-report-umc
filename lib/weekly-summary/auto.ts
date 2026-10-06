/**
 * Viết sẵn báo cáo tóm tắt cho các tuần — người dùng bấm vào tuần là có ngay.
 *  - Tuần có dữ liệu báo cáo mà chưa có bản tóm tắt → viết.
 *  - Bản nháp AI chưa ai sửa, mà dữ liệu tuần đó vừa được nạp thêm → viết lại.
 *  - Bản Phòng HC đã sửa hoặc đã chốt → không đụng tới.
 */
import type { PrismaClient } from '@prisma/client';
import { generateWeeklySummary } from './generate';

export interface AutoSummaryResult {
  written: Array<{ year: number; week: number; reason: 'new' | 'refresh'; tokens: number }>;
  failed: Array<{ year: number; week: number; error: string }>;
  pending: number;
}

/** Tuần cần viết (mới nhất trước). */
type WeekTodo = { id: string; year: number; weekNumber: number; reason: 'new' | 'refresh' };

export async function weeksNeedingSummary(db: PrismaClient): Promise<WeekTodo[]> {
  const weeks = await db.week.findMany({
    orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }],
    select: { id: true, year: true, weekNumber: true, summary: { select: { status: true, generatedAt: true, editedAt: true } } },
  });
  const latestEntry = await db.taskThreadEntry.groupBy({ by: ['year', 'week'], _max: { createdAt: true }, _count: { _all: true } });
  const entryOf = new Map(latestEntry.map((e) => [`${e.year}-${e.week}`, e]));
  const progressCount = new Map(
    (await db.weekTaskProgress.groupBy({ by: ['weekId'], _count: { _all: true } })).map((p) => [p.weekId, p._count._all]),
  );

  return weeks.flatMap((w): WeekTodo[] => {
    const entries = entryOf.get(`${w.year}-${w.weekNumber}`);
    const hasData = (entries?._count._all ?? 0) > 0 || (progressCount.get(w.id) ?? 0) > 0;
    if (!hasData) return [];
    if (!w.summary) return [{ id: w.id, year: w.year, weekNumber: w.weekNumber, reason: 'new' }];
    const untouchedDraft = w.summary.status === 'DRAFT' && !w.summary.editedAt;
    const newerData = entries?._max.createdAt && w.summary.generatedAt && entries._max.createdAt > w.summary.generatedAt;
    return untouchedDraft && newerData ? [{ id: w.id, year: w.year, weekNumber: w.weekNumber, reason: 'refresh' }] : [];
  });
}

export async function ensureWeeklySummaries(
  db: PrismaClient,
  options: { limit?: number; concurrency?: number; log?: (msg: string) => void } = {},
): Promise<AutoSummaryResult> {
  const log = options.log ?? (() => {});
  const todo = await weeksNeedingSummary(db);
  const batch = todo.slice(0, options.limit ?? todo.length);
  const result: AutoSummaryResult = { written: [], failed: [], pending: todo.length - batch.length };
  const queue = [...batch];

  const worker = async () => {
    for (let w = queue.shift(); w; w = queue.shift()) {
      try {
        const { content, model, tokens } = await generateWeeklySummary(db, w.id);
        const now = new Date();
        // Ghi có điều kiện: trong lúc AI viết mà Phòng HC vừa sửa/chốt thì giữ bản của người.
        const saved = await db.weeklySummary.upsert({
          where: { weekId: w.id },
          create: { weekId: w.id, content, model, tokens, generatedAt: now },
          update: {},
          select: { status: true, editedAt: true, generatedAt: true },
        });
        if (saved.generatedAt?.getTime() !== now.getTime() && saved.status === 'DRAFT' && !saved.editedAt) {
          await db.weeklySummary.update({ where: { weekId: w.id }, data: { content, model, tokens, generatedAt: now } });
        }
        result.written.push({ year: w.year, week: w.weekNumber, reason: w.reason, tokens });
        log(`  tuần ${w.weekNumber}/${w.year}: ${w.reason === 'new' ? 'viết mới' : 'viết lại'} (${tokens} token)`);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        result.failed.push({ year: w.year, week: w.weekNumber, error });
        log(`  tuần ${w.weekNumber}/${w.year}: lỗi — ${error.slice(0, 200)}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency ?? 2) }, worker));
  return result;
}
