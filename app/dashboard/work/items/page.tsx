'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ListChecks, Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import { WORK_KIND_LABELS, type WorkKindKey } from '@/lib/work/constants';
import { crmFetch, errorMessage } from '@/components/crm/api';
import { ErrorBanner, ICON_BTN, PANEL, PRIMARY_BTN, inputClass } from '@/components/crm/ui';
import { WorkItemModal } from '@/components/work/WorkItemModal';
import { WorkItemRow } from '@/components/work/WorkBits';
import type { WorkItemDTO } from '@/components/work/types';

const VIEWS = [
  ['open', 'Đang mở'],
  ['overdue', 'Quá hạn'],
  ['stale', 'Lâu chưa cập nhật'],
  ['done', 'Đã xong'],
  ['all', 'Tất cả'],
] as const;

/** Danh sách công việc; bộ lọc nằm trên URL để gửi link cho nhau được. */
function WorkItemsList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view = params.get('view') ?? 'open';
  const kind = params.get('kind') ?? '';
  const departmentId = params.get('departmentId') ?? '';
  const [q, setQ] = useState(params.get('q') ?? '');
  const [items, setItems] = useState<WorkItemDTO[] | null>(null);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  };

  const load = useCallback(async () => {
    setError('');
    const query = new URLSearchParams();
    if (view !== 'all') query.set('view', view);
    if (kind) query.set('kind', kind);
    if (departmentId) query.set('departmentId', departmentId);
    const search = params.get('q');
    if (search) query.set('q', search);
    try {
      setItems(await crmFetch<WorkItemDTO[]>(`/api/work/items?${query.toString()}`));
    } catch (loadError) {
      setError(errorMessage(loadError, 'Không tải được danh sách công việc.'));
    }
  }, [view, kind, departmentId, params]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <Link href="/dashboard/work" className={cn(ICON_BTN, 'inline-flex items-center gap-1.5 px-2 text-sm font-medium')}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Theo dõi công việc
      </Link>
      <PageHeader
        icon={ListChecks}
        title="Danh sách công việc"
        description={items ? `${items.length} việc${items.length >= 300 ? ' (hiện 300 việc đầu, lọc thêm để thu hẹp)' : ''}` : 'Đang tải...'}
        className="flex-wrap gap-4"
        actions={
          <button type="button" onClick={() => setShowCreate(true)} className={PRIMARY_BTN}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Mở việc theo kế hoạch
          </button>
        }
      />
      <ErrorBanner message={error} />

      <div className={cn(PANEL, 'space-y-3 p-4')}>
        <div role="group" aria-label="Lọc theo tình trạng" className="flex flex-wrap gap-1.5">
          {VIEWS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setParam('view', key === 'open' ? '' : key)}
              className={cn('rounded-full px-3 py-1.5 text-[13px] font-medium transition', view === key ? 'bg-cyan-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <form
            className="relative min-w-[220px] flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              setParam('q', q.trim());
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <label htmlFor="work-q" className="sr-only">Tìm công việc</label>
            <input id="work-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên việc, đơn vị, người chỉ đạo, mã việc (gõ không dấu được)" className={inputClass(undefined, 'pl-9')} />
          </form>
          <label htmlFor="work-kind" className="sr-only">Loại công việc</label>
          <select id="work-kind" value={kind} onChange={(e) => setParam('kind', e.target.value)} className={inputClass(undefined, 'w-auto')}>
            <option value="">Mọi loại</option>
            {(Object.keys(WORK_KIND_LABELS) as WorkKindKey[]).map((k) => <option key={k} value={k}>{WORK_KIND_LABELS[k]}</option>)}
          </select>
          {departmentId && (
            <button type="button" onClick={() => setParam('departmentId', '')} className="rounded-xl bg-cyan-50 px-3 text-sm font-medium text-cyan-800 hover:bg-cyan-100">
              Đang lọc 1 đơn vị · bỏ lọc
            </button>
          )}
        </div>
      </div>

      <section className={cn(PANEL, 'p-2 sm:p-3')} aria-label="Kết quả">
        {!items ? (
          <p className="py-10 text-center text-sm text-slate-500">Đang tải...</p>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">Không có công việc nào khớp bộ lọc.</p>
        ) : (
          <ul className="divide-y divide-slate-100">{items.map((i) => <WorkItemRow key={i.id} item={i} />)}</ul>
        )}
      </section>

      {showCreate && (
        <WorkItemModal
          onClose={() => setShowCreate(false)}
          onSaved={(saved) => router.push(`/dashboard/work/items/${saved.id}`)}
        />
      )}
    </div>
  );
}

export default function WorkItemsPage() {
  return (
    <Suspense>
      <WorkItemsList />
    </Suspense>
  );
}
