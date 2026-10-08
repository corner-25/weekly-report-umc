'use client';

import { EntityCombobox, type ComboValue } from '@/components/crm/EntityCombobox';
import { Pagination } from '@/components/crm/Pagination';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { Crown, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { DELEGATION_PURPOSES, DELEGATION_TOPICS, VIP_STAFF } from '@/lib/crm/constants';
import { DelegationStatsCard } from '@/components/crm/DelegationStatsCard';
import { VipEscortStatsCard } from '@/components/crm/VipEscortStatsCard';
import { changeInteractionStatus, crmFetch, errorMessage } from '@/components/crm/api';
import { InteractionModal, interactionModeOf, type InteractionMode } from '@/components/crm/InteractionModal';
import { INTERACTION_ICONS, InteractionTimeline } from '@/components/crm/InteractionTimeline';
import type { InteractionDTO } from '@/components/crm/types';
import { ACCENT_BTN, EmptyState, ErrorBanner, PANEL, PRIMARY_BTN, SECONDARY_BTN, Stat } from '@/components/crm/ui';
import { useConfirmDelete } from '@/components/crm/useConfirmDelete';
import { DateInput } from '@/components/ui/DateInput';

type TypeTab = 'ALL' | 'VIP_ESCORT' | 'DELEGATION' | 'FOLLOW_UP' | 'OTHER' | 'PLANNED';
const TABS: Array<{ value: TypeTab; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'VIP_ESCORT', label: 'Dẫn khám VIP' },
  { value: 'DELEGATION', label: 'Tiếp đoàn' },
  { value: 'FOLLOW_UP', label: 'Nhắc tái khám' },
  { value: 'OTHER', label: 'Khác' },
  { value: 'PLANNED', label: 'Lịch hẹn' },
];
const SEARCH_DEBOUNCE_MS = 250;
/** Sổ tiếp đoàn bắt đầu từ 2022. */
const FIRST_DELEGATION_YEAR = 2022;
const YEARS = Array.from({ length: new Date().getFullYear() - FIRST_DELEGATION_YEAR + 1 }, (_, i) => String(new Date().getFullYear() - i));

const isOtherType = (item: InteractionDTO) => item.type !== 'VIP_ESCORT' && item.type !== 'DELEGATION';

type Dialog = { mode: InteractionMode; initial?: InteractionDTO };

export default function CrmInteractionsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500">Đang tải...</div>}>
      <CrmInteractionsContent />
    </Suspense>
  );
}

function CrmInteractionsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') as TypeTab | null;
  const initialScope = searchParams.get('scope');

  const [referrerFilter, setReferrerFilter] = useState<ComboValue | null>(null);
  const [doctorFilter, setDoctorFilter] = useState<ComboValue | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [visitStats, setVisitStats] = useState<{ done: number; planned: number; patients: number; referrers: number; doctors: number; byReferrer: Array<{ id: string; name: string; count: number }>; byDoctor: Array<{ id: string; name: string; count: number }> } | null>(null);
  const [tab, setTab] = useState<TypeTab>(initialTab && TABS.some(t => t.value === initialTab) ? initialTab : 'ALL');
  const [followUpScope, setFollowUpScope] = useState<'upcoming14' | 'upcoming30' | 'all' | 'overdue'>((initialScope as any) || 'upcoming14');
  const [staffName, setStaffName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  // Bộ lọc sổ tiếp đoàn (chỉ hiện ở tab Dẫn đoàn).
  const [year, setYear] = useState('');
  const [purpose, setPurpose] = useState('');
  const [topic, setTopic] = useState('');
  const [hostDepartmentId, setHostDepartmentId] = useState('');
  const [needsReview, setNeedsReview] = useState(false);
  const { data: departments } = useSWR<Array<{ id: string; name: string }>>('/api/departments', (url: string) => fetch(url).then((r) => (r.ok ? r.json() : [])), { revalidateOnFocus: false });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<InteractionDTO[]>([]);
  const [monthStats, setMonthStats] = useState<{ escorts: number; delegations: number; guests: number; others: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { askDelete, deleteDialog } = useConfirmDelete(setError);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [tab, staffName, from, to, debouncedSearch, year, purpose, topic, hostDepartmentId, needsReview, referrerFilter, doctorFilter, followUpScope]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (tab === 'VIP_ESCORT') {
      if (referrerFilter && 'id' in referrerFilter) params.set('referrerId', referrerFilter.id);
      if (doctorFilter && 'id' in doctorFilter) params.set('doctorId', doctorFilter.id);
    }
    if (tab === 'FOLLOW_UP') {
      params.set('followUp', '1');
      params.set('followUpScope', followUpScope);
    }
    if (tab === 'OTHER') params.set('type', 'OTHER_GROUP');
    // Tab "Khác" gồm nhiều loại — lấy hết rồi lọc ở giao diện.
    if (tab === 'VIP_ESCORT' || tab === 'DELEGATION') params.set('type', tab);
    if (tab === 'PLANNED') params.set('status', 'PLANNED');
    if (staffName) params.set('staffName', staffName);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (tab === 'DELEGATION') {
      if (year) params.set('year', year);
      if (purpose) params.set('purpose', purpose);
      if (topic) params.set('topic', topic);
      if (hostDepartmentId) params.set('hostDepartmentId', hostDepartmentId);
      if (needsReview) params.set('needsReview', '1');
    }
    setLoading(true);
    setError('');
    crmFetch<{ items: InteractionDTO[]; total: number; page: number; stats: NonNullable<typeof visitStats> }>(`/api/crm/interactions?${params}`, { signal: controller.signal })
      .then((data) => {
        setItems(data.items); setTotal(data.total); setPage(data.page); setVisitStats(data.stats);
        setLoading(false);
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(loadError, 'Không thể tải danh sách tương tác.'));
        setLoading(false);
      });
    return () => controller.abort();
  }, [tab, staffName, from, to, debouncedSearch, year, purpose, topic, hostDepartmentId, needsReview, reloadKey, page, referrerFilter, doctorFilter, followUpScope]);

  useEffect(() => {
    const now = new Date();
    const params = new URLSearchParams({ stats: '1', from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') });
    crmFetch<NonNullable<typeof monthStats>>(`/api/crm/interactions?${params}`)
      .then(setMonthStats)
      .catch(() => setMonthStats(null));
  }, [reloadKey]);

  const delegationFilter = tab === 'DELEGATION' && Boolean(year || purpose || topic || hostDepartmentId || needsReview);
  const hasFilter = Boolean(staffName || from || to || debouncedSearch || tab !== 'ALL' || delegationFilter || followUpScope !== 'upcoming14');
  const resetFilters = () => {
    setTab('ALL');
    setFollowUpScope('upcoming14');
    setReferrerFilter(null); setDoctorFilter(null);
    setYear('');
    setPurpose('');
    setTopic('');
    setHostDepartmentId('');
    setNeedsReview(false);
    setStaffName('');
    setFrom('');
    setTo('');
    setSearch('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Crown}
        title="Tiếp đón & dẫn đoàn"
        description="Mọi lượt dẫn khám VIP, tiếp đoàn và tương tác với đối tác"
        className="flex-wrap gap-4"
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setDialog({ mode: 'VIP_ESCORT' })} className={PRIMARY_BTN}>
              <INTERACTION_ICONS.VIP_ESCORT className="h-4 w-4" aria-hidden="true" /> Dẫn khách VIP khám
            </button>
            <button type="button" onClick={() => setDialog({ mode: 'DELEGATION' })} className={ACCENT_BTN}>
              <INTERACTION_ICONS.DELEGATION className="h-4 w-4" aria-hidden="true" /> Dẫn đoàn
            </button>
            <button type="button" onClick={() => setDialog({ mode: 'OTHER' })} className={SECONDARY_BTN}>
              Tương tác khác
            </button>
          </div>
        }
      />

      <ErrorBanner message={error} />

      {/* 3 KPI Cards / Charts trên đầu trang */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {/* KPI 1: Dẫn khám VIP */}
        <div className={cn(PANEL, 'relative overflow-hidden p-4 sm:p-5 border-cyan-200/70 bg-gradient-to-br from-cyan-50/50 via-white to-white shadow-sm')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-800">Dẫn khám VIP tháng này</p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tabular-nums text-slate-900 sm:text-4xl">
                  {monthStats?.escorts ?? '—'}
                </span>
                <span className="text-xs font-semibold text-cyan-700">lượt khám</span>
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 shadow-sm shadow-cyan-200/50">
              <INTERACTION_ICONS.VIP_ESCORT className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-cyan-100/70 pt-2.5">
            <span>Khách VIP & gia đình</span>
            <span className="font-semibold text-emerald-700">Tiếp đón chu đáo</span>
          </div>
        </div>

        {/* KPI 2: Tiếp đoàn */}
        <div className={cn(PANEL, 'relative overflow-hidden p-4 sm:p-5 border-amber-200/70 bg-gradient-to-br from-amber-50/50 via-white to-white shadow-sm')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Tiếp đoàn tháng này</p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tabular-nums text-slate-900 sm:text-4xl">
                  {monthStats?.delegations ?? '—'}
                </span>
                <span className="text-xs font-semibold text-amber-700">đoàn khách</span>
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shadow-sm shadow-amber-200/50">
              <INTERACTION_ICONS.DELEGATION className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-amber-100/70 pt-2.5">
            <span>Quy mô đại biểu</span>
            <span className="font-semibold text-slate-900">{monthStats?.guests ?? 0} khách tham dự</span>
          </div>
        </div>

        {/* KPI 3: Lịch hẹn & Tương tác khác */}
        <div className={cn(PANEL, 'relative overflow-hidden p-4 sm:p-5 border-indigo-200/70 bg-gradient-to-br from-indigo-50/50 via-white to-white shadow-sm')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-800">Lịch hẹn & Tương tác khác</p>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tabular-nums text-slate-900 sm:text-4xl">
                  {monthStats ? (monthStats.others + (visitStats?.planned ?? 0)) : '—'}
                </span>
                <span className="text-xs font-semibold text-indigo-700">hoạt động</span>
              </div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 shadow-sm shadow-indigo-200/50">
              <INTERACTION_ICONS.MEETING className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-indigo-100/70 pt-2.5">
            <span>Lịch hẹn chuẩn bị: <b className="font-semibold text-amber-700">{visitStats?.planned ?? 0}</b></span>
            <span>Gặp gỡ/MOU: <b className="font-semibold text-slate-900">{monthStats?.others ?? 0}</b></span>
          </div>
        </div>
      </div>

      {/* Thanh chọn loại tương tác */}
      <div role="tablist" aria-label="Loại tương tác" className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn('whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-semibold transition', tab === t.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'FOLLOW_UP' && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-teal-200/80 bg-teal-50/60 p-3 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-900 mr-1">Khoảng thời gian:</span>
          {[
            { id: 'upcoming14', label: '14 ngày tới (2 tuần)' },
            { id: 'upcoming30', label: '30 ngày tới (1 tháng)' },
            { id: 'all', label: 'Tất cả có hẹn' },
            { id: 'overdue', label: 'Đã quá hạn' },
          ].map((scope) => (
            <button
              key={scope.id}
              type="button"
              onClick={() => setFollowUpScope(scope.id as any)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                followUpScope === scope.id
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-white text-teal-800 border border-teal-200/80 hover:bg-teal-100/50'
              )}
            >
              {scope.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'VIP_ESCORT' && (
        <VipEscortStatsCard
          year={year}
          onYear={setYear}
          referrerFilter={referrerFilter}
          onReferrerFilter={setReferrerFilter}
          doctorFilter={doctorFilter}
          onDoctorFilter={setDoctorFilter}
        />
      )}
      {tab === 'DELEGATION' && <DelegationStatsCard year={year} topic={topic} onYear={setYear} onTopic={setTopic} />}

      <div className={PANEL}>
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_160px_160px]">
            <label className="relative block">
              <span className="sr-only">Tìm kiếm</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm khách, đơn vị, nội dung, nơi đến..." className="input pl-10" />
            </label>
            <div>
              <label htmlFor="filter-staff" className="sr-only">Nhân viên</label>
              <Select id="filter-staff" value={staffName} onChange={(e) => setStaffName(e.target.value)} className="px-3.5 py-2.5">
                <option value="">Tất cả nhân viên</option>
                {VIP_STAFF.map((name) => <option key={name} value={name}>{name}</option>)}
              </Select>
            </div>
            <label className="block">
              <span className="sr-only">Từ ngày</span>
              <DateInput type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="sr-only">Đến ngày</span>
              <DateInput type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="input" />
            </label>
          </div>
          {tab === 'VIP_ESCORT' && <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm"><span>Người giới thiệu</span><EntityCombobox kind="contact" value={referrerFilter} onChange={setReferrerFilter} allowNew={false} placeholder="Lọc người giới thiệu" /></label>
            <label className="space-y-1 text-sm"><span>Bác sĩ khám</span><EntityCombobox kind="contact" value={doctorFilter} onChange={setDoctorFilter} allowNew={false} placeholder="Lọc bác sĩ" /></label>
          </div>}
          {tab === 'DELEGATION' && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <Select aria-label="Năm" value={year} onChange={(e) => setYear(e.target.value)} className="px-3.5 py-2.5">
                <option value="">Mọi năm</option>
                {YEARS.map((y) => <option key={y} value={y}>{`Năm ${y}`}</option>)}
              </Select>
              <Select aria-label="Hình thức tiếp" value={purpose} onChange={(e) => setPurpose(e.target.value)} className="px-3.5 py-2.5">
                <option value="">Mọi hình thức</option>
                {DELEGATION_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
              <Select aria-label="Chủ đề" value={topic} onChange={(e) => setTopic(e.target.value)} className="px-3.5 py-2.5">
                <option value="">Mọi chủ đề</option>
                {DELEGATION_TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Select aria-label="Khoa/phòng chủ trì" value={hostDepartmentId} onChange={(e) => setHostDepartmentId(e.target.value)} className="px-3.5 py-2.5">
                <option value="">Mọi khoa/phòng chủ trì</option>
                {(departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
              <label className="flex items-center gap-2 whitespace-nowrap rounded-xl border border-orange-200 bg-orange-50/60 px-3 text-sm font-medium text-orange-900">
                <input type="checkbox" checked={needsReview} onChange={(e) => setNeedsReview(e.target.checked)} className="h-4 w-4 rounded border-orange-300 text-orange-600" />
                Cần xác minh
              </label>
            </div>
          )}
          {hasFilter && (
            <button type="button" onClick={resetFilters} className="text-xs font-semibold text-cyan-700 hover:underline">Bỏ lọc</button>
          )}
        </div>

        <div className="p-4 sm:p-5">
          {loading && items.length === 0 ? (
            <p className="py-10 text-center text-slate-500">Đang tải dữ liệu...</p>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Crown className="h-12 w-12" />}
              title={hasFilter ? 'Không có lượt nào khớp bộ lọc' : 'Chưa có lượt tiếp đón nào'}
              hint={hasFilter ? 'Đổi điều kiện tìm kiếm để xem lại.' : 'Nhấn “Dẫn khách VIP khám” hoặc “Dẫn đoàn” để ghi lượt đầu tiên.'}
            />
          ) : (
            <div className={cn(loading && 'opacity-60 transition-opacity')}>
              <p className="mb-4 text-xs text-slate-500">{total} lượt · 20 lượt/trang</p>
              <InteractionTimeline
                items={items}
                onEdit={(item) => setDialog({ mode: interactionModeOf(item.type), initial: item })}
                onDelete={(item) => askDelete({
                  title: 'Xoá tương tác',
                  message: 'Xoá lượt tương tác này? Hồ sơ khách và đơn vị vẫn được giữ lại.',
                  url: `/api/crm/interactions/${item.id}`,
                  onDone: reload,
                })}
                onStatusChange={(item, status) => {
                  changeInteractionStatus(item.id, status).then(() => reload()).catch((e) => setError(errorMessage(e)));
                }}
              />
            </div>
          )}
        </div>
      </div>

      <Pagination page={page} total={total} onChange={setPage} disabled={loading} />

      {deleteDialog}

      {dialog && (
        <InteractionModal
          mode={dialog.mode}
          initial={dialog.initial}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
