'use client';

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
} from 'lucide-react';

const DOCUMENT_TYPES = [
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    form.forEach((v, k) => { if (v) data[k] = v.toString(); });

    try {
      const res = await fetch(`/api/mous/${mouId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowForm(false);
        onRefresh();
      }
    } catch (err) {
      console.error('Error creating document:', err);
    } finally {
      setSaving(false);
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
            <div className="col-span-2">
              <input name="title" required placeholder="Tên văn bản *" className={inputClass} />
            </div>
            <select name="documentType" className={inputClass}>
              <option value="">Loại văn bản</option>
              {DOCUMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input name="fileUrl" placeholder="URL file (nếu có)" className={inputClass} />
            <div className="col-span-2">
              <textarea name="description" rows={2} placeholder="Mô tả" className={inputClass} />
            </div>
          </div>
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
                    {doc.fileSize && <span>{formatFileSize(doc.fileSize)}</span>}
                    <span>{formatDate(doc.createdAt)}</span>
                    {doc.uploadedBy && <span>· {doc.uploadedBy}</span>}
                  </div>
                  {doc.description && <p className="text-xs text-slate-500 mt-1 line-clamp-1">{doc.description}</p>}
                </div>
                {doc.fileUrl && (
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                    title="Mở file"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
