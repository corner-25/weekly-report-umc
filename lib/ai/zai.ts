/**
 * Client gọi zAI (Zhipu GLM) cho pipeline trích xuất báo cáo tuần.
 *
 * Kiểm chứng trên dữ liệu thật (xem docs/HOSPITAL-REPORT-PIPELINE.md mục 5):
 *   - glm-4.5 không bật thinking cho kết quả tốt nhất ở tác vụ phân loại
 *   - Bật thinking khiến model tiêu hết token cho suy luận rồi trả rỗng, và khi
 *     tăng token thì gom quá thô và BỊA ra tên không có trong danh sách
 *   - Chia lô nhỏ (12 mục) chính xác hơn hẳn đưa cả 143 mục một lần
 */

const API_URL = 'https://api.z.ai/api/paas/v4/chat/completions';

/** Mặc định cho tác vụ phân loại: cần ổn định, không cần sáng tạo. */
const DEFAULT_MODEL = 'glm-4.5';
const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_TOKENS = 16000;

/** Gọi AI có thể chậm; giới hạn để không treo cả pipeline. */
const REQUEST_TIMEOUT_MS = 300_000;

/** Số lần thử lại khi lỗi tạm thời (429, 5xx, timeout). */
const MAX_RETRIES = 3;

export interface ZaiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ZaiResult<T> {
  data: T;
  usage: ZaiUsage;
  durationMs: number;
  model: string;
}

export class ZaiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'ZaiError';
  }
}

function getApiKey(): string {
  const key = process.env.ZAI_API_KEY;
  if (!key) {
    throw new ZaiError('Biến môi trường ZAI_API_KEY chưa được đặt');
  }
  return key;
}

interface CallOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Bật suy luận. Mặc định TẮT — xem ghi chú đầu file. */
  thinking?: boolean;
}

/**
 * Gọi model và parse JSON trả về.
 *
 * Prompt phải yêu cầu rõ định dạng JSON; hàm này đặt `response_format` để model
 * không trả kèm văn bản giải thích.
 */
export async function callJson<T>(prompt: string, options: CallOptions = {}): Promise<ZaiResult<T>> {
  const model = options.model ?? DEFAULT_MODEL;
  const startedAt = Date.now();

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: options.temperature ?? DEFAULT_TEMPERATURE,
    response_format: { type: 'json_object' },
  };

  // Mặc định tắt thinking. Ở tác vụ phân loại có ràng buộc chặt, bật vào làm
  // giảm chất lượng và tốn token.
  if (!options.thinking) {
    body.thinking = { type: 'disabled' };
  }

  let lastError: ZaiError | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const res = await fetchWithTimeout(body);
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        error?: { message?: string };
      };

      if (!res.ok) {
        const message = json.error?.message ?? `HTTP ${res.status}`;
        // 429 và 5xx là lỗi tạm thời, thử lại được.
        throw new ZaiError(message, res.status, res.status === 429 || res.status >= 500);
      }

      const choice = json.choices?.[0];
      const content = choice?.message?.content;

      if (!content) {
        // Thường gặp khi model tiêu hết token cho reasoning — tăng maxTokens
        // hoặc tắt thinking.
        throw new ZaiError(
          `Model trả nội dung rỗng (finish_reason=${choice?.finish_reason ?? '?'}). ` +
            'Nhiều khả năng hết token; thử tăng maxTokens hoặc tắt thinking.',
          undefined,
          false,
        );
      }

      return {
        data: parseJsonContent<T>(content),
        usage: {
          promptTokens: json.usage?.prompt_tokens ?? 0,
          completionTokens: json.usage?.completion_tokens ?? 0,
          totalTokens: json.usage?.total_tokens ?? 0,
        },
        durationMs: Date.now() - startedAt,
        model,
      };
    } catch (error) {
      lastError = toZaiError(error);
      if (!lastError.retryable || attempt === MAX_RETRIES) break;

      // Lùi dần: 2s, 4s, 8s
      await sleep(2000 * 2 ** (attempt - 1));
    }
  }

  throw lastError ?? new ZaiError('Gọi zAI thất bại không rõ lý do');
}

async function fetchWithTimeout(body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Model đôi khi bọc JSON trong ```json … ``` dù đã yêu cầu json_object. */
function parseJsonContent<T>(content: string): T {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new ZaiError(`Không parse được JSON từ model: ${cleaned.slice(0, 200)}`);
  }
}

function toZaiError(error: unknown): ZaiError {
  if (error instanceof ZaiError) return error;
  if (error instanceof Error) {
    // AbortError = timeout, thử lại được.
    const retryable = error.name === 'AbortError' || error.name === 'TypeError';
    return new ZaiError(error.message, undefined, retryable);
  }
  return new ZaiError(String(error));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chạy nhiều lô tuần tự, gom kết quả.
 *
 * Tuần tự chứ không song song: zAI giới hạn tốc độ, và chạy song song làm khó
 * truy nguyên khi một lô trả kết quả lạ.
 */
export async function runBatches<TItem, TResult>(
  items: readonly TItem[],
  batchSize: number,
  handler: (batch: TItem[], index: number) => Promise<ZaiResult<TResult>>,
): Promise<{ results: TResult[]; totalTokens: number; durationMs: number }> {
  const startedAt = Date.now();
  const results: TResult[] = [];
  let totalTokens = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const result = await handler(batch, i / batchSize);
    results.push(result.data);
    totalTokens += result.usage.totalTokens;
  }

  return { results, totalTokens, durationMs: Date.now() - startedAt };
}
