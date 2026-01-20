'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MeetingRoomSelector } from '@/components/hospital-events/MeetingRoomSelector';
import { EventTypeSelector } from '@/components/hospital-events/EventTypeSelector';

interface ChecklistTemplate {
  id: string;
  title: string;
  description?: string | null;
}

export default function NewHospitalEventPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    date: '',
    time: '',
    description: '',
    meetingRoomId: null as string | null,
    eventType: 'ORGANIZED' as 'ORGANIZED' | 'COLLABORATED',
    chair: '',
    participants: '',
    note: '',
    status: 'UNCONFIRMED' as 'CONFIRMED' | 'UNCONFIRMED',
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/checklist-templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Convert date to ISO string
      const dateObj = new Date(formData.date);
      const isoDate = dateObj.toISOString();

      const res = await fetch('/api/hospital-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          date: isoDate,
          time: formData.time || undefined,
          description: formData.description || undefined,
          chair: formData.chair || undefined,
          participants: formData.participants || undefined,
          note: formData.note || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Có lỗi xảy ra');
      }

      const event = await res.json();
      router.push(`/dashboard/hospital-events/${event.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Tạo sự kiện mới</h1>
        <p className="mt-2 text-gray-600">Điền thông tin sự kiện và checklist sẽ được tạo tự động</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Thông tin cơ bản */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Thông tin cơ bản</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên sự kiện <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="VD: Hội thảo khoa học tháng 12"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ngày diễn ra <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Giờ diễn ra
                </label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mô tả sự kiện
              </label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Mô tả chi tiết về sự kiện..."
              />
            </div>
          </div>
        </div>

        {/* Phòng họp */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Phòng họp</h2>
          <MeetingRoomSelector
            value={formData.meetingRoomId}
            onChange={(roomId) => setFormData({ ...formData, meetingRoomId: roomId })}
          />
        </div>

        {/* Loại sự kiện */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Loại sự kiện</h2>
          <EventTypeSelector
            value={formData.eventType}
            onChange={(type) => setFormData({ ...formData, eventType: type })}
          />
        </div>

        {/* Người tham gia */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Người tham gia</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Người chủ trì
              </label>
              <textarea
                rows={2}
                value={formData.chair}
                onChange={(e) => setFormData({ ...formData, chair: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="VD: GS.TS Nguyễn Văn A"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Người/Đơn vị tham dự
              </label>
              <textarea
                rows={3}
                value={formData.participants}
                onChange={(e) => setFormData({ ...formData, participants: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="VD: Khoa Tim mạch, Khoa Phẫu thuật..."
              />
            </div>
          </div>
        </div>

        {/* Checklist mặc định */}
        {templates.length > 0 && (
          <div className="border-b pb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Checklist mặc định</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700 mb-3">
                Các công việc sau sẽ được tự động thêm vào sự kiện. Bạn có thể chỉnh sửa sau khi tạo:
              </p>
              <ul className="space-y-2">
                {templates.map((template, index) => (
                  <li key={template.id} className="flex items-start text-sm text-gray-700">
                    <span className="font-medium text-blue-600 mr-2">{index + 1}.</span>
                    <span>{template.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Trạng thái & Ghi chú */}
        <div className="pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Trạng thái & Ghi chú</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trạng thái
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="UNCONFIRMED">Chưa xác nhận</option>
                <option value="CONFIRMED">Đã xác nhận</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ghi chú
              </label>
              <textarea
                rows={3}
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ghi chú thêm về sự kiện..."
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Đang tạo...' : 'Tạo sự kiện'}
          </button>
        </div>
      </form>
    </div>
  );
}
