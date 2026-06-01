import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { prismaRo } from '@/lib/prisma-ro';
import { CHATBOT_SCHEMA_PROMPT } from '@/lib/chatbot/schema-context';
import { guardSql } from '@/lib/chatbot/sql-guard';
import { deepseekComplete, deepseekStream, extractSql, type ChatMessage } from '@/lib/chatbot/deepseek';
import { consumeRateLimit } from '@/lib/chatbot/rate-limit';
import { scrubPii } from '@/lib/chatbot/pii-filter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatbotRequest {
  question: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const MAX_ROWS_PREVIEW = 30;
const MAX_HISTORY = 6;

function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v);
    }
    return out;
  }
  return value;
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const rl = consumeRateLimit(userId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Bạn đang gửi câu hỏi quá nhanh. Vui lòng thử lại sau.', retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec ?? 60) } },
    );
  }

  let body: ChatbotRequest;
  try {
    body = (await req.json()) as ChatbotRequest;
  } catch {
    return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 400 });
  }

  const question = (body.question ?? '').trim();
  if (!question) return NextResponse.json({ error: 'Câu hỏi trống.' }, { status: 400 });
  if (question.length > 1000) {
    return NextResponse.json({ error: 'Câu hỏi quá dài (tối đa 1000 ký tự).' }, { status: 400 });
  }

  let generatedSql: string | null = null;
  let rowCount: number | null = null;
  let errorMessage: string | null = null;
  let totalTokens = 0;
  let assembledAnswer = '';

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        // Step 1: ask DeepSeek to generate SQL.
        const historyContext = (body.history ?? [])
          .slice(-MAX_HISTORY)
          .map((m): ChatMessage => ({ role: m.role, content: m.content }));

        const sqlMessages: ChatMessage[] = [
          { role: 'system', content: CHATBOT_SCHEMA_PROMPT },
          ...historyContext,
          { role: 'user', content: question },
        ];
        const sqlGen = await deepseekComplete(sqlMessages, { maxTokens: 500, temperature: 0.1 });
        totalTokens += sqlGen.usage.total_tokens;

        const candidateSql = extractSql(sqlGen.content);
        if (!candidateSql) {
          send('answer', { delta: 'Xin lỗi, tôi không xác định được câu truy vấn phù hợp cho câu hỏi này. Bạn thử diễn đạt cụ thể hơn nhé.' });
          send('done', { totalTokens });
          return;
        }

        const guarded = guardSql(candidateSql);
        if (!guarded.ok) {
          errorMessage = guarded.error ?? 'SQL bị chặn bởi guard';
          send('answer', { delta: 'Câu truy vấn AI sinh ra không an toàn nên đã bị chặn. Bạn thử hỏi cách khác.' });
          send('done', { totalTokens, error: errorMessage });
          return;
        }
        generatedSql = guarded.sql;
        send('sql', { sql: generatedSql });

        // Step 2: run the SQL against the readonly client.
        let rows: unknown[] = [];
        try {
          const raw = await prismaRo.$queryRawUnsafe<unknown[]>(generatedSql);
          rows = Array.isArray(raw) ? raw : [];
          rowCount = rows.length;
        } catch (queryErr) {
          errorMessage = queryErr instanceof Error ? queryErr.message : 'Query failed';
          send('answer', { delta: 'Có lỗi khi truy vấn dữ liệu. Bạn thử lại nhé.' });
          send('done', { totalTokens, error: errorMessage });
          return;
        }

        const preview = rows.slice(0, MAX_ROWS_PREVIEW).map(serialize);
        send('rows', { rowCount, preview });

        // Step 3: ask DeepSeek to summarize the result for the user (streamed).
        const summaryMessages: ChatMessage[] = [
          {
            role: 'system',
            content:
              'Bạn là trợ lý phân tích dữ liệu cho Phòng Hành chính UMC. ' +
              'Trả lời ngắn gọn bằng tiếng Việt, dựa CHỈ trên dữ liệu được cung cấp (không bịa). ' +
              'Nếu kết quả rỗng, nói thẳng là không có số liệu phù hợp. ' +
              'Khi liệt kê số liệu, định dạng số có dấu phân cách hàng nghìn. ' +
              'Không bao giờ nhắc lại câu lệnh SQL.',
          },
          {
            role: 'user',
            content:
              `Câu hỏi gốc: ${question}\n\n` +
              `Kết quả truy vấn (JSON, tối đa ${MAX_ROWS_PREVIEW} dòng):\n${JSON.stringify(preview, null, 2)}\n\n` +
              `Tổng số dòng thực tế: ${rowCount}\n\n` +
              'Hãy trả lời câu hỏi.',
          },
        ];

        for await (const delta of deepseekStream(summaryMessages, { maxTokens: 600, temperature: 0.3 })) {
          const safe = scrubPii(delta);
          assembledAnswer += safe;
          send('answer', { delta: safe });
        }
        send('done', { totalTokens });
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : 'Unexpected error';
        send('answer', { delta: 'Có lỗi xảy ra. Vui lòng thử lại sau.' });
        send('done', { totalTokens, error: errorMessage });
      } finally {
        controller.close();
        // Audit log (fire and forget, never block the response).
        prisma.chatbotAuditLog
          .create({
            data: {
              userId,
              question,
              generatedSql,
              rowCount,
              answer: assembledAnswer.length > 0 ? assembledAnswer : null,
              totalTokens: totalTokens || null,
              durationMs: Date.now() - startedAt,
              errorMessage,
            },
          })
          .catch(() => {
            /* swallow audit failures */
          });
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
