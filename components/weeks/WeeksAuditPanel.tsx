import Link from 'next/link';
import { ChevronDown, Plus, ShieldCheck } from 'lucide-react';
import { formatRange } from '@/lib/weeks/hospital-week';
import { needsAttention, type YearAudit } from '@/lib/weeks/audit';
import { IssueChip } from './badges';
import type { WeekListItem } from './types';

interface WeeksAuditPanelProps {
  weeks: WeekListItem[];
  audit: YearAudit;
  weekHref: (id: string) => string;
  newReportHref: (dateKey: string) => string;
}

/** Danh sách việc cần xử lý: tuần thiếu + tuần có lỗi/cần kiểm tra. */
export function WeeksAuditPanel({ weeks, audit, weekHref, newReportHref }: WeeksAuditPanelProps) {
  const flagged = weeks
    .filter((w) => needsAttention(audit.issuesByWeek[w.id]))
    .sort((a, b) => a.weekNumber - b.weekNumber);
  const total = audit.missingWeeks.length + flagged.length;

  if (total === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        Dữ liệu năm này không có tuần thiếu, lệch ngày hay trùng ngày.
      </div>
    );
  }

  return (
    <details open className="group rounded-2xl border border-orange-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 hover:bg-orange-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-900">Rà soát dữ liệu · {total} mục</span>
          <span className="block text-xs text-slate-500">
            {audit.missingWeeks.length > 0 && `${audit.missingWeeks.length} tuần thiếu`}
            {audit.missingWeeks.length > 0 && flagged.length > 0 && ' · '}
            {flagged.length > 0 && `${flagged.length} tuần cần kiểm tra`}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="divide-y divide-slate-100 border-t border-slate-100">
        {audit.missingWeeks.map((m) => (
          <li key={`missing-${m.weekNumber}`} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
            <span className="inline-flex items-center rounded-md bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">Thiếu tuần {m.weekNumber}</span>
            <span className="text-sm text-slate-600">{formatRange(m.startKey, m.endKey)} chưa có báo cáo</span>
            <Link
              href={newReportHref(m.startKey)}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Tạo báo cáo
            </Link>
          </li>
        ))}
        {flagged.map((w) => (
          <li key={w.id} className="px-4 py-2.5">
            <Link
              href={weekHref(w.id)}
              className="text-sm font-bold text-slate-900 underline-offset-2 hover:text-brand-700 hover:underline"
            >
              Tuần {w.weekNumber}
            </Link>
            <ul className="mt-1 space-y-1">
              {(audit.issuesByWeek[w.id] ?? []).filter((i) => i.severity !== 'info').map((i) => (
                <li key={i.code} className="flex flex-wrap items-start gap-x-2 gap-y-1 text-xs text-slate-600">
                  <IssueChip issue={i} />
                  <span className="min-w-0 flex-1 basis-48">{i.detail}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
        Quy tắc: tuần báo cáo chạy Thứ Bảy → Thứ Sáu; hai tuần đầu năm lệch nhịp theo lịch bệnh viện nên không bắt lỗi ngày.
        Đơn vị &quot;thường lệ&quot; = có mặt ở ít nhất 75% số tuần trong năm.
      </p>
    </details>
  );
}
