'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PANEL } from '@/components/crm/ui';
import { HintTip } from '@/components/work/dashboard/Glossary';
import { VERDICT_DEFS, VERDICT_LABELS, type Verdict } from '@/lib/mou/assess';
import type { Portfolio } from '@/lib/mou/portfolio';
import { CLAUSE_TYPE_LABELS } from '../MOUUtils';

const BAR: Record<Verdict, string> = {
  SUCCESS: 'bg-emerald-500',
  ON_TRACK: 'bg-sky-500',
  AT_RISK: 'bg-amber-400',
  FAILED: 'bg-rose-500',
  TOO_EARLY: 'bg-slate-300',
};
const TEXT: Record<Verdict, string> = {
  SUCCESS: 'text-emerald-700',
  ON_TRACK: 'text-sky-700',
  AT_RISK: 'text-amber-700',
  FAILED: 'text-rose-700',
  TOO_EARLY: 'text-slate-500',
};

/**
 * Hiệu quả hợp tác: MOU nào thành công / thất bại (người chốt, chưa chốt thì AI
 * gợi ý) và đã ký những khía cạnh nào, mỗi loại triển khai được bao nhiêu.
 */
export function EffectivenessBoard({ data, listHref }: { data: Portfolio; listHref: (params: Record<string, string>) => string }) {
  const signed = data.verdicts.reduce((s, v) => s + v.total, 0);
  const t = data.aspectTotals;
  const maxType = Math.max(1, ...data.aspectTypes.map((a) => a.total));
  return (
    <section className={cn(PANEL, 'grid overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]')} aria-label="Hiệu quả hợp tác">
      <div className="border-b border-slate-100 p-4 sm:p-5 lg:border-b-0 lg:border-r">
        <h2 className="flex items-center gap-1 text-[15px] font-bold text-slate-900">
          Hiệu quả từng MOU
          <HintTip
            label="Hiệu quả từng MOU"
            def="AI đọc biên bản ký, đối chiếu từng khía cạnh với nhật ký office, báo cáo tuần các phòng, tiếp đoàn, công việc, sự kiện rồi gợi ý đánh giá. Lãnh đạo/Phòng HC chốt ở tab Đánh giá của từng MOU — đánh giá đã chốt luôn được ưu tiên."
          />
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {signed} MOU đã ký · <b className="text-slate-700">{data.evaluatedCount}</b> đã chốt đánh giá, còn lại là <span className="inline-flex items-center gap-0.5 text-violet-600"><Sparkles className="h-3 w-3" aria-hidden="true" />AI gợi ý</span>
        </p>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          {data.verdicts.map((v) => v.total > 0 && <span key={v.key} className={BAR[v.key as Verdict]} style={{ width: `${(v.total / Math.max(1, signed)) * 100}%` }} />)}
        </div>
        <ul className="mt-3 space-y-1.5">
          {data.verdicts.map((v) => {
            const key = v.key as Verdict;
            return (
              <li key={key}>
                <Link href={listHref({ danhgia: key })} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50" title={VERDICT_DEFS[key]}>
                  <span className={cn('h-2.5 w-2.5 rounded-sm', BAR[key])} aria-hidden="true" />
                  <span className="flex-1 text-slate-700">{VERDICT_LABELS[key]}</span>
                  <b className={cn('tabular-nums', TEXT[key])}>{v.total}</b>
                  <span className="w-20 text-right text-[11px] text-slate-400">{v.byPeople ? `${v.byPeople} đã chốt` : ''}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="p-4 sm:p-5">
        <h2 className="flex items-center gap-1 text-[15px] font-bold text-slate-900">
          Đã ký những khía cạnh nào — triển khai đến đâu
          <HintTip
            label="Khía cạnh hợp tác"
            def="Mỗi MOU được AI tách thành các khía cạnh đã cam kết (đào tạo, nghiên cứu, chuyên môn…). Đạt: có bằng chứng đạt cam kết; Đang làm: có hoạt động nhưng chưa đạt; phần xám: chưa thấy bằng chứng."
          />
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          {t.total} khía cạnh từ {t.mousWithAspects} MOU có văn bản ký · <b className="text-emerald-700">{t.completed}</b> đạt · <b className="text-sky-700">{t.inProgress}</b> đang làm · <b className="text-slate-600">{t.total - t.completed - t.inProgress}</b> chưa thấy triển khai
        </p>
        {data.aspectTypes.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Chưa có MOU nào được AI đọc văn bản.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {data.aspectTypes.map((a) => {
              const none = a.total - a.completed - a.inProgress;
              return (
                <li key={a.type} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                  <span className="truncate text-sm text-slate-700">{CLAUSE_TYPE_LABELS[a.type] ?? a.type}<span className="ml-1 text-xs text-slate-400">· {a.mous} MOU</span></span>
                  <span className="text-xs tabular-nums text-slate-500">
                    <b className="text-emerald-700">{a.completed}</b> / <b className="text-sky-700">{a.inProgress}</b> / {none} <span className="text-slate-400">(tổng {a.total})</span>
                  </span>
                  <span className="col-span-2 flex h-2 overflow-hidden rounded-full bg-slate-100" style={{ width: `${(a.total / maxType) * 100}%` }} aria-hidden="true">
                    <span className="bg-emerald-500" style={{ width: `${(a.completed / a.total) * 100}%` }} />
                    <span className="bg-sky-400" style={{ width: `${(a.inProgress / a.total) * 100}%` }} />
                    <span className="bg-slate-300" style={{ width: `${(none / a.total) * 100}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
