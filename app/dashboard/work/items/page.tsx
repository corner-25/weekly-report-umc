'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ListChecks, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { crmFetch, errorMessage } from '@/components/crm/api';
import { ErrorBanner, ICON_BTN, PANEL, PRIMARY_BTN } from '@/components/crm/ui';
import { WorkItemModal } from '@/components/work/WorkItemModal';
import { WorkListRow } from '@/components/work/list/WorkListRow';
import { WorkListToolbar } from '@/components/work/list/WorkListToolbar';
import { WorkPreviewDrawer } from '@/components/work/list/WorkPreviewDrawer';
import { downloadCsv } from '@/components/work/list/export-csv';
import { LIST_URL_KEY, SCROLL_KEY, SHOWN_KEY, listSearch, readSession, writeSession } from '@/components/work/list/list-session';
import { LIST_SORTS, LIST_VIEWS, filterItems, groupByUnit, sortItems, type ListFilters, type ListSort, type ListView, type WorkListItem } from '@/lib/work/list';

const PAGE_SIZE = 60;
const RESTORE_DELAYS_MS = [0, 80, 250, 600];
/**
 * Giữ dữ liệu và vị trí cuộn khi xem một việc rồi bấm Quay lại: danh sách vẽ
 * ngay từ bản đã tải (rồi lặng lẽ tải lại), cuộn về đúng chỗ cũ, bộ lọc nằm trên URL.
 */
let cachedItems: WorkListItem[] | null = null;
const isView = (v: string | null): v is ListView => LIST_VIEWS.some((x) => x.key === v);
const isSort = (v: string | null): v is ListSort => LIST_SORTS.some((x) => x.key === v);

function WorkItemsList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString();
  const memoryKey = listSearch(search);
  const rawView = params.get('view');
  const filters: ListFilters = {
    view: isView(rawView) ? rawView : 'open',
    year: params.get('nam') ?? undefined,
    departmentId: params.get('departmentId') ?? undefined,
    leader: params.get('lanhdao') ?? undefined,
    category: params.get('hinhthuc') ?? undefined,
    priority: params.get('uutien') ?? undefined,
    q: params.get('q') ?? undefined,
  };
  const rawSort = params.get('sapxep');
  const sort: ListSort = isSort(rawSort) ? rawSort : filters.view === 'done' ? 'completed' : filters.view === 'stale' ? 'silent' : 'smart';
  const grouped = params.get('nhom') === 'donvi';
  const previewId = params.get('xem');

  const [all, setAll] = useState<WorkListItem[] | null>(cachedItems);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [shown, setShown] = useState(() => Number(readSession(`${SHOWN_KEY}:${memoryKey}`)) || PAGE_SIZE);
  const restored = useRef(false);
  // Đọc trước khi trình nghe cuộn kịp ghi đè (Next cuộn về 0 lúc gắn trang).
  const restoreTarget = useRef<number>(typeof window === 'undefined' ? 0 : Number(readSession(`${SCROLL_KEY}:${memoryKey}`)) || 0);

  const load = useCallback(async () => {
    setError('');
    try {
      const items = await crmFetch<WorkListItem[]>('/api/work/list');
      cachedItems = items;
      setAll(items);
    } catch (loadError) {
      setError(errorMessage(loadError, 'Không tải được danh sách công việc.'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onChange = useCallback(
    (changes: Record<string, string>) => {
      const next = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      if (!('xem' in changes)) setShown(PAGE_SIZE);
    },
    [pathname, router],
  );

  const { items: filtered, counts } = useMemo(() => (all ? filterItems(all, filters) : { items: [], counts: null }), [all, search]);
  const sorted = useMemo(() => sortItems(filtered, sort), [filtered, sort]);
  const visible = sorted.slice(0, shown);
  const groups = useMemo(() => (grouped ? groupByUnit(visible) : null), [grouped, visible]);

  // Ghi nhớ bộ lọc, vị trí cuộn và số dòng đang hiện cho đúng bộ lọc này.
  useEffect(() => {
    writeSession(LIST_URL_KEY, memoryKey ? `${pathname}?${memoryKey}` : pathname);
  }, [memoryKey, pathname]);
  useEffect(() => {
    writeSession(`${SHOWN_KEY}:${memoryKey}`, String(shown));
  }, [shown, memoryKey]);
  useEffect(() => {
    // Khi bấm sang trang khác, Next cuộn về đầu trước khi gỡ trang này — URL lúc đó đã đổi, bỏ qua để không ghi đè vị trí cũ.
    const save = () => {
      if (window.location.pathname === pathname) writeSession(`${SCROLL_KEY}:${memoryKey}`, String(window.scrollY));
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [memoryKey, pathname]);
  // Next cuộn về đầu sau khi chuyển trang (kể cả bấm Quay lại) — cuộn lại về chỗ cũ sau nhịp đó,
  // dừng ngay nếu người dùng tự cuộn.
  useEffect(() => {
    if (restored.current || !all) return;
    restored.current = true;
    const y = restoreTarget.current;
    if (!y) return;
    const timers = RESTORE_DELAYS_MS.map((ms) => setTimeout(() => {
      if (Math.abs(window.scrollY - y) > 4 && window.scrollY < 4) window.scrollTo(0, y);
    }, ms));
    return () => timers.forEach(clearTimeout);
  }, [all]);

  const previewIndex = previewId ? sorted.findIndex((i) => i.id === previewId) : -1;
  const preview = previewIndex >= 0 ? sorted[previewIndex] : previewId ? all?.find((i) => i.id === previewId) : undefined;
  const step = useCallback(
    (delta: 1 | -1) => {
      const next = sorted[previewIndex + delta];
      if (!next) return;
      if (previewIndex + delta >= shown) setShown((s) => s + PAGE_SIZE);
      onChange({ xem: next.id });
      document.getElementById(`work-row-${next.id}`)?.scrollIntoView({ block: 'nearest' });
    },
    [sorted, previewIndex, shown, onChange],
  );

  const renderRows = (rows: WorkListItem[]) => (
    <ul className="divide-y divide-slate-100">
      {rows.map((i) => <WorkListRow key={i.id} item={i} selected={i.id === previewId} onOpen={(id) => onChange({ xem: id })} />)}
    </ul>
  );

  return (
    <div className="space-y-4">
      <Link href="/dashboard/work" className={cn(ICON_BTN, 'inline-flex items-center gap-1.5 px-2 text-sm font-medium')}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Bảng điều hành
      </Link>
      <PageHeader
        icon={ListChecks}
        title="Danh sách công việc"
        description={all ? `${sorted.length} việc khớp bộ lọc · bấm một việc để xem nhanh, ↑/↓ chuyển việc` : 'Đang tải...'}
        className="flex-wrap gap-4"
        actions={
          <button type="button" onClick={() => setShowCreate(true)} className={PRIMARY_BTN}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Mở việc theo kế hoạch
          </button>
        }
      />
      <ErrorBanner message={error} />

      <WorkListToolbar
        all={all ?? []}
        filters={filters}
        sort={sort}
        grouped={grouped}
        counts={counts}
        onChange={onChange}
        exportCount={sorted.length}
        onExport={() => downloadCsv(sorted, `cong-viec-${new Date().toISOString().slice(0, 10)}.csv`)}
      />

      <section className={cn(PANEL, 'overflow-hidden')} aria-label="Kết quả">
        {!all ? (
          <div className="space-y-px" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-28 animate-pulse bg-slate-50" />)}
          </div>
        ) : sorted.length === 0 ? (
          <p className="py-14 text-center text-sm text-slate-500">Không có công việc nào khớp bộ lọc.</p>
        ) : groups ? (
          groups.map((g) => (
            <section key={g.key} aria-label={g.unit}>
              <h2 className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-slate-100 bg-slate-50/95 px-5 py-2 text-sm font-bold text-slate-800 backdrop-blur first:border-t-0">
                {g.unit}
                <span className="text-xs font-medium text-slate-500">
                  <b className="text-brand-700">{g.items.length}</b> việc
                  {g.overdue > 0 && <> · <b className="text-rose-600">{g.overdue}</b> quá hạn</>}
                  {g.stale > 0 && <> · <b className="text-amber-600">{g.stale}</b> lâu chưa cập nhật</>}
                </span>
              </h2>
              {renderRows(g.items)}
            </section>
          ))
        ) : (
          renderRows(visible)
        )}
        {all && sorted.length > shown && (
          <div className="border-t border-slate-100 p-3 text-center">
            <button type="button" onClick={() => setShown((s) => s + PAGE_SIZE)} className="rounded-xl px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
              Hiện thêm {Math.min(PAGE_SIZE, sorted.length - shown)} việc · còn {sorted.length - shown}
            </button>
          </div>
        )}
      </section>

      {preview && <WorkPreviewDrawer item={preview} onClose={() => onChange({ xem: '' })} onStep={step} onChanged={load} />}
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
