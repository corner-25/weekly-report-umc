'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BellRing, ClipboardList, ListChecks, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { crmFetch, errorMessage } from '@/components/crm/api';
import { ErrorBanner, PANEL, PRIMARY_BTN, SECONDARY_BTN, SectionCard } from '@/components/crm/ui';
import { ImportCard } from '@/components/work/ImportCard';
import { RemindersModal } from '@/components/work/RemindersModal';
import { WorkItemModal } from '@/components/work/WorkItemModal';
import { MonthlyChart } from '@/components/work/dashboard/charts';
import { KpiBand } from '@/components/work/dashboard/KpiBand';
import { UnitScoreboard } from '@/components/work/dashboard/UnitScoreboard';
import { AgingCard, GroupBars, ProgressCard } from '@/components/work/dashboard/Breakdowns';
import { ActionLists, RecentUpdates } from '@/components/work/dashboard/ActionLists';
import { GlossaryCard, Term } from '@/components/work/dashboard/Glossary';
import type { WorkAnalyticsDTO } from '@/components/work/types';

function Skeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className={cn(PANEL, 'h-[232px] animate-pulse bg-slate-50')} />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className={cn(PANEL, 'h-80 animate-pulse bg-slate-50 xl:col-span-2')} />
        <div className={cn(PANEL, 'h-80 animate-pulse bg-slate-50')} />
      </div>
    </div>
  );
}

/** Bảng điều hành công việc chỉ đạo: tồn đọng, hoàn thành, tiến độ theo đơn vị, lãnh đạo, thời gian. */
function WorkDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const year = params.get('nam') ?? '';
  const departmentId = params.get('phong') ?? '';
  const [data, setData] = useState<WorkAnalyticsDTO | null>(null);
  const [error, setError] = useState('');
  const [showReminders, setShowReminders] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setError('');
    const query = new URLSearchParams();
    if (year) query.set('nam', year);
    if (departmentId) query.set('phong', departmentId);
    try {
      setData(await crmFetch<WorkAnalyticsDTO>(`/api/work/analytics?${query.toString()}`));
    } catch (loadError) {
      setError(errorMessage(loadError, 'Không tải được bảng điều hành công việc.'));
    }
  }, [year, departmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const hrefWith = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const setParam = (key: string, value: string) => router.replace(hrefWith({ [key]: value }), { scroll: false });
  const listHref = (view: string, dept = departmentId) => {
    const q = new URLSearchParams({ view });
    if (dept) q.set('departmentId', dept);
    if (year) q.set('nam', year);
    return `/dashboard/work/items?${q.toString()}`;
  };

  const department = data?.filters.departments.find((d) => d.id === departmentId);
  const scopeLabel = [department?.name ?? (departmentId ? 'Một đơn vị' : 'Toàn bệnh viện'), year ? `năm ${year}` : 'mọi năm'].join(' · ');

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ClipboardList}
        title="Điều hành công việc"
        description={`Chỉ đạo của Ban Giám đốc — ${scopeLabel}`}
        className="flex-wrap gap-4"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href={listHref('all')} className={SECONDARY_BTN}>
              <ListChecks className="h-4 w-4" aria-hidden="true" /> Danh sách
            </Link>
            <button type="button" onClick={() => setShowReminders(true)} className={SECONDARY_BTN}>
              <BellRing className="h-4 w-4" aria-hidden="true" /> Nhắc việc
            </button>
            <button type="button" onClick={() => setShowCreate(true)} className={PRIMARY_BTN}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Mở việc
            </button>
          </div>
        }
      />

      <div className={cn(PANEL, 'flex flex-wrap items-center gap-3 px-4 py-3')}>
        <div role="group" aria-label="Năm giao việc" className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {['', ...(data?.filters.years.map(String) ?? [])].map((y) => (
            <button
              key={y || 'all'}
              type="button"
              aria-pressed={year === y}
              onClick={() => setParam('nam', y)}
              className={cn('rounded-lg px-3 py-1.5 text-[13px] font-semibold tabular-nums transition', year === y ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900')}
            >
              {y || 'Mọi năm'}
            </button>
          ))}
        </div>
        <div className="flex min-w-[240px] flex-1 items-center gap-2 sm:max-w-sm">
          <label htmlFor="work-dept" className="shrink-0 text-sm font-medium text-slate-600">Đơn vị</label>
          <Select id="work-dept" value={departmentId} onChange={(e) => setParam('phong', e.target.value)} className="px-3 py-2">
            <option value="">Toàn bệnh viện</option>
            {data?.filters.departments.map((d) => <option key={d.id} value={d.id}>{`${d.name} (${d.count})`}</option>)}
          </Select>
        </div>
        {(year || departmentId) && (
          <Link href={pathname} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            <X className="h-4 w-4" aria-hidden="true" /> Bỏ lọc
          </Link>
        )}
      </div>

      <ErrorBanner message={error} />

      {!data ? (
        <Skeleton />
      ) : (
        <div className="space-y-5 animate-fade-in">
          <KpiBand data={data} listHref={(view) => listHref(view)} />

          <div className="grid items-start gap-5 xl:grid-cols-3">
            <SectionCard title="Giao việc và hoàn thành theo tháng" className="xl:col-span-2" action={<span className="text-xs text-slate-500">rê chuột để xem số từng tháng</span>}>
              <MonthlyChart
                data={data.monthly}
                legend={
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" aria-hidden="true" /><Term term="assigned" align="left" /></span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden="true" /><Term term="done" align="left" /></span>
                    <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-amber-500" aria-hidden="true" /><Term term="backlog">Còn tồn cuối tháng (trục phải)</Term></span>
                  </div>
                }
              />
            </SectionCard>
            <AgingCard aging={data.aging} />
          </div>

          {!departmentId && (
            <UnitScoreboard
              units={data.units}
              scopeHref={(id) => hrefWith({ phong: id })}
              listHref={(id) => listHref('open', id)}
            />
          )}

          <div className="grid items-start gap-5 lg:grid-cols-3">
            <ProgressCard progress={data.progress} />
            <GroupBars title="Theo lãnh đạo chỉ đạo" term="leader" rows={data.leaders} empty="Chưa ghi người chỉ đạo." />
            <GroupBars title="Theo hình thức chỉ đạo" term="category" rows={data.categories} empty="Chưa có phân loại." />
          </div>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <ActionLists
              lists={data.lists}
              counts={{ overdue: data.kpi.overdue, stale: data.kpi.staleOnly, dueSoon: data.kpi.dueSoon }}
              listHref={(view) => listHref(view)}
            />
            <div className="space-y-5">
              <RecentUpdates updates={data.recentUpdates} />
              <ImportCard lastImport={data.lastImport} onImported={load} />
            </div>
          </div>

          <GlossaryCard />
        </div>
      )}

      {showReminders && <RemindersModal onClose={() => setShowReminders(false)} />}
      {showCreate && (
        <WorkItemModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

export default function WorkDashboardPage() {
  return (
    <Suspense>
      <WorkDashboard />
    </Suspense>
  );
}
