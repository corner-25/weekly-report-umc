'use client';

import Link from 'next/link';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Download, ListChecks, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { EmptyState, ErrorBanner, PANEL, PRIMARY_BTN, SECONDARY_BTN } from '@/components/crm/ui';
import {
  MOU_SORTS, MOU_VIEWS, PARTNER_TYPE_LABELS, STAGE_LABELS, filterMous, matchesView, sortMous,
  type MouFilter, type MouSortKey, type MouViewKey, type PartnerType, type Stage,
} from '@/lib/mou/portfolio';
import { usePortfolio } from '@/components/mous/portfolio/usePortfolio';
import { MouTable } from '@/components/mous/portfolio/MouTable';
import { MouDetailHost, type HostMode } from '@/components/mous/portfolio/MouDetailHost';
import { downloadMouCsv } from '@/components/mous/portfolio/export-csv';
import { HintTip } from '@/components/work/dashboard/Glossary';
import { VERDICTS, VERDICT_LABELS } from '@/lib/mou/assess';
import { MOU_TERMS, type MouTermKey } from '@/components/mous/portfolio/terms';

const VIEW_TERM: Partial<Record<MouViewKey, MouTermKey>> = {
  live: 'live', dormant: 'dormant', decide: 'decide', pending: 'pending', incomplete: 'incomplete', ended: 'ended',
};
const VIEW_DOT: Partial<Record<MouViewKey, string>> = {
  live: 'bg-emerald-500', dormant: 'bg-rose-500', decide: 'bg-orange-400', pending: 'bg-sky-400', incomplete: 'bg-amber-400', ended: 'bg-slate-400',
};
const isView = (v: string | null): v is MouViewKey => MOU_VIEWS.some((x) => x.key === v);
const isSort = (v: string | null): v is MouSortKey => MOU_SORTS.some((x) => x.key === v);
const SELECT = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm';

/** Danh sách MOU: góc nhìn theo việc cần làm, lọc trên URL (bấm Quay lại không mất bộ lọc). */
function MouList() {
  const params = useSearchParams();
  // Đọc URL một lần; sau đó giữ trạng thái tại chỗ và ghi lại URL bằng replaceState (không cuộn, không tải lại).
  const [state, setState] = useState(() => ({
    view: isView(params.get('view')) ? (params.get('view') as MouViewKey) : 'all',
    q: params.get('q') ?? '',
    phong: params.get('phong') ?? '',
    linhvuc: params.get('linhvuc') ?? '',
    doitac: params.get('doitac') ?? '',
    phamvi: params.get('phamvi') ?? '',
    giaidoan: params.get('giaidoan') ?? '',
    danhgia: params.get('danhgia') ?? '',
    sapxep: isSort(params.get('sapxep')) ? (params.get('sapxep') as MouSortKey) : 'attention',
  }));
  const [mode, setMode] = useState<HostMode>(() => {
    const id = params.get('id');
    return id ? { kind: 'view', id } : { kind: 'none' };
  });
  const { views, departments, isLoading, error, reload } = usePortfolio();

  const update = useCallback((changes: Partial<typeof state>) => {
    setState((prev) => {
      const next = { ...prev, ...changes };
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(next)) if (v && !(k === 'view' && v === 'all') && !(k === 'sapxep' && v === 'attention')) q.set(k, v);
      window.history.replaceState(null, '', q.toString() ? `?${q.toString()}` : window.location.pathname);
      return next;
    });
  }, []);

  const { q, phong, linhvuc, doitac, phamvi, giaidoan, danhgia } = state;
  const scoped = useMemo(
    () => filterMous(views, { view: 'all', q, departmentId: phong, field: linhvuc, scope: phamvi as MouFilter['scope'], partnerType: doitac, stage: giaidoan, verdict: danhgia }),
    [views, q, phong, linhvuc, doitac, phamvi, giaidoan, danhgia],
  );
  const shown = useMemo(() => sortMous(scoped.filter((v) => matchesView(v, state.view)), state.sapxep), [scoped, state.view, state.sapxep]);
  const fields = useMemo(() => [...new Set(views.flatMap((v) => v.fields))].sort((a, b) => a.localeCompare(b, 'vi')), [views]);
  const ownerIds = useMemo(() => new Set(views.map((v) => v.departmentId)), [views]);
  const hasFilters = Boolean(state.q || state.phong || state.linhvuc || state.doitac || state.phamvi || state.giaidoan || state.danhgia);

  return (
    <div className="space-y-4">
      <PageHeader
        icon={ListChecks}
        title="Danh sách MOU"
        description="Mọi thỏa thuận hợp tác — bấm một dòng để xem nội dung, văn bản, nhật ký"
        className="flex-wrap gap-4"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/mous" className={SECONDARY_BTN}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Bảng điều hành
            </Link>
            <button type="button" onClick={() => downloadMouCsv(shown, `MOU_${new Date().toISOString().slice(0, 10)}.csv`)} disabled={!shown.length} className={SECONDARY_BTN}>
              <Download className="h-4 w-4" aria-hidden="true" /> Xuất Excel
            </button>
            <button type="button" onClick={() => setMode({ kind: 'create' })} className={PRIMARY_BTN}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Thêm MOU
            </button>
          </div>
        }
      />

      <div className={cn(PANEL, 'space-y-3 p-4')}>
        <div role="tablist" aria-label="Góc nhìn" className="flex flex-wrap gap-1.5">
          {MOU_VIEWS.map((v) => {
            const count = scoped.filter((x) => matchesView(x, v.key)).length;
            const term = VIEW_TERM[v.key];
            const active = state.view === v.key;
            return (
              <span key={v.key} className={cn('inline-flex items-center rounded-xl ring-1 ring-inset transition', active ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50')}>
                <button type="button" role="tab" aria-selected={active} onClick={() => update({ view: v.key })} className="inline-flex items-center gap-1.5 py-1.5 pl-3 pr-1 text-[13px] font-medium">
                  {VIEW_DOT[v.key] && <span className={cn('h-1.5 w-1.5 rounded-full', VIEW_DOT[v.key])} aria-hidden="true" />}
                  {v.label}
                  <span className={cn('tabular-nums', active ? 'text-white/70' : 'text-slate-400')}>{count}</span>
                </button>
                <span className={cn('pr-2', active ? '[&_button]:text-white/70' : '')}>{term ? <HintTip label={MOU_TERMS[term].label} def={MOU_TERMS[term].def} /> : <span className="pl-1" />}</span>
              </span>
            );
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]">
          <label className="relative">
            <span className="sr-only">Tìm MOU</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input value={state.q} onChange={(e) => update({ q: e.target.value })} placeholder="Tìm đối tác, nội dung, người phụ trách…" className={cn(SELECT, 'w-full pl-9')} />
          </label>
          <Select value={state.phong} onChange={(e) => update({ phong: e.target.value })} aria-label="Phòng đầu mối" className={SELECT}>
            <option value="">Mọi phòng đầu mối</option>
            {departments.filter((d) => ownerIds.has(d.id)).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            <option value="none">Chưa có phòng đầu mối</option>
          </Select>
          <Select value={state.linhvuc} onChange={(e) => update({ linhvuc: e.target.value })} aria-label="Lĩnh vực" className={SELECT}>
            <option value="">Mọi lĩnh vực</option>
            {fields.map((f) => <option key={f} value={f}>{f}</option>)}
          </Select>
          <Select value={state.doitac} onChange={(e) => update({ doitac: e.target.value })} aria-label="Loại đối tác" className={SELECT}>
            <option value="">Mọi loại đối tác</option>
            {(Object.keys(PARTNER_TYPE_LABELS) as PartnerType[]).map((k) => <option key={k} value={k}>{PARTNER_TYPE_LABELS[k]}</option>)}
          </Select>
          <Select value={state.phamvi} onChange={(e) => update({ phamvi: e.target.value })} aria-label="Trong nước hay quốc tế" className={SELECT}>
            <option value="">Trong nước và quốc tế</option>
            <option value="DOMESTIC">Trong nước</option>
            <option value="INTERNATIONAL">Quốc tế</option>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>
            <b className="text-slate-800">{shown.length}</b> MOU
          </span>
          <span className="text-violet-600" title="Đánh giá có dấu ✦ là AI gợi ý, chưa được lãnh đạo/Phòng HC chốt">✦ = AI gợi ý</span>
          <span className="mx-1 h-3 w-px bg-slate-200" aria-hidden="true" />
          <span>Triển khai:</span>
          {(['', 'NONE', 'STARTED', 'DONE'] as Array<'' | Stage>).map((s) => (
            <button key={s || 'all'} type="button" onClick={() => update({ giaidoan: s })} className={cn('rounded-lg px-2 py-1 font-medium ring-1 ring-inset', state.giaidoan === s ? 'bg-brand-50 text-brand-700 ring-brand-200' : 'text-slate-600 ring-slate-200 hover:bg-slate-50')}>
              {s ? STAGE_LABELS[s] : 'Tất cả'}
            </button>
          ))}
          <div className="w-44">
          <Select value={state.danhgia} onChange={(e) => update({ danhgia: e.target.value })} aria-label="Đánh giá hiệu quả" className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
            <option value="">Mọi đánh giá</option>
            {VERDICTS.map((v) => <option key={v} value={v}>{VERDICT_LABELS[v]}</option>)}
            <option value="none">Chưa đánh giá</option>
          </Select>
          </div>
          <span className="ml-auto flex items-center gap-2">
            {hasFilters && (
              <button type="button" onClick={() => update({ q: '', phong: '', linhvuc: '', doitac: '', phamvi: '', giaidoan: '', danhgia: '' })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600">
                <X className="h-3.5 w-3.5" aria-hidden="true" /> Xoá bộ lọc
              </button>
            )}
            <span className="w-44">
              <Select value={state.sapxep} onChange={(e) => update({ sapxep: e.target.value as MouSortKey })} aria-label="Sắp xếp" className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                {MOU_SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </span>
          </span>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
      {isLoading && !views.length ? (
        <div className={cn(PANEL, 'h-96 animate-pulse bg-slate-50')} aria-hidden="true" />
      ) : shown.length === 0 ? (
        <div className={PANEL}>
          <EmptyState title="Không có MOU nào khớp" hint={hasFilters ? 'Thử bỏ bớt bộ lọc.' : 'Chọn góc nhìn khác.'} />
        </div>
      ) : (
        <MouTable views={shown} onOpen={(id) => setMode({ kind: 'view', id })} />
      )}

      <MouDetailHost mode={mode} onChange={setMode} departments={departments} onSaved={reload} />
    </div>
  );
}

export default function MouListPage() {
  return (
    <Suspense fallback={<div className={cn(PANEL, 'h-96 animate-pulse bg-slate-50')} />}>
      <MouList />
    </Suspense>
  );
}
