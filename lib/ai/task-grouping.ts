/**
 * Gom nhiệm vụ thành nghiệp vụ và phân loại — giai đoạn 1→4 của pipeline.
 *
 * Bài toán: cùng một nghiệp vụ được viết nhiều kiểu. CNTT có 143 tên nhiệm vụ
 * khác nhau nhưng thực chất chỉ ~6 nghiệp vụ. `Phần mềm Chỉ định CLS` xuất hiện
 * một tuần không phải vì là việc phát sinh, mà vì nghiệp vụ là "vận hành phần mềm"
 * và tuần đó tình cờ làm với module CLS.
 *
 * Xem docs/HOSPITAL-REPORT-PIPELINE.md.
 */
import { callJson } from './zai';
import {
  buildAssignPrompt,
  buildClassifyPrompt,
  buildGroupingPrompt,
  buildReconcilePrompt,
  type BusinessArea,
  type TaskContext,
} from './prompts';

/** Số mục mỗi lô. Nhỏ để mỗi mục được xét kỹ kèm ngữ cảnh — đã đo là chính xác hơn. */
const ASSIGN_BATCH_SIZE = 12;
const CLASSIFY_BATCH_SIZE = 12;

/** Chỉ nhiệm vụ xuất hiện đủ thường xuyên mới dùng để dựng danh mục nghiệp vụ. */
const FREQUENT_THRESHOLD_RATIO = 0.24; // ≈ 8/33 tuần

/** Dưới ngưỡng này thì cần người duyệt xác nhận. */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

/** Độ tương đồng tên để nghi hai mục là cùng một việc. */
const NAME_SIMILARITY_THRESHOLD = 0.85;

/** CUMULATIVE cần ít nhất bấy nhiêu giá trị tiến độ KHÁC NHAU mới đáng tin. */
const MIN_DISTINCT_PROGRESS_FOR_CUMULATIVE = 3;

/** Giá trị cố định suốt bấy nhiêu tuần trở lên thì con số không phản ánh gì. */
const FLAT_SERIES_MIN_LENGTH = 5;

export type TaskType = 'RECURRING' | 'CUMULATIVE' | 'MILESTONE' | 'MONITORING' | 'UNRELIABLE';
export type ProgressMeaning = 'COMPLETION' | 'WEEKLY_DONE' | 'TIME_RATIO' | 'MEANINGLESS';

export interface TaskAssignment {
  taskName: string;
  areaIndex: number;
  areaName: string;
  /** Đối tượng cụ thể của công việc — giữ chi tiết khi gom về một nghiệp vụ. */
  subject: string | null;
  confidence: number;
  reasoning: string;
}

export interface TaskClassification {
  taskName: string;
  taskType: TaskType;
  progressMeaning: ProgressMeaning;
  confidence: number;
  reasoning: string;
}

export interface GroupingResult {
  areas: BusinessArea[];
  assignments: TaskAssignment[];
  classifications: TaskClassification[];
  /** Mục AI không xếp được — người duyệt phải xử lý. */
  unassigned: string[];
  /** Cặp tên gần giống đã được phân xử lại ở giai đoạn 4. */
  reconciled: Array<{ taskName: string; from: string; to: string; reasoning: string }>;
  totalTokens: number;
  durationMs: number;
}

/** Bỏ dấu và từ nối để so tên gần đúng. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[–—]/g, '-')
    .replace(/\b(ve|cho|cac|va|cua|tai|theo)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Độ tương đồng hai chuỗi, 0–1. Dùng thuật toán chia đôi đệ quy như difflib. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const matches = countMatches(a, b);
  return (2 * matches) / (a.length + b.length);
}

function countMatches(a: string, b: string): number {
  if (!a || !b) return 0;

  let best = { ai: 0, bi: 0, size: 0 };
  const positions = new Map<string, number[]>();
  for (let i = 0; i < b.length; i += 1) {
    const list = positions.get(b[i]) ?? [];
    list.push(i);
    positions.set(b[i], list);
  }

  let running = new Map<number, number>();
  for (let i = 0; i < a.length; i += 1) {
    const next = new Map<number, number>();
    for (const j of positions.get(a[i]) ?? []) {
      const size = (running.get(j - 1) ?? 0) + 1;
      next.set(j, size);
      if (size > best.size) best = { ai: i - size + 1, bi: j - size + 1, size };
    }
    running = next;
  }

  if (best.size === 0) return 0;

  return (
    best.size +
    countMatches(a.slice(0, best.ai), b.slice(0, best.bi)) +
    countMatches(a.slice(best.ai + best.size), b.slice(best.bi + best.size))
  );
}

/**
 * Chạy toàn bộ 4 giai đoạn cho một phòng ban.
 *
 * `tasks` phải là TẤT CẢ nhiệm vụ của phòng qua mọi tuần — nhìn toàn cục mới gom
 * đúng, AI xử lý từng tuần riêng lẻ không biết hai tên là cùng một việc.
 */
export async function groupDepartmentTasks(
  deptName: string,
  tasks: readonly TaskContext[],
  onProgress?: (stage: string, detail: string) => void,
): Promise<GroupingResult> {
  const startedAt = Date.now();
  let totalTokens = 0;

  // ── GĐ1: dựng danh mục nghiệp vụ từ các mục thường xuyên ──────────
  const totalWeeks = Math.max(...tasks.map((t) => t.totalWeeks), 1);
  const threshold = Math.max(2, Math.ceil(totalWeeks * FREQUENT_THRESHOLD_RATIO));
  const frequent = tasks.filter((t) => t.weekCount >= threshold);

  // Phòng ít nhiệm vụ thì dùng hết, không lọc.
  const seed = frequent.length >= 3 ? frequent : tasks;

  const grouping = await callJson<{ nghiep_vu: BusinessArea[] }>(
    buildGroupingPrompt(deptName, [...seed]),
  );
  totalTokens += grouping.usage.totalTokens;
  const areas = grouping.data.nghiep_vu ?? [];

  if (areas.length === 0) {
    throw new Error(`AI không đề xuất được nghiệp vụ nào cho ${deptName}`);
  }
  onProgress?.('GROUP', `${areas.length} nghiệp vụ`);

  // ── GĐ2: xếp từng nhiệm vụ vào nghiệp vụ ──────────────────────────
  const assignments = new Map<string, TaskAssignment>();

  for (let i = 0; i < tasks.length; i += ASSIGN_BATCH_SIZE) {
    const batch = tasks.slice(i, i + ASSIGN_BATCH_SIZE);
    const res = await callJson<{
      ket_qua: Array<{
        stt: number;
        nghiep_vu: number;
        doi_tuong?: string | null;
        do_tin_cay?: number;
        ly_do?: string;
      }>;
    }>(buildAssignPrompt(deptName, areas, [...batch]));
    totalTokens += res.usage.totalTokens;

    for (const item of res.data.ket_qua ?? []) {
      const task = batch[item.stt];
      const area = areas[item.nghiep_vu];
      if (!task || !area) continue;

      assignments.set(task.name, {
        taskName: task.name,
        areaIndex: item.nghiep_vu,
        areaName: area.ten,
        subject: item.doi_tuong || null,
        confidence: item.do_tin_cay ?? 0,
        reasoning: item.ly_do ?? '',
      });
    }
    onProgress?.('ASSIGN', `${assignments.size}/${tasks.length}`);
  }

  // ── GĐ3: phân loại nhiệm vụ và ý nghĩa tiến độ ────────────────────
  const classifications = new Map<string, TaskClassification>();

  for (let i = 0; i < tasks.length; i += CLASSIFY_BATCH_SIZE) {
    const batch = tasks.slice(i, i + CLASSIFY_BATCH_SIZE);
    const res = await callJson<{
      ket_qua: Array<{
        stt: number;
        loai: TaskType;
        y_nghia_tien_do: ProgressMeaning;
        do_tin_cay?: number;
        ly_do?: string;
      }>;
    }>(buildClassifyPrompt([...batch]));
    totalTokens += res.usage.totalTokens;

    for (const item of res.data.ket_qua ?? []) {
      const task = batch[item.stt];
      if (!task) continue;

      classifications.set(task.name, verifyClassification(task, {
        taskName: task.name,
        taskType: item.loai ?? 'RECURRING',
        progressMeaning: item.y_nghia_tien_do ?? 'WEEKLY_DONE',
        confidence: item.do_tin_cay ?? 0,
        reasoning: item.ly_do ?? '',
      }));
    }
    onProgress?.('CLASSIFY', `${classifications.size}/${tasks.length}`);
  }

  // ── GĐ4: phân xử cặp tên gần giống bị xếp khác nghiệp vụ ──────────
  const reconciled = await reconcileConflicts(deptName, areas, tasks, assignments, (t) => {
    totalTokens += t;
  });
  if (reconciled.length > 0) onProgress?.('RECONCILE', `sửa ${reconciled.length} mục`);

  const unassigned = tasks.map((t) => t.name).filter((n) => !assignments.has(n));

  return {
    areas,
    assignments: [...assignments.values()],
    classifications: [...classifications.values()],
    unassigned,
    reconciled,
    totalTokens,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Đối chiếu phân loại của AI với chuỗi tiến độ thật.
 *
 * AI có xu hướng gán CUMULATIVE cho mọi thứ nghe như dự án ("Triển khai dự án
 * Core Switch") dù chuỗi tiến độ chỉ có đúng một giá trị. Đo trên CNTT: 43/50
 * mục gán CUMULATIVE không hề có tiến độ tăng dần.
 *
 * Prompt đã nêu quy tắc, nhưng không thể chỉ tin prompt — chuỗi số là bằng chứng
 * kiểm chứng được, nên kiểm bằng code.
 */
function verifyClassification(task: TaskContext, ai: TaskClassification): TaskClassification {
  const series = task.progressSeries ?? [];
  const distinct = new Set(series).size;

  if (ai.taskType === 'CUMULATIVE') {
    // Không có dữ liệu tiến độ thì không thể là tiến độ tích luỹ.
    if (series.length === 0) {
      return {
        ...ai,
        taskType: 'MILESTONE',
        progressMeaning: 'MEANINGLESS',
        confidence: Math.min(ai.confidence, 0.5),
        reasoning: `${ai.reasoning} [tự sửa: không có số tiến độ nào]`,
      };
    }

    // Một giá trị duy nhất, hoặc cố định dài ngày — không phải tích luỹ.
    if (distinct < MIN_DISTINCT_PROGRESS_FOR_CUMULATIVE) {
      const isFlat = distinct === 1 && series.length >= FLAT_SERIES_MIN_LENGTH;
      const allComplete = series.every((p) => p === 100);
      return {
        ...ai,
        taskType: isFlat && !allComplete ? 'UNRELIABLE' : allComplete ? 'RECURRING' : 'MILESTONE',
        progressMeaning: allComplete ? 'WEEKLY_DONE' : 'MEANINGLESS',
        confidence: Math.min(ai.confidence, 0.5),
        reasoning: `${ai.reasoning} [tự sửa: chuỗi tiến độ chỉ có ${distinct} giá trị khác nhau]`,
      };
    }
  }

  return ai;
}

/**
 * Tìm các cặp tên gần giống nhưng bị xếp khác nghiệp vụ, rồi để AI phân xử.
 *
 * Không tự sửa bằng quy tắc "chọn bản tin cậy cao hơn" — đã kiểm chứng là sai:
 * `Hỗ trợ kỹ thuật và lắp đặt thiết bị CNTT` và `Hỗ trợ lắp đặt thiết bị CNTT`
 * tên gần giống nhưng THẬT SỰ thuộc hai nghiệp vụ khác nhau (một cái lắp thiết bị
 * mạng nội bộ, cái kia hỗ trợ sự kiện bên ngoài).
 */
async function reconcileConflicts(
  deptName: string,
  areas: BusinessArea[],
  tasks: readonly TaskContext[],
  assignments: Map<string, TaskAssignment>,
  addTokens: (tokens: number) => void,
): Promise<GroupingResult['reconciled']> {
  const byName = new Map(tasks.map((t) => [t.name, t]));
  const names = [...assignments.keys()];
  const conflicts: Array<{ a: TaskContext; b: TaskContext }> = [];

  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const a = assignments.get(names[i])!;
      const b = assignments.get(names[j])!;
      if (a.areaIndex === b.areaIndex) continue;

      const sim = similarity(normalizeName(names[i]), normalizeName(names[j]));
      if (sim < NAME_SIMILARITY_THRESHOLD) continue;

      const ta = byName.get(names[i]);
      const tb = byName.get(names[j]);
      if (ta && tb) conflicts.push({ a: ta, b: tb });
    }
  }

  if (conflicts.length === 0) return [];

  const res = await callJson<{
    quyet_dinh: Array<{ ten: string; nghiep_vu: number; do_tin_cay?: number; ly_do?: string }>;
  }>(buildReconcilePrompt(deptName, areas, conflicts));
  addTokens(res.usage.totalTokens);

  const changes: GroupingResult['reconciled'] = [];
  for (const d of res.data.quyet_dinh ?? []) {
    const current = assignments.get(d.ten);
    const area = areas[d.nghiep_vu];
    if (!current || !area || current.areaIndex === d.nghiep_vu) continue;

    changes.push({
      taskName: d.ten,
      from: current.areaName,
      to: area.ten,
      reasoning: d.ly_do ?? '',
    });
    assignments.set(d.ten, {
      ...current,
      areaIndex: d.nghiep_vu,
      areaName: area.ten,
      confidence: d.do_tin_cay ?? current.confidence,
      reasoning: d.ly_do ?? current.reasoning,
    });
  }

  return changes;
}
