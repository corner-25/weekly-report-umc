'use client';

import { useState } from 'react';

interface Props {
  licenseId: string;
  currentExpiry: string | null;
  onSuccess: () => void;
  onClose: () => void;
}

export default function RenewalForm({ licenseId, currentExpiry, onSuccess, onClose }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    renewedDate: today,
    newExpiryDate: '',
    renewedBy: '',
    decisionNumber: '',
    fileUrl: '',
    notes: '',
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

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
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/licenses/${licenseId}/renewals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          newExpiryDate: form.newExpiryDate || null,
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold text-gray-900">Gia hạn giấy phép</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

          {currentExpiry && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              Hết hạn hiện tại: <strong>{new Date(currentExpiry).toLocaleDateString('vi-VN')}</strong>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ngày gia hạn <span className="text-red-500">*</span></label>
              <input
                type="date" value={form.renewedDate} onChange={(e) => set('renewedDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hết hạn mới</label>
              <input
                type="date" value={form.newExpiryDate} onChange={(e) => set('newExpiryDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Người thực hiện</label>
              <input
                type="text" value={form.renewedBy} onChange={(e) => set('renewedBy', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Số quyết định</label>
              <input
                type="text" value={form.decisionNumber} onChange={(e) => set('decisionNumber', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File gia hạn</label>
            <input
              type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} disabled={uploading}
              className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {uploading && <p className="text-xs text-blue-500 mt-1">Đang upload...</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
            <textarea
              value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Hủy</button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Đang lưu...' : 'Xác nhận gia hạn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
