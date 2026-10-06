'use client';

/**
 * Tab "Đánh giá" của một MOU: ký những khía cạnh nào, mỗi khía cạnh đã triển
 * khai đến đâu (kèm bằng chứng, nguồn, ngày), AI gợi ý đánh giá — và ô để lãnh
 * đạo/Phòng HC chốt đánh giá cuối cùng.
 */
import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, CircleDashed, ExternalLink, Loader2, Sparkles, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EVALUATIONS, VERDICT_DEFS, VERDICT_LABELS, type Evaluation, type Verdict } from '@/lib/mou/assess';
import type { MouExtraction } from '@/lib/mou/extract';
import type { StoredAssessment, StoredEvidence } from '@/lib/mou/ai-run';
import { CLAUSE_TYPE_COLORS, CLAUSE_TYPE_LABELS, formatDate } from './MOUUtils';

export const VERDICT_TONE: Record<Verdict, string> = {
  SUCCESS: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  ON_TRACK: 'bg-sky-50 text-sky-700 ring-sky-200',
  AT_RISK: 'bg-amber-50 text-amber-700 ring-amber-200',
  FAILED: 'bg-rose-50 text-rose-700 ring-rose-200',
  TOO_EARLY: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export interface ReviewClause {
  id: string;
  clauseType: string;
  title: string;
  content: string | null;
  responsibleParty: string;
  clauseStatus: string;
  progress: number;
  notes: string | null;
  aiGenerated?: boolean;
  evidence?: { items?: StoredEvidence[]; gap?: string | null } | null;
}

export interface ReviewMou {
  id: string;
  extraction?: MouExtraction | null;
  extractedAt?: string | null;
  assessment?: StoredAssessment | null;
  assessedAt?: string | null;
  evaluation?: string | null;
  evaluationNote?: string | null;
  evaluatedAt?: string | null;
  evaluatedBy?: string | null;
  clauses: ReviewClause[];
}

const PARTY: Record<string, string> = { UMC: 'UMC thực hiện', PARTNER: 'Đối tác thực hiện', BOTH: 'Hai bên' };
const STATUS: Record<string, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  COMPLETED: { label: 'Đạt cam kết', icon: CheckCircle2, cls: 'text-emerald-600' },
  IN_PROGRESS: { label: 'Đang triển khai', icon: Timer, cls: 'text-sky-600' },
  NOT_STARTED: { label: 'Chưa triển khai', icon: CircleDashed, cls: 'text-slate-400' },
  ON_HOLD: { label: 'Tạm dừng', icon: CircleDashed, cls: 'text-amber-600' },
  CANCELLED: { label: 'Đã huỷ', icon: CircleDashed, cls: 'text-rose-500' },
};

export function VerdictChip({ verdict, prefix }: { verdict: Verdict; prefix?: string }) {
  return (
    <span title={VERDICT_DEFS[verdict]} className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', VERDICT_TONE[verdict])}>
      {prefix}
      {VERDICT_LABELS[verdict]}
    </span>
  );
}

function Evidence({ items }: { items: StoredEvidence[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((e, i) => (
        <li key={i} className="flex gap-2 text-xs">
          <span className="w-[72px] shrink-0 tabular-nums text-slate-400">{e.date ? formatDate(e.date) : '—'}</span>
          <span className="min-w-0 text-slate-700">
            {e.summary}
            <span className="ml-1 text-slate-400">
              ·{' '}
              {e.href ? (
                <Link href={e.href} className="inline-flex items-center gap-0.5 hover:text-brand-700 hover:underline">
                  {e.source}
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </Link>
              ) : (
                e.source
              )}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function AspectRow({ c, index }: { c: ReviewClause; index: number }) {
  const st = STATUS[c.clauseStatus] ?? STATUS.NOT_STARTED;
  const Icon = st.icon;
  const [open, setOpen] = useState(false);
  const items = c.evidence?.items ?? [];
  const lines = (c.content ?? '').split('\n');
  return (
    <li className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', st.cls)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">{index}.</span>
            <span className="font-semibold text-slate-900">{c.title}</span>
            <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', CLAUSE_TYPE_COLORS[c.clauseType] ?? 'bg-slate-100 text-slate-600')}>{CLAUSE_TYPE_LABELS[c.clauseType] ?? 'Khác'}</span>
            <span className="text-[11px] text-slate-500">{PARTY[c.responsibleParty] ?? ''}</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{lines[0]}</p>
          {lines.length > 1 && (
            <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-xs font-medium text-brand-700 hover:underline">
              {open ? 'Ẩn cam kết' : `Xem ${lines.length - 1} cam kết`}
            </button>
          )}
          {open && <ul className="mt-1 space-y-0.5 text-xs text-slate-600">{lines.slice(1).map((l, i) => <li key={i}>{l}</li>)}</ul>}
          {c.notes && <p className="mt-1 text-xs text-slate-500"><b className="font-semibold text-slate-600">Kết quả đo được:</b> {c.notes}</p>}
          {items.length > 0 ? <Evidence items={items} /> : c.evidence && <p className="mt-2 text-xs text-slate-400">Chưa tìm thấy bằng chứng triển khai.</p>}
          {c.evidence?.gap && <p className="mt-1.5 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800"><b>Còn thiếu:</b> {c.evidence.gap}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className={cn('text-xs font-semibold', st.cls)}>{st.label}</p>
          <p className="text-lg font-bold tabular-nums text-slate-800">{c.progress}%</p>
        </div>
      </div>
    </li>
  );
}

function EvaluationBox({ mou, onSaved }: { mou: ReviewMou; onSaved: () => void }) {
  const [value, setValue] = useState<string>(mou.evaluation ?? '');
  const [note, setNote] = useState(mou.evaluationNote ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/mous/${mou.id}/evaluation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluation: value || null, note }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Không lưu được');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="rounded-xl border-2 border-brand-100 bg-brand-50/40 p-4">
      <h3 className="text-sm font-bold text-slate-900">Đánh giá của lãnh đạo / Phòng HC</h3>
      <p className="text-xs text-slate-500">
        {mou.evaluatedAt ? `Đã chốt ${formatDate(mou.evaluatedAt)}${mou.evaluatedBy ? ` · ${mou.evaluatedBy}` : ''}` : 'Chưa chốt — AI chỉ gợi ý, kết quả cuối do người đánh giá.'}
      </p>
      <div role="radiogroup" aria-label="Đánh giá" className="mt-3 flex flex-wrap gap-1.5">
        {EVALUATIONS.map((v: Evaluation) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            title={VERDICT_DEFS[v]}
            onClick={() => setValue(value === v ? '' : v)}
            className={cn('rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition', value === v ? VERDICT_TONE[v] + ' ring-2' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50')}
          >
            {VERDICT_LABELS[v]}
          </button>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Nhận xét, chỉ đạo (vd: giao Phòng KHĐT làm việc lại với đối tác trong quý IV)" className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" />
      {error && <p className="mt-1 text-xs text-rose-600" role="alert">{error}</p>}
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
          {saving ? 'Đang lưu…' : 'Lưu đánh giá'}
        </button>
      </div>
    </section>
  );
}

function Facts({ ex }: { ex: MouExtraction }) {
  const rows: Array<[string, string | null]> = [
    ['Văn bản', ex.documentTitle],
    ['Các bên ký', ex.parties.map((p) => `${p.name}${p.representative ? ` — ${p.representative}${p.position ? ` (${p.position})` : ''}` : ''}`).join('\n') || null],
    ['Thời hạn', ex.termText],
    ['Tài chính', ex.financialTerms],
    ['Chấm dứt', ex.terminationTerms],
    ['Việc phải làm tiếp', ex.followUp],
    ['Tờ trình', ex.approval],
    ['Ghi chú', ex.notes],
  ];
  return (
    <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[140px_minmax(0,1fr)]">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-medium text-slate-500">{k}</dt>
          <dd className="whitespace-pre-line text-slate-800">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MouReview({ mou, onRefresh }: { mou: ReviewMou; onRefresh: () => void }) {
  const a = mou.assessment;
  const ex = mou.extraction;
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState('');
  const rerun = async () => {
    setRunning(true);
    setRunMsg('');
    try {
      const res = await fetch(`/api/mous/${mou.id}/ai`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'AI chưa chạy được');
      setRunMsg(`Đã đọc lại: ${body.extracted} · ${body.assessed}`);
      onRefresh();
    } catch (e) {
      setRunMsg((e as Error).message);
    } finally {
      setRunning(false);
    }
  };
  const done = mou.clauses.filter((c) => c.clauseStatus === 'COMPLETED').length;
  const started = mou.clauses.filter((c) => c.clauseStatus === 'IN_PROGRESS').length;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-600">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> AI gợi ý
            </p>
            {a ? (
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <VerdictChip verdict={a.verdict} />
                <span className="text-sm text-slate-600">
                  Triển khai <b className="text-slate-900">{a.implementationLevel}%</b> · {done + started}/{mou.clauses.length} khía cạnh có kết quả
                  {a.lastActivityDate && ` · hoạt động gần nhất ${formatDate(a.lastActivityDate)}`}
                </span>
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Chưa đánh giá.</p>
            )}
          </div>
          <button type="button" onClick={rerun} disabled={running} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-60">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
            {running ? 'AI đang đọc… (~1 phút)' : 'AI đọc lại'}
          </button>
        </div>
        {runMsg && <p className="mt-2 text-xs text-slate-500" role="status">{runMsg}</p>}
        {a && (
          <>
            <p className="mt-3 text-sm text-slate-700">{a.rationale}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {a.risks.length > 0 && (
                <div className="rounded-lg bg-rose-50/60 p-3">
                  <p className="text-xs font-bold text-rose-700">Rủi ro</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-700">{a.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
              )}
              {a.recommendations.length > 0 && (
                <div className="rounded-lg bg-sky-50/60 p-3">
                  <p className="text-xs font-bold text-sky-700">Đề xuất</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-700">{a.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              Đánh giá {formatDate(a.at)} từ {a.evidenceFound} đoạn dữ liệu (nhật ký office, báo cáo tuần, tiếp đoàn, công việc, sự kiện).
            </p>
          </>
        )}
      </section>

      <EvaluationBox key={mou.evaluatedAt ?? 'none'} mou={mou} onSaved={onRefresh} />

      <section>
        <h3 className="mb-2 text-sm font-bold text-slate-900">
          Ký những khía cạnh nào — đã triển khai đến đâu
          <span className="ml-2 text-xs font-normal text-slate-500">{done} đạt · {started} đang làm · {mou.clauses.length - done - started} chưa</span>
        </h3>
        {mou.clauses.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">
            Chưa trích được khía cạnh nào — MOU chưa có văn bản ký đính kèm, hoặc văn bản chưa được đọc chữ. Tải biên bản lên tab Văn bản rồi bấm "AI đọc lại".
          </p>
        ) : (
          <ol className="space-y-2">{mou.clauses.map((c, i) => <AspectRow key={c.id} c={c} index={i + 1} />)}</ol>
        )}
      </section>

      {a && a.otherActivities.length > 0 && (
        <section>
          <h3 className="text-sm font-bold text-slate-900">Hoạt động khác với đối tác</h3>
          <Evidence items={a.otherActivities} />
        </section>
      )}

      {ex && (
        <section className="rounded-xl bg-slate-50 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
            Nội dung văn bản ký
            <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', ex.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' : ex.confidence === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')}>
              AI đọc: độ tin cậy {ex.confidence === 'high' ? 'cao' : ex.confidence === 'medium' ? 'trung bình' : 'thấp'}
            </span>
          </h3>
          <Facts ex={ex} />
        </section>
      )}
    </div>
  );
}
