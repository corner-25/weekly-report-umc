'use client';

import { Suspense, useCallback, useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FileSpreadsheet, FileText, Plus, RefreshCw, Search } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { ErrorBanner, PRIMARY_BTN, SECONDARY_BTN } from '@/components/crm/ui';
import { useWeeksList } from '@/lib/swr';
import { cn } from '@/lib/utils';
import { auditYear, needsAttention } from '@/lib/weeks/audit';
import { formatDateKey, vnTodayKey } from '@/lib/weeks/hospital-week';
import {
  matchesWeekQuery,
  parseWeekListFilters,
  serializeWeekListFilters,
  withBack,
  type WeekListFilters,
  type WeekStatusFilter,
} from '@/lib/weeks/list-filters';
import { WeeksKpiBand } from '@/components/weeks/WeeksKpiBand';
import { WeekStrip } from '@/components/weeks/WeekStrip';
import { WeeksAuditPanel } from '@/components/weeks/WeeksAuditPanel';
import { WeekRow } from '@/components/weeks/WeekRow';
import type { WeekListItem } from '@/components/weeks/types';
import { WeeksSkeleton } from '@/components/weeks/WeeksSkeleton';
import { WeeklyModuleNav } from '@/components/weeks/WeeklyModuleNav';

const YEARS_BACK = 4;

const STATUS_TABS: { value: WeekStatusFilter; label: string; hint: string }[] = [
  { value: 'all', label: 'Tất cả', hint: 'Mọi báo cáo của năm' },
  { value: 'draft', label: 'Nháp', hint: 'Đã có dữ liệu nhưng chưa chốt' },
  { value: 'completed', label: 'Đã chốt', hint: 'Đã bấm "Hoàn thành & Lưu" — báo cáo đã chốt' },
  { value: 'issues', label: 'Có vấn đề', hint: 'Tuần lệch ngày, trùng ngày, rỗng hoặc thiếu đơn vị thường lệ' },
];

export default function WeeksListPage() {
  return (
    <Suspense fallback={<WeeksSkeleton />}>
      <WeeksList />
    </Suspense>
  );
}

function WeeksList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const todayKey = vnTodayKey();
  const currentYear = Number(todayKey.slice(0, 4));

  const filters = useMemo(() => parseWeekListFilters(searchParams, currentYear), [searchParams, currentYear]);
  const listQuery = serializeWeekListFilters(filters, currentYear);

  // Ô tìm gõ tự do, đẩy lên URL sau một nhịp để không giật trang.
  const [draftQ, setDraftQ] = useState(filters.q);
  useEffect(() => setDraftQ(filters.q), [filters.q]);

  const setFilters = useCallback((patch: Partial<WeekListFilters>) => {
    const qs = serializeWeekListFilters({ ...filters, ...patch }, currentYear);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [filters, currentYear, pathname, router]);

  useEffect(() => {
    if (draftQ === filters.q) return;
    const t = setTimeout(() => setFilters({ q: draftQ }), 300);
    return () => clearTimeout(t);
  }, [draftQ, filters.q, setFilters]);

  const { data, error, isLoading, isValidating, mutate } = useWeeksList({ year: filters.year });
  const weeks: WeekListItem[] = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const audit = useMemo(() => auditYear(weeks, filters.year, todayKey), [weeks, filters.year, todayKey]);

  const counts = useMemo(() => ({
    all: weeks.length,
    draft: weeks.filter((w) => w.status === 'DRAFT').length,
    completed: weeks.filter((w) => w.status === 'COMPLETED').length,
    issues: weeks.filter((w) => needsAttention(audit.issuesByWeek[w.id])).length,
  }), [weeks, audit]);

  const visible = useMemo(() => weeks
    .filter((w) => {
      if (filters.status === 'draft') return w.status === 'DRAFT';
      if (filters.status === 'completed') return w.status === 'COMPLETED';
      if (filters.status === 'issues') return needsAttention(audit.issuesByWeek[w.id]);
      return true;
    })
    .filter((w) => matchesWeekQuery(w.weekNumber, filters.q))
    .sort((a, b) => b.weekNumber - a.weekNumber), [weeks, filters, audit]);

  const latest = useMemo(
    () => weeks.reduce<WeekListItem | null>((acc, w) => (!acc || w.updatedAt > acc.updatedAt ? w : acc), null),
    [weeks],
  );

  // Bấm vào tuần là xem báo cáo tóm tắt; chi tiết nhiệm vụ là trang phụ.
  const weekHref = useCallback((id: string) => withBack(`/dashboard/weeks/${id}/summary`, listQuery), [listQuery]);
  const tasksHref = useCallback((id: string) => withBack(`/dashboard/weeks/${id}`, listQuery), [listQuery]);

  const baseYears = Array.from({ length: YEARS_BACK + 2 }, (_, i) => currentYear + 1 - i);
  const years = baseYears.includes(filters.year)
    ? baseYears
    : [...baseYears, filters.year].sort((a, b) => b - a);

  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-fade-in">
      <WeeklyModuleNav />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 shadow-sm shadow-brand-500/20">
            <FileText className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Báo cáo tuần Bệnh viện</h1>
            <p className="text-sm text-slate-500">
              Tuần chạy Thứ Bảy → Thứ Sáu · quét tự động hằng ngày
              {latest && (
                <> · Cập nhật gần nhất: tuần {latest.weekNumber}, {formatDateKey(vnTodayKey(new Date(latest.updatedAt)), true)}</>
              )}
            </p>
          </div>
        </div>
      </header>

      {error && (
        <div className="space-y-2">
          <ErrorBanner message="Không tải được danh sách báo cáo tuần. Kiểm tra kết nối rồi thử lại." />
          <button type="button" onClick={() => void mutate()} className={SECONDARY_BTN}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Thử lại
          </button>
        </div>
      )}

      {isLoading && weeks.length === 0 ? (
        <WeeksSkeleton embedded />
      ) : (
        <>
          <WeeksKpiBand
            year={filters.year}
            audit={audit}
            attentionCount={counts.issues}
            weekHref={weekHref}
          />

          <WeekStrip year={filters.year} weeks={weeks} audit={audit} weekHref={weekHref} />

          <WeeksAuditPanel weeks={weeks} audit={audit} weekHref={tasksHref} />

          <section aria-labelledby="weeks-list-heading" className="space-y-3">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
              <h2 id="weeks-list-heading" className="sr-only">Danh sách báo cáo</h2>
              <div role="group" aria-label="Lọc theo trạng thái" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
                {STATUS_TABS.map((tab) => {
                  const isOn = filters.status === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      aria-pressed={isOn}
                      title={tab.hint}
                      onClick={() => setFilters({ status: tab.value })}
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                        isOn ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
                      )}
                    >
                      {tab.label}
                      <span
                        className={cn(
                          'rounded-full px-1.5 text-xs tabular-nums',
                          isOn ? 'bg-white/20' : tab.value === 'issues' && counts.issues > 0 ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {counts[tab.value]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 lg:ml-auto">
                <label className="relative min-w-0 flex-1 lg:w-56">
                  <span className="sr-only">Tìm theo số tuần</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    type="search"
                    inputMode="numeric"
                    value={draftQ}
                    onChange={(e) => setDraftQ(e.target.value)}
                    placeholder="Số tuần: 40 hoặc 36-40"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </label>
                <label className="w-36 shrink-0">
                  <span className="sr-only">Năm</span>
                  <Select
                    value={filters.year}
                    onChange={(e) => setFilters({ year: Number(e.target.value), status: 'all', q: '' })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  >
                    {years.map((y) => <option key={y} value={y}>Năm {y}</option>)}
                  </Select>
                </label>
              </div>
            </div>

            <p className="px-1 text-xs text-slate-500" aria-live="polite">
              Hiển thị {visible.length}/{weeks.length} báo cáo năm {filters.year}
              {isValidating && !isLoading && ' · đang làm mới…'}
            </p>

            {visible.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300" aria-hidden="true" />
                <p className="mb-4 text-sm text-slate-500">
                  {weeks.length === 0 ? `Năm ${filters.year} chưa có báo cáo nào.` : 'Không có báo cáo khớp bộ lọc.'}
                </p>
                {weeks.length === 0 ? (
                  <p className="text-xs text-slate-400">Báo cáo các phòng được quét tự động hằng ngày từ OneDrive.</p>
                ) : (
                  <button type="button" onClick={() => { setDraftQ(''); setFilters({ status: 'all', q: '' }); }} className={SECONDARY_BTN}>
                    Xoá bộ lọc
                  </button>
                )}
              </div>
            ) : (
              <ol className="space-y-2.5">
                {visible.map((w) => (
                  <li key={w.id}>
                    <WeekRow
                      week={w}
                      issues={audit.issuesByWeek[w.id] ?? []}
                      detailHref={weekHref(w.id)}
                      tasksHref={tasksHref(w.id)}
                      editHref={withBack(`/dashboard/weeks/${w.id}/edit`, listQuery)}
                      metricsHref={`/dashboard/weeks/${w.id}/metrics`}
                    />
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}
    </div>
  );
}
