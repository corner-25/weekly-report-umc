'use client';

import { useState, useEffect } from 'react';

interface Transfer {
  id: string;
  transferDate: string;
  decisionNumber: string | null;
  reason: string | null;
  notes: string | null;
  secretary: { id: string; fullName: string; avatar: string | null };
  fromDepartment: { id: string; name: string } | null;
  toDepartment: { id: string; name: string };
}

interface Secretary {
  id: string;
  fullName: string;
  currentDepartment: { id: string; name: string } | null;
}

interface Department {
  id: string;
  name: string;
}

export default function SecretaryTransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [secretaries, setSecretaries] = useState<Secretary[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    secretaryId: '',
    toDepartmentId: '',
    transferDate: new Date().toISOString().split('T')[0],
    decisionNumber: '',
    reason: '',
    notes: '',
  });

  const fetchTransfers = async () => {
    try {
      const res = await fetch('/api/secretary-transfers');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setTransfers(data);
      } else {
        setTransfers([]);
      }
    } catch (error) {
      console.error('Error fetching transfers:', error);
      setTransfers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSecretaries = async () => {
    try {
      const res = await fetch('/api/secretaries?status=ACTIVE');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setSecretaries(data);
      } else {
        setSecretaries([]);
      }
    } catch (error) {
      console.error('Error fetching secretaries:', error);
      setSecretaries([]);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setDepartments(data);
      } else {
        setDepartments([]);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      setDepartments([]);
    }
  };

  useEffect(() => {
    fetchTransfers();
    fetchSecretaries();
    fetchDepartments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/secretary-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowForm(false);
        setFormData({
          secretaryId: '',
          toDepartmentId: '',
          transferDate: new Date().toISOString().split('T')[0],
          decisionNumber: '',
          reason: '',
          notes: '',
        });
        fetchTransfers();
        fetchSecretaries();
      } else {
        const error = await res.json();
        alert(error.error || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error creating transfer:', error);
      alert('Có lỗi xảy ra');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  const selectedSecretary = secretaries.find(s => s.id === formData.secretaryId);

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Luân chuyển thư ký</h1>
            <p className="text-gray-500 mt-1">Quản lý lịch sử luân chuyển thư ký giữa các khoa/phòng</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Tạo luân chuyển
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">Đang tải...</div>
      ) : transfers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <p className="text-gray-500">Chưa có lịch sử luân chuyển</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ngày</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Thư ký</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Từ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Đến</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Số QĐ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Lý do</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transfers.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(transfer.transferDate)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 font-semibold text-sm">
                          {transfer.secretary.avatar ? (
                            <img src={transfer.secretary.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            transfer.secretary.fullName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="font-medium text-gray-900">{transfer.secretary.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {transfer.fromDepartment?.name || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-cyan-600 font-medium">{transfer.toDepartment.name}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {transfer.decisionNumber || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {transfer.reason || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Tạo luân chuyển mới</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Thư ký <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.secretaryId}
                  onChange={(e) => setFormData({ ...formData, secretaryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  required
                >
                  <option value="">-- Chọn thư ký --</option>
                  {secretaries.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} {s.currentDepartment ? `(${s.currentDepartment.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSecretary?.currentDepartment && (
                <div className="p-3 bg-gray-50 rounded-lg text-sm">
                  <span className="text-gray-500">Khoa/Phòng hiện tại: </span>
                  <span className="font-medium">{selectedSecretary.currentDepartment.name}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chuyển đến <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.toDepartmentId}
                  onChange={(e) => setFormData({ ...formData, toDepartmentId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  required
                >
                  <option value="">-- Chọn khoa/phòng --</option>
                  {departments
                    .filter(d => d.id !== selectedSecretary?.currentDepartment?.id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày luân chuyển</label>
                  <input
                    type="date"
                    value={formData.transferDate}
                    onChange={(e) => setFormData({ ...formData, transferDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số quyết định</label>
                  <input
                    type="text"
                    value={formData.decisionNumber}
                    onChange={(e) => setFormData({ ...formData, decisionNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="VD: QĐ-123/2024"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lý do luân chuyển</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
                >
                  Xác nhận luân chuyển
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
