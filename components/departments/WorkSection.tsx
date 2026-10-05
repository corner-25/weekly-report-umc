'use client';

/**
 * Khối "Công việc chỉ đạo" trong hồ sơ phòng: vòng trạng thái, chỉ số xử lý,
 * danh sách việc cần chú ý theo thẻ (quá hạn / sắp đến hạn / lâu chưa cập nhật /
 * mới hoàn thành) và biểu đồ giao – xong – tồn theo tháng.
 */
import Link from 'next/link';
import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/components/crm/format';
import { EmptyState, SectionCard } from '@/components/crm/ui';
import { HealthChip, ProgressBar, StatusChip } from '@/components/work/WorkBits';
import { Donut, Legend, MonthlyChart } from '@/components/work/dashboard/charts';
import { statusSegments } from '@/components/work/dashboard/tones';
import { InfoTip, Term, type TermKey } from '@/components/work/dashboard/Glossary';
import type { DepartmentProfile } from '@/lib/department-profile';
import type { AttentionItem } from '@/lib/department-profile-sections';
import { FOCUS_RING, TONE_TEXT, type Tone } from './bits';

type ListKey = keyof DepartmentProfile['work']['lists'];

const TABS: Array<{ key: ListKey; label: string; tone: Tone; count: (k: DepartmentProfile['work']['kpi']) => number; view?: string; empty: string; hint?: string }> = [
  { key: 'overdue', label: 'Quá hạn', tone: 'overdue', count: (k) => k.overdue, view: 'overdue', empty: 'Không có việc quá hạn.' },
  { key: 'dueSoon', label: 'Sắp đến hạn', tone: 'dueSoon', count: (k) => k.dueSoon, empty: 'Không có việc đến hạn trong 30 ngày tới.' },
  { key: 'stale', label: 'Lâu chưa cập nhật', tone: 'stale', count: (k) => k.staleOnly, view: 'stale', empty: 'Không có việc lâu chưa cập nhật (ngoài các việc đã quá hạn).', hint: 'Không tính việc đã quá hạn — các việc đó nằm ở thẻ Quá hạn' },
  { key: 'recentDone', label: 'Mới hoàn thành', tone: 'done', count: (k) => k.done, view: 'done', empty: 'Chưa có việc hoàn thành.' },
];

const VN_OFFSET_MS = 7 * 3_600_000;
const vnDay = (iso: string) => new Date(Date.parse(iso) + VN_OFFSET_MS).toISOString().slice(0, 10);

export function WorkSection({ data }: { data: DepartmentProfile }) {
  const { kpi, lists, status, monthly } = data.work;
  const id = data.department.id;
  const listUrl = (view?: string) => `/dashboard/work/items?departmentId=${id}${view ? `&view=${view}` : ''}`;
  const [tab, setTab] = useState<ListKey>(() => TABS.find((t) => lists[t.key].length > 0)?.key ?? 'overdue');
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div id="cong-viec" className="scroll-mt-20">
      <SectionCard
        title="Công việc chỉ đạo"
        icon={<ClipboardList className="h-4 w-4 text-brand-600" aria-hidden="true" />}
        info={<InfoTip term="leadUnit" />}
        action={<Link href={listUrl()} className={cn('rounded text-xs font-semibold text-brand-700 hover:underline', FOCUS_RING)}>Xem tất cả ({kpi.total}) →</Link>}
      >
        {kpi.total === 0 ? (
          <EmptyState title="Phòng chưa được giao công việc chỉ đạo nào" hint="Công việc từ phân hệ Quản lý công việc gắn với phòng sẽ hiện ở đây." />
        ) : (
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start lg:flex-col lg:items-center">
                <Donut segments={statusSegments(status)} centerValue={kpi.completionRate === null ? '—' : `${kpi.completionRate}%`} centerLabel="đã hoàn thành" size={156} />
                <div className="w-full min-w-0 space-y-3">
                  <Legend segments={statusSegments(status)} />
                  <dl className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center lg:grid-cols-3">
                    <Fact term="cycleTime" value={kpi.medianDaysToComplete} unit="ngày" />
                    <Fact term="avgProgress" value={kpi.avgOpenProgress} unit="%" />
                    <Fact term="oldest" value={kpi.oldestOpenDays} unit="ngày" />
                  </dl>
                </div>
              </div>

              <div className="min-w-0">
                <div role="tablist" aria-label="Việc cần chú ý" className="flex flex-wrap gap-1 border-b border-slate-100 pb-2">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      id={`tab-${t.key}`}
                      aria-selected={tab === t.key}
                      aria-controls="work-tabpanel"
                      onClick={() => setTab(t.key)}
                      title={t.hint}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
                        FOCUS_RING,
                        tab === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
                      )}
                    >
                      {t.label}
                      <span className={cn('tabular-nums', tab === t.key ? 'text-white/80' : t.count(kpi) ? TONE_TEXT[t.tone] : 'text-slate-300')}>{t.count(kpi)}</span>
                    </button>
                  ))}
                </div>
                <div id="work-tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="pt-1">
                  {lists[tab].length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">{current.empty}</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {lists[tab].map((w) => <AttentionRow key={w.id} item={w} />)}
                    </ul>
                  )}
                  {current.count(kpi) > lists[tab].length && (
                    <Link href={listUrl(current.view)} className={cn('mt-2 inline-block rounded text-xs font-semibold text-brand-700 hover:underline', FOCUS_RING)}>
                      Xem đủ {current.count(kpi)} việc “{current.label.toLowerCase()}” →
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">12 tháng gần nhất</h3>
              <MonthlyChart
                data={monthly}
                legend={
                  <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" aria-hidden="true" /><Term term="assigned" /></span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden="true" /><Term term="done" /></span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 bg-amber-500" aria-hidden="true" /><Term term="backlog" /></span>
                  </p>
                }
              />
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function Fact({ term, value, unit }: { term: TermKey; value: number | null; unit: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex justify-center text-[10px] font-semibold uppercase tracking-wide text-slate-500"><Term term={term} /></dt>
      <dd className="text-base font-bold tabular-nums text-violet-700">
        {value === null ? <span className="text-slate-300">—</span> : <>{value}<span className="ml-0.5 text-xs font-semibold opacity-60">{unit}</span></>}
      </dd>
    </div>
  );
}

function AttentionRow({ item: w }: { item: AttentionItem }) {
  const onTime = w.status === 'DONE' && w.completedAt && w.dueDate ? vnDay(w.completedAt) <= w.dueDate : null;
  return (
    <li>
      <Link href={`/dashboard/work/items/${w.id}`} className={cn('block rounded-lg px-2 py-2.5 hover:bg-slate-50', FOCUS_RING)}>
        <span className="block text-sm font-semibold text-slate-900 line-clamp-2">
          {(w.priority === 'URGENT' || w.priority === 'HIGH') && (
            <span className="mr-1.5 rounded bg-rose-600 px-1.5 py-0.5 align-middle text-[10px] font-bold text-white">{w.priority === 'URGENT' ? 'Khẩn' : 'Ưu tiên cao'}</span>
          )}
          {w.title}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <StatusChip status={w.status} />
          <HealthChip health={w.health} />
          {w.status === 'DONE' && w.completedAt && <span>xong {formatDate(w.completedAt)}</span>}
          {onTime !== null && <span className={cn('font-semibold', onTime ? 'text-emerald-700' : 'text-rose-600')}>{onTime ? 'đúng hạn' : 'trễ hạn'}</span>}
          {w.status !== 'DONE' && w.dueDate && <span>hạn {formatDate(w.dueDate)}</span>}
          {w.status !== 'DONE' && <ProgressBar value={w.progressPercent} />}
        </span>
      </Link>
    </li>
  );
}
