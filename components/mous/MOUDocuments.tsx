'use client';

import { Select } from '@/components/ui/Select';
import { useState } from 'react';
import { formatDate } from './MOUUtils';
import {
  FileText,
  Plus,
  X,
  Download,
  ExternalLink,
  File,
  FileImage,
  FileSpreadsheet,
  Trash2,
  Upload,
} from 'lucide-react';

const DOCUMENT_TYPES = [
  'Biên bản ghi nhớ',
  'Tờ trình',
  'Kế hoạch',
  'Hợp đồng',
  'Phụ lục',
  'Biên bản',
  'Công văn',
  'Báo cáo',
  'Quyết định',
  'Tài liệu tham khảo',
  'Khác',
];

interface MOUDocument {
  id: string;
  title: string;
  description: string | null;
  documentType: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  originalSize?: number | null;
  mimeType?: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

interface Props {
  mouId: string;
  documents: MOUDocument[];
  onRefresh: () => void;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileName: string | null) {
  if (!fileName) return File;
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return FileImage;
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return FileSpreadsheet;
  return FileText;
}

export function MOUDocuments({ mouId, documents, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const file = form.get('file');
    const hasFile = file instanceof window.File && file.size > 0;
    if (!hasFile && !String(form.get('title') ?? '').trim()) {
      setError('Chọn file hoặc nhập tên văn bản');
      setSaving(false);
      return;
    }
    try {
      // Có file → gửi multipart để lưu file vào hệ thống; không có → chỉ ghi liên kết.
      const res = hasFile
        ? await fetch(`/api/mous/${mouId}/documents`, { method: 'POST', body: form })
        : await fetch(`/api/mous/${mouId}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries([...form.entries()].filter(([k, v]) => k !== 'file' && v))),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Không lưu được văn bản');
        return;
      }
      setShowForm(false);
      onRefresh();
    } catch {
      setError('Mất kết nối — thử lại');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (doc: MOUDocument) => {
    if (!window.confirm(`Xoá văn bản "${doc.title}"?`)) return;
    setBusyId(doc.id);
    try {
      const res = await fetch(`/api/mous/${mouId}/documents/${doc.id}`, { method: 'DELETE' });
      if (res.ok) onRefresh();
      else setError('Không xoá được văn bản');
    } finally {
      setBusyId(null);
    }
  };

  const inputClass = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-600" />
          Văn bản đính kèm ({documents.length})
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-700 bg-cyan-50 rounded-lg hover:bg-cyan-100 transition-colors"
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? 'Đóng' : 'Thêm văn bản'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600 hover:border-cyan-400">
              <Upload className="h-4 w-4 shrink-0 text-cyan-600" />
              <input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx" className="min-w-0 flex-1 text-xs file:mr-2 file:rounded file:border-0 file:bg-cyan-50 file:px-2 file:py-1 file:text-cyan-700" />
            </label>
            <p className="col-span-2 -mt-1 text-[11px] text-slate-400">PDF, ảnh, Word, Excel — tối đa 20 MB. PDF scan nên nén trước cho nhẹ.</p>
            <div className="col-span-2">
              <input name="title" placeholder="Tên văn bản (bỏ trống thì lấy tên file)" className={inputClass} />
            </div>
            <Select name="documentType" className={inputClass}>
              <option value="">Loại văn bản</option>
              {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <input name="fileUrl" placeholder="Hoặc dán liên kết file" className={inputClass} />
            <div className="col-span-2">
              <textarea name="description" rows={2} placeholder="Mô tả" className={inputClass} />
            </div>
          </div>
          {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Hủy
            </button>
            <button type="submit" disabled={saving} className="px-4 py-1.5 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 disabled:opacity-50">
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      )}

      {!showForm && error && <p className="text-xs text-rose-600" role="alert">{error}</p>}

      {/* Document List */}
      {documents.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          Chưa có văn bản đính kèm
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => {
            const IconComponent = getFileIcon(doc.fileName);
            return (
              <div key={doc.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <IconComponent className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{doc.title}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {doc.documentType && <span className="px-1.5 py-0.5 bg-slate-100 rounded">{doc.documentType}</span>}
                    {doc.fileSize && (
                      <span title={doc.originalSize && doc.originalSize > doc.fileSize ? `Đã nén từ ${formatFileSize(doc.originalSize)}` : undefined}>
                        {formatFileSize(doc.fileSize)}
                      </span>
                    )}
                    <span>{formatDate(doc.createdAt)}</span>
                    {doc.uploadedBy && <span>· {doc.uploadedBy}</span>}
                  </div>
                  {doc.description && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{doc.description}</p>}
                </div>
                <div className="flex shrink-0 items-center">
                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                      title="Xem file"
                      aria-label={`Xem ${doc.title}`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {doc.fileUrl?.startsWith('/api/') && (
                    <a
                      href={`${doc.fileUrl}?download=1`}
                      className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                      title="Tải về"
                      aria-label={`Tải về ${doc.title}`}
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(doc)}
                    disabled={busyId === doc.id}
                    className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-40"
                    title="Xoá văn bản"
                    aria-label={`Xoá ${doc.title}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
