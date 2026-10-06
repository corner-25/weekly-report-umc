'use client';

/**
 * Thanh chuyển mục của phân hệ "Báo cáo tuần Bệnh viện": báo cáo tóm tắt các tuần,
 * nhiệm vụ các phòng (AI đã cấu trúc lại từ báo cáo), số liệu theo dõi.
 * Ba mục cùng một nguồn — báo cáo tuần các phòng quét tự động hằng ngày.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, FileText, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

export const WEEKLY_MODULE_TABS = [
  { href: '/dashboard/weeks', label: 'Báo cáo các tuần', hint: 'Tóm tắt hoạt động Bệnh viện từng tuần', icon: FileText, match: ['/dashboard/weeks'] },
  { href: '/dashboard/tasks/progress', label: 'Nhiệm vụ các phòng', hint: 'Tiến độ từng việc, tổng hợp, dòng thời gian', icon: ListChecks, match: ['/dashboard/tasks'] },
  { href: '/dashboard/reports/metrics-data', label: 'Số liệu theo dõi', hint: 'Chỉ số trích từ báo cáo các phòng', icon: BarChart3, match: ['/dashboard/reports/metrics-data'] },
] as const;

export function WeeklyModuleNav({ className }: { className?: string }) {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Báo cáo tuần Bệnh viện" className={cn('-mx-1 overflow-x-auto px-1 print:hidden', className)}>
      <ul className="flex min-w-max gap-1 rounded-2xl bg-slate-100 p-1">
        {WEEKLY_MODULE_TABS.map((t) => {
          const on = t.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? 'page' : undefined}
                title={t.hint}
                className={cn(
                  'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  on ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:bg-white/60 hover:text-slate-900',
                )}
              >
                <t.icon className="h-4 w-4" aria-hidden="true" />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
