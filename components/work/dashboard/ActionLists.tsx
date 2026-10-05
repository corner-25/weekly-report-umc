'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PANEL } from '@/components/crm/ui';
import { formatDateTime } from '@/components/crm/format';
import { DUE_SOON_DAYS } from '@/lib/work/constants';
import { WorkItemRow } from '../WorkBits';
import type { WorkAnalyticsDTO } from '../types';

const TABS = [
  { key: 'overdue', label: 'Quá hạn', empty: 'Không có việc nào quá hạn.', tone: 'bg-rose-500' },
  { key: 'stale', label: 'Lâu chưa cập nhật', empty: 'Việc nào cũng có cập nhật trong 14 ngày qua.', tone: 'bg-amber-400' },
  { key: 'dueSoon', label: 'Sắp đến hạn', empty: `Không có việc nào đến hạn trong ${DUE_SOON_DAYS} ngày tới.`, tone: 'bg-orange-400' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

/** Việc cần xử lý ngay, chia tab — mỗi tab là một lý do để đôn đốc. */
export function ActionLists({ lists, counts, listHref }: { lists: WorkAnalyticsDTO['lists']; counts: Record<TabKey, number>; listHref: (view: string) => string }) {
  const [tab, setTab] = useState<TabKey>(counts.overdue ? 'overdue' : counts.stale ? 'stale' : 'dueSoon');
  const active = TABS.find((t) => t.key === tab)!;
  const items = lists[tab];
  return (
    <section className={cn(PANEL, 'p-4 sm:p-5')} aria-label="Việc cần xử lý">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-slate-900">Việc cần đôn đốc</h2>
        <div role="tablist" aria-label="Lý do đôn đốc" className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition', tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900')}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', t.tone)} aria-hidden="true" />
              {t.label}
              <span className="tabular-nums text-slate-400">{counts[t.key]}</span>
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" key={tab} className="animate-fade-in">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{active.empty}</p>
        ) : (
          <ul className="-mx-2 divide-y divide-slate-100">{items.map((i) => <WorkItemRow key={i.id} item={i} />)}</ul>
        )}
        {counts[tab] > items.length && tab !== 'dueSoon' && (
          <Link href={listHref(tab)} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            Xem đủ {counts[tab]} việc <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}

export function RecentUpdates({ updates }: { updates: WorkAnalyticsDTO['recentUpdates'] }) {
  return (
    <section className={cn(PANEL, 'p-4 sm:p-5')} aria-label="Cập nhật gần nhất">
      <h2 className="mb-3 text-[15px] font-bold text-slate-900">Cập nhật gần nhất</h2>
      {updates.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">Chưa có cập nhật nào.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-slate-200 pl-4">
          {updates.map((u) => (
            <li key={u.id} className="relative text-sm">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500" aria-hidden="true" />
              <p className="text-xs text-slate-500">
                {formatDateTime(u.occurredAt)}
                {u.progressPercent != null && <b className="ml-1 text-slate-700">· {u.progressPercent}%</b>}
              </p>
              <Link href={`/dashboard/work/items/${u.item.id}`} className="font-semibold text-slate-900 line-clamp-1 hover:text-brand-700">{u.item.title}</Link>
              <p className="mt-0.5 whitespace-pre-line text-slate-600 line-clamp-2">{u.content}</p>
              <p className="mt-0.5 text-xs text-slate-400">{[u.author, u.item.unit].filter(Boolean).join(' · ')}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
