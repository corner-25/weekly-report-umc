'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PANEL } from '@/components/crm/ui';
import { daysBetween, type MouView, type Portfolio } from '@/lib/mou/portfolio';
import { ExpiryText, LifecycleChip, ProgressBar, fmtDate, fmtMonths } from './terms';

const TABS = [
  { key: 'decide', label: 'Cần quyết định gia hạn', tone: 'bg-orange-400', empty: 'Không MOU nào hết hạn trong 90 ngày tới.' },
  { key: 'dormant', label: 'Ký rồi chưa triển khai', tone: 'bg-rose-500', empty: 'MOU nào ký quá 6 tháng cũng đã có kết quả.' },
  { key: 'pending', label: 'Chờ ký', tone: 'bg-sky-400', empty: 'Không có MOU nào đang chờ ký.' },
  { key: 'incomplete', label: 'Hồ sơ thiếu', tone: 'bg-amber-400', empty: 'Hồ sơ MOU đầy đủ.' },
] as const;
type TabKey = (typeof TABS)[number]['key'];
const SHOW = 8;

/** Lý do một MOU nằm trong danh sách — câu ngắn để lãnh đạo hỏi đúng người. */
function reason(v: MouView, tab: TabKey): string {
  const now = new Date();
  switch (tab) {
    case 'decide':
      return v.daysToExpiry !== null && v.daysToExpiry < 0 ? 'Đã quá hạn, chưa quyết gia hạn hay kết thúc' : 'Đánh giá hiệu quả, quyết gia hạn trước khi hết hạn';
    case 'dormant':
      return `Ký ${fmtMonths(v.monthsSinceSigned)} trước, chưa có kết quả`;
    case 'pending':
      return v.signedDate ? `Chờ ${-daysBetween(v.signedDate, now)} ngày (từ ${fmtDate(v.signedDate)})` : 'Chưa ghi ngày bắt đầu';
    default:
      return v.missing.join(' · ');
  }
}

export function MouLine({ v, tab, onOpen }: { v: MouView; tab: TabKey; onOpen: (id: string) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onOpen(v.id)} className="group flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-slate-900 group-hover:text-brand-700">{v.partnerName}</span>
            {v.scope === 'INTERNATIONAL' && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-violet-600">
                <Globe2 className="h-3 w-3" aria-hidden="true" />
                {v.partnerCountry && v.partnerCountry !== 'Nước ngoài' ? v.partnerCountry : 'Quốc tế'}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">
            {v.departmentName ?? 'Chưa có phòng đầu mối'}
            {v.contactPerson && ` · ${v.contactPerson}`}
          </span>
          <span className={cn('mt-1 block text-xs', tab === 'incomplete' ? 'text-amber-700' : 'text-slate-600')}>{reason(v, tab)}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          {tab === 'decide' ? <ExpiryText days={v.daysToExpiry} iso={v.expiryDate} /> : <LifecycleChip lifecycle={v.lifecycle} />}
          {tab !== 'pending' && <ProgressBar value={v.progress} stage={v.stage} />}
        </span>
      </button>
    </li>
  );
}

/** Bốn danh sách việc lãnh đạo cần ra quyết định hoặc đôn đốc. */
export function DecisionBoard({ lists, onOpen, listHref }: { lists: Portfolio['lists']; onOpen: (id: string) => void; listHref: (view: string) => string }) {
  const first = TABS.find((t) => lists[t.key].length > 0)?.key ?? 'decide';
  const [tab, setTab] = useState<TabKey>(first);
  const active = TABS.find((t) => t.key === tab)!;
  const items = lists[tab];
  return (
    <section className={cn(PANEL, 'p-4 sm:p-5')} aria-label="Việc cần lãnh đạo xử lý">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Cần lãnh đạo xử lý</h2>
          <p className="text-xs text-slate-500">Bấm vào MOU để xem nội dung, văn bản, nhật ký</p>
        </div>
        <div role="tablist" aria-label="Lý do" className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
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
              <span className="tabular-nums text-slate-400">{lists[t.key].length}</span>
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" key={tab} className="animate-fade-in">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{active.empty}</p>
        ) : (
          <ul className="-mx-2 divide-y divide-slate-100">{items.slice(0, SHOW).map((v) => <MouLine key={v.id} v={v} tab={tab} onOpen={onOpen} />)}</ul>
        )}
        {items.length > SHOW && (
          <Link href={listHref(tab)} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            Xem đủ {items.length} MOU <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}
