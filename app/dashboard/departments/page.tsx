'use client';

/**
 * Phòng ban — bảng tổng quan: mỗi phòng một dòng tín hiệu (công việc chỉ đạo,
 * nộp báo cáo tuần, nhiệm vụ báo cáo tuần, số liệu, thư ký). Bấm tên phòng để
 * mở hồ sơ chi tiết. Thêm/sửa/xoá phòng nằm trong "Quản lý danh mục".
 * Tìm, lọc, sắp xếp lưu trên URL để gửi link được.
 */
import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { Building2, Plus, Settings2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { crmFetch } from '@/components/crm/api';
import { EmptyState, ErrorBanner, PANEL, PRIMARY_BTN, SECONDARY_BTN } from '@/components/crm/ui';
import { DepartmentAdminModal } from '@/components/departments/DepartmentAdminModal';
import { OverviewCards } from '@/components/departments/OverviewCards';
import { OverviewSummary } from '@/components/departments/OverviewSummary';
import { OverviewTable } from '@/components/departments/OverviewTable';
import { OverviewToolbar, type ViewMode } from '@/components/departments/OverviewToolbar';
import type { DepartmentOverview } from '@/lib/department-overview';
import {
  DEFAULT_DIR, filterCounts, matchesFilter, overviewTotals, parseFilterKey, parseSortDir, parseSortKey, searchRows, sortRows,
  type FilterKey, type SortDir, type SortKey,
} from '@/lib/department-overview-view';
import { cn } from '@/lib/utils';

const VIEW_STORAGE_KEY = 'departments-view';
const SEARCH_DEBOUNCE_MS = 250;

function readView(): ViewMode {
  try {
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
    // Giá trị cũ "grid"/"list" của trang trước đây.
    return saved === 'cards' || saved === 'grid' ? 'cards' : 'table';
  } catch {
    return 'table';
  }
}

function DepartmentsOverview() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filter = parseFilterKey(params.get('loc'));
  const sort = parseSortKey(params.get('sap'));
  const dir = parseSortDir(params.get('chieu'), sort);
  const urlQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  const [view, setView] = useState<ViewMode>('table');
  const [admin, setAdmin] = useState<null | 'list' | 'create'>(null);

  const { data, error, isLoading, mutate } = useSWR<DepartmentOverview>('/api/departments/overview', (url: string) => crmFetch<DepartmentOverview>(url), {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  useEffect(() => setView(readView()), []);

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Gõ tìm: cập nhật URL sau một nhịp ngắn để không điều hướng mỗi phím.
  useEffect(() => {
    if (query === urlQuery) return;
    const timer = setTimeout(() => setParams({ q: query.trim() || null }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const onSort = (key: SortKey, nextDir?: SortDir) => {
    const resolved = nextDir ?? (key === sort ? (dir === 'asc' ? 'desc' : 'asc') : DEFAULT_DIR[key]);
    setParams({ sap: key === 'attention' ? null : key, chieu: resolved === DEFAULT_DIR[key] ? null : resolved });
  };
  const onFilter = (next: FilterKey) => setParams({ loc: next === 'all' ? null : next });
  const onView = (next: ViewMode) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* Trình duyệt chặn lưu trữ — vẫn đổi được dạng xem trong phiên này. */
    }
  };

  const departments = useMemo(() => data?.departments ?? [], [data]);
  const totals = useMemo(() => overviewTotals(departments), [departments]);
  const searched = useMemo(() => searchRows(departments, query), [departments, query]);
  const counts = useMemo(() => filterCounts(searched), [searched]);
  const rows = useMemo(() => sortRows(searched.filter((r) => matchesFilter(r, filter)), sort, dir), [searched, filter, sort, dir]);

  return (
    <div className="space-y-5 animate-page-in">
      <PageHeader
        icon={Building2}
        title="Phòng ban"
        description="Tình hình từng phòng: công việc chỉ đạo, báo cáo tuần, số liệu và nhân sự"
        className="flex-wrap gap-3"
        actions={
          <>
            <button type="button" onClick={() => setAdmin('list')} className={cn(SECONDARY_BTN, 'px-3')} disabled={!data}>
              <Settings2 className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Quản lý danh mục</span><span className="sm:hidden">Danh mục</span>
            </button>
            <button type="button" onClick={() => setAdmin('create')} className={cn(PRIMARY_BTN, 'px-3')} disabled={!data}>
              <Plus className="h-4 w-4" aria-hidden="true" /> <span>Thêm phòng</span>
            </button>
          </>
        }
      />

      {error && <ErrorBanner message={error instanceof Error ? error.message : 'Không tải được tổng quan phòng ban.'} />}

      {isLoading && !data ? (
        <OverviewSkeleton />
      ) : data ? (
        <>
          <OverviewSummary totals={totals} latestWeek={data.latestWeek} filter={filter} onFilter={onFilter} />
          <OverviewToolbar query={query} onQuery={setQuery} filter={filter} counts={counts} onFilter={onFilter} sort={sort} dir={dir} onSort={onSort} view={view} onView={onView} />
          <p className="px-1 text-xs text-slate-500" aria-live="polite">
            {rows.length === departments.length ? `${rows.length} phòng ban` : `${rows.length}/${departments.length} phòng ban khớp`}
            {sort === 'attention' && ' · xếp phòng cần chú ý lên trước (quá hạn, lâu chưa cập nhật, chưa nộp báo cáo, nhiệm vụ cần xác nhận, số liệu chậm)'}
          </p>
          {rows.length === 0 ? (
            <div className={cn(PANEL, 'border-dashed')}>
              <EmptyState icon={<Building2 className="h-10 w-10" />} title="Không có phòng ban nào khớp" hint={query ? 'Thử từ khoá khác hoặc bỏ bộ lọc.' : 'Bỏ bộ lọc để xem tất cả.'} />
            </div>
          ) : (
            <>
              <div className={cn(view === 'table' ? 'hidden md:block' : 'hidden')}>
                <OverviewTable rows={rows} sort={sort} dir={dir} onSort={(key) => onSort(key)} weeksShown={data.weeksShown} />
              </div>
              <div className={cn(view === 'table' && 'md:hidden')}>
                <OverviewCards rows={rows} latestWeek={data.latestWeek} />
              </div>
            </>
          )}
        </>
      ) : null}

      {admin && data && (
        <DepartmentAdminModal
          departments={[...data.departments].sort((a, b) => a.name.localeCompare(b.name, 'vi'))}
          startWithCreate={admin === 'create'}
          onClose={() => setAdmin(null)}
          onChanged={() => void mutate()}
        />
      )}
    </div>
  );
}

/** Khung chờ đúng bố cục thật — trang không nhảy khi dữ liệu về. */
function OverviewSkeleton() {
  const block = 'animate-pulse rounded-2xl bg-slate-200/70';
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Đang tải tổng quan phòng ban">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className={cn(block, 'h-24')} />)}</div>
      <div className={cn(block, 'h-11')} />
      <div className={cn(block, 'h-[480px]')} />
    </div>
  );
}

export default function DepartmentsPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <DepartmentsOverview />
    </Suspense>
  );
}
