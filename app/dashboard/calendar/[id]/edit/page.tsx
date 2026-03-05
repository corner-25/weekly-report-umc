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
    status: 'UNCONFIRMED',
  });

  const [chairMode, setChairMode] = useState<'select' | 'custom'>('select');
  const chairOptions = [
    'GĐ Nguyễn Hoàng Bắc',
    'PGĐ Nguyễn Hoàng Định',
    'PGĐ Lê Khắc Bảo',
    'PGĐ Nguyễn Minh Anh',
  ];

  useEffect(() => {
    const loadEvent = async () => {
      try {
        const response = await fetch(`/api/events/${id}`);
        if (response.ok) {
          const event = await response.json();

          // Convert date to YYYY-MM-DD format for input
          const dateObj = new Date(event.date);
          const dateStr = dateObj.toISOString().split('T')[0];

          const chairValue = event.chair || '';
          const isPresetChair = chairOptions.includes(chairValue);

          setFormData({
            date: dateStr,
            time: event.time || '',
            location: event.location || '',
            content: event.content || '',
            chair: chairValue,
            participants: event.participants || '',
            note: event.note || '',
            status: event.status || 'UNCONFIRMED',
          });

          // Set chair mode based on whether the value is in the preset options
          setChairMode(isPresetChair ? 'select' : 'custom');
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
          status: formData.status,
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Người chủ trì
            </label>

            {/* Toggle between select and custom input */}
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setChairMode('select');
                  setFormData({ ...formData, chair: '' });
                }}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  chairMode === 'select'
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Chọn từ danh sách
              </button>
              <button
                type="button"
                onClick={() => {
                  setChairMode('custom');
                  setFormData({ ...formData, chair: '' });
                }}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  chairMode === 'custom'
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Tự nhập
              </button>
            </div>

            {chairMode === 'select' ? (
              <select
                value={formData.chair}
                onChange={(e) => setFormData({ ...formData, chair: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              >
                <option value="">-- Chọn người chủ trì --</option>
                {chairOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <textarea
                rows={2}
                placeholder="Nhập tên người chủ trì (có thể nhiều người)"
                value={formData.chair}
                onChange={(e) => setFormData({ ...formData, chair: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              />
            )}
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

          <div className="mb-4">
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

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trạng thái <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            >
              <option value="UNCONFIRMED">Chưa xác nhận</option>
              <option value="CONFIRMED">Đã xác nhận</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Sự kiện "Đã xác nhận" sẽ được hiển thị nổi bật hơn trên lịch
            </p>
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
