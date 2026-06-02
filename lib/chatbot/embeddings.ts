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
const GEMINI_MODEL = 'text-embedding-004';

function getProvider(): 'openai' | 'gemini' | null {
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.GOOGLE_API_KEY) return 'gemini';
  return null;
}

async function embedOpenAi(inputs: string[]): Promise<number[][]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: OPENAI_MODEL, input: inputs }),
  });
  if (!res.ok) throw new Error(`OpenAI embed ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
}

async function embedGemini(inputs: string[]): Promise<number[][]> {
  // Gemini's embedding API accepts one input at a time but is fast.
  // Limit concurrency to be polite.
  const out: number[][] = [];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent?key=${process.env.GOOGLE_API_KEY}`;
  for (const input of inputs) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text: input }] } }),
    });
    if (!res.ok) throw new Error(`Gemini embed ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { embedding: { values: number[] } };
    out.push(json.embedding.values);
  }
  return out;
}

async function embedBatch(inputs: string[]): Promise<{ vectors: number[][]; model: string }> {
  const provider = getProvider();
  if (!provider) throw new Error('No embedding API key configured (OPENAI_API_KEY or GOOGLE_API_KEY)');
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
