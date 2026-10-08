'use client';

import { EntityCombobox, type ComboValue } from '@/components/crm/EntityCombobox';
import { Pagination } from '@/components/crm/Pagination';
import { useCallback, useEffect, useState } from 'react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { Crown, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import useSWR from 'swr';
import { DELEGATION_PURPOSES, DELEGATION_TOPICS, VIP_STAFF } from '@/lib/crm/constants';
import { DelegationStatsCard } from '@/components/crm/DelegationStatsCard';
import { changeInteractionStatus, crmFetch, errorMessage } from '@/components/crm/api';
import { InteractionModal, interactionModeOf, type InteractionMode } from '@/components/crm/InteractionModal';
import { INTERACTION_ICONS, InteractionTimeline } from '@/components/crm/InteractionTimeline';
import type { InteractionDTO } from '@/components/crm/types';
import { ACCENT_BTN, EmptyState, ErrorBanner, PANEL, PRIMARY_BTN, SECONDARY_BTN, Stat } from '@/components/crm/ui';
import { useConfirmDelete } from '@/components/crm/useConfirmDelete';
import { DateInput } from '@/components/ui/DateInput';

type TypeTab = 'ALL' | 'VIP_ESCORT' | 'DELEGATION' | 'OTHER' | 'PLANNED';
const TABS: Array<{ value: TypeTab; label: string }> = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'VIP_ESCORT', label: 'Dẫn khám VIP' },
  { value: 'DELEGATION', label: 'Tiếp đoàn' },
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
  const [referrerFilter, setReferrerFilter] = useState<ComboValue | null>(null);
  const [doctorFilter, setDoctorFilter] = useState<ComboValue | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [visitStats, setVisitStats] = useState<{ done: number; planned: number; patients: number; referrers: number; doctors: number; byReferrer: Array<{ id: string; name: string; count: number }>; byDoctor: Array<{ id: string; name: string; count: number }> } | null>(null);
  const [tab, setTab] = useState<TypeTab>('ALL');
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

  useEffect(() => setPage(1), [tab, staffName, from, to, debouncedSearch, year, purpose, topic, hostDepartmentId, needsReview, referrerFilter, doctorFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (tab === 'VIP_ESCORT') {
      if (referrerFilter && 'id' in referrerFilter) params.set('referrerId', referrerFilter.id);
      if (doctorFilter && 'id' in doctorFilter) params.set('doctorId', doctorFilter.id);
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
  }, [tab, staffName, from, to, debouncedSearch, year, purpose, topic, hostDepartmentId, needsReview, reloadKey, page, referrerFilter, doctorFilter]);

  useEffect(() => {
    const now = new Date();
    const params = new URLSearchParams({ stats: '1', from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') });
    crmFetch<NonNullable<typeof monthStats>>(`/api/crm/interactions?${params}`)
      .then(setMonthStats)
      .catch(() => setMonthStats(null));
  }, [reloadKey]);

  const delegationFilter = tab === 'DELEGATION' && Boolean(year || purpose || topic || hostDepartmentId || needsReview);
  const hasFilter = Boolean(staffName || from || to || debouncedSearch || tab !== 'ALL' || delegationFilter);
  const resetFilters = () => {
    setTab('ALL');
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <Stat label="Dẫn khám VIP tháng này" value={monthStats?.escorts ?? '—'} />
        <Stat label="Đoàn tiếp tháng này" value={monthStats?.delegations ?? '—'} hint={monthStats ? `${monthStats.guests} khách` : undefined} tone="accent" />
        <Stat label="Tương tác khác tháng này" value={monthStats?.others ?? '—'} />
      </div>

      {tab === 'VIP_ESCORT' && <div className={cn(PANEL, 'p-4')}>
        <h2 className="mb-3 font-semibold">Thống kê dẫn khám theo bộ lọc</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Lượt đã khám" value={visitStats?.done ?? '—'} />
          <Stat label="Khách đã khám" value={visitStats?.patients ?? '—'} />
          <Stat label="Lịch hẹn" value={visitStats?.planned ?? '—'} />
          <Stat label="Người giới thiệu" value={visitStats?.referrers ?? '—'} />
          <Stat label="Bác sĩ khám" value={visitStats?.doctors ?? '—'} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {([['Theo người giới thiệu', visitStats?.byReferrer], ['Theo bác sĩ khám', visitStats?.byDoctor]] as const).map(([title, rows]) => <div key={title}>
            <h3 className="mb-2 text-sm font-semibold">{title} · tối đa 20 người</h3>
            <table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="py-2">Họ tên</th><th className="text-right">Lượt đã khám</th></tr></thead><tbody>{rows?.map(r => <tr key={r.id} className="border-b border-slate-100"><td className="py-2"><a className="text-cyan-700 hover:underline" href={`/dashboard/crm/contacts/${r.id}`}>{r.name}</a></td><td className="text-right">{r.count}</td></tr>)}</tbody></table>
          </div>)}
        </div>
      </div>}
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
