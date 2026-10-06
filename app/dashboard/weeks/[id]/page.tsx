'use client';

import { Suspense, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle, ArrowLeft, BarChart3, Building2, FileDown, FileText, Filter, Layers,
  ListChecks, Pencil, Search, Star, Trash2,
  Sparkles,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorBanner, PANEL, PRIMARY_BTN, SECONDARY_BTN } from '@/components/crm/ui';
import { WeekStatusBadge } from '@/components/weeks/badges';
import { KIND_META, WeekTaskCard, type WeekTask, type WeekTaskWithDept } from '@/components/weeks/WeekTaskCard';
import { cn } from '@/lib/utils';
import type { WeekStatus } from '@/lib/weeks/audit';
import { formatDateKey, formatRange, hospitalWeekRange, storedDateKey, vnTodayKey } from '@/lib/weeks/hospital-week';
import { weekListHref, withBack } from '@/lib/weeks/list-filters';

interface Department { id: string; name: string }
interface TasksByDepartment { department: Department; tasks: WeekTask[] }

interface WeekDetail {
  id: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  status: WeekStatus;
  reportFileUrl: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { name: string | null; email: string } | null;
  _count?: { metricValues: number; extractedMetrics: number };
  tasksByDepartment: TasksByDepartment[];
}

type TaskKind = 'all' | 'important' | 'recurring' | 'adhoc';
type LoadState = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; week: WeekDetail };

const ALL_DEPTS = '__all__';

export default function WeekDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <WeekDetailView params={params} />
    </Suspense>
  );
}

function WeekDetailView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const back = useSearchParams().get('back') ?? '';
  const listHref = weekListHref(back);

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [selectedDeptId, setSelectedDeptId] = useState<string>(ALL_DEPTS);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<TaskKind>('all');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const response = await fetch(`/api/weeks/${id}`);
      if (response.status === 404) {
        setState({ kind: 'error', message: 'Không tìm thấy báo cáo này — có thể đã bị xoá.' });
        return;
      }
      if (!response.ok) {
        setState({ kind: 'error', message: 'Không tải được báo cáo. Vui lòng thử lại.' });
        return;
      }
      setState({ kind: 'ready', week: (await response.json()) as WeekDetail });
    } catch (error) {
      console.error('Lỗi tải báo cáo tuần:', error);
      setState({ kind: 'error', message: 'Mất kết nối khi tải báo cáo. Vui lòng thử lại.' });
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const week = state.kind === 'ready' ? state.week : null;

  const { flatTasks, deptStats, importantCount } = useMemo(() => {
    if (!week) return { flatTasks: [] as WeekTaskWithDept[], deptStats: [], importantCount: 0 };
    const flat: WeekTaskWithDept[] = week.tasksByDepartment.flatMap((dt) =>
      dt.tasks.map((t) => ({ ...t, department: dt.department })),
    );
    const stats = week.tasksByDepartment
      .map((dt) => ({ ...dt.department, total: dt.tasks.length, important: dt.tasks.filter((t) => t.isImportant).length }))
      .sort((a, b) => b.important - a.important || b.total - a.total);
    return { flatTasks: flat, deptStats: stats, importantCount: flat.filter((t) => t.isImportant).length };
  }, [week]);

  const visibleTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flatTasks
      .filter((t) => selectedDeptId === ALL_DEPTS || t.department.id === selectedDeptId)
      .filter((t) => {
        if (kindFilter === 'important') return t.isImportant;
        if (kindFilter === 'recurring') return !!t.masterTask;
        if (kindFilter === 'adhoc') return !t.masterTask;
        return true;
      })
      .filter((t) => {
        if (!q) return true;
        const haystack = [t.masterTask?.name, t.taskName, t.masterTask?.description, t.subject, t.result]
          .filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => (a.isImportant !== b.isImportant ? (a.isImportant ? -1 : 1) : a.orderNumber - b.orderNumber));
  }, [flatTasks, selectedDeptId, kindFilter, search]);

  const handleDelete = async () => {
    setConfirmDelete(false);
    setDeleting(true);
    setDeleteError('');
    try {
      const response = await fetch(`/api/weeks/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        setDeleteError('Không xoá được báo cáo. Vui lòng thử lại.');
        return;
      }
      router.push(listHref);
    } catch (error) {
      console.error('Lỗi xoá báo cáo tuần:', error);
      setDeleteError('Mất kết nối khi xoá báo cáo.');
    } finally {
      setDeleting(false);
    }
  };

  const backLink = (
    <Link href={listHref} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-brand-700">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Danh sách báo cáo
    </Link>
  );

  if (state.kind === 'loading') return <DetailSkeleton />;

  if (state.kind === 'error' || !week) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        {backLink}
        <ErrorBanner message={state.kind === 'error' ? state.message : 'Không tìm thấy báo cáo'} />
        <button type="button" onClick={() => void load()} className={SECONDARY_BTN}>Thử lại</button>
      </div>
    );
  }

  const startKey = storedDateKey(week.startDate);
  const endKey = storedDateKey(week.endDate);
  const expected = hospitalWeekRange(week.weekNumber, week.year);
  const isDateOffRule = week.weekNumber > 2 && (expected.startKey !== startKey || expected.endKey !== endKey);
  const metricTotal = (week._count?.metricValues ?? 0) + (week._count?.extractedMetrics ?? 0);
  const selectedDept = selectedDeptId === ALL_DEPTS ? null : deptStats.find((d) => d.id === selectedDeptId);
  const isFiltered = !!selectedDept || kindFilter !== 'all' || !!search;

  return (
    <div className="mx-auto max-w-7xl animate-fade-in">
      <ConfirmDialog
        open={confirmDelete}
        title={`Xoá báo cáo tuần ${week.weekNumber}/${week.year}?`}
        message={`Toàn bộ ${flatTasks.length} nhiệm vụ và số liệu của tuần này sẽ bị xoá vĩnh viễn, không khôi phục được.`}
        confirmLabel="Xoá báo cáo"
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />

      {backLink}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 shadow-sm shadow-brand-500/20">
            <FileText className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Báo cáo tuần {week.weekNumber}/{week.year}</h1>
              <WeekStatusBadge status={week.status} />
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {formatRange(startKey, endKey)} · Thứ Bảy → Thứ Sáu
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {week.reportFileUrl && (
            <a href={week.reportFileUrl} target="_blank" rel="noopener noreferrer" className={cn(SECONDARY_BTN, 'px-3')}>
              <FileDown className="h-4 w-4" aria-hidden="true" /> Biên bản
            </a>
          )}
          <Link href={`/dashboard/weeks/${week.id}/metrics`} className={cn(SECONDARY_BTN, 'px-3')} title="Nhập số liệu định lượng của tuần">
            <BarChart3 className="h-4 w-4" aria-hidden="true" /> Số liệu
          </Link>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            className={cn(SECONDARY_BTN, 'px-3 hover:border-rose-400 hover:text-rose-700')}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> {deleting ? 'Đang xoá…' : 'Xoá'}
          </button>
          <Link href={`/dashboard/weeks/${week.id}/summary`} className={SECONDARY_BTN} title="Báo cáo tóm tắt hoạt động Bệnh viện do AI viết">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> Báo cáo tóm tắt
          </Link>
          <Link href={withBack(`/dashboard/weeks/${week.id}/edit`, back)} className={PRIMARY_BTN}>
            <Pencil className="h-4 w-4" aria-hidden="true" /> Chỉnh sửa
          </Link>
        </div>
      </header>

      <div className="mt-4 space-y-2">
        {deleteError && <ErrorBanner message={deleteError} />}
        {isDateOffRule && (
          <div role="note" className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Ngày đang lưu lệch quy tắc: tuần {week.weekNumber} đúng ra là {formatRange(expected.startKey, expected.endKey)}.
              Vào <strong>Chỉnh sửa</strong> → &quot;Sửa theo quy tắc&quot; để chỉnh.
            </span>
          </div>
        )}
        {week.status === 'DRAFT' && (
          <p className="text-xs text-slate-500">
            Báo cáo đang ở trạng thái <strong className="text-amber-700">Nháp</strong> — vào Chỉnh sửa và bấm &quot;Hoàn thành &amp; Lưu&quot; để chốt.
          </p>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Đơn vị" value={deptStats.length} hint="khoa/phòng có nhiệm vụ" tone="brand" />
        <StatTile label="Nhiệm vụ" value={flatTasks.length} hint={`${importantCount} quan trọng`} tone="emerald" />
        <StatTile label="Số liệu" value={metricTotal} hint="nhập tay + AI trích" tone={metricTotal === 0 ? 'slate' : 'violet'} />
        <StatTile
          label="Cập nhật"
          value={formatDateKey(vnTodayKey(new Date(week.updatedAt)), true)}
          hint={week.createdBy?.name ? `Tạo bởi ${week.createdBy.name}` : `Tạo ${formatDateKey(vnTodayKey(new Date(week.createdAt)), true)}`}
          tone="slate"
          small
        />
      </dl>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className={cn(PANEL, 'hidden h-fit p-2 md:sticky md:top-4 md:block')} aria-label="Lọc theo đơn vị">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">Đơn vị</p>
          <div className="max-h-[70vh] space-y-0.5 overflow-y-auto">
            <DeptRow active={selectedDeptId === ALL_DEPTS} onClick={() => setSelectedDeptId(ALL_DEPTS)} name="Tất cả đơn vị" total={flatTasks.length} important={importantCount} isAll />
            <div className="my-1 h-px bg-slate-100" />
            {deptStats.map((d) => (
              <DeptRow key={d.id} active={selectedDeptId === d.id} onClick={() => setSelectedDeptId(d.id)} name={d.name} total={d.total} important={d.important} />
            ))}
          </div>
        </aside>

        <section className="min-w-0" aria-label="Nhiệm vụ trong tuần">
          <div className={cn(PANEL, 'mb-3 space-y-3 p-3')}>
            <label className="block md:hidden">
              <span className="sr-only">Đơn vị</span>
              <Select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value={ALL_DEPTS}>Tất cả đơn vị ({flatTasks.length})</option>
                {deptStats.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.total})</option>)}
              </Select>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-0 flex-1 basis-56">
                <span className="sr-only">Tìm nhiệm vụ</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm theo tên, đối tượng, kết quả…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                />
              </label>
              <div role="group" aria-label="Loại nhiệm vụ" className="flex flex-wrap gap-1.5">
                <FilterChip active={kindFilter === 'all'} onClick={() => setKindFilter('all')}>Tất cả</FilterChip>
                <FilterChip active={kindFilter === 'important'} onClick={() => setKindFilter('important')} tone="amber" title={KIND_META.important.hint}>
                  <Star className="h-3.5 w-3.5" aria-hidden="true" /> {KIND_META.important.label}
                </FilterChip>
                <FilterChip active={kindFilter === 'recurring'} onClick={() => setKindFilter('recurring')} tone="brand" title={KIND_META.recurring.hint}>
                  {KIND_META.recurring.label}
                </FilterChip>
                <FilterChip active={kindFilter === 'adhoc'} onClick={() => setKindFilter('adhoc')} tone="violet" title={KIND_META.adhoc.hint}>
                  {KIND_META.adhoc.label}
                </FilterChip>
              </div>
            </div>
            {isFiltered && (
              <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500" aria-live="polite">
                <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                Hiển thị {visibleTasks.length}/{flatTasks.length} nhiệm vụ
                {selectedDept && <span className="font-medium text-slate-700">· {selectedDept.name}</span>}
              </p>
            )}
          </div>

          {visibleTasks.length === 0 ? (
            <div className={cn(PANEL, 'p-12 text-center')}>
              <ListChecks className="mx-auto mb-3 h-12 w-12 text-slate-300" aria-hidden="true" />
              <h2 className="mb-1 text-base font-medium text-slate-900">Không có nhiệm vụ</h2>
              <p className="text-sm text-slate-500">
                {flatTasks.length === 0 ? 'Báo cáo này chưa có nhiệm vụ nào.' : 'Thử điều chỉnh bộ lọc hoặc từ khoá tìm kiếm.'}
              </p>
            </div>
          ) : (
            <ol className="space-y-2">
              {visibleTasks.map((task) => (
                <li key={task.id}><WeekTaskCard task={task} showDept={selectedDeptId === ALL_DEPTS} /></li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

const STAT_TONE = {
  brand: 'border-t-brand-500',
  emerald: 'border-t-emerald-500',
  violet: 'border-t-violet-500',
  slate: 'border-t-slate-300',
} as const;

function StatTile({ label, value, hint, tone, small }: {
  label: string; value: ReactNode; hint?: string; tone: keyof typeof STAT_TONE; small?: boolean;
}) {
  return (
    <div className={cn('min-w-0 rounded-2xl border border-t-4 border-slate-200/80 bg-white p-4 shadow-sm', STAT_TONE[tone])}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={cn('mt-1 font-bold tabular-nums text-slate-900', small ? 'text-lg' : 'text-2xl')}>{value}</dd>
      {hint && <dd className="mt-0.5 truncate text-xs text-slate-500">{hint}</dd>}
    </div>
  );
}

function DeptRow({ active, onClick, name, total, important, isAll }: {
  active: boolean; onClick: () => void; name: string; total: number; important: number; isAll?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        active ? 'bg-brand-50 text-brand-900' : 'text-slate-700 hover:bg-slate-50',
      )}
    >
      {isAll ? (
        <Layers className={cn('h-4 w-4 shrink-0', active ? 'text-brand-600' : 'text-slate-400')} aria-hidden="true" />
      ) : (
        <Building2 className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-brand-600' : 'text-slate-300')} aria-hidden="true" />
      )}
      <span className={cn('flex-1 truncate text-sm', active ? 'font-semibold' : isAll ? 'font-medium' : '')}>{name}</span>
      {important > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-600" title={`${important} nhiệm vụ quan trọng`}>
          <Star className="h-3 w-3 fill-amber-500 stroke-amber-500" aria-hidden="true" />
          {important}
        </span>
      )}
      <span className={cn('font-mono text-xs', active ? 'text-brand-700' : 'text-slate-400')}>{total}</span>
    </button>
  );
}

const CHIP_TONE = {
  default: 'bg-slate-800 text-white ring-slate-800',
  amber: 'bg-amber-500 text-white ring-amber-500',
  brand: 'bg-brand-600 text-white ring-brand-600',
  violet: 'bg-violet-600 text-white ring-violet-600',
} as const;

function FilterChip({ active, onClick, children, tone = 'default', title }: {
  active: boolean; onClick: () => void; children: ReactNode; tone?: keyof typeof CHIP_TONE; title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        active ? CHIP_TONE[tone] : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-4" aria-busy="true" aria-label="Đang tải báo cáo">
      <div className="h-20 rounded-2xl bg-slate-100" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-slate-100" />)}
      </div>
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <div className="hidden h-[420px] rounded-2xl bg-slate-100 md:block" />
        <div className="h-[420px] rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}
