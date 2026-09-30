import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GENERAL_CHATBOT_VIEWS, PERSONNEL_CHATBOT_VIEWS } from '@/lib/chatbot/sql-guard';
import { consumeRateLimit } from '@/lib/chatbot/rate-limit';
import { runChatbotPipeline, type PipelineResult } from '@/lib/chatbot/pipeline';
import { LlmError, userMessageFor } from '@/lib/chatbot/llm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatbotRequest {
  question: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  context?: { pathname?: string; title?: string };
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const userRole = session.user.role ?? 'STAFF';
  const allowedViews = userRole === 'ADMIN'
    ? [...GENERAL_CHATBOT_VIEWS, ...PERSONNEL_CHATBOT_VIEWS]
    : GENERAL_CHATBOT_VIEWS;

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

  // history đến từ trình duyệt — không tin: chỉ nhận role user/assistant (chặn
  // việc giả role "system" để chèn chỉ dẫn), cắt độ dài từng tin.
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
      !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  const contextPath = typeof body.context?.pathname === 'string' ? body.context.pathname.slice(0, 500) : null;
  let contextHint = contextPath ? `Ngữ cảnh UI hiện tại: ${contextPath}.` : '';
  const weekId = contextPath?.match(/^\/dashboard\/weeks\/([^/]+)$/)?.[1];
  if (weekId) {
    const currentWeek = await prisma.week.findUnique({ where: { id: weekId }, select: { weekNumber: true, year: true } }).catch(() => null);
    if (currentWeek) contextHint += ` Báo cáo đang mở là tuần ${currentWeek.weekNumber}/${currentWeek.year}; khi người dùng nói "tuần này" hoặc "báo cáo này", phải dùng đúng tuần/năm này.`;
  }
  const audit = await prisma.chatbotAuditLog.create({
    data: { userId, question, contextPath },
    select: { id: true },
  }).catch(() => null);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Người dùng đóng khung giữa chừng thì enqueue ném lỗi — nuốt để pipeline
      // vẫn chạy xong và audit log vẫn được ghi.
      let open = true;
      const send = (event: string, data: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          open = false;
        }
      };

      let result: PipelineResult | null = null;
      let errorMessage: string | null = null;
      try {
        result = await runChatbotPipeline(
          {
            question,
            history,
            userId,
            userRole,
            allowedViews,
            contextPath,
            contextHint,
          },
          send,
        );
        // Lỗi đã xử lý êm (câu trả lời đã giải thích cho người dùng) chỉ ghi vào
        // audit, không gửi chuỗi kỹ thuật kiểu 'column "x" does not exist' ra UI.
        send('done', { totalTokens: result.totalTokens, auditId: audit?.id });
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : 'Unexpected error';
        // Ghi ra log Railway — trước đây lỗi bị nuốt, AI hết tiền 3 tuần mới biết.
        console.error('[chatbot] lỗi', err instanceof LlmError ? err.kind : 'unknown', errorMessage);
        const friendly = userMessageFor(err, userRole === 'ADMIN');
        send('answer', { delta: friendly });
        send('done', { totalTokens: result?.totalTokens ?? 0, error: friendly, errorKind: err instanceof LlmError ? err.kind : 'unknown', auditId: audit?.id });
      } finally {
        if (open) {
          try { controller.close(); } catch { /* đã đóng */ }
        }
        // Audit log (fire and forget, never block the response).
        const data = {
          generatedSql: result?.generatedSql ?? null,
          rowCount: result?.rowCount ?? null,
          answer: result?.answer ? result.answer : null,
          totalTokens: result?.totalTokens || null,
          durationMs: Date.now() - startedAt,
          errorMessage: errorMessage ?? result?.errorMessage ?? null,
          actionType: result?.actionType ?? null,
          actionStatus: result?.actionStatus ?? null,
        };
        const persist = audit
          ? prisma.chatbotAuditLog.update({ where: { id: audit.id }, data })
          : prisma.chatbotAuditLog.create({ data: { userId, question, contextPath, ...data } });
        persist.catch((e) => console.error('[chatbot] ghi audit lỗi', e instanceof Error ? e.message : e));
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
