'use client';

import { useState, useEffect } from 'react';
import { CATEGORY_LABELS } from './LicenseUtils';

interface Department { id: string; name: string; }
interface LicenseFormData {
  name: string;
  licenseNumber: string;
  category: string;
  issuedBy: string;
  issuedDate: string;
  expiryDate: string;
  scope: string;
  fileUrl: string;
  notes: string;
  departmentId: string;
}

interface Props {
  initialData?: Partial<LicenseFormData> & { id?: string };
  departments: Department[];
  onSuccess: () => void;
  onClose: () => void;
}

const EMPTY: LicenseFormData = {
  name: '', licenseNumber: '', category: 'HOSPITAL', issuedBy: '',
  issuedDate: '', expiryDate: '', scope: '', fileUrl: '', notes: '', departmentId: '',
};

export default function LicenseForm({ initialData, departments, onSuccess, onClose }: Props) {
  const [form, setForm] = useState<LicenseFormData>({ ...EMPTY, ...initialData });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEditing = !!initialData?.id;

  useEffect(() => {
    setForm({ ...EMPTY, ...initialData });
  }, [initialData]);

  const set = (field: keyof LicenseFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) set('fileUrl', data.url);
      else setError(data.error || 'Upload thất bại');
    } catch {
      setError('Upload thất bại');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Tên giấy phép là bắt buộc'); return; }
    setSaving(true);
    setError('');
    try {
      const url = isEditing ? `/api/licenses/${initialData!.id}` : '/api/licenses';
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          issuedDate: form.issuedDate || null,
          expiryDate: form.expiryDate || null,
          departmentId: form.departmentId || null,
        }),
      });
      if (res.ok) { onSuccess(); onClose(); }
      else { const d = await res.json(); setError(d.error || 'Lỗi lưu dữ liệu'); }
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            {isEditing ? 'Chỉnh sửa giấy phép' : 'Thêm giấy phép mới'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

          {/* Tên */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên giấy phép <span className="text-red-500">*</span></label>
            <input
              type="text" value={form.name} onChange={(e) => set('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="VD: Giấy phép hoạt động bệnh viện"
            />
          </div>

          {/* Số GP + Loại */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Số giấy phép</label>
              <input
                type="text" value={form.licenseNumber} onChange={(e) => set('licenseNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="VD: 123/GP-BYT"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loại giấy phép <span className="text-red-500">*</span></label>
              <select
                value={form.category} onChange={(e) => set('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Cơ quan cấp + Ngày cấp */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cơ quan cấp</label>
              <input
                type="text" value={form.issuedBy} onChange={(e) => set('issuedBy', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="VD: Bộ Y tế"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày cấp</label>
              <input
                type="date" value={form.issuedDate} onChange={(e) => set('issuedDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Hết hạn + Phòng ban */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày hết hạn <span className="text-gray-400 font-normal">(để trống nếu không hết hạn)</span></label>
              <input
                type="date" value={form.expiryDate} onChange={(e) => set('expiryDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Khoa/Phòng</label>
              <select
                value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Cấp bệnh viện —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {/* Phạm vi */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phạm vi áp dụng</label>
            <input
              type="text" value={form.scope} onChange={(e) => set('scope', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="VD: Xe cứu thương 51B-12345, Máy MRI hiệu GE..."
            />
          </div>

          {/* File */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File đính kèm</label>
            <input
              type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileUpload}
              disabled={uploading}
              className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {uploading && <p className="text-xs text-blue-500 mt-1">Đang upload...</p>}
            {form.fileUrl && !uploading && (
              <a href={form.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 block">
                Xem file hiện tại
              </a>
            )}
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <textarea
              value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Hủy</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Đang lưu...' : isEditing ? 'Cập nhật' : 'Thêm mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
