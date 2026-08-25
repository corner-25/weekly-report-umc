// Provider-agnostic embedding layer + in-memory ANN search for metric names.
// We embed ~200 (metric_name, department_name) pairs once a day, store the
// vectors in process memory, and at query time find the top-K cosine-similar
// entries to feed back into the SQL-generation prompt as hints.

import { getPrismaRo } from '@/lib/prisma-ro';

interface MetricVector {
  metric: string;
  department: string;
  vec: number[];
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
const QWEN_MODEL = 'text-embedding-v4';
const QWEN_BASE_URL =
  process.env.DASHSCOPE_BASE_URL ??
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

function getProvider(): 'qwen' | 'openai' | 'gemini' | null {
  // Qwen trước: hiểu tiếng Việt tốt hơn cho tên chỉ số bệnh viện.
  if (process.env.DASHSCOPE_API_KEY) return 'qwen';
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
  options: { baseUrl: string; apiKey: string; model: string; label: string },
): Promise<number[][]> {
  const res = await fetch(`${options.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({ model: options.model, input: inputs }),
  });
  if (!res.ok) {
    throw new Error(`${options.label} embed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
}

async function embedOpenAi(inputs: string[]): Promise<number[][]> {
  return embedOpenAiCompatible(inputs, {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY!,
    model: OPENAI_MODEL,
    label: 'OpenAI',
  });
}

async function embedQwen(inputs: string[]): Promise<number[][]> {
  return embedOpenAiCompatible(inputs, {
    baseUrl: QWEN_BASE_URL,
    apiKey: process.env.DASHSCOPE_API_KEY!,
    model: QWEN_MODEL,
    label: 'Qwen',
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
      'Chưa cấu hình key embedding (DASHSCOPE_API_KEY, OPENAI_API_KEY hoặc GOOGLE_API_KEY)',
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

function cosine(a: number[], b: number[]): number {
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

  const rows = await getPrismaRo().$queryRawUnsafe<Array<{ metric_name: string; department_name: string }>>(
    'SELECT DISTINCT metric_name, department_name FROM v_chatbot_metrics ORDER BY department_name, metric_name',
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
    items: rows.map((r, i) => ({ metric: r.metric_name, department: r.department_name, vec: vectors[i] })),
  };
  return cache;
}

/**
 * Find the top-K metric/department pairs most relevant to the user question.
 * Returns an empty array if embeddings are not configured or the cache failed
 * to build — callers must handle that path gracefully.
 */
export async function findRelevantMetrics(
  question: string,
  k = 10,
): Promise<Array<{ metric: string; department: string; score: number }>> {
  const cached = await getMetricEmbeddings();
  if (!cached || cached.items.length === 0) return [];
  const { vectors } = await embedBatch([question]);
  const qVec = vectors[0];
  const scored = cached.items.map((item) => ({
    metric: item.metric,
    department: item.department,
    score: cosine(qVec, item.vec),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}
