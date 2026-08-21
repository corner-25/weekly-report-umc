/**
 * Nạp một tuần báo cáo bệnh viện vào database.
 *
 * Nối các mảnh lại: khớp nhiệm vụ với MasterTask, trích số liệu từ văn bản, rồi
 * ghi `WeekTaskProgress` và `ExtractedMetric`.
 *
 * Giữ nguyên văn bản gốc (`rawTaskName`, `rawResultText`) và độ tin cậy khớp —
 * để khi số liệu trông lạ thì truy nguyên được về đúng ô Excel ban đầu.
 */
import type { PrismaClient } from '@prisma/client';
import { PROMPT_VERSION } from './prompts';
import { extractMetrics, buildHistory, type MetricExtractionInput } from './metric-extraction';
import {
  matchWeekTasks,
  saveAliases,
  MATCH_CONFIDENCE_THRESHOLD,
  type WeekTaskInput,
} from './task-matching';

const DEFAULT_MODEL = 'glm-4.5';

/** Nhiều dòng Excel cùng thuộc một nghiệp vụ, gộp lại trước khi ghi. */
interface MergedTask {
  masterTaskId: string;
  results: string[];
  subjects: string[];
  rawNames: string[];
  progress: number | null;
  confidence: number;
  reasonings: string[];
  flags: Set<string>;
}

function mergeInto(
  target: MergedTask,
  match: { subject: string | null; reasoning: string; confidence: number },
  source: { resultText: string; progress?: number | null },
  flags: string[],
): void {
  if (source.resultText) target.results.push(source.resultText);
  if (match.subject) target.subjects.push(match.subject);
  if (match.reasoning) target.reasonings.push(match.reasoning);
  for (const f of flags) target.flags.add(f);

  target.confidence = Math.min(target.confidence, match.confidence);
  // Tiến độ: giữ giá trị đầu tiên có thật, tránh null xoá mất số đã ghi nhận.
  if (target.progress === null && source.progress != null) target.progress = source.progress;
}

/** Số tuần lịch sử dùng để phát hiện số liệu bất thường. */
const HISTORY_WEEKS = 4;

export interface WeekImportInput {
  year: number;
  week: number;
  departmentId: string;
  departmentName: string;
  tasks: WeekTaskInput[];
}

export interface WeekImportSummary {
  year: number;
  week: number;
  departmentName: string;
  tasksMatched: number;
  tasksUnmatched: number;
  /** Khớp được mà không tốn token — nhờ aliases. */
  freeMatches: number;
  metricsExtracted: number;
  metricsFlagged: number;
  aliasesLearned: number;
  totalTokens: number;
  durationMs: number;
}

/**
 * Nạp một tuần của một phòng.
 *
 * Yêu cầu `Week` đã tồn tại — bản ghi tuần là dữ liệu nghiệp vụ do người dùng
 * tạo, pipeline không tự tạo tuần mới.
 */
export async function importWeekForDepartment(
  db: PrismaClient,
  input: WeekImportInput,
  options: { model?: string; extractMetricsEnabled?: boolean } = {},
): Promise<WeekImportSummary> {
  const startedAt = Date.now();
  const model = options.model ?? DEFAULT_MODEL;

  const week = await db.week.findUnique({
    where: { weekNumber_year: { weekNumber: input.week, year: input.year } },
    select: { id: true },
  });
  if (!week) {
    throw new Error(`Chưa có bản ghi tuần ${input.week}/${input.year} trong hệ thống`);
  }

  const run = await db.aiExtractionRun.create({
    data: {
      stage: 'MATCH',
      departmentId: input.departmentId,
      year: input.year,
      week: input.week,
      model,
      promptVersion: PROMPT_VERSION,
      itemsInput: input.tasks.length,
    },
  });

  try {
    // ── Khớp nhiệm vụ ─────────────────────────────────────────────
    const matchResult = await matchWeekTasks(
      db,
      input.departmentId,
      input.departmentName,
      input.tasks,
    );

    // Tra theo dòng gốc, KHÔNG theo tên: nhiều dòng con không có tên nên đều
    // mang tên nhóm cha, tra theo tên sẽ lấy nhầm cùng một nguồn cho tất cả.
    const taskByRow = new Map(input.tasks.map((t, i) => [t.sourceRow ?? i, t]));

    // Nhiều dòng Excel có thể cùng thuộc một nghiệp vụ — đó là mục đích của
    // việc gom. Nhưng khoá (masterTaskId, weekId) là duy nhất, nên phải GỘP nội
    // dung thay vì ghi đè, nếu không các dòng sau xoá mất dòng trước.
    //
    // Ví dụ thật: tuần 17 của Quản trị Toà nhà có 4 dòng thuộc nghiệp vụ "Phòng
    // cháy chữa cháy" (một dòng có tên, ba dòng con chỉ có kết quả). Ghi đè làm
    // mất 3 dòng nội dung.
    const merged = new Map<string, MergedTask>();

    for (const match of matchResult.matches) {
      const source = taskByRow.get(match.sourceRow ?? -1);
      if (!source || !match.masterTaskId) continue;

      const flags = [...match.flags];
      if (match.confidence < MATCH_CONFIDENCE_THRESHOLD) flags.push('LOW_CONFIDENCE');

      const existing = merged.get(match.masterTaskId);
      if (existing) {
        existing.rawNames.push(match.rawName);
        mergeInto(existing, match, source, flags);
      } else {
        merged.set(match.masterTaskId, {
          masterTaskId: match.masterTaskId,
          results: source.resultText ? [source.resultText] : [],
          subjects: match.subject ? [match.subject] : [],
          rawNames: [match.rawName],
          progress: source.progress ?? null,
          // Giữ mức tin cậy THẤP NHẤT trong nhóm — một dòng khớp mơ hồ đủ để
          // cả nghiệp vụ đáng rà soát.
          confidence: match.confidence,
          reasonings: match.reasoning ? [match.reasoning] : [],
          flags: new Set(flags),
        });
      }
    }

    let tasksMatched = 0;
    let orderNumber = 0;

    for (const item of merged.values()) {
      orderNumber += 1;
      tasksMatched += item.rawNames.length;

      const result = item.results.join('\n\n');
      const flags = [...item.flags];
      if (item.rawNames.length > 1) flags.push('MERGED_ROWS');

      const data = {
        result,
        progress: item.progress,
        subject: item.subjects.length > 0 ? [...new Set(item.subjects)].join(' · ') : null,
        rawTaskName: item.rawNames.join(' · '),
        rawResultText: result,
        extractionModel: model,
        matchConfidence: item.confidence,
        matchReasoning: item.reasonings.join(' | '),
        reviewFlags: flags,
      };

      await db.weekTaskProgress.upsert({
        where: {
          masterTaskId_weekId: { masterTaskId: item.masterTaskId, weekId: week.id },
        },
        create: {
          masterTaskId: item.masterTaskId,
          weekId: week.id,
          orderNumber,
          timePeriod: '',
          nextWeekPlan: '',
          ...data,
        },
        update: data,
      });
    }

    const aliasesLearned = await saveAliases(db, matchResult.newAliases);

    // ── Trích số liệu ─────────────────────────────────────────────
    let metricsExtracted = 0;
    let metricsFlagged = 0;
    let metricTokens = 0;

    if (options.extractMetricsEnabled !== false) {
      const result = await extractMetricsForWeek(db, input, week.id, model);
      metricsExtracted = result.extracted;
      metricsFlagged = result.flagged;
      metricTokens = result.tokens;
    }

    const totalTokens = matchResult.totalTokens + metricTokens;
    const durationMs = Date.now() - startedAt;

    await db.aiExtractionRun.update({
      where: { id: run.id },
      data: {
        itemsOutput: tasksMatched,
        flagged: metricsFlagged + (input.tasks.length - tasksMatched),
        tokensUsed: totalTokens,
        durationMs,
      },
    });

    return {
      year: input.year,
      week: input.week,
      departmentName: input.departmentName,
      tasksMatched,
      tasksUnmatched: input.tasks.length - tasksMatched,
      freeMatches: matchResult.freeMatches,
      metricsExtracted,
      metricsFlagged,
      aliasesLearned,
      totalTokens,
      durationMs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi không xác định';
    await db.aiExtractionRun.update({
      where: { id: run.id },
      data: { errorMessage: message, durationMs: Date.now() - startedAt },
    });
    throw error;
  }
}

async function extractMetricsForWeek(
  db: PrismaClient,
  input: WeekImportInput,
  weekId: string,
  model: string,
): Promise<{ extracted: number; flagged: number; tokens: number }> {
  // Lịch sử để phát hiện giá trị bất thường: chỉ lấy metric đã duyệt của các
  // tuần trước, tránh so với chính dữ liệu chưa kiểm chứng.
  const previous = await db.extractedMetric.findMany({
    where: {
      departmentId: input.departmentId,
      reviewStatus: { in: ['APPROVED', 'EDITED'] },
      week: { year: input.year, weekNumber: { lt: input.week, gte: input.week - HISTORY_WEEKS } },
    },
    select: { name: true, value: true },
    orderBy: { createdAt: 'desc' },
  });

  const items: MetricExtractionInput[] = input.tasks.map((t) => ({
    taskName: t.rawName,
    resultText: t.resultText,
  }));

  const result = await extractMetrics(input.departmentName, items, buildHistory(previous));

  // Liên kết metric với MasterTask đã khớp, nếu xác định được.
  const progressRows = await db.weekTaskProgress.findMany({
    where: { weekId, masterTask: { departmentId: input.departmentId } },
    select: { masterTaskId: true, rawTaskName: true },
  });
  // rawTaskName có thể là nhiều tên nối bằng ' · ' khi nhiều dòng Excel cùng
  // thuộc một nghiệp vụ, nên tách ra để tra theo từng tên gốc.
  const masterByRawName = new Map<string, string>();
  for (const row of progressRows) {
    if (!row.rawTaskName) continue;
    for (const name of row.rawTaskName.split(' · ')) {
      masterByRawName.set(name, row.masterTaskId);
    }
  }

  // Xoá metric cũ của đúng phòng + tuần này trước khi ghi mới.
  //
  // Trích xuất là thao tác thay thế, không phải bổ sung: chạy lại cùng một tuần
  // phải cho cùng kết quả. Không xoá thì mỗi lần chạy lại nhân bản toàn bộ —
  // đo được trên production: tuần 5 phình từ 358 lên 824 metric sau hai lần chạy.
  //
  // Giữ lại bản người dùng đã duyệt hoặc sửa: đó là quyết định của con người,
  // AI không được ghi đè.
  await db.extractedMetric.deleteMany({
    where: {
      weekId,
      departmentId: input.departmentId,
      reviewStatus: 'PENDING',
    },
  });

  let extracted = 0;
  let flagged = 0;

  for (const metric of result.metrics) {
    if (metric.flags.length > 0) flagged += 1;

    await db.extractedMetric.create({
      data: {
        weekId,
        departmentId: input.departmentId,
        masterTaskId: masterByRawName.get(metric.taskName) ?? null,
        name: metric.name,
        value: metric.value,
        unit: metric.unit,
        period: metric.period,
        asOfDate: metric.asOfDate ? new Date(metric.asOfDate) : null,
        sourceText: metric.sourceText,
        confidence: metric.confidence,
        originalValue: metric.value,
        extractionModel: model,
      },
    });
    extracted += 1;
  }

  return { extracted, flagged, tokens: result.totalTokens };
}
