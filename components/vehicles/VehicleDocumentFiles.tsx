'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface VehicleDocumentFile {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedBy: string | null;
  createdAt: string;
}

function fmtSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/** File hồ sơ gốc của một xe: xem, tải thêm, xoá. */
export function VehicleDocumentFiles({ vehicleId }: { vehicleId: string }) {
  const [files, setFiles] = useState<VehicleDocumentFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VehicleDocumentFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/documents`);
      if (!res.ok) throw new Error();
      setFiles(await res.json());
    } catch {
      setMessage({ tone: 'error', text: 'Không tải được danh sách file hồ sơ.' });
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      Array.from(list).forEach((file) => form.append('files', file));
      const res = await fetch(`/api/vehicles/${vehicleId}/documents`, { method: 'POST', body: form });
      const data = (await res.json()) as { created?: number; skipped?: Array<{ fileName: string; reason: string }>; error?: string };
      if (data.error) throw new Error(data.error);
      const skipped = data.skipped ?? [];
      setMessage({
        tone: skipped.length > 0 && !data.created ? 'error' : 'ok',
        text: [
          data.created ? `Đã thêm ${data.created} file.` : '',
          ...skipped.map((s) => `${s.fileName}: ${s.reason}`),
        ].filter(Boolean).join(' '),
      });
      await load();
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'Không tải lên được.' });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    const res = await fetch(`/api/vehicle-documents/${target.id}`, { method: 'DELETE' });
    if (!res.ok) setMessage({ tone: 'error', text: 'Không xoá được file.' });
    await load();
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4" aria-labelledby="vehicle-files-heading">
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xoá file hồ sơ"
        message={`Xoá “${deleteTarget?.fileName ?? ''}” khỏi hồ sơ xe? Không khôi phục được.`}
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="vehicle-files-heading" className="text-sm font-semibold text-slate-900">File hồ sơ gốc</h3>
          <p className="text-xs text-slate-500 mt-0.5">Ảnh chụp đăng ký, đăng kiểm, bảo hiểm, PDF… Bấm vào file để xem.</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-cyan-200 px-3 py-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 focus-within:ring-2 focus-within:ring-cyan-500">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
          {uploading ? 'Đang tải lên…' : 'Thêm file'}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            disabled={uploading}
            onChange={(event) => upload(event.target.files)}
          />
        </label>
      </div>

      {message && (
        <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-xs ${message.tone === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </p>
      )}

      {loading ? (
        <div className="py-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan-500" aria-label="Đang tải" /></div>
      ) : files.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">Chưa có file hồ sơ nào.</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {files.map((file) => {
            const url = `/api/vehicle-documents/${file.id}`;
            const isImage = file.mimeType.startsWith('image/');
            return (
              <li key={file.id} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <a href={url} target="_blank" rel="noopener noreferrer" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
                  {isImage ? (
                    // Ảnh hồ sơ phục vụ qua API có kiểm đăng nhập, không qua next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={file.title} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 text-red-600">
                      <FileText className="h-10 w-10" aria-hidden="true" />
                      <span className="text-xs font-semibold">PDF</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 bg-white px-2 py-1.5">
                    <p className="truncate text-xs font-medium text-slate-800" title={file.fileName}>{file.title}</p>
                    <p className="text-[11px] text-slate-500">{fmtSize(file.size)}</p>
                  </div>
                </a>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(file)}
                  aria-label={`Xoá ${file.fileName}`}
                  className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1.5 text-red-600 opacity-0 shadow-sm transition-opacity hover:bg-red-50 focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
