/**
 * Viết sẵn báo cáo tóm tắt — mỗi tuần MỘT lần, sau khi tuần đã kết thúc.
 *
 * Báo cáo tuần được quét hằng ngày; viết lại mỗi lần quét thì tốn token vô ích.
 * Nên chỉ viết khi tuần đã xong: hết Chủ nhật cuối tuần (tuần báo cáo Thứ Bảy →
 * Thứ Sáu, cộng hai ngày cuối tuần để các phòng kịp nộp), tức từ Thứ Hai hôm sau.
 *  - Tuần đã xong, có dữ liệu, chưa có bản tóm tắt → viết.
 *  - Bản nháp AI viết khi tuần còn đang diễn ra (bấm xem sớm) và chưa ai sửa → viết lại một lần.
 *  - Bản Phòng HC đã sửa hoặc đã chốt → không đụng tới.
 */
import type { PrismaClient } from '@prisma/client';
import { generateWeeklySummary } from './generate';
import { weekClosesAt } from './schedule';

export { weekClosesAt };

export interface AutoSummaryResult {
  written: Array<{ year: number; week: number; reason: 'new' | 'refresh'; tokens: number }>;
  failed: Array<{ year: number; week: number; error: string }>;
  pending: number;
}

/** Tuần cần viết (mới nhất trước). */
type WeekTodo = { id: string; year: number; weekNumber: number; reason: 'new' | 'refresh' };

export async function weeksNeedingSummary(db: PrismaClient, now = new Date()): Promise<WeekTodo[]> {
  const weeks = await db.week.findMany({
    orderBy: [{ year: 'desc' }, { weekNumber: 'desc' }],
    select: { id: true, year: true, weekNumber: true, endDate: true, summary: { select: { status: true, generatedAt: true, editedAt: true } } },
  });
  const entryWeeks = new Set((await db.taskThreadEntry.groupBy({ by: ['year', 'week'] })).map((e) => `${e.year}-${e.week}`));
  const progressWeeks = new Set((await db.weekTaskProgress.groupBy({ by: ['weekId'] })).map((p) => p.weekId));

  return weeks.flatMap((w): WeekTodo[] => {
    const closesAt = weekClosesAt(w.endDate);
    if (now < closesAt) return [];
    if (!entryWeeks.has(`${w.year}-${w.weekNumber}`) && !progressWeeks.has(w.id)) return [];
    if (!w.summary) return [{ id: w.id, year: w.year, weekNumber: w.weekNumber, reason: 'new' }];
    const writtenEarly = w.summary.status === 'DRAFT' && !w.summary.editedAt && (!w.summary.generatedAt || w.summary.generatedAt < closesAt);
    return writtenEarly ? [{ id: w.id, year: w.year, weekNumber: w.weekNumber, reason: 'refresh' }] : [];
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
