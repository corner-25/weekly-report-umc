'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, Check, ChevronDown, Code2, Copy, ExternalLink, Loader2, RotateCcw, ThumbsDown, ThumbsUp,
} from 'lucide-react';
import { ChatMarkdown, type ChatSource } from './ChatMarkdown';

export interface Proposal { id: string; actionType: string; title: string; description: string; expiresAt: string }

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  rowCount?: number | null;
  error?: string;
  sources?: ChatSource[];
  proposal?: Proposal;
  auditId?: string;
  feedback?: boolean;
  actionResultHref?: string;
  /** Câu hỏi gốc — để nút "Thử lại" hỏi lại đúng câu đó. */
  question?: string;
}

interface Props {
  message: Message;
  busy: boolean;
  streaming: boolean;
  statusLabel: string | null;
  onExecute: (messageId: string, proposalId: string) => void;
  onFeedback: (messageId: string, auditId: string, helpful: boolean) => void;
  onRetry: (question: string) => void;
}

export function ChatMessage({ message, busy, streaming, statusLabel, onExecute, onFeedback, onRetry }: Props) {
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-gradient-to-br from-cyan-500 to-blue-600 px-3.5 py-2 text-sm text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  const waiting = streaming && !message.content;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* trình duyệt chặn clipboard — bỏ qua */ }
  };

  return (
    <div className="group flex justify-start">
      <div className="w-full max-w-[92%]">
        <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 shadow-sm">
          {waiting ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
              {statusLabel ?? 'Đang xử lý…'}
            </div>
          ) : (
            <div className="break-words">
              <ChatMarkdown text={message.content} sources={message.sources} />
              {streaming && <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-cyan-400" />}
            </div>
          )}
        </div>

        {message.error && (
          <div className="mt-1.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">{message.error}</span>
            {message.question && (
              <button
                onClick={() => onRetry(message.question!)}
                disabled={busy}
                className="inline-flex shrink-0 items-center gap-1 font-semibold text-amber-800 hover:text-amber-950 disabled:opacity-40"
              >
                <RotateCcw className="h-3 w-3" /> Thử lại
              </button>
            )}
          </div>
        )}

        {message.proposal && (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
            <p className="font-semibold">{message.proposal.title}</p>
            <p className="mt-1 leading-5">{message.proposal.description}</p>
            <button
              disabled={busy}
              onClick={() => onExecute(message.id, message.proposal!.id)}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Xác nhận và thực hiện
            </button>
            <p className="mt-1.5 text-center text-[10px] text-amber-700">Chưa ghi dữ liệu · Hết hạn sau 10 phút</p>
          </div>
        )}

        {message.actionResultHref && (
          <Link href={message.actionResultHref} className="mt-2 flex items-center gap-1 text-xs font-medium text-cyan-700 hover:underline">
            Mở mục vừa tạo <ExternalLink className="h-3 w-3" />
          </Link>
        )}

        {!streaming && message.content && (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px] text-slate-400">
            <button onClick={copy} className="inline-flex items-center gap-1 hover:text-slate-600">
              {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Đã chép' : 'Chép'}
            </button>
            {message.sql && (
              <button onClick={() => setShowSql((v) => !v)} className="inline-flex items-center gap-1 hover:text-slate-600">
                <Code2 className="h-3 w-3" />
                Chi tiết tra cứu{typeof message.rowCount === 'number' ? ` · ${message.rowCount} dòng` : ''}
                <ChevronDown className={`h-3 w-3 transition-transform ${showSql ? 'rotate-180' : ''}`} />
              </button>
            )}
            {message.auditId && (
              <span className="ml-auto inline-flex items-center gap-1.5">
                <button aria-label="Hữu ích" onClick={() => onFeedback(message.id, message.auditId!, true)}
                  className={message.feedback === true ? 'text-emerald-600' : 'hover:text-emerald-600'}>
                  <ThumbsUp className="h-3 w-3" />
                </button>
                <button aria-label="Không hữu ích" onClick={() => onFeedback(message.id, message.auditId!, false)}
                  className={message.feedback === false ? 'text-red-600' : 'hover:text-red-600'}>
                  <ThumbsDown className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        )}

        {showSql && message.sql && (
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-[10px] text-slate-600">
            {message.sql}
          </pre>
        )}
      </div>
    </div>
  );
}
