/**
 * Trích số liệu định lượng từ ô "Kết quả thực hiện" — giai đoạn 5 của pipeline.
 *
 * Báo cáo chữ có rất nhiều số bị chôn trong văn bản:
 *   "Tiếp nhận 278 văn bản đến, xử lý đúng hạn 277/278 (99,6%)"
 *   "Tính đến ngày 18/4/2026, Bệnh viện đã triển khai 09 ca ghép tim"
 * Chỉ 3 tuần mẫu đã có 91 ô chứa số. Không trích ra thì không lọc, không vẽ
 * biểu đồ, không so sánh giữa các tuần được.
 *
 * Xem docs/HOSPITAL-REPORT-PIPELINE.md.
 */
import { callJson } from './zai';
import { buildMetricPrompt } from './prompts';

/** Số ô mỗi lô. Nhỏ hơn lô phân loại vì văn bản kết quả dài hơn nhiều. */
const METRIC_BATCH_SIZE = 6;

/** Dưới ngưỡng này thì đánh dấu cần người duyệt kỹ. */
export const METRIC_CONFIDENCE_THRESHOLD = 0.7;

/** Lệch quá tỷ lệ này so với trung bình các tuần trước thì gắn cờ bất thường. */
const ANOMALY_RATIO = 0.5;

/** Cần ít nhất bấy nhiêu tuần lịch sử mới so sánh được. */
const MIN_HISTORY_FOR_ANOMALY = 3;

export type MetricPeriod = 'WEEK' | 'CUMULATIVE' | 'MONTH' | 'QUARTER' | 'YEAR';

export interface ExtractedMetricDraft {
  taskName: string;
  name: string;
  value: number;
  unit: string | null;
  period: MetricPeriod;
  asOfDate: string | null;
  sourceText: string;
  confidence: number;
  flags: string[];
}

export interface MetricExtractionInput {
  taskName: string;
  resultText: string;
}

export interface MetricExtractionResult {
  metrics: ExtractedMetricDraft[];
  /** Ô AI không trả kết quả — cần xem lại thủ công. */
  missedItems: string[];
  totalTokens: number;
  durationMs: number;
}

/** Số liệu lịch sử để phát hiện bất thường. */
export interface MetricHistory {
  /** name → các giá trị đã ghi nhận ở tuần trước, mới nhất trước. */
  byName: Map<string, number[]>;
}

interface RawMetric {
  ten?: string;
  gia_tri?: number;
  don_vi?: string | null;
  ky?: string;
  tinh_den_ngay?: string | null;
  trich_tu?: string;
  do_tin_cay?: number;
}

const VALID_PERIODS = new Set<MetricPeriod>(['WEEK', 'CUMULATIVE', 'MONTH', 'QUARTER', 'YEAR']);

function normalizePeriod(raw: string | undefined): MetricPeriod {
  const value = (raw ?? '').toUpperCase() as MetricPeriod;
  return VALID_PERIODS.has(value) ? value : 'WEEK';
}

/** Ngày hợp lệ dạng YYYY-MM-DD; AI đôi khi trả chuỗi rỗng hoặc "null". */
function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw || raw === 'null') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

/**
 * Trích số liệu từ các ô kết quả.
 *
 * Chỉ gọi AI cho ô có chứa chữ số — ô toàn văn bản mô tả thì bỏ qua, tiết kiệm
 * đáng kể token vì phần lớn ô không có số liệu.
 */
export async function extractMetrics(
  deptName: string,
  items: readonly MetricExtractionInput[],
  history?: MetricHistory,
): Promise<MetricExtractionResult> {
  const startedAt = Date.now();

  const candidates = items.filter((it) => /\d/.test(it.resultText));
  const metrics: ExtractedMetricDraft[] = [];
  const missedItems: string[] = [];
  let totalTokens = 0;

  for (let i = 0; i < candidates.length; i += METRIC_BATCH_SIZE) {
    const batch = candidates.slice(i, i + METRIC_BATCH_SIZE);

    const res = await callJson<{
      ket_qua: Array<{ stt: number; so_lieu?: RawMetric[] }>;
    }>(buildMetricPrompt(deptName, [...batch]));
    totalTokens += res.usage.totalTokens;

    const seen = new Set<number>();
    for (const item of res.data.ket_qua ?? []) {
      const source = batch[item.stt];
      if (!source) continue;
      seen.add(item.stt);

      for (const raw of item.so_lieu ?? []) {
        const draft = toDraft(source.taskName, raw);
        if (draft) metrics.push(draft);
      }
    }

    // Ô nào AI bỏ sót thì ghi lại, đừng im lặng bỏ qua.
    batch.forEach((it, idx) => {
      if (!seen.has(idx)) missedItems.push(it.taskName);
    });
  }

  if (history) flagAnomalies(metrics, history);

  return { metrics, missedItems, totalTokens, durationMs: Date.now() - startedAt };
}

function toDraft(taskName: string, raw: RawMetric): ExtractedMetricDraft | null {
  const name = (raw.ten ?? '').trim();
  const value = raw.gia_tri;

  // Bỏ mục thiếu tên hoặc giá trị không phải số — thà mất một metric còn hơn
  // ghi rác vào database.
  if (!name || typeof value !== 'number' || !Number.isFinite(value)) return null;

  const confidence = raw.do_tin_cay ?? 0;
  const flags: string[] = [];
  if (confidence < METRIC_CONFIDENCE_THRESHOLD) flags.push('LOW_CONFIDENCE');

  const period = normalizePeriod(raw.ky);
  const asOfDate = normalizeDate(raw.tinh_den_ngay);

  // Số luỹ kế mà không biết tính đến ngày nào thì khó đối chiếu về sau.
  if (period === 'CUMULATIVE' && !asOfDate) flags.push('CUMULATIVE_NO_DATE');

  return {
    taskName,
    name,
    value,
    unit: raw.don_vi?.trim() || null,
    period,
    asOfDate,
    sourceText: (raw.trich_tu ?? '').trim(),
    confidence,
    flags,
  };
}

/**
 * Gắn cờ số liệu lệch bất thường so với lịch sử.
 *
 * Hai kiểu bất thường:
 *   - Lệch >50% so với trung bình các tuần trước
 *   - Số luỹ kế GIẢM so với tuần trước (bất khả thi)
 */
function flagAnomalies(metrics: ExtractedMetricDraft[], history: MetricHistory): void {
  for (const metric of metrics) {
    const past = history.byName.get(metric.name);
    if (!past || past.length < MIN_HISTORY_FOR_ANOMALY) continue;

    if (metric.period === 'CUMULATIVE' && metric.value < past[0]) {
      metric.flags.push('CUMULATIVE_DECREASED');
      continue;
    }

    const average = past.reduce((sum, v) => sum + v, 0) / past.length;
    if (average === 0) continue;

    const deviation = Math.abs(metric.value - average) / Math.abs(average);
    if (deviation > ANOMALY_RATIO) metric.flags.push('VALUE_ANOMALY');
  }
}

/** Dựng lịch sử từ các metric đã duyệt của những tuần trước. */
export function buildHistory(
  previous: ReadonlyArray<{ name: string; value: number }>,
): MetricHistory {
  const byName = new Map<string, number[]>();
  for (const item of previous) {
    const list = byName.get(item.name) ?? [];
    list.push(item.value);
    byName.set(item.name, list);
  }
  return { byName };
}
