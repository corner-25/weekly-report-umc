// Minimal DeepSeek client (OpenAI-compatible REST API).
// We do not pull the openai SDK — the surface we need is tiny and fetch is sufficient.

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_CHAT_MODEL = 'deepseek-chat';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface DeepSeekCompletion {
  content: string;
  usage: DeepSeekUsage;
}

interface DeepSeekResponse {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: DeepSeekUsage;
}

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY is not configured');
  return key;
}

/**
 * Send a chat completion request to DeepSeek. Non-streaming.
 * Used for SQL generation (short output, deterministic).
 */
export async function deepseekComplete(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<DeepSeekCompletion> {
  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_CHAT_MODEL,
      messages,
      max_tokens: opts.maxTokens ?? 600,
      temperature: opts.temperature ?? 0.1,
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek error ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as DeepSeekResponse;
  const content = json.choices[0]?.message?.content ?? '';
  return { content, usage: json.usage };
}

/**
 * Stream a chat completion as SSE chunks. Used for the user-facing summary
 * answer so the UI can render the text token by token.
 *
 * Yields plain content strings; caller is responsible for forwarding to the
 * client (e.g. via a TransformStream).
 */
export async function* deepseekStream(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): AsyncGenerator<string, void, void> {
  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_CHAT_MODEL,
      messages,
      max_tokens: opts.maxTokens ?? 800,
      temperature: opts.temperature ?? 0.3,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text();
    throw new Error(`DeepSeek stream error ${res.status}: ${text.slice(0, 200)}`);
  }

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
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // Ignore malformed lines; DeepSeek occasionally sends keep-alive frames.
      }
    }
  }
}

/**
 * Extract a SQL statement from a model response. The model is instructed to
 * wrap its query in <sql>...</sql>, but we accept loose formats too.
 */
export function extractSql(content: string): string | null {
  const tagMatch = content.match(/<sql>([\s\S]*?)<\/sql>/i);
  if (tagMatch) return tagMatch[1].trim();
  const codeMatch = content.match(/```sql\s*([\s\S]*?)\s*```/i);
  if (codeMatch) return codeMatch[1].trim();
  const genericCode = content.match(/```\s*(SELECT[\s\S]*?)\s*```/i);
  if (genericCode) return genericCode[1].trim();
  // Last resort: take the first SELECT statement we can spot.
  const selectMatch = content.match(/(SELECT[\s\S]*?;)/i);
  if (selectMatch) return selectMatch[1].trim();
  if (/^\s*SELECT/i.test(content)) return content.trim();
  return null;
}
