'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SectionCard } from '@/components/crm/ui';
import { HintTip } from '@/components/work/dashboard/Glossary';
import { ColumnChart } from '@/components/work/dashboard/charts';
import { PARTNER_TYPE_LABELS, type Portfolio } from '@/lib/mou/portfolio';
import { MouTerm } from './terms';

/** Thanh ngang: độ dài là số MOU còn hiệu lực, phần đậm là số đã triển khai. */
function Bars({ rows }: { rows: Array<{ key: string; label: string; total: number; part?: number; href?: string }> }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const label = <span className="truncate text-sm text-slate-700">{r.label}</span>;
        return (
          <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            {r.href ? <Link href={r.href} className="min-w-0 truncate hover:text-brand-700 hover:underline">{label}</Link> : label}
            <span className="text-sm font-semibold tabular-nums text-slate-800">
              {r.total}
              {r.part !== undefined && <span className="ml-1 text-xs font-normal text-slate-500">· {r.part} triển khai</span>}
            </span>
            <span className="col-span-2 flex h-2 overflow-hidden rounded-full bg-slate-100">
              <span className="flex h-full overflow-hidden rounded-full bg-brand-200" style={{ width: `${(r.total / max) * 100}%` }}>
                {r.part !== undefined && <span className="h-full bg-brand-500" style={{ width: r.total ? `${(r.part / r.total) * 100}%` : 0 }} />}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Cột chồng trong nước / quốc tế theo năm ký. */
function SignedChart({ data }: { data: Portfolio['signedByYear'] }) {
  const max = Math.max(1, ...data.map((d) => d.domestic + d.international));
  return (
    <div>
      <div className="flex h-40 items-end gap-2" role="img" aria-label={data.map((d) => `${d.year}: ${d.domestic} trong nước, ${d.international} quốc tế`).join('; ')}>
        {data.map((d) => {
          const total = d.domestic + d.international;
          return (
            <div key={d.year} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${d.year}: ${d.domestic} trong nước, ${d.international} quốc tế`}>
              <span className="text-xs font-semibold tabular-nums text-slate-700">{total || ''}</span>
              <div className="flex w-full max-w-[40px] flex-col overflow-hidden rounded-t-md" style={{ height: `${Math.max(total ? 4 : 1, (total / max) * 100)}%` }}>
                <div className="bg-violet-400" style={{ flexGrow: d.international }} />
                <div className={total ? 'bg-brand-500' : 'bg-slate-100'} style={{ flexGrow: d.domestic || (total ? 0 : 1) }} />
              </div>
              <span className="text-[11px] tabular-nums text-slate-500">{d.year}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 flex gap-3 text-[11px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-brand-500" />trong nước</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-violet-400" />quốc tế</span>
      </p>
    </div>
  );
}

export function PortfolioMix({ data, listHref }: { data: Portfolio; listHref: (params: Record<string, string>) => string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <SectionCard title="Lĩnh vực hợp tác" info={<HintTip label="Lĩnh vực hợp tác" def="MOU còn hiệu lực theo lĩnh vực ghi trên office; phần đậm là MOU đã triển khai. Một MOU nhiều lĩnh vực được đếm ở mỗi lĩnh vực." />}>
        <Bars rows={data.fields.map((f) => ({ key: f.name, label: f.name, total: f.live, part: f.started, href: listHref({ view: 'live', linhvuc: f.name }) }))} />
      </SectionCard>

      <SectionCard title="Loại đối tác" info={<HintTip label="Loại đối tác" def="MOU còn hiệu lực theo loại đối tác, nhận từ tên đối tác (bệnh viện, trường/viện, doanh nghiệp…)." />}>
        <Bars rows={data.partnerTypes.map((p) => ({ key: p.key, label: PARTNER_TYPE_LABELS[p.key], total: p.live, href: listHref({ view: 'live', doitac: p.key }) }))} />
        {data.countries.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-semibold text-slate-500"><MouTerm term="international" /></p>
            <div className="flex flex-wrap gap-1.5">
              {data.countries.map((c) => (
                <span key={c.name} className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
                  {c.name}
                  <b className="tabular-nums">{c.count}</b>
                </span>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:col-span-2 lg:grid-cols-2 xl:col-span-1 xl:grid-cols-1">
        <SectionCard title="Ký kết theo năm" info={<HintTip label="Ký kết theo năm" def="Số MOU theo năm ký (không tính MOU đang chờ ký) — xem nhịp mở rộng hợp tác." />}>
          <SignedChart data={data.signedByYear} />
        </SectionCard>
        <SectionCard title="Hết hạn theo năm" info={<HintTip label="Hết hạn theo năm" def="MOU còn hiệu lực theo năm hết hạn — năm nào nhiều thì chuẩn bị đánh giá, gia hạn trước. Cột cuối là MOU chưa ghi thời hạn." />}>
          <ColumnChart
            data={data.expiryByYear.map((e, i) => ({ label: e.label, count: e.count, className: cn(i === 0 ? 'bg-orange-400' : i === data.expiryByYear.length - 1 ? 'bg-slate-300' : 'bg-brand-400') }))}
          />
        </SectionCard>
      </div>
    </div>
  );
}
