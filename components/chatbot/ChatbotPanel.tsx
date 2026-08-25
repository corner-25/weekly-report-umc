'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, Code2, ExternalLink, Loader2, Send, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';

interface Source { id: string; title: string; href: string }
interface Proposal { id: string; actionType: string; title: string; description: string; expiresAt: string }

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  rowCount?: number | null;
  error?: string;
  sources?: Source[];
  proposal?: Proposal;
  auditId?: string;
  feedback?: boolean;
  actionResultHref?: string;
}

const STORAGE_KEY = 'chatbot.conversation.v1';
const DEFAULT_SUGGESTIONS = [
  'Hiện nay có bao nhiêu ca ghép gan?',
  'Tuần 14 phòng KHTH có nhiệm vụ gì đã hoàn thành?',
  'MOU nào sắp hết hạn trong 60 ngày tới?',
  'Có bao nhiêu thư ký đang hoạt động?',
];

function suggestionsFor(pathname: string) {
  if (pathname.includes('/weeks/')) return ['Tóm tắt báo cáo tuần này', 'Việc nào chậm tiến độ?', 'Soạn kế hoạch tuần tới'];
  if (pathname.includes('/mous')) return ['MOU nào sắp hết hạn?', 'Tóm tắt MOU đang hoạt động', 'MOU nào cần chú ý?'];
  if (pathname.includes('/hospital-events')) return ['Sự kiện nào diễn ra trong 7 ngày tới?', 'Tạo sự kiện họp giao ban ngày mai lúc 08:00', 'Sự kiện nào chưa xác nhận?'];
  if (pathname.includes('/tasks')) return ['Tuần mới nhất các phòng làm gì?', 'Việc nào chậm tiến độ?', 'Có số liệu nào nghi nhập sai?'];
  return DEFAULT_SUGGESTIONS;
}

export function ChatbotPanel({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setMessages(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
    } catch {
      /* ignore */
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput('');

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: q };
    const assistantMsg: Message = { id: crypto.randomUUID(), role: 'assistant', content: '' };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history, context: { pathname, title: document.title } }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Có lỗi xảy ra' }));
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: err.error || 'Có lỗi.', error: err.error } : m)),
        );
        return;
      }
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let lastEvent = 'message';

      // Stream SSE events. Each event has: event: <name>\ndata: <json>\n\n
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const segments = buffer.split('\n\n');
        buffer = segments.pop() ?? '';
        for (const seg of segments) {
          const lines = seg.split('\n');
          for (const line of lines) {
            if (line.startsWith('event:')) lastEvent = line.slice(6).trim();
            else if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim();
              try {
                const data = JSON.parse(dataStr) as Record<string, unknown>;
                if (lastEvent === 'sql' && typeof data.sql === 'string') {
                  const sql = data.sql;
                  setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, sql } : m)));
                } else if (lastEvent === 'rows' && typeof data.rowCount !== 'undefined') {
                  const rc = data.rowCount as number | null;
                  setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, rowCount: rc } : m)));
                } else if (lastEvent === 'answer' && typeof data.delta === 'string') {
                  const delta = data.delta;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: m.content + delta } : m)),
                  );
                } else if (lastEvent === 'sources' && Array.isArray(data.sources)) {
                  setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, sources: data.sources as Source[] } : m)));
                } else if (lastEvent === 'proposal' && data.proposal) {
                  setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, proposal: data.proposal as Proposal } : m)));
                } else if (lastEvent === 'done') {
                  setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? {
                    ...m,
                    auditId: typeof data.auditId === 'string' ? data.auditId : m.auditId,
                    error: typeof data.error === 'string' ? data.error : m.error,
                  } : m));
                }
              } catch {
                /* skip malformed */
              }
            }
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi mạng.';
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: 'Có lỗi: ' + message, error: message } : m)),
      );
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function clearChat() {
    setMessages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  async function executeProposal(messageId: string, proposalId: string) {
    setBusy(true);
    try {
      const res = await fetch('/api/chatbot/actions/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proposalId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể thực hiện đề xuất.');
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, proposal: undefined, content: `${m.content}\n\n${data.message}`, actionResultHref: data.entity.href } : m));
    } catch (error) {
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, error: error instanceof Error ? error.message : 'Có lỗi xảy ra.' } : m));
    } finally { setBusy(false); }
  }

  function sendFeedback(messageId: string, auditId: string, helpful: boolean) {
    setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, feedback: helpful } : m));
    void fetch('/api/chatbot/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ auditId, helpful }) });
  }

  return (
    <div className="fixed bottom-24 right-5 z-40 w-[400px] max-w-[calc(100vw-2.5rem)] h-[600px] max-h-[calc(100vh-7rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
      <header className="px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-cyan-500 to-blue-600 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">Trợ lý AI</div>
            <div className="text-xs text-white/80">Hỏi đáp số liệu bệnh viện</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-xs px-2 py-1 rounded-md hover:bg-white/10 transition-colors"
              title="Xoá hội thoại"
            >
              Xoá
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/10 transition-colors"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/50">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-cyan-600" />
            </div>
            <p className="text-sm font-medium text-slate-700">Bạn muốn tra cứu gì?</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Hỏi bằng tiếng Việt tự nhiên, tôi sẽ tra dữ liệu giúp.
            </p>
            <div className="space-y-1.5">
              {suggestionsFor(pathname).map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/40 transition-colors text-slate-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} busy={busy} onExecute={executeProposal} onFeedback={sendFeedback} />
        ))}

        {busy && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content === '' && (
          <div className="flex items-center gap-2 text-xs text-slate-500 px-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            Đang phân tích...
          </div>
        )}
      </div>

      <form
        className="px-3 py-3 border-t border-slate-100 bg-white"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder="Nhập câu hỏi..."
            rows={1}
            disabled={busy}
            className="flex-1 resize-none px-3 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 disabled:bg-slate-50 disabled:cursor-not-allowed max-h-24"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md hover:shadow-cyan-500/30 transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5 px-1">
          AI có thể sai. Vui lòng kiểm tra số liệu trước khi sử dụng.
        </p>
      </form>
    </div>
  );
}

function MessageBubble({ message, busy, onExecute, onFeedback }: { message: Message; busy: boolean; onExecute: (messageId: string, proposalId: string) => void; onFeedback: (messageId: string, auditId: string, helpful: boolean) => void }) {
  const [showSql, setShowSql] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isUser ? 'order-1' : ''}`}>
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
            isUser
              ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-br-sm'
              : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
          }`}
        >
          {message.content || (isUser ? '' : '...')}
        </div>

        {!isUser && message.sql && (
          <div className="mt-1.5">
            <button
              onClick={() => setShowSql((v) => !v)}
              className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 px-1.5 py-0.5 rounded transition-colors"
            >
              <Code2 className="w-3 h-3" />
              {showSql ? 'Ẩn' : 'Xem'} câu truy vấn
              {typeof message.rowCount === 'number' && (
                <span className="text-slate-400">· {message.rowCount} dòng</span>
              )}
            </button>
            {showSql && (
              <pre className="mt-1 text-[10px] font-mono p-2 bg-slate-100 border border-slate-200 rounded-lg overflow-x-auto text-slate-700 whitespace-pre-wrap break-all">
                {message.sql}
              </pre>
            )}
          </div>
        )}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nguồn kiểm chứng</p>
            {message.sources.map((source) => <Link key={source.id} href={source.href} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-cyan-700 hover:bg-cyan-50"><span className="font-semibold">{source.id}</span><span className="flex-1">{source.title}</span><ExternalLink className="h-3 w-3" /></Link>)}
          </div>
        )}
        {!isUser && message.proposal && (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
            <p className="font-semibold">{message.proposal.title}</p><p className="mt-1 leading-5">{message.proposal.description}</p>
            <button disabled={busy} onClick={() => onExecute(message.id, message.proposal!.id)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Xác nhận và thực hiện</button>
            <p className="mt-1.5 text-center text-[10px] text-amber-700">Chưa ghi dữ liệu · Hết hạn sau 10 phút</p>
          </div>
        )}
        {!isUser && message.actionResultHref && <Link href={message.actionResultHref} className="mt-2 flex items-center gap-1 text-xs font-medium text-cyan-700 hover:underline">Mở sự kiện vừa tạo <ExternalLink className="h-3 w-3" /></Link>}
        {!isUser && message.auditId && (
          <div className="mt-1 flex items-center gap-1 px-1 text-slate-400"><span className="mr-1 text-[10px]">Hữu ích?</span><button aria-label="Hữu ích" onClick={() => onFeedback(message.id, message.auditId!, true)} className={message.feedback === true ? 'text-emerald-600' : 'hover:text-emerald-600'}><ThumbsUp className="h-3 w-3" /></button><button aria-label="Không hữu ích" onClick={() => onFeedback(message.id, message.auditId!, false)} className={message.feedback === false ? 'text-red-600' : 'hover:text-red-600'}><ThumbsDown className="h-3 w-3" /></button></div>
        )}
        {!isUser && message.error && <p className="mt-1 px-1 text-[10px] text-red-600">{message.error}</p>}
      </div>
    </div>
  );
}
