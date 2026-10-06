// Provider-agnostic embedding layer + in-memory ANN search for metric names.
// We embed ~200 (metric_name, department_name) pairs once a day, store the
// vectors in process memory, and at query time find the top-K cosine-similar
// entries to feed back into the SQL-generation prompt as hints.

import { getPrismaRo } from '@/lib/prisma-ro';

interface MetricVector {
  metric: string;
  department: string;
  /** Số tuần có dữ liệu — 1 tuần là con số rời, nhiều tuần là chuỗi theo dõi. */
  weeks: number | null;
  /** Tuần cuối có dữ liệu, dạng 202640. */
  lastYearWeek: number | null;
  /** Chỉ số chuẩn (cây cha/con, v_chatbot_metric_facts); metric là đường dẫn đầy đủ. */
  standard: boolean;
  /** Float32 thay vì number[] — 2.544 chỉ số × 2.048 chiều chỉ còn ~20MB. */
  vec: Float32Array;
}

interface CachedEmbeddings {
  fetchedAt: number;
  model: string;
  items: MetricVector[];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cache: CachedEmbeddings | null = null;

// -----------------------------------------------------------------------------
// Provider: Gemini (free tier). Switches to OpenAI when OPENAI_API_KEY is set.
// -----------------------------------------------------------------------------

const OPENAI_MODEL = 'text-embedding-3-small';
const GEMINI_MODEL = 'gemini-embedding-001';

/**
 * Qwen (Alibaba DashScope) — ưu tiên dùng vì hiểu tiếng Việt tốt hơn.
 *
 * zAI không có API embedding: thử `embedding-2`, `embedding-3` trên cả
 * api.z.ai lẫn open.bigmodel.cn đều trả "Unknown Model", và danh sách model của
 * key chỉ có 9 model chat GLM.
 *
 * DashScope dùng giao thức tương thích OpenAI nên tái sử dụng được cùng một
 * hàm gọi, chỉ khác URL và tên model.
 */
const QWEN_API_KEY = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
const QWEN_MODEL = process.env.QWEN_EMBEDDING_MODEL || 'text-embedding-v4';
/** Số chiều vector; để trống thì dùng mặc định của model (1024). */
const QWEN_DIMENSIONS = Number(process.env.QWEN_EMBEDDING_DIMENSIONS) || undefined;
const QWEN_TIMEOUT_MS = Number(process.env.QWEN_EMBEDDING_TIMEOUT_MS) || 60_000;
const QWEN_MAX_RETRIES = Number(process.env.QWEN_EMBEDDING_MAX_RETRIES) || 3;

/**
 * Số dòng tối đa mỗi lần gọi DashScope — tuỳ model.
 *
 * Đo trực tiếp 30/09/2026: text-embedding-v4 chỉ nhận tối đa 10 dòng (11+ trả
 * "batch size is invalid"); qwen3.7-text-embedding nhận được 20.
 */
const QWEN_BATCH_SIZE = Number(process.env.QWEN_EMBEDDING_BATCH) || 10;
const QWEN_BASE_URL = (
  process.env.QWEN_EMBEDDING_BASE_URL ||
  process.env.DASHSCOPE_BASE_URL ||
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
).replace(/\/$/, '');

function getProvider(): 'qwen' | 'openai' | 'gemini' | null {
  // Qwen trước: hiểu tiếng Việt tốt hơn cho tên chỉ số bệnh viện.
  if (QWEN_API_KEY) return 'qwen';
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.GOOGLE_API_KEY) return 'gemini';
  return null;
}

/**
 * Gọi API embedding theo giao thức OpenAI.
 *
 * Dùng chung cho OpenAI và DashScope — hai bên cùng nhận `{model, input}` và
 * trả `{data: [{embedding}]}`.
 */
async function embedOpenAiCompatible(
  inputs: string[],
  options: {
    baseUrl: string; apiKey: string; model: string; label: string;
    dimensions?: number; timeoutMs?: number; maxRetries?: number;
  },
): Promise<number[][]> {
  const body: Record<string, unknown> = { model: options.model, input: inputs };
  if (options.dimensions) body.dimensions = options.dimensions;
  const maxRetries = options.maxRetries ?? 0;

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);
    try {
      const res = await fetch(`${options.baseUrl}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.apiKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.ok) {
        const json = (await res.json()) as { data: Array<{ embedding: number[]; index?: number }> };
        // Sắp theo index để chắc thứ tự vector khớp thứ tự đầu vào.
        return [...json.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map((d) => d.embedding);
      }
      const text = await res.text();
      // Chỉ thử lại lỗi tạm thời (quá tải / lỗi máy chủ); lỗi 4xx khác thử lại vô ích.
      const transient = res.status === 429 || res.status >= 500;
      if (!transient || attempt >= maxRetries) {
        throw new Error(`${options.label} embed ${res.status}: ${text.slice(0, 200)}`);
      }
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      if (!aborted || attempt >= maxRetries) {
        throw aborted ? new Error(`${options.label} embed quá thời gian chờ`) : err;
      }
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
}

async function embedOpenAi(inputs: string[]): Promise<number[][]> {
  return embedOpenAiCompatible(inputs, {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY!,
    model: OPENAI_MODEL,
    label: 'OpenAI',
  });
}

/** Số lô gọi song song. DashScope chịu được; tuần tự thì 2.544 chỉ số mất ~107s. */
const QWEN_CONCURRENCY = 4;

async function embedQwen(inputs: string[]): Promise<number[][]> {
  const chunks: string[][] = [];
  for (let i = 0; i < inputs.length; i += QWEN_BATCH_SIZE) chunks.push(inputs.slice(i, i + QWEN_BATCH_SIZE));
  const results: number[][][] = new Array(chunks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(QWEN_CONCURRENCY, chunks.length) }, async () => {
      while (next < chunks.length) {
        const idx = next++;
        results[idx] = await embedQwenChunk(chunks[idx]);
      }
    }),
  );
  return results.flat();
}

async function embedQwenChunk(chunk: string[]): Promise<number[][]> {
  return embedOpenAiCompatible(chunk, {
    baseUrl: QWEN_BASE_URL,
    apiKey: QWEN_API_KEY!,
    model: QWEN_MODEL,
    label: 'Qwen',
    dimensions: QWEN_DIMENSIONS,
    timeoutMs: QWEN_TIMEOUT_MS,
    maxRetries: QWEN_MAX_RETRIES,
  });
}

async function embedGemini(inputs: string[]): Promise<number[][]> {
  // Gemini's embedding API accepts one input at a time but is fast.
  // Authenticated via the X-goog-api-key header (works for both AIza* and
  // AQ.* style keys).
  const out: number[][] = [];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent`;
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY is not configured');
  for (const input of inputs) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify({ content: { parts: [{ text: input }] } }),
    });
    if (!res.ok) throw new Error(`Gemini embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = (await res.json()) as { embedding: { values: number[] } };
    out.push(json.embedding.values);
  }
  return out;
}

async function embedBatch(inputs: string[]): Promise<{ vectors: number[][]; model: string }> {
  const provider = getProvider();
  if (!provider) {
    throw new Error(
      'Chưa cấu hình key embedding (QWEN_API_KEY/DASHSCOPE_API_KEY, OPENAI_API_KEY hoặc GOOGLE_API_KEY)',
    );
  }
  if (provider === 'qwen') {
    return { vectors: await embedQwen(inputs), model: `qwen/${QWEN_MODEL}` };
  }
  if (provider === 'openai') {
    return { vectors: await embedOpenAi(inputs), model: `openai/${OPENAI_MODEL}` };
  }
  return { vectors: await embedGemini(inputs), model: `gemini/${GEMINI_MODEL}` };
}

// -----------------------------------------------------------------------------
// Cosine similarity
// -----------------------------------------------------------------------------

function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Returns true if at least one embedding provider key is set.
 * Callers should fall back to the keyword-only flow when this is false.
 */
export function embeddingsAvailable(): boolean {
  return getProvider() !== null;
}

/** Nhúng nhiều đoạn văn (dùng cho kho tri thức chatbot); trả vector cùng thứ tự và tên model. */
export async function embedTexts(inputs: string[]): Promise<{ vectors: number[][]; model: string }> {
  return embedBatch(inputs);
}

/**
 * Build / refresh the in-process cache of metric vectors. Pulls the distinct
 * (metric_name, department_name) pairs from v_chatbot_metrics, embeds each
 * one as "metric_name (department_name)", and stores the vectors.
 *
 * Subsequent calls within CACHE_TTL_MS return the cached set.
 */
export async function getMetricEmbeddings(force = false): Promise<CachedEmbeddings | null> {
  if (!embeddingsAvailable()) return null;
  if (!force && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache;
  return buildCache();
}

/** Promise build đang chạy — nhiều câu hỏi cùng lúc chỉ build một lần. */
let building: Promise<CachedEmbeddings> | null = null;

function buildCache(): Promise<CachedEmbeddings> {
  if (building) return building;
  building = (async () => {
    const t0 = Date.now();
    // Đọc từ danh mục để biết mỗi chỉ số có bao nhiêu tuần dữ liệu — gợi ý cho
    // model ưu tiên chuỗi thật thay vì con số rời chỉ xuất hiện một tuần.
    // Môi trường chưa có danh mục (chưa chạy migration) thì đọc thẳng v_chatbot_metrics.
    //
    // Tên thô đã gộp vào danh mục chuẩn được thay bằng chỉ số chuẩn: để lại chỉ
    // làm model chọn nhầm bảng thô — đo được: hỏi "văn bản theo dõi tiến độ"
    // model lấy v_chatbot_metrics và thiếu số "chưa xử lý". Con số rời chưa gắn
    // vào cây (standard_metric_path NULL) vẫn giữ để còn tìm được.
    type Row = { metric_name: string; department_name: string; weeks_with_data: number | null; last_year_week: number | null; standard: boolean };
    const rows = await getPrismaRo()
      .$queryRawUnsafe<Row[]>(
        `SELECT metric_path AS metric_name, department_name, NULL::int AS weeks_with_data, NULL::int AS last_year_week, true AS standard
           FROM v_chatbot_metric_tree WHERE kind = 'METRIC'
         UNION ALL
         SELECT metric_name, department_name, weeks_with_data, last_year_week, false
           FROM v_chatbot_metric_catalog
          WHERE standard_metric_path IS NULL
         ORDER BY 2, 1`,
      )
      .catch(() =>
        getPrismaRo().$queryRawUnsafe<Row[]>(
          'SELECT metric_name, department_name, weeks_with_data, last_year_week, false AS standard FROM v_chatbot_metric_catalog ORDER BY department_name, metric_name',
        ),
      )
      .catch(() =>
        getPrismaRo().$queryRawUnsafe<Row[]>(
          'SELECT DISTINCT metric_name, department_name, NULL::int AS weeks_with_data, NULL::int AS last_year_week, false AS standard FROM v_chatbot_metrics ORDER BY department_name, metric_name',
        ),
      );
    if (rows.length === 0) {
      cache = { fetchedAt: Date.now(), model: 'empty', items: [] };
      return cache;
    }
    const inputs = rows.map((r) => `${r.metric_name} (${r.department_name})`);
    const { vectors, model } = await embedBatch(inputs);
    cache = {
      fetchedAt: Date.now(),
      model,
      items: rows.map((r, i) => ({
        metric: r.metric_name, department: r.department_name,
        weeks: r.weeks_with_data ?? null, lastYearWeek: r.last_year_week ?? null, standard: r.standard,
        vec: Float32Array.from(vectors[i]),
      })),
    };
    console.info(`[chatbot] embedding ${rows.length} chỉ số bằng ${model} trong ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return cache;
  })().finally(() => {
    building = null;
  });
  return building;
}

/**
 * Kích hoạt build nền nếu cache chưa có hoặc đã cũ — KHÔNG chờ.
 *
 * Lần build đầu mất vài chục giây với ~2.500 chỉ số; bắt câu hỏi đầu tiên chờ
 * (trước đây 108s) là không chấp nhận được. Trong lúc build, câu hỏi vẫn được
 * trả lời, chỉ thiếu phần gợi ý tên chỉ số.
 */
export function warmMetricEmbeddings(): void {
  if (!embeddingsAvailable()) return;
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return;
  buildCache().catch((err) => console.warn('[chatbot] build embedding lỗi:', err instanceof Error ? err.message : err));
}

/**
 * Find the top-K metric/department pairs most relevant to the user question.
 * Returns an empty array if embeddings are not configured or the cache failed
 * to build — callers must handle that path gracefully.
 */
export async function findRelevantMetrics(
  question: string,
  k = 10,
): Promise<Array<{ metric: string; department: string; score: number; weeks: number | null; lastYearWeek: number | null; standard: boolean }>> {
  // Không chờ build: cache cũ vẫn dùng được trong lúc làm mới; chưa có thì bỏ qua.
  warmMetricEmbeddings();
  const cached = cache;
  if (!cached || cached.items.length === 0) return [];
  const { vectors } = await embedBatch([question]);
  const qVec = vectors[0];
  const scored = cached.items.map((item) => ({
    metric: item.metric,
    department: item.department,
    weeks: item.weeks,
    lastYearWeek: item.lastYearWeek,
    standard: item.standard,
    score: cosine(qVec, item.vec),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
