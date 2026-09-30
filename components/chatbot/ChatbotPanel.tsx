'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Maximize2, Minimize2, Send, Sparkles, Square, SquarePen, X } from 'lucide-react';
import { ChatMessage, type Message, type Proposal } from './ChatMessage';
import type { ChatSource } from './ChatMarkdown';

const STORAGE_KEY = 'chatbot.conversation.v1';
const EXPANDED_KEY = 'chatbot.expanded';
/** Số tin giữ lại trong trình duyệt giữa các lần mở. */
const MAX_STORED_MESSAGES = 30;
/** Số tin gửi kèm làm ngữ cảnh — server cũng cắt ở 6. */
const HISTORY_SENT = 6;

const DEFAULT_SUGGESTIONS = [
  'Hiện nay có bao nhiêu ca ghép gan?',
  'Tuần này Phòng Kế hoạch Tổng hợp làm gì?',
  'Chỉ số nào giảm mạnh so với tuần trước?',
  'Xe nào sắp hết hạn đăng kiểm?',
];

function suggestionsFor(pathname: string) {
  if (pathname.includes('/weeks/')) return ['Tóm tắt báo cáo tuần này', 'Việc nào chậm tiến độ?', 'Soạn kế hoạch tuần tới'];
  if (pathname.includes('/mous')) return ['MOU nào sắp hết hạn?', 'Tóm tắt MOU đang hoạt động', 'MOU nào cần chú ý?'];
  if (pathname.includes('/hospital-events')) return ['Sự kiện nào diễn ra trong 7 ngày tới?', 'Tạo sự kiện họp giao ban ngày mai lúc 08:00', 'Sự kiện nào chưa xác nhận?'];
  if (pathname.includes('/tasks')) return ['Tuần mới nhất các phòng làm gì?', 'Việc nào chậm tiến độ?', 'Có số liệu nào nghi nhập sai?'];
  if (pathname.includes('phong-hc')) return ['Tuần này có bao nhiêu văn bản đến?', 'Tổng đài tuần qua nhỡ bao nhiêu cuộc?', 'Doanh thu tổ xe các tuần gần đây'];
  return DEFAULT_SUGGESTIONS;
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* chế độ riêng tư / bị chặn */ }
}

export function ChatbotPanel({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages(readStorage<Message[]>(STORAGE_KEY, []));
    setExpanded(readStorage<boolean>(EXPANDED_KEY, false));
    inputRef.current?.focus();
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    writeStorage(STORAGE_KEY, messages.slice(-MAX_STORED_MESSAGES));
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Ô nhập tự giãn theo nội dung, tối đa ~6 dòng.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [input]);

  const patch = useCallback((id: string, fn: (m: Message) => Message) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput('');
    setStatusLabel(null);

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: q };
    const assistant: Message = { id: crypto.randomUUID(), role: 'assistant', content: '', question: q };
    const history = messages
      .filter((m) => m.content && !m.error)
      .slice(-HISTORY_SENT)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg, assistant]);
    setStreamingId(assistant.id);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history, context: { pathname, title: document.title } }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Có lỗi xảy ra.' }));
        patch(assistant.id, (m) => ({ ...m, error: err.error || 'Có lỗi xảy ra.' }));
        return;
      }
      if (!res.body) throw new Error('Không nhận được phản hồi.');
      await readEvents(res.body, (event, data) => handleEvent(assistant.id, event, data));
    } catch (err) {
      if (controller.signal.aborted) {
        patch(assistant.id, (m) => ({ ...m, content: m.content || '_Đã dừng._' }));
      } else {
        patch(assistant.id, (m) => ({ ...m, error: 'Mất kết nối tới máy chủ. Kiểm tra mạng rồi thử lại.' }));
        console.error('[chatbot]', err);
      }
    } finally {
      abortRef.current = null;
      setStreamingId(null);
      setStatusLabel(null);
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function handleEvent(id: string, event: string, data: Record<string, unknown>) {
    switch (event) {
      case 'status':
        if (typeof data.label === 'string') setStatusLabel(data.label);
        break;
      case 'answer':
        if (typeof data.delta === 'string') { const d = data.delta; patch(id, (m) => ({ ...m, content: m.content + d })); }
        break;
      case 'sql':
        if (typeof data.sql === 'string') { const sql = data.sql; patch(id, (m) => ({ ...m, sql })); }
        break;
      case 'rows':
        patch(id, (m) => ({ ...m, rowCount: data.rowCount as number | null }));
        break;
      case 'sources':
        if (Array.isArray(data.sources)) patch(id, (m) => ({ ...m, sources: data.sources as ChatSource[] }));
        break;
      case 'proposal':
        if (data.proposal) patch(id, (m) => ({ ...m, proposal: data.proposal as Proposal }));
        break;
      case 'done':
        patch(id, (m) => ({
          ...m,
          auditId: typeof data.auditId === 'string' ? data.auditId : m.auditId,
          error: typeof data.error === 'string' ? data.error : m.error,
          // Lỗi đã có câu giải thích trong error — bỏ bản lặp trong content.
          content: typeof data.error === 'string' && m.content === data.error ? '' : m.content,
        }));
        break;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function newChat() {
    if (busy) stop();
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* bỏ qua */ }
    inputRef.current?.focus();
  }

  function toggleExpanded() {
    setExpanded((v) => { writeStorage(EXPANDED_KEY, !v); return !v; });
  }

  async function executeProposal(messageId: string, proposalId: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/chatbot/actions/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proposalId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể thực hiện đề xuất.');
      patch(messageId, (m) => ({ ...m, proposal: undefined, content: `${m.content}\n\n${data.message}`, actionResultHref: data.entity.href }));
    } catch (error) {
      patch(messageId, (m) => ({ ...m, error: error instanceof Error ? error.message : 'Có lỗi xảy ra.' }));
    } finally {
      setBusy(false);
    }
  }

  function sendFeedback(messageId: string, auditId: string, helpful: boolean) {
    patch(messageId, (m) => ({ ...m, feedback: helpful }));
    void fetch('/api/chatbot/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auditId, helpful }),
    });
  }

  const size = expanded
    ? 'w-[min(760px,calc(100vw-2.5rem))] h-[calc(100vh-7rem)]'
    : 'w-[420px] max-w-[calc(100vw-2.5rem)] h-[620px] max-h-[calc(100vh-7rem)]';

  return (
    <div
      role="dialog"
      aria-label="Trợ lý AI"
      className={`fixed bottom-24 right-5 z-40 ${size} flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 transition-[width,height] duration-200 animate-in fade-in slide-in-from-bottom-4`}
    >
      <header className="flex items-center justify-between bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-white">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">Trợ lý AI</div>
            <div className="truncate text-[11px] text-white/80">Tra cứu số liệu & soạn thảo · Phòng Hành chính</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {messages.length > 0 && (
            <button onClick={newChat} title="Hội thoại mới" aria-label="Hội thoại mới" className="rounded-md p-1.5 transition-colors hover:bg-white/15">
              <SquarePen className="h-4 w-4" />
            </button>
          )}
          <button onClick={toggleExpanded} title={expanded ? 'Thu nhỏ' : 'Phóng to'} aria-label={expanded ? 'Thu nhỏ' : 'Phóng to'}
            className="rounded-md p-1.5 transition-colors hover:bg-white/15">
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button onClick={onClose} title="Đóng (Esc)" aria-label="Đóng" className="rounded-md p-1.5 transition-colors hover:bg-white/15">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 px-4 py-4">
        {messages.length === 0 && (
          <div className="py-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-100">
              <Sparkles className="h-6 w-6 text-cyan-600" />
            </div>
            <p className="text-sm font-medium text-slate-700">Bạn muốn tra cứu gì?</p>
            <p className="mb-4 mt-1 text-xs text-slate-500">Hỏi bằng tiếng Việt tự nhiên — mình tra dữ liệu và trả lời kèm nguồn.</p>
            <div className={`mx-auto grid gap-1.5 ${expanded ? 'max-w-xl grid-cols-2' : 'grid-cols-1'}`}>
              {suggestionsFor(pathname).map((s) => (
                <button key={s} onClick={() => ask(s)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:border-cyan-300 hover:bg-cyan-50/40">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <ChatMessage
            key={m.id}
            message={m}
            busy={busy}
            streaming={m.id === streamingId}
            statusLabel={statusLabel}
            onExecute={executeProposal}
            onFeedback={sendFeedback}
            onRetry={ask}
          />
        ))}
      </div>

      <form className="border-t border-slate-100 bg-white px-3 pb-2.5 pt-3" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder="Nhập câu hỏi…"
            title="Enter để gửi · Shift+Enter xuống dòng"
            rows={1}
            maxLength={1000}
            disabled={busy}
            className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm leading-5 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
          />
          {busy && streamingId ? (
            <button type="button" onClick={stop} title="Dừng" aria-label="Dừng trả lời"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-white transition-colors hover:bg-slate-900">
              <Square className="h-3.5 w-3.5 fill-current" />
            </button>
          ) : (
            <button type="submit" disabled={busy || !input.trim()} aria-label="Gửi"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white transition-all hover:shadow-md hover:shadow-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-slate-400">AI có thể sai — đối chiếu nguồn trước khi dùng số liệu.</p>
      </form>
    </div>
  );
}

/** Đọc luồng SSE: mỗi sự kiện dạng "event: <tên>\ndata: <json>\n\n". */
async function readEvents(body: ReadableStream<Uint8Array>, onEvent: (event: string, data: Record<string, unknown>) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const segments = buffer.split('\n\n');
    buffer = segments.pop() ?? '';
    for (const seg of segments) {
      let event = 'message';
      let dataStr = '';
      for (const line of seg.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
      }
      if (!dataStr) continue;
      try { onEvent(event, JSON.parse(dataStr)); } catch { /* bỏ gói hỏng */ }
    }
  }
}
