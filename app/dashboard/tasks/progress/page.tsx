'use client';

/**
 * Tiến độ nhiệm vụ — tình trạng từng việc cụ thể trong báo cáo tuần của các phòng.
 *
 * AI đọc cách báo cáo của từng phòng (ghi 100% mọi tuần / ghi % thật / không ghi %)
 * để quyết việc nào thường kỳ (không gán %), việc nào có tiến độ, việc nào đã xong.
 * Phòng Hành chính bấm vào một việc để xem diễn tiến và xác nhận/sửa.
 */

import { Suspense, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { BarChart3, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toSearchKey } from '@/lib/crm/constants';
import { PageHeader } from '@/components/ui/PageHeader';
import { crmFetch } from '@/components/crm/api';
import { ErrorBanner, PANEL } from '@/components/crm/ui';
import { ThreadRow } from '@/components/tasks/ThreadBits';
import { ThreadDetailModal } from '@/components/tasks/ThreadDetailModal';
import { ThreadsOverview, type DepartmentStats } from '@/components/tasks/ThreadsOverview';
import { ThreadsTimeline } from '@/components/tasks/ThreadsTimeline';
import type { ThreadDto } from '@/lib/task-tracking/server';
import { WeeklyModuleNav } from '@/components/weeks/WeeklyModuleNav';

interface DepartmentInfo extends DepartmentStats {
  summary: string;
}

const VIEWS = [
  { key: 'tong-quan', label: 'Tổng quan toàn viện' },
  { key: 'theo-phong', label: 'Theo từng phòng' },
  { key: 'dong-thoi-gian', label: 'Dòng thời gian' },
] as const;
type View = (typeof VIEWS)[number]['key'];

interface ProgressData {
  year: number;
  departments: DepartmentInfo[];
  threads: ThreadDto[];
}

const STYLE_LABELS: Record<string, string> = {
  NO_PERCENT: 'Không ghi %',
  ALWAYS_100: 'Ghi 100% mỗi tuần',
  PROGRESSIVE: 'Ghi % tiến độ thật',
  MIXED: 'Ghi lẫn lộn',
};
/** Mặc định chỉ xem việc còn hoạt động gần đây. */
const RECENT_WEEKS = 8;
const DEFAULT_DEPARTMENT = 'Phòng Hành chính';

type Section = { key: string; title: string; hint: string; items: ThreadDto[] };

function buildSections(threads: ThreadDto[], latestWeek: number, recentOnly: boolean): Section[] {
  const recent = (t: ThreadDto) => !recentOnly || t.lastWeek >= latestWeek - RECENT_WEEKS || (t.completedWeek ?? 0) >= latestWeek - RECENT_WEEKS;
  const pool = threads.filter(recent);
  const review = pool.filter((t) => t.needsReview);
  const rest = pool.filter((t) => !t.needsReview);
  const byProgress = (a: ThreadDto, b: ThreadDto) => (b.progress ?? -1) - (a.progress ?? -1) || b.lastWeek - a.lastWeek;
  return [
    { key: 'review', title: 'Cần xác nhận', hint: 'AI chưa chắc, hoặc việc ngừng báo cáo mà chưa rõ đã xong chưa', items: review.sort((a, b) => b.lastWeek - a.lastWeek) },
    {
      key: 'progress', title: 'Đang thực hiện — có tiến độ', hint: 'Việc có đích, theo dõi bằng %',
      items: rest.filter((t) => t.kind !== 'ROUTINE' && (t.status === 'IN_PROGRESS' || t.status === 'STALLED')).sort(byProgress),
    },
    {
      key: 'done', title: 'Hoàn thành', hint: 'Mới xong trước',
      items: rest.filter((t) => t.status === 'DONE').sort((a, b) => (b.completedWeek ?? 0) - (a.completedWeek ?? 0)),
    },
    {
      key: 'routine', title: 'Việc thường kỳ', hint: 'Tuần nào cũng làm — không gán %',
      items: rest.filter((t) => t.kind === 'ROUTINE' && t.status === 'IN_PROGRESS').sort((a, b) => b.weeksReported - a.weeksReported),
    },
    { key: 'stopped', title: 'Ngừng báo cáo', hint: 'Không còn trong báo cáo, chưa có dấu hiệu xong', items: rest.filter((t) => t.status === 'STOPPED') },
    { key: 'pending', title: 'Chưa đánh giá', hint: 'Việc mới, AI sẽ đánh giá ở lần chạy sau', items: rest.filter((t) => !t.status) },
  ].filter((s) => s.items.length > 0);
}

function ProgressBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: session } = useSession();
  const [query, setQuery] = useState('');
  const [recentOnly, setRecentOnly] = useState(true);
  const [open, setOpen] = useState<ThreadDto | null>(null);
  const [withRoutine, setWithRoutine] = useState(false);
  const rawView = params.get('xem');
  const view: View = VIEWS.some((v) => v.key === rawView) ? (rawView as View) : params.get('phong') ? 'theo-phong' : 'tong-quan';

  const { data: list } = useSWR<ProgressData>('/api/task-threads', (url: string) => crmFetch<ProgressData>(url), { revalidateOnFocus: false });
  const departments = list?.departments ?? [];
  const chosenName = params.get('phong') ?? departments.find((d) => d.id === session?.user?.departmentId)?.name ?? DEFAULT_DEPARTMENT;
  const dept = departments.find((d) => d.name === chosenName) ?? departments[0];

  const { data, error, mutate } = useSWR<ProgressData>(
    dept && view !== 'tong-quan' ? `/api/task-threads?departmentId=${dept.id}` : null,
    (url: string) => crmFetch<ProgressData>(url),
    { revalidateOnFocus: false },
  );

  const sections = useMemo(() => {
    const q = toSearchKey(query);
    const threads = (data?.threads ?? []).filter((t) => !q || toSearchKey(t.title, t.rawName, t.lastText).includes(q));
    return buildSections(threads, dept?.latestWeek ?? 0, recentOnly && !q);
  }, [data, query, recentOnly, dept]);

  const setView = (v: View) => {
    const next = new URLSearchParams(params.toString());
    next.set('xem', v);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const choose = (name: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('phong', name);
    if (view === 'tong-quan') next.set('xem', 'theo-phong');
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const onSaved = (saved: ThreadDto) => {
    mutate((current) => current && { ...current, threads: current.threads.map((t) => (t.id === saved.id ? saved : t)) }, { revalidate: false });
    setOpen(saved);
  };

  return (
    <div className="space-y-5">
      <WeeklyModuleNav />
      <PageHeader icon={BarChart3} title="Nhiệm vụ các phòng" description="Tình trạng từng việc trong báo cáo tuần các phòng — AI đọc theo cách báo cáo riêng của mỗi phòng" />
      <ErrorBanner message={error ? (error as Error).message : ''} />

      <div role="tablist" aria-label="Cách xem" className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            onClick={() => setView(v.key)}
            className={cn('rounded-lg px-3.5 py-1.5 text-sm font-semibold transition', view === v.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'tong-quan' && (
        !list ? <div className="h-96 animate-pulse rounded-2xl bg-slate-200/70" aria-hidden="true" /> : <ThreadsOverview departments={departments} onOpen={choose} />
      )}
      {view !== 'tong-quan' && (<>

      <nav aria-label="Chọn phòng" className="flex flex-wrap gap-2">
        {!list
          ? Array.from({ length: 8 }, (_, i) => <span key={i} className="h-9 w-40 animate-pulse rounded-xl bg-slate-200/70" />)
          : departments.map((d) => {
              const on = d.name === dept?.name;
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => choose(d.name)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                    on ? 'border-brand-600 bg-brand-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50',
                  )}
                >
                  {d.name.replace(/^Phòng /, '')}
                  <span className={cn('rounded-full px-1.5 text-[11px] font-semibold tabular-nums', on ? 'bg-white/20' : 'bg-slate-100 text-slate-500')}>{d.activeProjects}</span>
                  {d.needsReview > 0 && !on && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label={`${d.needsReview} việc cần xác nhận`} />}
                </button>
              );
            })}
      </nav>

      {dept && (
        <div className={cn(PANEL, 'space-y-2 p-4')}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">{dept.name}</h2>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{STYLE_LABELS[dept.style] ?? dept.style}</span>
            <span className="text-sm text-slate-500">
              {dept.total} việc · {dept.activeProjects} đang có tiến độ · {dept.needsReview} cần xác nhận · tuần mới nhất {dept.latestWeek}
            </span>
          </div>
          <p className="text-sm text-slate-600">{dept.summary}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[240px] flex-1">
          <span className="sr-only">Tìm việc</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm việc trong phòng (gõ không dấu được)"
            className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>
        <div role="group" aria-label="Khoảng thời gian" className="inline-flex rounded-xl bg-slate-100 p-1">
          {([[true, `${RECENT_WEEKS} tuần gần đây`], [false, 'Cả năm']] as const).map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={recentOnly === value}
              onClick={() => setRecentOnly(value)}
              className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition', recentOnly === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'dong-thoi-gian' ? (
        !data ? <div className="h-96 animate-pulse rounded-2xl bg-slate-200/70" aria-hidden="true" /> : (
          <>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={withRoutine} onChange={(e) => setWithRoutine(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
              Gồm cả việc thường kỳ
            </label>
            <ThreadsTimeline threads={data.threads} latestWeek={dept?.latestWeek ?? 0} onOpen={setOpen} includeRoutine={withRoutine} />
          </>
        )
      ) : !data && dept ? (
        <div className="space-y-3" aria-busy="true">{Array.from({ length: 3 }, (_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-200/70" />)}</div>
      ) : sections.length === 0 ? (
        <p className={cn(PANEL, 'p-10 text-center text-sm text-slate-500')}>Không có việc nào khớp.</p>
      ) : (
        sections.map((s) => (
          <section key={s.key} className={cn(PANEL, 'overflow-hidden')} aria-label={s.title}>
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
              <h3 className="text-sm font-bold text-slate-800">{s.title} <span className="font-medium text-slate-400">· {s.items.length}</span></h3>
              <span className="text-xs text-slate-500">{s.hint}</span>
            </header>
            <ul className="divide-y divide-slate-100 p-1.5">
              {s.items.slice(0, 60).map((t) => <ThreadRow key={t.id} thread={t} onOpen={setOpen} />)}
            </ul>
            {s.items.length > 60 && <p className="px-4 pb-3 text-xs text-slate-500">Hiện 60/{s.items.length} việc — gõ tìm để thu hẹp.</p>}
          </section>
        ))
      )}

      </>)}

      <p className="text-xs text-slate-400">
        Nhiệm vụ do AI cấu trúc lại từ báo cáo tuần các phòng (quét tự động hằng ngày).{' '}
        <a href="/dashboard/tasks" className="underline-offset-2 hover:text-brand-700 hover:underline">Danh mục nhiệm vụ gốc</a> chỉ dùng khi sửa tay một báo cáo tuần.
      </p>

      {open && <ThreadDetailModal thread={open} onClose={() => setOpen(null)} onSaved={onSaved} />}
    </div>
  );
}

export default function TaskProgressPage() {
  return (
    <Suspense>
      <ProgressBoard />
    </Suspense>
  );
}
