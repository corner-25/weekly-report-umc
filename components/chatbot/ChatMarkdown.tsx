'use client';

import Link from 'next/link';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface ChatSource { id: string; title: string; href: string }

/**
 * Biến trích dẫn [S1], [S2] thành link markdown tới đúng nguồn.
 *
 * Dùng scheme giả "cite:" để component `a` nhận ra và vẽ thành chip nhỏ,
 * phân biệt với link thường trong câu trả lời.
 */
function linkCitations(text: string, sources: ChatSource[]): string {
  const byId = new Map(sources.map((s) => [s.id.toUpperCase(), s]));
  return text.replace(/\[(S\d+)\]/gi, (match, id: string) => {
    const src = byId.get(id.toUpperCase());
    return src ? `[${id.toUpperCase()}](cite:${encodeURIComponent(src.href)})` : match;
  });
}

/** Lấy chữ thuần từ children của một ô để đo độ dài. */
function textOf(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return textOf((node as { props?: { children?: unknown } }).props?.children);
  }
  return '';
}

function components(sources: ChatSource[]): Components {
  const titleOf = (href: string) => sources.find((s) => s.href === href)?.title;
  return {
    p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0 leading-relaxed">{children}</p>,
    strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
    ul: ({ children }) => <ul className="my-1.5 ml-4 list-disc space-y-0.5 marker:text-cyan-500">{children}</ul>,
    ol: ({ children }) => <ol className="my-1.5 ml-4 list-decimal space-y-0.5 marker:text-slate-400">{children}</ol>,
    li: ({ children }) => <li className="pl-0.5 leading-relaxed">{children}</li>,
    h1: ({ children }) => <p className="mt-2 mb-1 font-semibold text-slate-900">{children}</p>,
    h2: ({ children }) => <p className="mt-2 mb-1 font-semibold text-slate-900">{children}</p>,
    h3: ({ children }) => <p className="mt-2 mb-1 font-semibold text-slate-800">{children}</p>,
    code: ({ children }) => <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-700">{children}</code>,
    blockquote: ({ children }) => <blockquote className="my-1.5 border-l-2 border-cyan-300 pl-2.5 text-slate-600">{children}</blockquote>,
    // Bảng rộng cuộn ngang trong khung riêng, không đẩy vỡ khung chat.
    table: ({ children }) => (
      <div className="my-2 -mx-1 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-[12px] tabular-nums">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-slate-50 text-slate-600">{children}</thead>,
    th: ({ children }) => <th className="whitespace-nowrap border-b border-slate-200 px-2.5 py-1.5 text-left font-semibold">{children}</th>,
    // Ô ngắn (biển số, ngày, số liệu) không ngắt dòng — "50M-002.00" bị tách
    // làm hai trên điện thoại. Ô dài (nội dung báo cáo) vẫn xuống dòng bình thường.
    td: ({ children }) => (
      <td className={`border-b border-slate-100 px-2.5 py-1.5 align-top ${textOf(children).length <= 24 ? 'whitespace-nowrap' : 'min-w-[12rem]'}`}>
        {children}
      </td>
    ),
    tr: ({ children }) => <tr className="even:bg-slate-50/60">{children}</tr>,
    a: ({ href, children }) => {
      if (href?.startsWith('cite:')) {
        const target = decodeURIComponent(href.slice(5));
        return (
          <Link
            href={target}
            title={titleOf(target) ?? 'Mở nguồn'}
            className="mx-0.5 inline-flex -translate-y-px items-center rounded bg-cyan-50 px-1 text-[10px] font-semibold leading-4 text-cyan-700 ring-1 ring-cyan-200 hover:bg-cyan-100"
          >
            {children}
          </Link>
        );
      }
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-700 underline underline-offset-2 hover:text-cyan-900">
          {children}
        </a>
      );
    },
  };
}

export function ChatMarkdown({ text, sources = [] }: { text: string; sources?: ChatSource[] }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components(sources)}
      // react-markdown mặc định lọc URL lạ — cho phép scheme "cite:" nội bộ.
      urlTransform={(url) => (url.startsWith('cite:') || /^(https?:|\/|#|mailto:)/i.test(url) ? url : '')}
    >
      {linkCitations(text, sources)}
    </ReactMarkdown>
  );
}
