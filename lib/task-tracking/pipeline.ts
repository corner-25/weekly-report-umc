/**
 * Pipeline theo dõi nhiệm vụ (xem docs/TASK-TRACKING.md):
 *
 *   file báo cáo bệnh viện → dòng từng phòng từng tuần
 *     → nối thành việc (link.ts) → cách báo cáo của phòng (profile.ts)
 *     → AI quyết loại việc + tình trạng (judge.ts) → luật cứng (rules.ts) → DB
 *
 * Chạy lại an toàn: tuần nào nội dung không đổi thì giữ nguyên; tuần nào phòng
 * sửa thì nối lại từ tuần đó. Phần Phòng HC sửa tay nằm ở các cột override*,
 * AI không bao giờ ghi vào đó.
 */
import { createHash, randomUUID } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { matchDepartment } from '@/lib/ingestion/parsers/department-matcher';
import { departmentContentHash, isUneditedCopy } from '@/lib/ingestion/parsers/department-snapshot';
import { extractWeekTasksByDepartment } from '@/lib/ingestion/parsers/hospital-week-tasks';
import type { HospitalWeekSheet } from '@/lib/ingestion/parsers/hospital-report';
import { linkWeek, nameKeyOf, UNNAMED, type OpenThread, type ReportRow } from './link';
import { classifyStreamBatch, STREAM_BATCH, type StreamInput } from './streams';
import { computeProfile, describeProfile, type ReportStyle } from './profile';
import { JUDGE_BATCH, JUDGE_MODEL, judgeThreads, type JudgeThread } from './judge';
import { applyRules } from './rules';

const TX = { maxWait: 15_000, timeout: 300_000 };
/** Việc vắng mặt lâu hơn mốc này kể từ tuần mới nhất thì không cần đánh giá lại khi có tuần mới. */
const REJUDGE_WINDOW_WEEKS = 8;

export interface DepartmentRows {
  departmentId: string;
  departmentName: string;
  year: number;
  weeks: Array<{ week: number; rows: ReportRow[] }>;
}

/** Dòng báo cáo theo phòng cho cả năm, bỏ tuần phòng chưa sửa bản chép tuần trước. */
export function rowsFromSheets(sheets: HospitalWeekSheet[], departments: ReadonlyArray<{ id: string; name: string }>, year: number): DepartmentRows[] {
  const ordered = sheets.filter((s) => s.year === year).sort((a, b) => a.week - b.week);
  const byDept = new Map<string, DepartmentRows>();
  let previousHashes = new Map<string, string>();
  for (const sheet of ordered) {
    const hashes = new Map<string, string>();
    for (const dept of extractWeekTasksByDepartment(sheet)) {
      const hash = departmentContentHash(dept.tasks);
      hashes.set(dept.departmentName, hash);
      if (isUneditedCopy(hash, previousHashes.get(dept.departmentName), dept.tasks.length)) continue;
      const match = matchDepartment(dept.departmentName, departments);
      if (!match.departmentId || !match.dbName) continue;
      const entry = byDept.get(match.departmentId) ?? { departmentId: match.departmentId, departmentName: match.dbName, year, weeks: [] };
      entry.weeks.push({
        week: sheet.week,
        rows: dept.tasks.map((t) => ({
          week: sheet.week,
          sourceRow: t.sourceRow,
          rawName: t.rawName,
          parentGroup: t.parentGroup,
          resultText: t.resultText,
          progress: t.progress,
          timePeriod: readableTimePeriod(t.timePeriod),
          nextWeekPlan: t.nextWeekPlan || null,
        })),
      });
      byDept.set(match.departmentId, entry);
    }
    previousHashes = hashes;
  }
  return [...byDept.values()];
}

/** Ô thời gian đôi khi là số ngày kiểu Excel (46120) — đổi ra dd/mm/yyyy cho người đọc. */
export function readableTimePeriod(value: string | undefined | null): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(v)) * 86_400_000);
    return date.toISOString().slice(0, 10).split('-').reverse().join('/');
  }
  return v;
}

const signature = (rows: Array<{ sourceRow: number; resultText: string; progress: number | null }>) =>
  createHash('sha256')
    .update(JSON.stringify([...rows].sort((a, b) => a.sourceRow - b.sourceRow).map((r) => [r.sourceRow, r.resultText, r.progress])))
    .digest('hex');

/** Nối dòng báo cáo của một phòng vào các việc. Trả về số dòng mới nối. */
export async function linkDepartment(
  db: PrismaClient,
  input: DepartmentRows,
  options: { rebuild?: boolean } = {},
): Promise<{ linkedFromWeek: number | null; entries: number }> {
  const { departmentId, year } = input;
  const routineNames = new Set(
    (await db.taskStream.findMany({ where: { departmentId, year, mode: 'ROUTINE' }, select: { nameKey: true } })).map((r) => r.nameKey),
  );
  const existing = await db.taskThreadEntry.findMany({
    where: { departmentId, year },
    select: { week: true, sourceRow: true, resultText: true, progress: true },
  });
  const existingByWeek = new Map<number, typeof existing>();
  for (const e of existing) existingByWeek.set(e.week, [...(existingByWeek.get(e.week) ?? []), e]);

  // Tuần đầu tiên có thay đổi (mới, phòng sửa, hoặc tuần cũ không còn) — nối lại từ đó.
  const inputWeeks = new Set(input.weeks.map((w) => w.week));
  const changed = input.weeks.filter((w) => {
    const old = existingByWeek.get(w.week);
    return !old || signature(old) !== signature(w.rows);
  }).map((w) => w.week);
  const vanished = [...existingByWeek.keys()].filter((w) => !inputWeeks.has(w));
  const fromWeek = options.rebuild ? Math.min(...input.weeks.map((w) => w.week)) : Math.min(...changed, ...vanished);
  if (!Number.isFinite(fromWeek)) return { linkedFromWeek: null, entries: 0 };

  let entries = 0;
  await db.$transaction(async (tx) => {
    await tx.taskThreadEntry.deleteMany({ where: { departmentId, year, week: { gte: fromWeek } } });
    // Việc còn dòng: tính lại mốc tuần. Việc hết dòng: xoá, trừ việc Phòng HC đã sửa tay.
    await tx.$executeRaw`
      UPDATE task_threads t SET "firstWeek" = s.first, "lastWeek" = s.last
      FROM (SELECT "threadId", min(week) AS first, max(week) AS last FROM task_thread_entries GROUP BY 1) s
      WHERE s."threadId" = t.id AND t."departmentId" = ${departmentId} AND t.year = ${year}`;
    await tx.taskThread.deleteMany({
      where: { departmentId, year, entries: { none: {} }, overriddenAt: null },
    });

    const kept = await tx.taskThread.findMany({
      where: { departmentId, year, entries: { some: {} } },
      select: { id: true, rawName: true, lastWeek: true, entries: { orderBy: { week: 'desc' }, take: 1, select: { resultText: true } } },
    });
    let open: OpenThread[] = kept.map((t) => ({ key: t.id, rawName: t.rawName, lastWeek: t.lastWeek, lastText: t.entries[0]?.resultText ?? '' }));

    const now = new Date();
    for (const { week, rows } of input.weeks.filter((w) => w.week >= fromWeek).sort((a, b) => a.week - b.week)) {
      const pendingNew = new Map<string, ReportRow>();
      const result = linkWeek(rows, open, week, (row) => {
        const key = `new:${week}:${row.sourceRow}`;
        pendingNew.set(key, row);
        return key;
      }, routineNames);
      // Tạo việc mới, đổi khoá tạm sang id thật.
      // Tạo id ngay ở đây để ghi một lượt (createMany) thay vì mỗi việc một lần gọi DB.
      const realId = new Map([...pendingNew.keys()].map((key) => [key, randomUUID()]));
      if (pendingNew.size) {
        await tx.taskThread.createMany({
          data: [...pendingNew].map(([key, row]) => ({
            id: realId.get(key)!,
            departmentId, year, rawName: row.rawName, parentGroup: row.parentGroup,
            title: (row.resultText || row.rawName).split('\n')[0].slice(0, 160),
            firstWeek: week, lastWeek: week, changedAt: now,
          })),
        });
      }
      const touched = result.assignments.filter((a) => !a.isNew).map((a) => a.threadKey);
      if (touched.length) {
        await tx.taskThread.updateMany({ where: { id: { in: touched } }, data: { lastWeek: week, changedAt: now } });
      }
      await tx.taskThreadEntry.createMany({
        data: result.assignments.map(({ row, threadKey }) => ({
          threadId: realId.get(threadKey) ?? threadKey,
          departmentId, year, week, sourceRow: row.sourceRow,
          rawName: row.rawName, parentGroup: row.parentGroup, resultText: row.resultText,
          progress: row.progress === null ? null : Math.round(row.progress),
          timePeriod: row.timePeriod ?? null, nextWeekPlan: row.nextWeekPlan ?? null,
        })),
      });
      entries += result.assignments.length;
      open = result.open.map((t) => ({ ...t, key: realId.get(t.key) ?? t.key }));
    }
  }, TX);
  return { linkedFromWeek: fromWeek, entries };
}

/**
 * AI quyết các luồng (cùng tên nhiệm vụ, đã tách ≥ 2 việc) chưa có quyết định.
 * Trả về true nếu có luồng mới được quyết là thường kỳ — cần nối lại phòng.
 */
export async function classifyStreams(
  db: PrismaClient,
  departmentId: string,
  departmentName: string,
  year: number,
  options: { model?: string; log?: (msg: string) => void } = {},
): Promise<{ newRoutine: number; decided: number; tokens: number }> {
  const profile = await db.departmentReportProfile.findUnique({ where: { departmentId }, select: { summary: true } });
  const decided = new Set((await db.taskStream.findMany({ where: { departmentId, year }, select: { nameKey: true } })).map((s) => s.nameKey));
  const threads = await db.taskThread.findMany({
    where: { departmentId, year, rawName: { not: UNNAMED }, entries: { some: {} } },
    orderBy: { firstWeek: 'asc' },
    select: {
      rawName: true, firstWeek: true, lastWeek: true,
      entries: { orderBy: { week: 'asc' }, select: { progress: true, resultText: true } },
    },
  });
  const byName = new Map<string, StreamInput>();
  for (const t of threads) {
    const key = nameKeyOf(t.rawName);
    if (decided.has(key)) continue;
    const stream = byName.get(key) ?? { key, rawName: t.rawName, segments: [] };
    stream.segments.push({
      firstWeek: t.firstWeek, lastWeek: t.lastWeek,
      progresses: t.entries.map((e) => e.progress),
      firstText: t.entries[0]?.resultText ?? '', lastText: t.entries[t.entries.length - 1]?.resultText ?? '',
    });
    byName.set(key, stream);
  }
  const pending = [...byName.values()].filter((s) => s.segments.length >= 2);

  let newRoutine = 0;
  let count = 0;
  let tokens = 0;
  for (let i = 0; i < pending.length; i += STREAM_BATCH) {
    const batch = pending.slice(i, i + STREAM_BATCH);
    try {
      const result = await classifyStreamBatch(departmentName, profile?.summary ?? '', batch, options.model);
      tokens += result.tokens;
      for (const stream of batch) {
        const d = result.decisions.get(stream.key);
        if (!d) continue;
        await db.taskStream.upsert({
          where: { departmentId_year_nameKey: { departmentId, year, nameKey: stream.key } },
          create: { departmentId, year, nameKey: stream.key, rawName: stream.rawName, mode: d.loai, reasoning: d.ly_do ?? null, decidedBy: 'AI' },
          update: {},
        });
        count += 1;
        if (d.loai === 'ROUTINE') newRoutine += 1;
      }
    } catch (error) {
      options.log?.(`${departmentName}: lỗi AI khi xét luồng — ${error instanceof Error ? error.message.slice(0, 160) : error}`);
      throw error; // không quyết được luồng thì chưa nên đánh giá việc (sẽ phải nối lại)
    }
  }
  return { newRoutine, decided: count, tokens };
}

/** Tính lại cách báo cáo của phòng từ các việc đã nối. */
export async function refreshProfile(db: PrismaClient, departmentId: string, departmentName: string, year: number) {
  const threads = await db.taskThread.findMany({
    where: { departmentId, year },
    select: { entries: { orderBy: { week: 'asc' }, select: { progress: true } } },
  });
  const stats = computeProfile(threads.map((t) => ({ progresses: t.entries.map((e) => e.progress) })));
  const summary = describeProfile(departmentName, stats);
  await db.departmentReportProfile.upsert({
    where: { departmentId },
    create: { departmentId, year, stats: stats as unknown as Prisma.InputJsonValue, summary },
    update: { year, stats: stats as unknown as Prisma.InputJsonValue, summary, computedAt: new Date() },
  });
  return { stats, summary };
}

/** AI đánh giá các việc mới đổi, hoặc vắng mặt từ khi phòng có tuần mới. */
export async function judgeDepartment(
  db: PrismaClient,
  departmentId: string,
  departmentName: string,
  year: number,
  options: { model?: string; force?: boolean; log?: (msg: string) => void } = {},
): Promise<{ judged: number; tokens: number; failed: number }> {
  const profile = await db.departmentReportProfile.findUnique({ where: { departmentId } });
  if (!profile) throw new Error(`Chưa tính cách báo cáo của ${departmentName}`);
  const style = (profile.stats as { style?: ReportStyle }).style ?? 'MIXED';
  const latest = await db.taskThreadEntry.aggregate({ where: { departmentId, year }, _max: { week: true } });
  const latestWeek = latest._max.week ?? 0;

  const candidates = await db.taskThread.findMany({
    where: { departmentId, year, entries: { some: {} } },
    select: {
      id: true, rawName: true, parentGroup: true, aiUpdatedAt: true, changedAt: true, judgedWeek: true, lastWeek: true,
      entries: { orderBy: { week: 'asc' }, select: { week: true, progress: true, resultText: true, nextWeekPlan: true, timePeriod: true } },
    },
  });
  const due = candidates.filter(
    (t) =>
      options.force ||
      !t.aiUpdatedAt ||
      t.changedAt > t.aiUpdatedAt ||
      ((t.judgedWeek ?? 0) < latestWeek && t.lastWeek >= latestWeek - REJUDGE_WINDOW_WEEKS),
  );

  let judged = 0;
  let tokens = 0;
  let failed = 0;
  for (let i = 0; i < due.length; i += JUDGE_BATCH) {
    const batch = due.slice(i, i + JUDGE_BATCH);
    const payload: JudgeThread[] = batch.map((t) => ({ id: t.id, rawName: t.rawName, parentGroup: t.parentGroup, entries: t.entries }));
    try {
      const result = await judgeThreads(departmentName, profile.summary, latestWeek, payload, options.model ?? JUDGE_MODEL);
      tokens += result.tokens;
      const now = new Date();
      for (const j of result.judgements) {
        const thread = batch.find((t) => t.id === j.id);
        if (!thread) continue;
        const final = applyRules(j, thread.entries, style, latestWeek);
        await db.taskThread.update({
          where: { id: j.id },
          data: { ...final, aiModel: options.model ?? JUDGE_MODEL, aiUpdatedAt: now, judgedWeek: latestWeek },
        });
        judged += 1;
      }
      failed += batch.length - result.judgements.length;
    } catch (error) {
      failed += batch.length;
      options.log?.(`${departmentName}: lỗi AI ở lô ${i / JUDGE_BATCH + 1} — ${error instanceof Error ? error.message.slice(0, 160) : error}`);
    }
  }
  return { judged, tokens, failed };
}

/** Cả ba bước cho một phòng. */
export async function syncDepartment(db: PrismaClient, input: DepartmentRows, options: { model?: string; judge?: boolean; force?: boolean; log?: (msg: string) => void } = {}) {
  const { departmentId, departmentName, year } = input;
  let linked = await linkDepartment(db, input);
  let profile = await refreshProfile(db, departmentId, departmentName, year);
  if (options.judge === false) return { ...linked, style: profile.stats.style, judged: 0, tokens: 0, failed: 0, routineStreams: 0 };

  // Luồng mới được quyết là thường kỳ → nối lại cả năm của phòng để gộp các đoạn.
  const streams = await classifyStreams(db, departmentId, departmentName, year, options);
  if (streams.newRoutine > 0) {
    linked = await linkDepartment(db, input, { rebuild: true });
    profile = await refreshProfile(db, departmentId, departmentName, year);
  }
  const judged = await judgeDepartment(db, departmentId, departmentName, year, options);
  return { ...linked, style: profile.stats.style, ...judged, tokens: judged.tokens + streams.tokens, routineStreams: streams.newRoutine };
}
