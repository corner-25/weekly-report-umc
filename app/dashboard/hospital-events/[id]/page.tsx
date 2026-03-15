'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChecklistManager } from '@/components/hospital-events/ChecklistManager';
import { ChecklistProgress } from '@/components/hospital-events/ChecklistProgress';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface MeetingRoom {
  id: string;
  name: string;
  location?: string | null;
  capacity: number;
}

interface ChecklistItem {
  id: string;
  title: string;
  description?: string | null;
  orderNumber: number;
  isCompleted: boolean;
  completedAt?: string | null;
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
  chair?: string | null;
  participants?: string | null;
  note?: string | null;
  meetingRoom?: MeetingRoom | null;
  checklistItems: ChecklistItem[];
}

export default function HospitalEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<HospitalEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/hospital-events/${id}`);
      if (!res.ok) throw new Error('Failed to fetch event');
      const data = await res.json();
      setEvent(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/hospital-events/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete event');
      router.push('/dashboard/hospital-events');
    } catch (error) {
      alert('Có lỗi xảy ra khi xóa sự kiện');
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Đang tải...</div>;
  }

  if (!event) {
    return <div className="text-center py-12">Không tìm thấy sự kiện</div>;
  }

  const completedCount = event.checklistItems.filter(item => item.isCompleted).length;
  const totalCount = event.checklistItems.length;

  const getEventTypeColor = (type: string) => {
    return type === 'ORGANIZED'
      ? 'bg-blue-100 border-blue-300 text-blue-900'
      : 'bg-green-100 border-green-300 text-green-900'
;
  };

  const getStatusColor = (status: string, isEdited: boolean) => {
    if (isEdited) return 'bg-orange-100 border-orange-300 text-orange-900';
    return status === 'CONFIRMED'
      ? 'bg-green-100 border-green-300 text-green-900'
      : 'bg-yellow-100 border-yellow-300 text-yellow-900';
  };

  return (
    <div className="max-w-5xl mx-auto">
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Xác nhận xóa"
        message={`Bạn có chắc muốn xóa sự kiện "${event?.name}"?`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{event.name}</h1>
            <div className="flex gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getEventTypeColor(event.eventType)}`}>
                {event.eventType === 'ORGANIZED' ? '🏢 Tổ chức' : '🤝 Phối hợp'}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(event.status, event.isEdited)}`}>
                {event.isEdited ? '✏️ Đã chỉnh sửa' : event.status === 'CONFIRMED' ? '✓ Đã xác nhận' : '⏳ Chưa xác nhận'}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href={`/dashboard/hospital-events/${id}/edit`}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Sửa
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Xóa
            </button>
          </div>
        </div>

        <Link
          href="/dashboard/hospital-events"
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          ← Quay lại danh sách
        </Link>
      </div>

      {/* Event Details */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Thông tin sự kiện</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="text-sm text-gray-500 mb-1">Ngày giờ</div>
            <div className="font-medium text-gray-900">
              📅 {format(new Date(event.date), 'dd/MM/yyyy (EEEE)', { locale: vi })}
              {event.time && ` - 🕐 ${event.time}`}
            </div>
          </div>

          {event.meetingRoom && (
            <div>
              <div className="text-sm text-gray-500 mb-1">Phòng họp</div>
              <div className="font-medium text-gray-900">
                🏢 {event.meetingRoom.name}
                {event.meetingRoom.location && ` (${event.meetingRoom.location})`}
              </div>
              <div className="text-sm text-gray-600">
                👥 Sức chứa: {event.meetingRoom.capacity} người
              </div>
            </div>
          )}

          {event.description && (
            <div className="md:col-span-2">
              <div className="text-sm text-gray-500 mb-1">Mô tả</div>
              <div className="text-gray-900 whitespace-pre-wrap">{event.description}</div>
            </div>
          )}

          {event.chair && (
            <div>
              <div className="text-sm text-gray-500 mb-1">Người chủ trì</div>
              <div className="text-gray-900 whitespace-pre-wrap">{event.chair}</div>
            </div>
          )}

          {event.participants && (
            <div>
              <div className="text-sm text-gray-500 mb-1">Người/Đơn vị tham dự</div>
              <div className="text-gray-900 whitespace-pre-wrap">{event.participants}</div>
            </div>
          )}

          {event.note && (
            <div className="md:col-span-2">
              <div className="text-sm text-gray-500 mb-1">Ghi chú</div>
              <div className="text-gray-900 whitespace-pre-wrap">{event.note}</div>
            </div>
          )}
        </div>
      </div>

      {/* Checklist Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Danh sách công việc</h2>
          <div className="text-sm font-medium text-gray-600">
            {completedCount}/{totalCount} hoàn thành
          </div>
        </div>

        <div className="mb-6">
          <ChecklistProgress completed={completedCount} total={totalCount} showPercentage />
        </div>

        <ChecklistManager
          eventId={id}
          items={event.checklistItems}
          onUpdate={fetchEvent}
        />
      </div>
    </div>
  );
}
