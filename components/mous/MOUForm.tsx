'use client';

import { useState } from 'react';
import { CATEGORY_LABELS, STATUS_LABELS } from './MOUUtils';

interface Department {
  id: string;
  name: string;
}

interface MOUFormData {
  id?: string;
  title: string;
  mouNumber: string;
  category: string;
  status: string;
  partnerName: string;
  partnerCountry: string;
  partnerContact: string;
  signedDate: string;
  effectiveDate: string;
  expiryDate: string;
  autoRenew: boolean;
  purpose: string;
  scope: string;
  keyTerms: string;
  fileUrl: string;
  notes: string;
  departmentId: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
}

interface Props {
  initialData?: Partial<MOUFormData> & { id?: string };
  departments: Department[];
  onSuccess: () => void;
  onClose: () => void;
}

function toDateInput(val: string | null | undefined): string {
  if (!val) return '';
  return new Date(val).toISOString().split('T')[0];
}

export function MOUForm({ initialData, departments, onSuccess, onClose }: Props) {
  const isEdit = !!initialData?.id;
  const [form, setForm] = useState<MOUFormData>({
    title: initialData?.title || '',
    mouNumber: initialData?.mouNumber || '',
    category: initialData?.category || 'DOMESTIC',
    status: initialData?.status || 'DRAFT',
    partnerName: initialData?.partnerName || '',
    partnerCountry: initialData?.partnerCountry || '',
    partnerContact: initialData?.partnerContact || '',
    signedDate: toDateInput(initialData?.signedDate),
    effectiveDate: toDateInput(initialData?.effectiveDate),
    expiryDate: toDateInput(initialData?.expiryDate),
    autoRenew: initialData?.autoRenew || false,
    purpose: initialData?.purpose || '',
    scope: initialData?.scope || '',
    keyTerms: initialData?.keyTerms || '',
    fileUrl: initialData?.fileUrl || '',
    notes: initialData?.notes || '',
    departmentId: initialData?.departmentId || '',
    contactPerson: initialData?.contactPerson || '',
    contactEmail: initialData?.contactEmail || '',
    contactPhone: initialData?.contactPhone || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const url = isEdit ? `/api/mous/${initialData!.id}` : '/api/mous';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        ...form,
        signedDate: form.signedDate || null,
        effectiveDate: form.effectiveDate || null,
        expiryDate: form.expiryDate || null,
        departmentId: form.departmentId || null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Có lỗi xảy ra');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        setForm(prev => ({ ...prev, fileUrl: data.url }));
      }
    } catch {
      setError('Lỗi upload file');
    }
  };

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? 'Chỉnh sửa MOU' : 'Thêm MOU mới'}
            </h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

          {/* Thông tin cơ bản */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Thông tin cơ bản</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Tên MOU *</label>
                <input type="text" required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Số hiệu</label>
                <input type="text" value={form.mouNumber} onChange={e => setForm(p => ({ ...p, mouNumber: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Loại *</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={inputClass}>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Trạng thái</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className={inputClass}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phòng đầu mối</label>
                <select value={form.departmentId} onChange={e => setForm(p => ({ ...p, departmentId: e.target.value }))} className={inputClass}>
                  <option value="">-- Chọn phòng --</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Đối tác */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Thông tin đối tác</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tên đối tác *</label>
                <input type="text" required value={form.partnerName} onChange={e => setForm(p => ({ ...p, partnerName: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Quốc gia</label>
                <input type="text" value={form.partnerCountry} onChange={e => setForm(p => ({ ...p, partnerCountry: e.target.value }))} className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Liên hệ đối tác</label>
                <textarea rows={2} value={form.partnerContact} onChange={e => setForm(p => ({ ...p, partnerContact: e.target.value }))} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Thời hạn */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Thời hạn</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ngày ký kết</label>
                <input type="date" value={form.signedDate} onChange={e => setForm(p => ({ ...p, signedDate: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ngày hiệu lực</label>
                <input type="date" value={form.effectiveDate} onChange={e => setForm(p => ({ ...p, effectiveDate: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ngày hết hạn</label>
                <input type="date" value={form.expiryDate} onChange={e => setForm(p => ({ ...p, expiryDate: e.target.value }))} className={inputClass} />
              </div>
            </div>
            <label className="flex items-center mt-3 text-sm text-gray-600">
              <input type="checkbox" checked={form.autoRenew} onChange={e => setForm(p => ({ ...p, autoRenew: e.target.checked }))} className="rounded border-gray-300 text-cyan-600 mr-2" />
              Tự động gia hạn
            </label>
          </div>

          {/* Nội dung */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Nội dung hợp tác</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Mục đích</label>
                <textarea rows={2} value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phạm vi</label>
                <textarea rows={2} value={form.scope} onChange={e => setForm(p => ({ ...p, scope: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Điều khoản chính (tóm tắt)</label>
                <textarea rows={3} value={form.keyTerms} onChange={e => setForm(p => ({ ...p, keyTerms: e.target.value }))} className={inputClass} />
              </div>
            </div>
          </div>

          {/* Người phụ trách */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Người phụ trách (phía BV)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Họ tên</label>
                <input type="text" value={form.contactPerson} onChange={e => setForm(p => ({ ...p, contactPerson: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Điện thoại</label>
                <input type="tel" value={form.contactPhone} onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))} className={inputClass} />
              </div>
            </div>
          </div>

          {/* File & ghi chú */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">File đính kèm</label>
              <input type="file" onChange={handleFileUpload} className="text-sm text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100" />
              {form.fileUrl && <p className="text-xs text-green-600 mt-1">File: {form.fileUrl}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ghi chú</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={inputClass} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Hủy
            </button>
            <button type="submit" disabled={loading} className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50">
              {loading ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo MOU'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
