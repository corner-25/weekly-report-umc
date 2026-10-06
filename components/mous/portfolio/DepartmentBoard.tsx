'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { PANEL } from '@/components/crm/ui';
import type { DepartmentLine } from '@/lib/mou/portfolio';
import { MouTerm } from './terms';

/**
 * Trách nhiệm theo phòng đầu mối: phòng giữ bao nhiêu MOU, bao nhiêu đã thành
 * kết quả, bao nhiêu để đó. Thanh ngang: phần xanh là đang triển khai.
 */
export function DepartmentBoard({ rows, deptHref }: { rows: DepartmentLine[]; deptHref: (id: string | null, view?: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.live));
  return (
    <section className={cn(PANEL, 'overflow-hidden')} aria-label="Theo phòng đầu mối">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-5">
        <h2 className="text-[15px] font-bold text-slate-900"><MouTerm term="department">Theo phòng đầu mối</MouTerm></h2>
        <span className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-brand-500" />đang triển khai</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-200" />chưa triển khai</span>
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-y border-slate-100 bg-slate-50/70 text-xs text-slate-500">
              <th scope="col" className="px-4 py-2 text-left font-semibold sm:px-5">Phòng</th>
              <th scope="col" className="px-3 py-2 text-left font-semibold"><MouTerm term="live" /></th>
              <th scope="col" className="px-3 py-2 text-right font-semibold"><MouTerm term="dormant">Để đó</MouTerm></th>
              <th scope="col" className="px-3 py-2 text-right font-semibold"><MouTerm term="decide">Cần gia hạn</MouTerm></th>
              <th scope="col" className="px-3 py-2 text-right font-semibold"><MouTerm term="pending" /></th>
              <th scope="col" className="px-4 py-2 text-right font-semibold sm:px-5"><MouTerm term="avgProgress">TB %</MouTerm></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const rate = r.live ? Math.round((r.started / r.live) * 100) : null;
              return (
                <tr key={r.id ?? 'none'} className="hover:bg-brand-50/40">
                  <th scope="row" className="px-4 py-2.5 text-left font-normal sm:px-5">
                    <Link href={deptHref(r.id)} className={cn('font-semibold hover:text-brand-700 hover:underline', r.id ? 'text-slate-900' : 'text-slate-400')}>{r.name}</Link>
                  </th>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="flex h-2 overflow-hidden rounded-full bg-slate-200" style={{ width: `${Math.max(8, (r.live / max) * 140)}px` }} aria-hidden="true">
                        <span className="h-full bg-brand-500" style={{ width: r.live ? `${(r.started / r.live) * 100}%` : 0 }} />
                      </span>
                      <span className="tabular-nums text-slate-800"><b>{r.live}</b>{rate !== null && <span className="ml-1 text-xs text-slate-500">({rate}% triển khai)</span>}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.dormant ? <Link href={deptHref(r.id, 'dormant')} className="font-semibold text-rose-600 hover:underline">{r.dormant}</Link> : <span className="text-slate-300">0</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.decide ? <Link href={deptHref(r.id, 'decide')} className="font-semibold text-orange-600 hover:underline">{r.decide}</Link> : <span className="text-slate-300">0</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {r.pending ? <Link href={deptHref(r.id, 'pending')} className="font-semibold text-sky-700 hover:underline">{r.pending}</Link> : <span className="text-slate-300">0</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 sm:px-5">{r.avgProgress === null ? '—' : `${r.avgProgress}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
