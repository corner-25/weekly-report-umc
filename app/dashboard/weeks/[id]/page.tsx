'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import Link from 'next/link';
import {
  FileText, Pencil, ArrowLeft, Building2, ListChecks, Calendar,
  Star, Download, Eye, Search, Filter, Layers, Clock, Target,
  CheckCircle2, CircleDot, FileDown, ChevronRight,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

interface Task {
  id: string;
  orderNumber: number;
  taskName?: string;
  masterTask?: { name: string; description: string | null };
  result: string;
  timePeriod: string;
  progress: number | null;
  nextWeekPlan: string;
  isImportant: boolean;
}

interface Department { id: string; name: string; }
interface TasksByDepartment { department: Department; tasks: Task[]; }

interface Week {
  id: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  status: string;
  reportFileUrl: string | null;
  createdAt: string;
  tasksByDepartment: TasksByDepartment[];
}

type TaskKind = 'all' | 'important' | 'longterm' | 'shortterm';

export default function WeekDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [week, setWeek] = useState<Week | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('__all__');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<TaskKind>('all');

  useEffect(() => { fetchWeek(); }, [resolvedParams.id]);

  const fetchWeek = async () => {
    try {
      const response = await fetch(`/api/weeks/${resolvedParams.id}`);
      if (response.ok) setWeek(await response.json());
      else router.push('/dashboard');
    } catch (error) {
      console.error('Error fetching week:', error);
    } finally {
      setLoading(false);
    }
  };

  const { flatTasks, deptStats, totalTasks, importantCount } = useMemo(() => {
    if (!week) return { flatTasks: [], deptStats: [], totalTasks: 0, importantCount: 0 };
    const flat: (Task & { department: Department })[] = [];
    const stats = week.tasksByDepartment.map((dt) => {
      const imp = dt.tasks.filter((t) => t.isImportant).length;
      dt.tasks.forEach((t) => flat.push({ ...t, department: dt.department }));
      return { ...dt.department, total: dt.tasks.length, important: imp };
    });
    return {
      flatTasks: flat,
      deptStats: stats.sort((a, b) => b.important - a.important || b.total - a.total),
      totalTasks: flat.length,
      importantCount: flat.filter((t) => t.isImportant).length,
    };
  }, [week]);

  const visibleTasks = useMemo(() => {
    let tasks = selectedDeptId === '__all__'
      ? flatTasks
      : flatTasks.filter((t) => t.department.id === selectedDeptId);

    if (kindFilter === 'important') tasks = tasks.filter((t) => t.isImportant);
    else if (kindFilter === 'longterm') tasks = tasks.filter((t) => t.masterTask);
    else if (kindFilter === 'shortterm') tasks = tasks.filter((t) => !t.masterTask);

    const q = search.trim().toLowerCase();
    if (q) {
      tasks = tasks.filter((t) => {
        const name = (t.masterTask?.name || t.taskName || '').toLowerCase();
        const desc = (t.masterTask?.description || '').toLowerCase();
        const result = (t.result || '').toLowerCase();
        return name.includes(q) || desc.includes(q) || result.includes(q);
      });
    }

    return tasks.sort((a, b) => {
      if (a.isImportant !== b.isImportant) return a.isImportant ? -1 : 1;
      return a.orderNumber - b.orderNumber;
    });
  }, [flatTasks, selectedDeptId, kindFilter, search]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-slate-100 rounded-xl" />
          <div className="grid grid-cols-[280px_1fr] gap-4">
            <div className="h-[500px] bg-slate-100 rounded-xl" />
            <div className="h-[500px] bg-slate-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!week) {
    return <div className="text-center py-12"><p className="text-slate-500">Không tìm thấy báo cáo</p></div>;
  }

  const selectedDept = selectedDeptId === '__all__'
    ? null
    : deptStats.find((d) => d.id === selectedDeptId);

  return (
    <div className="max-w-7xl mx-auto">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-cyan-600 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Quay lại
      </button>

      <PageHeader
        icon={FileText}
        title={`Báo cáo Tuần ${week.weekNumber}/${week.year}`}
        description={`${format(new Date(week.startDate), 'dd/MM/yyyy', { locale: vi })} — ${format(new Date(week.endDate), 'dd/MM/yyyy', { locale: vi })}`}
        actions={
          <div className="flex items-center gap-2">
            {week.reportFileUrl && (
              <a
                href={week.reportFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all"
              >
                <FileDown className="w-4 h-4" /> Biên bản
              </a>
            )}
            <Link
              href={`/dashboard/weeks/${week.id}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all shadow-sm shadow-cyan-500/20"
            >
              <Pencil className="w-4 h-4" /> Chỉnh sửa
            </Link>
          </div>
        }
      />

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
        <StatCard icon={Building2} label="Phòng ban" value={deptStats.length} tone="cyan" />
        <StatCard icon={ListChecks} label="Nhiệm vụ" value={totalTasks} tone="emerald" />
        <StatCard icon={Star} label="Quan trọng" value={importantCount} tone="amber" />
        <StatCard
          icon={Calendar}
          label="Ngày tạo"
          value={format(new Date(week.createdAt), 'dd/MM/yyyy', { locale: vi })}
          tone="slate"
          small
        />
      </div>

      {/* Dual pane */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 mt-6">
        {/* Left rail */}
        <aside className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-2 h-fit md:sticky md:top-4">
          <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Phòng ban
          </div>
          <div className="space-y-0.5 max-h-[70vh] overflow-y-auto">
            <DeptRow
              active={selectedDeptId === '__all__'}
              onClick={() => setSelectedDeptId('__all__')}
              name="Tất cả phòng ban"
              total={totalTasks}
              important={importantCount}
              icon={Layers}
              isAll
            />
            <div className="h-px bg-slate-100 my-1" />
            {deptStats.map((d) => (
              <DeptRow
                key={d.id}
                active={selectedDeptId === d.id}
                onClick={() => setSelectedDeptId(d.id)}
                name={d.name}
                total={d.total}
                important={d.important}
              />
            ))}
          </div>
        </aside>

        {/* Right pane */}
        <section className="min-w-0">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm theo tên, mô tả, kết quả..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500"
                />
              </div>
              <FilterChip active={kindFilter === 'all'} onClick={() => setKindFilter('all')}>
                Tất cả
              </FilterChip>
              <FilterChip
                active={kindFilter === 'important'}
                onClick={() => setKindFilter('important')}
                tone="amber"
              >
                <Star className="w-3.5 h-3.5" /> Quan trọng
              </FilterChip>
              <FilterChip
                active={kindFilter === 'longterm'}
                onClick={() => setKindFilter('longterm')}
                tone="blue"
              >
                Dài hạn
              </FilterChip>
              <FilterChip
                active={kindFilter === 'shortterm'}
                onClick={() => setKindFilter('shortterm')}
                tone="emerald"
              >
                Ngắn hạn
              </FilterChip>
            </div>

            {(selectedDept || kindFilter !== 'all' || search) && (
              <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5" />
                <span>Hiển thị {visibleTasks.length} / {totalTasks} nhiệm vụ</span>
                {selectedDept && (
                  <span className="inline-flex items-center gap-1">
                    <ChevronRight className="w-3 h-3" />
                    <span className="font-medium text-slate-700">{selectedDept.name}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {visibleTasks.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-12 text-center">
              <ListChecks className="mx-auto w-12 h-12 text-slate-300 mb-3" />
              <h3 className="text-base font-medium text-slate-900 mb-1">Không có nhiệm vụ</h3>
              <p className="text-sm text-slate-500">Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleTasks.map((task) => (
                <TaskCard key={task.id} task={task} showDept={selectedDeptId === '__all__'} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone, small }: {
  icon: any; label: string; value: string | number; tone: 'cyan' | 'emerald' | 'amber' | 'slate'; small?: boolean;
}) {
  const tones: Record<string, string> = {
    cyan: 'bg-cyan-50 text-cyan-600 ring-cyan-200',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-600 ring-amber-200',
    slate: 'bg-slate-50 text-slate-600 ring-slate-200',
  };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ring-1 ring-inset ${tones[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className={`font-bold text-slate-900 ${small ? 'text-base' : 'text-xl'}`}>{value}</p>
      </div>
    </div>
  );
}

function DeptRow({ active, onClick, name, total, important, icon: Icon, isAll }: {
  active: boolean; onClick: () => void; name: string; total: number; important: number;
  icon?: any; isAll?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2 transition-colors group ${
        active ? 'bg-cyan-50 text-cyan-900' : 'hover:bg-slate-50 text-slate-700'
      }`}
    >
      {Icon ? (
        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-cyan-600' : 'text-slate-400'}`} />
      ) : (
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? 'bg-cyan-500' : 'bg-slate-300'}`} />
      )}
      <span className={`flex-1 text-sm truncate ${active ? 'font-semibold' : isAll ? 'font-medium' : ''}`}>
        {name}
      </span>
      {important > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 font-medium">
          <Star className="w-3 h-3 fill-amber-500 stroke-amber-500" />
          {important}
        </span>
      )}
      <span className={`text-xs font-mono ${active ? 'text-cyan-700' : 'text-slate-400'}`}>
        {total}
      </span>
    </button>
  );
}

function FilterChip({ active, onClick, children, tone }: {
  active: boolean; onClick: () => void; children: React.ReactNode; tone?: 'amber' | 'blue' | 'emerald';
}) {
  const activeTones: Record<string, string> = {
    amber: 'bg-amber-500 text-white ring-amber-500',
    blue: 'bg-blue-500 text-white ring-blue-500',
    emerald: 'bg-emerald-500 text-white ring-emerald-500',
    default: 'bg-slate-800 text-white ring-slate-800',
  };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg ring-1 ring-inset transition-colors whitespace-nowrap ${
        active
          ? activeTones[tone || 'default']
          : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function TaskCard({ task, showDept }: {
  task: Task & { department: Department }; showDept: boolean;
}) {
  const isMaster = !!task.masterTask;
  const name = task.masterTask?.name || task.taskName || '';
  const desc = task.masterTask?.description;
  const accent = task.isImportant ? 'border-l-amber-400' : isMaster ? 'border-l-blue-400' : 'border-l-emerald-400';
  const progress = task.progress;
  const isDone = progress === 100;

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200/80 border-l-4 ${accent} hover:shadow-md hover:border-slate-300 transition-all`}>
      <div className="p-4">
        <div className="flex items-start gap-3 mb-2">
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">
            {task.orderNumber}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-slate-900 leading-snug flex-1 min-w-0">
                {name}
              </h3>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {task.isImportant && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 whitespace-nowrap">
                    <Star className="w-3 h-3 fill-amber-500 stroke-amber-500" /> Quan trọng
                  </span>
                )}
                {isMaster ? (
                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-md bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 whitespace-nowrap">
                    Dài hạn
                  </span>
                ) : (
                  <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 whitespace-nowrap">
                    Ngắn hạn
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500">
              {showDept && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {task.department.name}
                </span>
              )}
              {task.timePeriod && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {task.timePeriod}
                </span>
              )}
            </div>

            {desc && (
              <p className="text-xs text-slate-500 italic mt-2 line-clamp-2">{desc}</p>
            )}
          </div>
        </div>


        <div className="mt-3">
          <Block icon={Target} label="Kết quả" tone="slate">
            {task.result || <span className="italic text-slate-400">Chưa cập nhật</span>}
          </Block>
        </div>
      </div>
    </div>
  );
}

function Block({ icon: Icon, label, tone, children }: {
  icon: any; label: string; tone: 'slate' | 'cyan'; children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-50 text-slate-500',
    cyan: 'bg-cyan-50/70 text-cyan-600',
  };
  return (
    <div className="rounded-lg p-2.5 bg-slate-50/60">
      <div className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider mb-1 ${tones[tone].split(' ')[1]}`}>
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">{children}</div>
    </div>
  );
}
