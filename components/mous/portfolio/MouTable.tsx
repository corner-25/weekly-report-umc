'use client';

import { AlertTriangle, FileText, Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PANEL } from '@/components/crm/ui';
import { needsDecision, type MouView } from '@/lib/mou/portfolio';
import { ExpiryText, LifecycleChip, ProgressBar, fmtDate, fmtMonths } from './terms';

/** Huy hiệu "cần chú ý" — đủ lý do trên cùng một dòng, như danh sách công việc. */
function Flags({ v }: { v: MouView }) {
  const flags = [
    needsDecision(v) && { text: v.daysToExpiry !== null && v.daysToExpiry < 0 ? 'Quá hạn, chưa quyết' : 'Cần quyết gia hạn', cls: 'bg-orange-50 text-orange-700 ring-orange-200' },
    v.dormant && { text: `Để đó ${fmtMonths(v.monthsSinceSigned)}`, cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
    v.missing.length > 0 && { text: v.missing.length === 1 ? v.missing[0] : `Thiếu ${v.missing.length} mục hồ sơ`, cls: 'bg-amber-50 text-amber-700 ring-amber-200', title: v.missing.join(', ') },
  ].filter(Boolean) as Array<{ text: string; cls: string; title?: string }>;
  if (!flags.length) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {flags.map((f) => (
        <span key={f.text} title={f.title} className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', f.cls)}>
          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
          {f.text}
        </span>
      ))}
    </span>
  );
}

export function MouTable({ views, onOpen }: { views: MouView[]; onOpen: (id: string) => void }) {
  return (
    <div className={cn(PANEL, 'overflow-hidden')}>
      <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_110px_120px_130px_110px] gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 text-xs font-semibold text-slate-500 lg:grid">
        <span>Đối tác</span>
        <span>Phòng đầu mối</span>
        <span>Lĩnh vực</span>
        <span>Ngày ký</span>
        <span>Hết hạn</span>
        <span>Tiến độ</span>
        <span className="text-right">Vòng đời</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {views.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              onClick={() => onOpen(v.id)}
              className="grid w-full gap-x-3 gap-y-1.5 px-4 py-3 text-left transition hover:bg-brand-50/40 focus-visible:bg-brand-50/60 focus-visible:outline-none lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_110px_120px_130px_110px] lg:items-center"
            >
              <span className="min-w-0">
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-slate-900">{v.partnerName}</span>
                  <LifecycleChip lifecycle={v.lifecycle} className="lg:hidden" />
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  {v.scope === 'INTERNATIONAL' && (
                    <span className="inline-flex items-center gap-0.5 font-medium text-violet-600">
                      <Globe2 className="h-3 w-3" aria-hidden="true" />
                      {v.partnerCountry && v.partnerCountry !== 'Nước ngoài' ? v.partnerCountry : 'Quốc tế'}
                    </span>
                  )}
                  {v.documentCount > 0 && (
                    <span className="inline-flex items-center gap-0.5"><FileText className="h-3 w-3" aria-hidden="true" />{v.documentCount} văn bản</span>
                  )}
                </span>
                <Flags v={v} />
              </span>
              <span className="min-w-0 text-sm text-slate-700">
                <span className={cn('block truncate', !v.departmentName && 'text-slate-400')}>{v.departmentName ?? 'Chưa có phòng'}</span>
                {v.contactPerson && <span className="block truncate text-xs text-slate-500">{v.contactPerson}</span>}
              </span>
              <span className="flex min-w-0 flex-wrap gap-1">
                {v.fields.map((f) => <span key={f} title={f} className="truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{f}</span>)}
              </span>
              <span className="text-xs tabular-nums text-slate-600"><span className="text-slate-400 lg:hidden">Ký </span>{fmtDate(v.signedDate)}</span>
              <span><ExpiryText days={v.daysToExpiry} iso={v.expiryDate} /></span>
              <span>{v.lifecycle === 'PENDING' ? <span className="text-xs text-slate-400">Chưa ký</span> : <ProgressBar value={v.progress} stage={v.stage} />}</span>
              <span className="hidden justify-end lg:flex"><LifecycleChip lifecycle={v.lifecycle} /></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
