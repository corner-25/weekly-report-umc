'use client';

import { useState, useEffect } from 'react';
import { EquipmentBadges } from '@/components/hospital-events/EquipmentBadges';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface MeetingRoom {
  id: string;
  name: string;
  location?: string | null;
  capacity: number;
  description?: string | null;
  hasMicrophone: boolean;
  hasSpeaker: boolean;
  audioSystemType?: string | null;
  hasProjector: boolean;
  hasScreen: boolean;
  hasTV: boolean;
  hasSmartBoard: boolean;
  visualEquipment?: string | null;
  hasWifi: boolean;
  hasAircon: boolean;
  hasWhiteboard: boolean;
  furnitureType?: string | null;
  otherAmenities?: string | null;
}

export default function MeetingRoomsPage() {
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<MeetingRoom | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/meeting-rooms');
      if (!res.ok) throw new Error('Failed to fetch rooms');
      const data = await res.json();
      setRooms(data);
    } catch (err) {
      setError('Không thể tải danh sách phòng họp');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingRoom(null);
    setFormData({
      name: '',
      location: '',
      capacity: 10,
      description: '',
      hasMicrophone: false,
      hasSpeaker: false,
      audioSystemType: '',
      hasProjector: false,
      hasScreen: false,
      hasTV: false,
      hasSmartBoard: false,
      visualEquipment: '',
      hasWifi: false,
      hasAircon: false,
      hasWhiteboard: false,
      furnitureType: '',
      otherAmenities: '',
    });
    setShowModal(true);
  };

  const handleEdit = (room: MeetingRoom) => {
    setEditingRoom(room);
    setFormData(room);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const url = editingRoom
        ? `/api/meeting-rooms/${editingRoom.id}`
        : '/api/meeting-rooms';
      const method = editingRoom ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Có lỗi xảy ra');
      }

      await fetchRooms();
      setShowModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/meeting-rooms/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Không thể xóa phòng họp');
      setDeleteTarget(null);
      await fetchRooms();
    } catch {
      setError('Có lỗi xảy ra khi xóa phòng họp.');
      setDeleteTarget(null);
    }
  };

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (room.location && room.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return <div className="text-center py-12">Đang tải...</div>;
  }

  return (
    <div>
      <ConfirmDialog
        open={!!deleteTarget}
        title="Xóa phòng họp"
        message={`Bạn có chắc muốn xóa phòng "${deleteTarget?.name}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Quản lý Phòng họp</h1>
        <p className="mt-2 text-gray-600">Quản lý thông tin phòng họp và thiết bị</p>
      </div>

      <div className="mb-6 flex gap-4">
        <input
          type="text"
          placeholder="Tìm kiếm phòng họp..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          + Thêm phòng họp
        </button>
      </div>

      {filteredRooms.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500">Chưa có phòng họp nào</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">STT</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên phòng</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vị trí</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sức chứa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thiết bị</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hành động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRooms.map((room, index) => (
                <tr key={room.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{room.name}</div>
                    {room.description && (
                      <div className="text-sm text-gray-500 truncate max-w-xs">{room.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {room.location || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {room.capacity} người
                  </td>
                  <td className="px-6 py-4">
                    <EquipmentBadges room={room} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEdit(room)}
                      className="text-blue-600 hover:text-blue-900 mr-4"
                    >
                      Sửa
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: room.id, name: room.name })}
                      className="text-red-600 hover:text-red-900"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingRoom ? 'Chỉnh sửa phòng họp' : 'Thêm phòng họp mới'}
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Thông tin cơ bản */}
                <div className="border-b pb-4">
                  <h3 className="font-medium text-gray-900 mb-3">Thông tin cơ bản</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tên phòng <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vị trí</label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sức chứa <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={formData.capacity}
                        onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                      <textarea
                        rows={2}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Thiết bị âm thanh */}
                <div className="border-b pb-4">
                  <h3 className="font-medium text-gray-900 mb-3">Thiết bị âm thanh</h3>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.hasMicrophone}
                        onChange={(e) => setFormData({ ...formData, hasMicrophone: e.target.checked })}
                        className="mr-2"
                      />
                      <span>Micro</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.hasSpeaker}
                        onChange={(e) => setFormData({ ...formData, hasSpeaker: e.target.checked })}
                        className="mr-2"
                      />
                      <span>Loa</span>
                    </label>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Loại hệ thống âm thanh</label>
                      <input
                        type="text"
                        value={formData.audioSystemType}
                        onChange={(e) => setFormData({ ...formData, audioSystemType: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Thiết bị hình ảnh */}
                <div className="border-b pb-4">
                  <h3 className="font-medium text-gray-900 mb-3">Thiết bị hình ảnh</h3>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.hasProjector}
                        onChange={(e) => setFormData({ ...formData, hasProjector: e.target.checked })}
                        className="mr-2"
                      />
                      <span>Máy chiếu</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.hasScreen}
                        onChange={(e) => setFormData({ ...formData, hasScreen: e.target.checked })}
                        className="mr-2"
                      />
                      <span>Màn hình</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.hasTV}
                        onChange={(e) => setFormData({ ...formData, hasTV: e.target.checked })}
                        className="mr-2"
                      />
                      <span>TV</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.hasSmartBoard}
                        onChange={(e) => setFormData({ ...formData, hasSmartBoard: e.target.checked })}
                        className="mr-2"
                      />
                      <span>Bảng thông minh</span>
                    </label>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả thiết bị hình ảnh</label>
                      <textarea
                        rows={2}
                        value={formData.visualEquipment}
                        onChange={(e) => setFormData({ ...formData, visualEquipment: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Tiện ích khác */}
                <div className="pb-4">
                  <h3 className="font-medium text-gray-900 mb-3">Tiện ích khác</h3>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.hasWifi}
                        onChange={(e) => setFormData({ ...formData, hasWifi: e.target.checked })}
                        className="mr-2"
                      />
                      <span>Wifi</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.hasAircon}
                        onChange={(e) => setFormData({ ...formData, hasAircon: e.target.checked })}
                        className="mr-2"
                      />
                      <span>Điều hòa</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.hasWhiteboard}
                        onChange={(e) => setFormData({ ...formData, hasWhiteboard: e.target.checked })}
                        className="mr-2"
                      />
                      <span>Bảng viết</span>
                    </label>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Loại bàn ghế</label>
                      <input
                        type="text"
                        value={formData.furnitureType}
                        onChange={(e) => setFormData({ ...formData, furnitureType: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tiện ích khác</label>
                      <textarea
                        rows={2}
                        value={formData.otherAmenities}
                        onChange={(e) => setFormData({ ...formData, otherAmenities: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Đang lưu...' : editingRoom ? 'Cập nhật' : 'Tạo mới'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
