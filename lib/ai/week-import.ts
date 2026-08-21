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

    const taskByName = new Map(input.tasks.map((t) => [t.rawName, t]));
    let tasksMatched = 0;
    let orderNumber = 0;

    for (const match of matchResult.matches) {
      const source = taskByName.get(match.rawName);
      if (!source || !match.masterTaskId) continue;

      orderNumber += 1;
      tasksMatched += 1;

      const flags = [...match.flags];
      if (match.confidence < MATCH_CONFIDENCE_THRESHOLD) flags.push('LOW_CONFIDENCE');

      await db.weekTaskProgress.upsert({
        where: {
          masterTaskId_weekId: { masterTaskId: match.masterTaskId, weekId: week.id },
        },
        create: {
          masterTaskId: match.masterTaskId,
          weekId: week.id,
          orderNumber,
          result: source.resultText,
          timePeriod: '',
          progress: source.progress ?? null,
          nextWeekPlan: '',
          subject: match.subject,
          rawTaskName: match.rawName,
          rawResultText: source.resultText,
          extractionModel: model,
          matchConfidence: match.confidence,
          matchReasoning: match.reasoning,
          reviewFlags: flags,
        },
        update: {
          result: source.resultText,
          progress: source.progress ?? null,
          subject: match.subject,
          rawTaskName: match.rawName,
          rawResultText: source.resultText,
          extractionModel: model,
          matchConfidence: match.confidence,
          matchReasoning: match.reasoning,
          reviewFlags: flags,
        },
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
  const masterByRawName = new Map(
    progressRows.filter((r) => r.rawTaskName).map((r) => [r.rawTaskName!, r.masterTaskId]),
  );

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
