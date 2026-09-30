// LLM client cho chatbot — giao thức tương thích OpenAI (chat/completions).
//
// Nhà cung cấp chính là Z.AI (GLM). DeepSeek giữ lại làm dự phòng khi chưa có
// ZAI_API_KEY. Không kéo SDK: phần cần dùng rất nhỏ, fetch là đủ.
//
// Hai vai trò model tách riêng vì yêu cầu khác nhau:
//   - planner: sinh SQL — cần chính xác, ngắn, nhiệt độ thấp.
//   - writer : viết câu trả lời cho người đọc — cần tự nhiên, trình bày tốt.
// Mặc định cả hai là cùng một model; tách được qua ZAI_PLANNER_MODEL.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface LlmCompletion {
  content: string;
  usage: LlmUsage;
}

export type LlmRole = 'planner' | 'writer';

/**
 * Loại lỗi — để route báo người dùng đúng nguyên nhân thay vì "Có lỗi xảy ra".
 *
 * Trước đây khi DeepSeek hết tiền (HTTP 402), người dùng chỉ thấy câu chung
 * chung, route không ghi log ra Railway, và mất gần 3 tuần mới biết nguyên nhân.
 */
export type LlmErrorKind = 'quota' | 'rate_limit' | 'auth' | 'timeout' | 'config' | 'upstream';

export class LlmError extends Error {
  constructor(
    public readonly kind: LlmErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

interface ProviderConfig {
  name: 'zai' | 'deepseek';
  baseUrl: string;
  apiKey: string;
  plannerModel: string;
  writerModel: string;
  /** GLM bật "thinking" mặc định — tắt để giảm độ trễ, SQL không cần suy luận dài. */
  disableThinking: boolean;
}

const ZAI_DEFAULT_BASE_URL = 'https://api.z.ai/api/paas/v4';
const ZAI_DEFAULT_MODEL = 'glm-4.5-air';
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_MODEL = 'deepseek-chat';

/** Hết thời gian chờ một lần gọi — tránh treo kết nối SSE của người dùng. */
const REQUEST_TIMEOUT_MS = 45_000;

/** Số lần thử lại khi bị giới hạn tốc độ; mỗi lần chờ gấp đôi. */
const MAX_RATE_LIMIT_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 800;

export function getProviderConfig(): ProviderConfig {
  const zaiKey = process.env.ZAI_API_KEY;
  if (zaiKey) {
    const model = process.env.ZAI_MODEL || ZAI_DEFAULT_MODEL;
    return {
      name: 'zai',
      baseUrl: (process.env.ZAI_BASE_URL || ZAI_DEFAULT_BASE_URL).replace(/\/$/, ''),
      apiKey: zaiKey,
      plannerModel: process.env.ZAI_PLANNER_MODEL || model,
      writerModel: model,
      disableThinking: true,
    };
  }
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    return {
      name: 'deepseek',
      baseUrl: DEEPSEEK_BASE_URL,
      apiKey: deepseekKey,
      plannerModel: DEEPSEEK_MODEL,
      writerModel: DEEPSEEK_MODEL,
      disableThinking: false,
    };
  }
  throw new LlmError('config', 'Chưa cấu hình ZAI_API_KEY (hoặc DEEPSEEK_API_KEY)');
}

/** Tên nhà cung cấp + model đang dùng — ghi vào audit log để truy vết. */
export function describeProvider(role: LlmRole = 'writer'): string {
  try {
    const cfg = getProviderConfig();
    return `${cfg.name}/${role === 'planner' ? cfg.plannerModel : cfg.writerModel}`;
  } catch {
    return 'unconfigured';
  }
}

/**
 * Phân loại lỗi HTTP từ nhà cung cấp.
 *
 * Z.AI trả mã nghiệp vụ trong body: 1113 = hết số dư, 1302/1303 = quá tốc độ.
 * DeepSeek dùng HTTP 402 cho hết số dư. Cả hai đều dùng 429 cho quá tốc độ.
 */
export function classifyHttpError(status: number, body: string): LlmErrorKind {
  if (status === 402 || /\b1113\b|insufficient balance|余额不足/i.test(body)) return 'quota';
  if (status === 429 || /\b130[1-5]\b|rate limit/i.test(body)) return 'rate_limit';
  if (status === 401 || status === 403) return 'auth';
  return 'upstream';
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post(body: Record<string, unknown>, role: LlmRole): Promise<Response> {
  const cfg = getProviderConfig();
  const payload: Record<string, unknown> = {
    ...body,
    model: role === 'planner' ? cfg.plannerModel : cfg.writerModel,
  };
  if (cfg.disableThinking) payload.thinking = { type: 'disabled' };

  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new LlmError('timeout', `${cfg.name} không phản hồi sau ${REQUEST_TIMEOUT_MS / 1000}s`);
      }
      throw new LlmError('upstream', `${cfg.name} lỗi mạng: ${err instanceof Error ? err.message : err}`);
    }
    clearTimeout(timer);
    if (res.ok) return res;

    const text = await res.text();
    const kind = classifyHttpError(res.status, text);
    // Chỉ thử lại khi bị giới hạn tốc độ: lỗi hết tiền / sai key thử lại vô ích.
    if (kind === 'rate_limit' && attempt < MAX_RATE_LIMIT_RETRIES) {
      await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
      continue;
    }
    throw new LlmError(kind, `${cfg.name} ${res.status}: ${text.slice(0, 200)}`, res.status);
  }
}

interface CompletionResponse {
  choices: Array<{ message: { content: string | null } }>;
  usage?: LlmUsage;
}

const EMPTY_USAGE: LlmUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

/** Gọi một lần, không stream — dùng cho sinh SQL (đầu ra ngắn, cần trọn vẹn). */
export async function llmComplete(
  messages: ChatMessage[],
  opts: { role?: LlmRole; maxTokens?: number; temperature?: number } = {},
): Promise<LlmCompletion> {
  const res = await post(
    {
      messages,
      max_tokens: opts.maxTokens ?? 800,
      temperature: opts.temperature ?? 0.1,
      stream: false,
    },
    opts.role ?? 'planner',
  );
  const json = (await res.json()) as CompletionResponse;
  return {
    content: json.choices?.[0]?.message?.content ?? '',
    usage: json.usage ?? EMPTY_USAGE,
  };
}

/**
 * Gọi và ép trả JSON — dùng cho các luồng nhập báo cáo bằng AI.
 *
 * Bóc hàng rào ```json nếu model vẫn bọc, rồi parse. Lỗi parse ném LlmError
 * kèm đoạn đầu nội dung để dễ chẩn đoán.
 */
export async function llmJson<T>(
  messages: ChatMessage[],
  opts: { role?: LlmRole; maxTokens?: number; temperature?: number } = {},
): Promise<{ data: T; usage: LlmUsage }> {
  const res = await post(
    {
      messages,
      max_tokens: opts.maxTokens ?? 4000,
      temperature: opts.temperature ?? 0,
      stream: false,
      response_format: { type: 'json_object' },
    },
    opts.role ?? 'planner',
  );
  const json = (await res.json()) as CompletionResponse;
  const raw = (json.choices?.[0]?.message?.content ?? '').trim();
  const body = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return { data: JSON.parse(body) as T, usage: json.usage ?? EMPTY_USAGE };
  } catch {
    throw new LlmError('upstream', `AI trả JSON không hợp lệ: ${raw.slice(0, 160)}`);
  }
}

/**
 * Stream câu trả lời theo từng mảnh.
 *
 * Trả về tổng token qua callback onUsage (nhà cung cấp gửi usage ở gói cuối
 * khi bật stream_options.include_usage).
 */
export async function* llmStream(
  messages: ChatMessage[],
  opts: { role?: LlmRole; maxTokens?: number; temperature?: number; onUsage?: (u: LlmUsage) => void } = {},
): AsyncGenerator<string, void, void> {
  const res = await post(
    {
      messages,
      max_tokens: opts.maxTokens ?? 800,
      temperature: opts.temperature ?? 0.3,
      stream: true,
      stream_options: { include_usage: true },
    },
    opts.role ?? 'writer',
  );
  if (!res.body) throw new LlmError('upstream', 'Phản hồi stream rỗng');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const json = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string | null } }>;
          usage?: LlmUsage;
        };
        if (json.usage && opts.onUsage) opts.onUsage(json.usage);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Bỏ qua dòng hỏng — nhà cung cấp thỉnh thoảng gửi khung keep-alive.
      }
    }
  }
}

/**
 * Tách SQL khỏi câu trả lời của model. Model được dặn bọc trong <sql>...</sql>,
 * nhưng vẫn chấp nhận code block để chịu được model lệch hướng dẫn.
 */
export function extractSql(content: string): string | null {
  const tagMatch = content.match(/<sql>([\s\S]*?)<\/sql>/i);
  if (tagMatch) return tagMatch[1].trim();
  const codeMatch = content.match(/```sql\s*([\s\S]*?)\s*```/i);
  if (codeMatch) return codeMatch[1].trim();
  const genericCode = content.match(/```\s*(SELECT[\s\S]*?)\s*```/i);
  if (genericCode) return genericCode[1].trim();
  const bare = content.trim();
  if (/^(WITH|SELECT)\b/i.test(bare)) return bare.replace(/;\s*$/, '');
  return null;
}

/** Thông báo thân thiện cho người dùng theo loại lỗi. */
export function userMessageFor(err: unknown, isAdmin: boolean): string {
  if (!(err instanceof LlmError)) return 'Có lỗi xảy ra. Vui lòng thử lại sau.';
  switch (err.kind) {
    case 'quota':
      return isAdmin
        ? 'Tài khoản AI đã hết số dư — cần nạp thêm credit ở trang quản lý của nhà cung cấp (Z.AI).'
        : 'Trợ lý AI đang tạm ngưng do hết hạn mức sử dụng. Vui lòng báo quản trị viên.';
    case 'rate_limit':
      return 'Trợ lý AI đang quá tải. Bạn thử lại sau ít giây nhé.';
    case 'auth':
      return isAdmin
        ? 'Khoá API của AI không hợp lệ hoặc đã bị thu hồi — kiểm tra biến ZAI_API_KEY.'
        : 'Trợ lý AI đang gặp sự cố cấu hình. Vui lòng báo quản trị viên.';
    case 'timeout':
      return 'AI phản hồi quá lâu. Bạn thử lại, hoặc hỏi gọn hơn.';
    case 'config':
      return isAdmin
        ? 'Chưa cấu hình khoá API cho trợ lý AI (ZAI_API_KEY).'
        : 'Trợ lý AI chưa được cấu hình. Vui lòng báo quản trị viên.';
    default:
      return 'AI đang gặp sự cố tạm thời. Vui lòng thử lại sau.';
  }
}
