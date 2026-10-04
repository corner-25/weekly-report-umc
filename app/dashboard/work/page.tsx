'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BellRing, ClipboardList, Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { crmFetch, errorMessage } from '@/components/crm/api';
import { formatDateTime } from '@/components/crm/format';
import { ErrorBanner, PRIMARY_BTN, SECONDARY_BTN, SectionCard, Stat } from '@/components/crm/ui';
import { ImportCard } from '@/components/work/ImportCard';
import { RemindersModal } from '@/components/work/RemindersModal';
import { WorkItemModal } from '@/components/work/WorkItemModal';
import { WorkItemRow } from '@/components/work/WorkBits';
import type { WorkItemDTO, WorkOverviewDTO } from '@/components/work/types';

function ItemList({ items, empty }: { items: WorkItemDTO[]; empty: string }) {
  if (items.length === 0) return <p className="py-4 text-center text-sm text-slate-500">{empty}</p>;
  return <ul className="-mx-2 divide-y divide-slate-100">{items.map((i) => <WorkItemRow key={i.id} item={i} />)}</ul>;
}

const viewLink = (view: string, label: string) => (
  <Link href={`/dashboard/work/items?view=${view}`} className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:underline">
    {label} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
  </Link>
);

/** B3: theo dõi công việc chỉ đạo — việc quá hạn, lâu chưa cập nhật, vừa cập nhật gì. */
export default function WorkOverviewPage() {
  const [data, setData] = useState<WorkOverviewDTO | null>(null);
  const [error, setError] = useState('');
  const [showReminders, setShowReminders] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await crmFetch<WorkOverviewDTO>('/api/work/overview'));
    } catch (loadError) {
      setError(errorMessage(loadError, 'Không tải được bảng theo dõi công việc.'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const c = data?.counts;
  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardList}
        title="Theo dõi công việc"
        description="Chỉ đạo của Ban Giám đốc và việc theo kế hoạch"
        className="flex-wrap gap-4"
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowReminders(true)} className={SECONDARY_BTN}>
              <BellRing className="h-4 w-4" aria-hidden="true" /> Nhắc việc qua email
            </button>
            <button type="button" onClick={() => setShowCreate(true)} className={PRIMARY_BTN}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Mở việc theo kế hoạch
            </button>
          </div>
        }
      />

      <ErrorBanner message={error} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Đang mở" value={c?.open ?? '—'} hint={c ? `${c.directives} chỉ đạo BGĐ` : undefined} />
        <Stat label="Quá hạn" value={c?.overdue ?? '—'} tone={c && c.overdue > 0 ? 'accent' : 'default'} />
        <Stat label="Lâu chưa cập nhật" value={c?.stale ?? '—'} hint="quá 14 ngày" />
        <Stat label="Sắp đến hạn" value={c?.dueSoon ?? '—'} hint="trong 7 ngày" />
        <Stat label="Có cập nhật tuần này" value={c?.updatedThisWeek ?? '—'} />
        <Stat label="Đã hoàn thành" value={c?.done ?? '—'} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionCard title="Quá hạn" action={viewLink('overdue', 'Xem tất cả')}>
            <ItemList items={data?.overdue ?? []} empty={data ? 'Không có việc nào quá hạn.' : 'Đang tải...'} />
          </SectionCard>
          <SectionCard title="Lâu chưa cập nhật" action={viewLink('stale', 'Xem tất cả')}>
            <ItemList items={data?.stale ?? []} empty={data ? 'Việc nào cũng có cập nhật trong 14 ngày qua.' : 'Đang tải...'} />
          </SectionCard>
          <SectionCard title="Sắp đến hạn" action={viewLink('open', 'Mọi việc đang mở')}>
            <ItemList items={data?.dueSoon ?? []} empty={data ? 'Không có việc nào đến hạn trong 7 ngày tới.' : 'Đang tải...'} />
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Cập nhật gần đây" action={<span className="text-xs text-slate-500">7 ngày qua</span>}>
            {!data?.recentUpdates.length ? (
              <p className="py-4 text-center text-sm text-slate-500">{data ? 'Chưa có cập nhật nào trong tuần.' : 'Đang tải...'}</p>
            ) : (
              <ol className="space-y-3">
                {data.recentUpdates.map((u) => (
                  <li key={u.id} className="text-sm">
                    <Link href={`/dashboard/work/items/${u.item.id}`} className="font-semibold text-slate-900 line-clamp-1 hover:text-cyan-700">{u.item.title}</Link>
                    <p className="text-xs text-slate-500">
                      {formatDateTime(u.occurredAt)}{u.author && ` · ${u.author}`}{u.progressPercent != null && ` · ${u.progressPercent}%`}
                    </p>
                    <p className="mt-0.5 whitespace-pre-line text-slate-700 line-clamp-3">{u.content}</p>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          <SectionCard title="Theo đơn vị chủ trì">
            {!data?.byUnit.length ? (
              <p className="py-4 text-center text-sm text-slate-500">{data ? 'Chưa có việc đang mở.' : 'Đang tải...'}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th scope="col" className="py-1.5 font-semibold">Đơn vị</th>
                    <th scope="col" className="py-1.5 text-right font-semibold">Mở</th>
                    <th scope="col" className="py-1.5 text-right font-semibold">Quá hạn</th>
                    <th scope="col" className="py-1.5 text-right font-semibold">Lâu chưa CN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.byUnit.map((u) => (
                    <tr key={u.unit}>
                      <th scope="row" className="py-1.5 pr-2 text-left font-medium text-slate-700">
                        {u.departmentId ? <Link href={`/dashboard/work/items?departmentId=${u.departmentId}`} className="hover:text-cyan-700">{u.unit}</Link> : u.unit}
                      </th>
                      <td className="py-1.5 text-right tabular-nums">{u.open}</td>
                      <td className={`py-1.5 text-right tabular-nums ${u.overdue ? 'font-semibold text-red-600' : 'text-slate-400'}`}>{u.overdue}</td>
                      <td className={`py-1.5 text-right tabular-nums ${u.stale ? 'font-semibold text-amber-700' : 'text-slate-400'}`}>{u.stale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>

          <ImportCard lastImport={data?.lastImport ?? null} onImported={load} />
        </div>
      </div>

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
