'use client';

import { useState } from 'react';

interface Secretary {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  status: string;
  startDate: string | null;
  notes: string | null;
  secretaryType: { id: string; name: string; color: string | null } | null;
  currentDepartment: { id: string; name: string } | null;
  certificates: any[];
}

interface SecretaryType {
  id: string;
  name: string;
  color: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface Props {
  secretary: Secretary | null;
  types: SecretaryType[];
  departments: Department[];
  onClose: () => void;
  onSuccess: () => void;
}

export function SecretaryForm({ secretary, types, departments, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: secretary?.fullName || '',
    dateOfBirth: secretary?.dateOfBirth ? secretary.dateOfBirth.split('T')[0] : '',
    phone: secretary?.phone || '',
    email: secretary?.email || '',
    secretaryTypeId: secretary?.secretaryType?.id || '',
    currentDepartmentId: secretary?.currentDepartment?.id || '',
    status: secretary?.status || 'ACTIVE',
    startDate: secretary?.startDate ? secretary.startDate.split('T')[0] : '',
    notes: secretary?.notes || '',
  });

  const [certificates, setCertificates] = useState<any[]>(
    secretary?.certificates || []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = secretary ? `/api/secretaries/${secretary.id}` : '/api/secretaries';
      const method = secretary ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          certificates: secretary ? undefined : certificates.filter(c => c.name),
        }),
      });

      if (res.ok) {
        // If editing and certificates changed, update them separately
        if (secretary) {
          // Handle certificate updates here if needed
        }
        onSuccess();
      } else {
        const error = await res.json();
        alert(error.error || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error saving secretary:', error);
      alert('Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const addCertificate = () => {
    setCertificates([...certificates, { name: '', issuedYear: '', issuedBy: '' }]);
  };

  const updateCertificate = (index: number, field: string, value: string) => {
    const updated = [...certificates];
    updated[index] = { ...updated[index], [field]: value };
    setCertificates(updated);
  };

  const removeCertificate = (index: number) => {
    setCertificates(certificates.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {secretary ? 'Chỉnh sửa thư ký' : 'Thêm thư ký mới'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase">Thông tin cơ bản</h3>

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase">Phân loại</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại thư ký</label>
                <select
                  value={formData.secretaryTypeId}
                  onChange={(e) => setFormData({ ...formData, secretaryTypeId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">-- Chọn loại --</option>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Khoa/Phòng hiện tại</label>
                <select
                  value={formData.currentDepartmentId}
                  onChange={(e) => setFormData({ ...formData, currentDepartmentId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="">-- Chọn khoa/phòng --</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                >
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="ON_LEAVE">Nghỉ phép</option>
                  <option value="INACTIVE">Nghỉ việc</option>
                </select>
              </div>
            </div>
          </div>

          {/* Certificates - only for new secretary */}
          {!secretary && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 uppercase">Bằng cấp</h3>
                <button
                  type="button"
                  onClick={addCertificate}
                  className="text-sm text-cyan-600 hover:text-cyan-700"
                >
                  + Thêm bằng cấp
                </button>
              </div>

              {certificates.map((cert, index) => (
                <div key={index} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Tên bằng cấp"
                      value={cert.name}
                      onChange={(e) => updateCertificate(index, 'name', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Năm cấp"
                      value={cert.issuedYear}
                      onChange={(e) => updateCertificate(index, 'issuedYear', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Nơi cấp"
                      value={cert.issuedBy}
                      onChange={(e) => updateCertificate(index, 'issuedBy', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCertificate(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : (secretary ? 'Cập nhật' : 'Tạo mới')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
