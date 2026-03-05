'use client';

import { useState } from 'react';

interface Application {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  phone: string | null;
  email: string | null;
  cvUrl: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  interviewDate: string | null;
  interviewScore: number | null;
  interviewNotes: string | null;
  appliedType: { id: string; name: string } | null;
  desiredDepartment: { id: string; name: string } | null;
}

interface Props {
  application: Application | null;
  types: { id: string; name: string; color: string | null }[];
  departments: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

const SOURCE_OPTIONS = [
  'Website bệnh viện',
  'LinkedIn',
  'Giới thiệu nội bộ',
  'Facebook',
  'Sàn tuyển dụng (TopCV, VietnamWorks...)',
  'Khác',
];

export function ApplicationForm({ application, types, departments, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: application?.fullName || '',
    dateOfBirth: application?.dateOfBirth ? application.dateOfBirth.split('T')[0] : '',
    phone: application?.phone || '',
    email: application?.email || '',
    cvUrl: application?.cvUrl || '',
    appliedTypeId: application?.appliedType?.id || '',
    desiredDepartmentId: application?.desiredDepartment?.id || '',
    source: application?.source || '',
    interviewDate: application?.interviewDate ? application.interviewDate.split('T')[0] : '',
    interviewScore: application?.interviewScore?.toString() || '',
    interviewNotes: application?.interviewNotes || '',
    notes: application?.notes || '',
  });

  const isInterview = application?.status === 'INTERVIEW';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = application ? `/api/secretary-applications/${application.id}` : '/api/secretary-applications';
      const method = application ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const err = await res.json();
        alert(err.error || 'Có lỗi xảy ra');
      }
    } catch {
      alert('Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {application ? 'Chỉnh sửa hồ sơ ứng tuyển' : 'Thêm hồ sơ ứng tuyển'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Thông tin cơ bản */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Thông tin cơ bản</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sinh</label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link CV / Hồ sơ</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={formData.cvUrl}
                  onChange={(e) => setFormData({ ...formData, cvUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Thông tin ứng tuyển */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Thông tin ứng tuyển</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại thư ký</label>
                <select
                  value={formData.appliedTypeId}
                  onChange={(e) => setFormData({ ...formData, appliedTypeId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">-- Chọn loại --</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban mong muốn</label>
                <select
                  value={formData.desiredDepartmentId}
                  onChange={(e) => setFormData({ ...formData, desiredDepartmentId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">-- Chọn phòng --</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nguồn tuyển dụng</label>
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">-- Chọn nguồn --</option>
                  {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Vòng phỏng vấn — chỉ hiển thị khi đang ở INTERVIEW */}
          {isInterview && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Thông tin phỏng vấn</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày phỏng vấn</label>
                  <input
                    type="date"
                    value={formData.interviewDate}
                    onChange={(e) => setFormData({ ...formData, interviewDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Điểm đánh giá (0–10)</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    placeholder="VD: 7.5"
                    value={formData.interviewScore}
                    onChange={(e) => setFormData({ ...formData, interviewScore: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú phỏng vấn</label>
                  <textarea
                    value={formData.interviewNotes}
                    onChange={(e) => setFormData({ ...formData, interviewNotes: e.target.value })}
                    rows={3}
                    placeholder="Nhận xét về ứng viên..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Ghi chú chung */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : application ? 'Cập nhật' : 'Tạo hồ sơ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
