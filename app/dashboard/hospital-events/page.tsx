'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { CalendarRange } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ChecklistProgress } from '@/components/hospital-events/ChecklistProgress';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface MeetingRoom {
  id: string;
  name: string;
  location?: string | null;
}

interface ChecklistItem {
  id: string;
  isCompleted: boolean;
}

interface HospitalEvent {
  id: string;
  name: string;
  date: string;
  time?: string | null;
  description?: string | null;
  eventType: 'ORGANIZED' | 'COLLABORATED';
  status: 'CONFIRMED' | 'UNCONFIRMED';
  isEdited: boolean;
  meetingRoom?: MeetingRoom | null;
  checklistItems: ChecklistItem[];
}

export default function HospitalEventsPage() {
  const [events, setEvents] = useState<HospitalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setError('');
      const res = await fetch('/api/hospital-events');
      if (!res.ok) throw new Error('Failed to fetch events');
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      setError('Không thể tải danh sách sự kiện. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/hospital-events/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setDeleteTarget(null);
      await fetchEvents();
    } catch {
      setError('Có lỗi xảy ra khi xóa sự kiện.');
      setDeleteTarget(null);
    }
  };

  const filteredEvents = events.filter(event => {
    const matchSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = !filterType || event.eventType === filterType;
    const matchStatus = !filterStatus || event.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const getEventTypeColor = (type: string) => {
    return type === 'ORGANIZED'
      ? 'bg-blue-100 border-blue-300 text-blue-900'
      : 'bg-emerald-100 border-green-300 text-green-900';
  };

  const getStatusColor = (status: string, isEdited: boolean) => {
    if (isEdited) return 'bg-orange-100 border-orange-300 text-orange-900';
    return status === 'CONFIRMED'
      ? 'bg-emerald-100 border-green-300 text-green-900'
      : 'bg-amber-100 border-yellow-300 text-yellow-900';
  };

  if (loading) return <div className="text-center py-12">Đang tải...</div>;

  return (
    <div>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Xóa sự kiện"
        message={`Bạn có chắc muốn xóa sự kiện "${deleteTarget?.name}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <PageHeader
        icon={CalendarRange}
        title="Sự kiện Bệnh viện"
        description="Quản lý sự kiện và theo dõi tiến độ checklist"
        className="mb-6"
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex justify-between items-center">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <input
          type="text"
          placeholder="Tìm kiếm sự kiện..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
        />

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
        >
          <option value="">Tất cả loại sự kiện</option>
          <option value="ORGANIZED">Tổ chức</option>
          <option value="COLLABORATED">Phối hợp</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="CONFIRMED">Đã xác nhận</option>
          <option value="UNCONFIRMED">Chưa xác nhận</option>
        </select>

        <Link
          href="/dashboard/hospital-events/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all shadow-sm shadow-cyan-500/20 text-center"
        >
          + Tạo sự kiện mới
        </Link>
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-12 text-center">
          <p className="text-slate-500">
            {searchTerm || filterType || filterStatus
              ? 'Không tìm thấy sự kiện nào'
              : 'Chưa có sự kiện nào. Hãy tạo sự kiện đầu tiên!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map(event => {
            const completedCount = event.checklistItems.filter(item => item.isCompleted).length;
            const totalCount = event.checklistItems.length;

            return (
              <div
                key={event.id}
                className="bg-white rounded-xl shadow-sm border border-slate-200/80 hover:shadow-lg transition-shadow overflow-hidden"
              >
                {/* Header */}
                <div className="p-4 border-b">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-lg text-slate-900 flex-1">
                      {event.name}
                    </h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getEventTypeColor(event.eventType)}`}>
                      {event.eventType === 'ORGANIZED' ? 'Tổ chức' : 'Phối hợp'}
                    </span>
                  </div>

                  <div className="flex items-center text-sm text-slate-600 mb-1">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {format(new Date(event.date), 'dd/MM/yyyy', { locale: vi })}
                    {event.time && ` - ${event.time}`}
                  </div>

                  {event.meetingRoom && (
                    <div className="flex items-center text-sm text-slate-600">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      {event.meetingRoom.name}
                    </div>
                  )}
                </div>

                {/* Checklist Progress */}
                <div className="p-4 bg-slate-50">
                  <ChecklistProgress completed={completedCount} total={totalCount} showPercentage />
                </div>

                {/* Footer */}
                <div className="p-4 flex items-center justify-between">
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(event.status, event.isEdited)}`}>
                    {event.isEdited ? 'Đã chỉnh sửa' : event.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Chưa xác nhận'}
                  </span>

                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/hospital-events/${event.id}`}
                      className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Xem
                    </Link>
                    <Link
                      href={`/dashboard/hospital-events/${event.id}/edit`}
                      className="px-3 py-1 text-sm text-slate-600 hover:text-slate-800 font-medium"
                    >
                      Sửa
                    </Link>
                    <button
                      onClick={() => setDeleteTarget({ id: event.id, name: event.name })}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-800 font-medium"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
