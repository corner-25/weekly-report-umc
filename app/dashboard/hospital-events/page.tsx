'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format, isAfter, isBefore, startOfDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Building2, CalendarDays, CalendarRange, CheckCircle2, ChevronRight, Clock3, Plus, Search, Trash2, UsersRound } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';

interface HospitalEvent {
  id: string; name: string; date: string; time?: string | null; description?: string | null;
  eventType: 'ORGANIZED' | 'COLLABORATED'; status: 'CONFIRMED' | 'UNCONFIRMED';
  isEdited: boolean; chair?: string | null; meetingRoom?: { id: string; name: string } | null;
  checklistItems: { id: string; isCompleted: boolean }[];
}

export default function HospitalEventsPage() {
  const [events, setEvents] = useState<HospitalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [timeRange, setTimeRange] = useState('upcoming');
  const [deleteTarget, setDeleteTarget] = useState<HospitalEvent | null>(null);

  const loadEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/hospital-events');
      if (!response.ok) throw new Error();
      setEvents(await response.json());
    } catch {
      setError('Không thể tải danh sách sự kiện. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEvents(); }, []);

  const today = startOfDay(new Date());
  const filteredEvents = useMemo(() => events.filter((event) => {
    const matchesSearch = !search.trim() || [event.name, event.chair, event.meetingRoom?.name].some((value) => value?.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')));
    const matchesType = !type || event.eventType === type;
    const eventDate = startOfDay(new Date(event.date));
    const matchesTime = timeRange === 'all' || (timeRange === 'upcoming' ? !isBefore(eventDate, today) : isBefore(eventDate, today));
    return matchesSearch && matchesType && matchesTime;
  }).sort((a, b) => timeRange === 'past' ? +new Date(b.date) - +new Date(a.date) : +new Date(a.date) - +new Date(b.date)), [events, search, type, timeRange, today]);

  const upcoming = events.filter((event) => !isBefore(startOfDay(new Date(event.date)), today));
  const completedTasks = upcoming.reduce((sum, event) => sum + event.checklistItems.filter((item) => item.isCompleted).length, 0);
  const totalTasks = upcoming.reduce((sum, event) => sum + event.checklistItems.length, 0);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const response = await fetch(`/api/hospital-events/${deleteTarget.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setDeleteTarget(null);
      await loadEvents();
    } catch {
      setDeleteTarget(null);
      setError('Không thể xóa sự kiện.');
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog open={Boolean(deleteTarget)} title="Xóa sự kiện" message={`Bạn có chắc muốn xóa “${deleteTarget?.name ?? ''}”?`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      <PageHeader icon={CalendarRange} title="Sự kiện bệnh viện" description="Theo dõi lịch, đầu mối và tiến độ tổ chức tại một nơi" actions={<Link href="/dashboard/hospital-events/new" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-cyan-500/20"><Plus className="h-4 w-4" /> Tạo sự kiện</Link>} />
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Summary icon={CalendarDays} label="Sắp diễn ra" value={upcoming.length} detail="Từ hôm nay" />
        <Summary icon={Building2} label="Phòng chủ trì" value={upcoming.filter((event) => event.eventType === 'ORGANIZED').length} detail="Sự kiện sắp tới" />
        <Summary icon={UsersRound} label="Phòng phối hợp" value={upcoming.filter((event) => event.eventType === 'COLLABORATED').length} detail="Sự kiện sắp tới" />
        <Summary icon={CheckCircle2} label="Tiến độ công việc" value={totalTasks ? `${Math.round(completedTasks / totalTasks * 100)}%` : '—'} detail={`${completedTasks}/${totalTasks} việc hoàn thành`} />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-100 p-4 lg:grid-cols-[1fr_220px_220px_auto]">
          <div className="relative"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="input pl-10" placeholder="Tìm sự kiện, phòng họp, đầu mối..." /></div>
          <Select value={type} onChange={(event) => setType(event.target.value)} className="px-3.5 py-2.5"><option value="">Tất cả vai trò</option><option value="ORGANIZED">Phòng chủ trì</option><option value="COLLABORATED">Phòng phối hợp</option></Select>
          <Select value={timeRange} onChange={(event) => setTimeRange(event.target.value)} className="px-3.5 py-2.5"><option value="upcoming">Sắp diễn ra</option><option value="past">Đã diễn ra</option><option value="all">Tất cả thời gian</option></Select>
          <Link href="/dashboard/hospital-events-calendar" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"><CalendarDays className="h-4 w-4" /> Xem lịch</Link>
        </div>

        {loading ? <div className="p-12 text-center text-slate-500">Đang tải sự kiện...</div> : filteredEvents.length === 0 ? <div className="p-12 text-center"><CalendarRange className="mx-auto mb-3 h-12 w-12 text-slate-200" /><p className="font-semibold text-slate-700">Không có sự kiện phù hợp</p><p className="mt-1 text-sm text-slate-500">Thay đổi bộ lọc hoặc tạo sự kiện mới.</p></div> : <div className="divide-y divide-slate-100">
          {filteredEvents.map((event) => {
            const completed = event.checklistItems.filter((item) => item.isCompleted).length;
            const total = event.checklistItems.length;
            const percentage = total ? Math.round(completed / total * 100) : 0;
            return <div key={event.id} className="group grid gap-4 p-5 transition hover:bg-slate-50/70 lg:grid-cols-[minmax(0,1fr)_180px_190px_80px] lg:items-center">
              <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${event.eventType === 'ORGANIZED' ? 'bg-cyan-50 text-cyan-700' : 'bg-violet-50 text-violet-700'}`}>{event.eventType === 'ORGANIZED' ? 'Phòng chủ trì' : 'Phòng phối hợp'}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${event.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{event.status === 'CONFIRMED' ? 'Đã xác nhận lịch' : 'Chưa xác nhận lịch'}</span></div><Link href={`/dashboard/hospital-events/${event.id}`} className="text-base font-bold text-slate-900 hover:text-cyan-700">{event.name}</Link><p className="mt-1 flex flex-wrap gap-x-3 text-sm text-slate-500"><span>{format(new Date(event.date), 'EEEE, dd/MM/yyyy', { locale: vi })}{event.time && ` · ${event.time}`}</span>{event.meetingRoom && <span>{event.meetingRoom.name}</span>}</p></div>
              <div><p className="text-xs font-medium text-slate-400">Nhân viên đầu mối</p><p className="mt-1 truncate text-sm font-semibold text-slate-700">{event.chair || 'Chưa phân công'}</p></div>
              <div><div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-500"><span>Tiến độ</span><span>{total ? `${percentage}%` : 'Chưa có việc'}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${percentage}%` }} /></div>{total > 0 && <p className="mt-1 text-xs text-slate-400">{completed}/{total} việc hoàn thành</p>}</div>
              <div className="flex justify-end gap-1"><button onClick={() => setDeleteTarget(event)} className="rounded-lg p-2 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100" title="Xóa"><Trash2 className="h-4 w-4" /></button><Link href={`/dashboard/hospital-events/${event.id}`} className="rounded-lg p-2 text-cyan-700 hover:bg-cyan-50" title="Xem chi tiết"><ChevronRight className="h-5 w-5" /></Link></div>
            </div>;
          })}
        </div>}
      </section>
    </div>
  );
}

function Summary({ icon: Icon, label, value, detail }: { icon: typeof Clock3; label: string; value: string | number; detail: string }) {
  return <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p><p className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div><div className="rounded-xl bg-cyan-50 p-2.5 text-cyan-700"><Icon className="h-5 w-5" /></div></div></div>;
}
