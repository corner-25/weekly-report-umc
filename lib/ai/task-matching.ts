/**
 * Khớp nhiệm vụ của một tuần với MasterTask — giai đoạn chạy hằng tuần.
 *
 * Khác với `task-grouping.ts` (chạy một lần trên toàn bộ lịch sử để dựng danh mục),
 * module này chạy mỗi khi có báo cáo tuần mới.
 *
 * Thứ tự thử, rẻ trước đắt sau:
 *   1. Khớp `aliases` — tức thì, không tốn token
 *   2. Khớp sau khi bỏ dấu — bắt được khác biệt hoa/thường, dấu gạch ngang
 *   3. Gọi AI — chỉ khi hai cách trên không ra
 *
 * Mỗi lần AI khớp được và người vận hành chấp nhận, tên đó vào `aliases` nên lần
 * sau khớp ở bước 1. Chi phí giảm dần theo thời gian.
 */
import type { PrismaClient } from '@prisma/client';
import { callJson } from './zai';
import { buildAssignPrompt, type BusinessArea } from './prompts';

/** Số mục mỗi lô khi phải gọi AI. */
const MATCH_BATCH_SIZE = 12;

/** Dưới ngưỡng này thì gắn cờ cho người vận hành xem lại. */
export const MATCH_CONFIDENCE_THRESHOLD = 0.7;

export type MatchMethod = 'ALIAS' | 'NORMALIZED' | 'AI' | 'NONE';

export interface WeekTaskInput {
  /** Tên nhiệm vụ y như trong file Excel. */
  rawName: string;
  resultText: string;
  parentGroup?: string | null;
  progress?: number | null;
  /** Dòng trong sheet gốc — định danh duy nhất khi nhiều dòng trùng tên. */
  sourceRow?: number;
}

export interface TaskMatch {
  rawName: string;
  /** Dòng gốc, để nơi gọi tra đúng nguồn khi nhiều dòng cùng tên. */
  sourceRow?: number;
  masterTaskId: string | null;
  masterTaskName: string | null;
  subject: string | null;
  confidence: number;
  method: MatchMethod;
  reasoning: string;
  flags: string[];
}

export interface MatchResult {
  matches: TaskMatch[];
  /** Số mục khớp được mà không tốn token. */
  freeMatches: number;
  aiCalls: number;
  totalTokens: number;
  /** Tên mới nên thêm vào aliases để lần sau khớp miễn phí. */
  newAliases: Array<{ masterTaskId: string; alias: string }>;
}

/** Bỏ dấu, chuẩn hoá khoảng trắng và dấu gạch ngang để so tên. */
export function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

interface MasterTaskRow {
  id: string;
  name: string;
  aliases: string[];
}

/**
 * Khớp danh sách nhiệm vụ của một tuần với MasterTask của phòng.
 *
 * Chỉ xét MasterTask đang hoạt động — bản AI đề xuất chưa duyệt không được dùng
 * để khớp, tránh đưa dữ liệu vào nhánh nghiệp vụ chưa ai xác nhận.
 */
export async function matchWeekTasks(
  db: PrismaClient,
  departmentId: string,
  departmentName: string,
  tasks: readonly WeekTaskInput[],
): Promise<MatchResult> {
  const masterTasks = await db.masterTask.findMany({
    where: { departmentId, isActive: true },
    select: { id: true, name: true, aliases: true, description: true },
  });

  if (masterTasks.length === 0) {
    // Chưa gom nghiệp vụ cho phòng này thì không khớp được gì.
    return {
      matches: tasks.map((t) => ({
        rawName: t.rawName,
        sourceRow: t.sourceRow,
        masterTaskId: null,
        masterTaskName: null,
        subject: null,
        confidence: 0,
        method: 'NONE' as const,
        reasoning: 'Phòng chưa có danh mục nghiệp vụ',
        flags: ['NO_CATALOG'],
      })),
      freeMatches: 0,
      aiCalls: 0,
      totalTokens: 0,
      newAliases: [],
    };
  }

  // Dựng bảng tra: alias và tên chuẩn hoá → MasterTask
  const byExact = new Map<string, MasterTaskRow>();
  const byNormalized = new Map<string, MasterTaskRow>();

  for (const mt of masterTasks) {
    const row: MasterTaskRow = { id: mt.id, name: mt.name, aliases: mt.aliases };
    for (const key of [mt.name, ...mt.aliases]) {
      byExact.set(key, row);
      const normalized = normalizeForMatch(key);
      // Tên chuẩn xuất hiện sau alias sẽ ghi đè — chấp nhận được vì cùng
      // MasterTask thì trỏ về đâu cũng như nhau.
      if (!byNormalized.has(normalized)) byNormalized.set(normalized, row);
    }
  }

  const matches: TaskMatch[] = [];
  const needAi: WeekTaskInput[] = [];
  let freeMatches = 0;

  for (const task of tasks) {
    const exact = byExact.get(task.rawName);
    if (exact) {
      freeMatches += 1;
      matches.push(toMatch(task, exact, 1, 'ALIAS', 'Khớp alias đã lưu'));
      continue;
    }

    const normalized = byNormalized.get(normalizeForMatch(task.rawName));
    if (normalized) {
      freeMatches += 1;
      matches.push(
        toMatch(task, normalized, 0.95, 'NORMALIZED', 'Khớp sau khi bỏ dấu và chuẩn hoá'),
      );
      continue;
    }

    needAi.push(task);
  }

  // Gọi AI cho phần còn lại
  const areas: BusinessArea[] = masterTasks.map((mt) => ({
    ten: mt.name,
    mo_ta: mt.description ?? '',
    dau_hieu: mt.aliases.slice(0, 6).join(' · '),
  }));

  const newAliases: MatchResult['newAliases'] = [];
  let aiCalls = 0;
  let totalTokens = 0;

  for (let i = 0; i < needAi.length; i += MATCH_BATCH_SIZE) {
    const batch = needAi.slice(i, i + MATCH_BATCH_SIZE);
    aiCalls += 1;

    const res = await callJson<{
      ket_qua: Array<{
        stt: number;
        nghiep_vu: number;
        doi_tuong?: string | null;
        do_tin_cay?: number;
        ly_do?: string;
      }>;
    }>(
      buildAssignPrompt(
        departmentName,
        areas,
        batch.map((t) => ({
          name: t.rawName,
          weekCount: 1,
          totalWeeks: 1,
          parentGroup: t.parentGroup,
          sampleResults: t.resultText ? [t.resultText] : [],
        })),
      ),
    );
    totalTokens += res.usage.totalTokens;

    const handled = new Set<number>();
    for (const item of res.data.ket_qua ?? []) {
      const task = batch[item.stt];
      const master = masterTasks[item.nghiep_vu];
      if (!task || !master) continue;
      handled.add(item.stt);

      const confidence = item.do_tin_cay ?? 0;
      const match = toMatch(
        task,
        { id: master.id, name: master.name, aliases: master.aliases },
        confidence,
        'AI',
        item.ly_do ?? '',
      );
      match.subject = item.doi_tuong || match.subject;
      if (confidence < MATCH_CONFIDENCE_THRESHOLD) match.flags.push('LOW_CONFIDENCE');
      matches.push(match);

      // Đủ tin cậy thì ghi nhớ để lần sau khỏi gọi AI.
      if (confidence >= MATCH_CONFIDENCE_THRESHOLD) {
        newAliases.push({ masterTaskId: master.id, alias: task.rawName });
      }
    }

    // Mục AI bỏ qua vẫn phải có mặt trong kết quả, đừng để mất im lặng.
    batch.forEach((task, idx) => {
      if (handled.has(idx)) return;
      matches.push({
        rawName: task.rawName,
        sourceRow: task.sourceRow,
        masterTaskId: null,
        masterTaskName: null,
        subject: null,
        confidence: 0,
        method: 'NONE',
        reasoning: 'AI không trả kết quả cho mục này',
        flags: ['AI_NO_RESULT'],
      });
    });
  }

  return { matches, freeMatches, aiCalls, totalTokens, newAliases };
}

function toMatch(
  task: WeekTaskInput,
  master: MasterTaskRow,
  confidence: number,
  method: MatchMethod,
  reasoning: string,
): TaskMatch {
  return {
    rawName: task.rawName,
    sourceRow: task.sourceRow,
    masterTaskId: master.id,
    masterTaskName: master.name,
    // Tên gốc khác tên nghiệp vụ nghĩa là nó nói về một đối tượng cụ thể.
    subject: task.rawName === master.name ? null : task.rawName,
    confidence,
    method,
    reasoning,
    flags: [],
  };
}

/** Ghi alias mới vào MasterTask để lần sau khớp miễn phí. */
export async function saveAliases(
  db: PrismaClient,
  newAliases: MatchResult['newAliases'],
): Promise<number> {
  const byTask = new Map<string, Set<string>>();
  for (const { masterTaskId, alias } of newAliases) {
    const set = byTask.get(masterTaskId) ?? new Set<string>();
    set.add(alias);
    byTask.set(masterTaskId, set);
  }

  let saved = 0;
  for (const [masterTaskId, aliases] of byTask) {
    const current = await db.masterTask.findUnique({
      where: { id: masterTaskId },
      select: { aliases: true },
    });
    if (!current) continue;

    const merged = [...new Set([...current.aliases, ...aliases])];
    if (merged.length === current.aliases.length) continue;

    await db.masterTask.update({ where: { id: masterTaskId }, data: { aliases: merged } });
    saved += merged.length - current.aliases.length;
  }
  return saved;
}
