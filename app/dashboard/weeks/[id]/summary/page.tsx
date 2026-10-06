'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, FileText, Lock, LockOpen, Pencil, Printer, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { crmFetch, crmSend, errorMessage } from '@/components/crm/api';
import { ErrorBanner, ICON_BTN, PANEL, PRIMARY_BTN, SECONDARY_BTN } from '@/components/crm/ui';
import { SummaryDocument, summaryToText } from '@/components/weeks/summary/SummaryDocument';
import { summaryContentSchema, type SummaryContent } from '@/lib/weekly-summary/types';

interface SummaryDto {
  week: { id: string; weekNumber: number; year: number; startDate: string; endDate: string };
  summary: {
    content: unknown;
    status: 'DRAFT' | 'FINAL';
    model: string | null;
    tokens: number | null;
    generatedAt: string | null;
    editedAt: string | null;
    editedBy: string | null;
    finalizedAt: string | null;
  } | null;
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '');
/** Bỏ dòng trống người dùng để lại khi sửa trước khi lưu. */
const tidy = (c: SummaryContent): SummaryContent => ({
  ...c,
  plan: c.plan.map((p) => p.trim()).filter(Boolean),
  sections: c.sections.map((s) => ({
    ...s,
    items: s.items
      .map((i) => (i.type === 'text' ? { ...i, text: i.text.trim(), subItems: i.subItems.map((x) => x.trim()).filter(Boolean) } : i))
      .filter((i) => i.type === 'table' || i.text || i.subItems.length),
  })),
});

export default function WeeklySummaryPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SummaryDto | null>(null);
  const [draft, setDraft] = useState<SummaryContent | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'' | 'generate' | 'save'>('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const accept = (dto: SummaryDto) => {
    setData(dto);
    const parsed = dto.summary ? summaryContentSchema.safeParse(dto.summary.content) : null;
    setDraft(parsed?.success ? parsed.data : null);
  };

  const load = useCallback(async () => {
    setError('');
    try {
      accept(await crmFetch<SummaryDto>(`/api/weeks/${id}/summary`));
    } catch (e) {
      setError(errorMessage(e, 'Không tải được báo cáo tóm tắt.'));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setBusy('generate');
    setError('');
    try {
      accept(await crmSend<SummaryDto>(`/api/weeks/${id}/summary`, 'POST', {}));
      setEditing(false);
    } catch (e) {
      setError(errorMessage(e, 'AI chưa viết được báo cáo, thử lại sau ít phút.'));
    } finally {
      setBusy('');
    }
  };

  const save = async (status?: 'DRAFT' | 'FINAL') => {
    if (!draft) return;
    setBusy('save');
    setError('');
    try {
      accept(await crmSend<SummaryDto>(`/api/weeks/${id}/summary`, 'PATCH', { content: tidy(draft), ...(status && { status }) }));
      setEditing(false);
    } catch (e) {
      setError(errorMessage(e, 'Không lưu được.'));
    } finally {
      setBusy('');
    }
  };

  const copy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(summaryToText(draft));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Trình duyệt chặn sao chép — dùng In / Lưu PDF.');
    }
  };

  const summary = data?.summary;
  const isFinal = summary?.status === 'FINAL';
  const week = data?.week;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`/dashboard/weeks/${id}`} className={cn(ICON_BTN, 'inline-flex items-center gap-1.5 px-2 text-sm font-medium')}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Báo cáo tuần {week ? `${week.weekNumber}/${week.year}` : ''}
        </Link>
      </div>

      <div className={cn(PANEL, 'sticky top-2 z-20 flex flex-wrap items-center gap-2 p-3 print:hidden')}>
        <div className="mr-auto min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <FileText className="h-5 w-5 text-brand-600" aria-hidden="true" /> Báo cáo tóm tắt {week ? `tuần ${week.weekNumber}/${week.year}` : ''}
            {summary && (
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', isFinal ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                {isFinal ? 'Đã chốt' : 'Bản nháp'}
              </span>
            )}
          </h1>
          {summary && (
            <p className="text-xs text-slate-500">
              {summary.generatedAt && <>AI viết {when(summary.generatedAt)}{summary.model && ` (${summary.model})`}</>}
              {summary.editedAt && <> · sửa {when(summary.editedAt)}{summary.editedBy && ` bởi ${summary.editedBy}`}</>}
              {summary.finalizedAt && <> · chốt {when(summary.finalizedAt)}</>}
            </p>
          )}
        </div>
        {editing ? (
          <>
            <button type="button" onClick={() => { accept(data!); setEditing(false); }} className={SECONDARY_BTN} disabled={busy !== ''}>Huỷ sửa</button>
            <button type="button" onClick={() => save()} className={PRIMARY_BTN} disabled={busy !== ''}>
              <Check className="h-4 w-4" aria-hidden="true" /> {busy === 'save' ? 'Đang lưu…' : 'Lưu'}
            </button>
          </>
        ) : (
          <>
            {!isFinal && (
              <button type="button" onClick={generate} className={summary ? SECONDARY_BTN : PRIMARY_BTN} disabled={busy !== ''}>
                <Sparkles className="h-4 w-4" aria-hidden="true" /> {busy === 'generate' ? 'AI đang viết…' : summary ? 'Viết lại bằng AI' : 'Viết bằng AI'}
              </button>
            )}
            {draft && !isFinal && (
              <button type="button" onClick={() => setEditing(true)} className={SECONDARY_BTN} disabled={busy !== ''}>
                <Pencil className="h-4 w-4" aria-hidden="true" /> Sửa
              </button>
            )}
            {draft && (
              <>
                <button type="button" onClick={copy} className={SECONDARY_BTN}>
                  <Copy className="h-4 w-4" aria-hidden="true" /> {copied ? 'Đã sao chép' : 'Sao chép'}
                </button>
                <button type="button" onClick={() => window.print()} className={SECONDARY_BTN}>
                  <Printer className="h-4 w-4" aria-hidden="true" /> In / Lưu PDF
                </button>
              </>
            )}
            {draft && (
              isFinal ? (
                <button type="button" onClick={() => save('DRAFT')} className={SECONDARY_BTN} disabled={busy !== ''}>
                  <LockOpen className="h-4 w-4" aria-hidden="true" /> Bỏ chốt
                </button>
              ) : (
                <button type="button" onClick={() => save('FINAL')} className={PRIMARY_BTN} disabled={busy !== ''} title="Bản chốt dùng làm mẫu văn phong cho AI ở các tuần sau">
                  <Lock className="h-4 w-4" aria-hidden="true" /> Chốt báo cáo
                </button>
              )
            )}
          </>
        )}
      </div>

      <div className="print:hidden"><ErrorBanner message={error} /></div>

      {busy === 'generate' && (
        <div className={cn(PANEL, 'flex items-center gap-3 p-4 text-sm text-slate-600 print:hidden')} role="status">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" aria-hidden="true" />
          AI đang đọc báo cáo các phòng và viết tóm tắt — khoảng 20–40 giây.
        </div>
      )}

      {draft && summary && !editing && (() => {
        const notes = (summaryContentSchema.safeParse(summary.content).data?.notes ?? []);
        return notes.length ? (
          <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-900 print:hidden">
            {notes.map((n) => <li key={n}>• {n}</li>)}
          </ul>
        ) : null;
      })()}

      {!data && !error && <div className={cn(PANEL, 'h-96 animate-pulse bg-slate-50')} aria-hidden="true" />}
      {data && !draft && busy !== 'generate' && (
        <div className={cn(PANEL, 'space-y-3 p-8 text-center')}>
          <Sparkles className="mx-auto h-10 w-10 text-brand-300" aria-hidden="true" />
          <p className="font-semibold text-slate-900">Chưa có báo cáo tóm tắt tuần này</p>
          <p className="mx-auto max-w-lg text-sm text-slate-500">
            AI đọc báo cáo tuần của các phòng và số liệu đã trích, viết bản tóm tắt theo mẫu gửi Ban Giám đốc. Phòng HC sửa lại rồi bấm Chốt — các bản đã chốt giúp AI viết đúng văn phong hơn ở những tuần sau.
          </p>
          <button type="button" onClick={generate} className={PRIMARY_BTN}>
            <Sparkles className="h-4 w-4" aria-hidden="true" /> Viết bằng AI
          </button>
        </div>
      )}
      {draft && <SummaryDocument content={draft} editing={editing} onChange={setDraft} />}
    </div>
  );
}
