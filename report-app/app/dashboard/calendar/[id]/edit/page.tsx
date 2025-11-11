'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    date: '',
    time: '',
    location: '',
    content: '',
    chair: '',
    participants: '',
    note: '',
  });

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const response = await fetch(`/api/events/${id}`);
        if (response.ok) {
          const event = await response.json();

          // Convert date to YYYY-MM-DD format for input
          const dateObj = new Date(event.date);
          const dateStr = dateObj.toISOString().split('T')[0];

          setFormData({
            date: dateStr,
            time: event.time || '',
            location: event.location || '',
            content: event.content || '',
            chair: event.chair || '',
            participants: event.participants || '',
            note: event.note || '',
          });
        } else {
          setError('Không tìm thấy sự kiện');
        }
      } catch (err) {
        console.error('Error loading event:', err);
        setError('Lỗi khi tải dữ liệu sự kiện');
      } finally {
        setLoadingData(false);
      }
    };

    loadEvent();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.date || !formData.content) {
      setError('Vui lòng nhập ngày và nội dung sự kiện');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: formData.date,
          time: formData.time || null,
          location: formData.location || null,
          content: formData.content,
          chair: formData.chair || null,
          participants: formData.participants || null,
          note: formData.note || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update event');
      }

      router.push('/dashboard/calendar');
    } catch (err) {
      console.error('Error updating event:', err);
      setError('Không thể cập nhật sự kiện. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          <p className="text-gray-600 mt-2">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Chỉnh sửa sự kiện</h1>
        <p className="text-sm text-gray-600 mt-1">Cập nhật thông tin sự kiện</p>
      </div>

      <div className="max-w-3xl bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngày <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Giờ
              </label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              />
              <p className="text-xs text-gray-500 mt-1">Chọn giờ từ picker</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Địa điểm
            </label>
            <input
              type="text"
              placeholder="VD: HT 3A, Phòng 401, Bệnh viện Đại học Y"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nội dung <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="Mô tả chi tiết nội dung sự kiện..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Người chủ trì
            </label>
            <textarea
              rows={2}
              placeholder="VD: PGĐ Nguyễn Hoàng Định"
              value={formData.chair}
              onChange={(e) => setFormData({ ...formData, chair: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Đơn vị chuẩn bị/tham dự
            </label>
            <textarea
              rows={2}
              placeholder="VD: Phòng KHTH; Khoa TMCT"
              value={formData.participants}
              onChange={(e) => setFormData({ ...formData, participants: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ghi chú
            </label>
            <textarea
              rows={2}
              placeholder="Ghi chú thêm (nếu có)"
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
            <Link
              href="/dashboard/calendar"
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              Hủy
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
