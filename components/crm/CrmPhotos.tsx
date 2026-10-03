'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MAX_PHOTOS_PER_ITEM } from '@/lib/crm/constants';
import { resizePhoto } from './photo-resize';
import type { PhotoDTO } from './types';

interface PhotoFieldProps {
  label: string;
  hint?: string;
  existing: PhotoDTO[];
  pending: File[];
  onPendingChange: (files: File[]) => void;
  /** Ảnh đã lưu bị đánh dấu xoá khi bấm Lưu. */
  removedIds: string[];
  onRemovedChange: (ids: string[]) => void;
}

/**
 * Chọn ảnh trong form: chụp bằng camera điện thoại hoặc chọn từ thư viện. Ảnh
 * chỉ tải lên khi bấm Lưu (form cần id của lượt/việc trước).
 */
export function PhotoField({ label, hint, existing, pending, onPendingChange, removedIds, onRemovedChange }: PhotoFieldProps) {
  const [busy, setBusy] = useState(false);
  const kept = existing.filter((p) => !removedIds.includes(p.id));
  const room = MAX_PHOTOS_PER_ITEM - kept.length - pending.length;
  const previews = useMemo(() => pending.map((f) => URL.createObjectURL(f)), [pending]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const add = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []).slice(0, Math.max(room, 0));
    event.target.value = '';
    if (picked.length === 0) return;
    setBusy(true);
    try {
      onPendingChange([...pending, ...(await Promise.all(picked.map(resizePhoto)))]);
    } finally {
      setBusy(false);
    }
  };

  const tile = 'relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50';
  const removeBtn = 'absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-slate-600 shadow hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500';

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-slate-700">{label}</legend>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {kept.map((p) => (
          <div key={p.id} className={tile}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption ?? 'Ảnh đã lưu'} className="h-full w-full object-cover" loading="lazy" />
            <button type="button" onClick={() => onRemovedChange([...removedIds, p.id])} aria-label="Xoá ảnh" className={removeBtn}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {previews.map((url, i) => (
          <div key={url} className={cn(tile, 'ring-2 ring-cyan-200')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Ảnh mới ${i + 1}`} className="h-full w-full object-cover" />
            <button type="button" onClick={() => onPendingChange(pending.filter((_, j) => j !== i))} aria-label="Bỏ ảnh mới" className={removeBtn}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {room > 0 && (
          <>
            <label className={cn(tile, 'flex cursor-pointer flex-col items-center justify-center gap-1 border-dashed text-xs font-medium text-slate-500 hover:border-cyan-400 hover:text-cyan-700', busy && 'opacity-60')}>
              <Camera className="h-5 w-5" aria-hidden="true" />
              Chụp ảnh
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={add} disabled={busy} />
            </label>
            <label className={cn(tile, 'flex cursor-pointer flex-col items-center justify-center gap-1 border-dashed text-xs font-medium text-slate-500 hover:border-cyan-400 hover:text-cyan-700', busy && 'opacity-60')}>
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
              Chọn ảnh
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={add} disabled={busy} />
            </label>
          </>
        )}
      </div>
      {busy && <p className="text-xs text-slate-500">Đang thu nhỏ ảnh...</p>}
    </fieldset>
  );
}

/** Dãy ảnh nhỏ trong dòng thời gian, hồ sơ; bấm để xem lớn. */
export function PhotoStrip({ photos, className }: { photos: PhotoDTO[]; className?: string }) {
  const [open, setOpen] = useState<PhotoDTO | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  if (photos.length === 0) return null;

  return (
    <>
      <div className={cn('flex flex-wrap gap-1.5', className)}>
        {photos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(p)}
            className="h-14 w-14 overflow-hidden rounded-lg border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            aria-label={p.caption ? `Xem ảnh: ${p.caption}` : 'Xem ảnh'}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-full w-full object-cover transition hover:scale-105" loading="lazy" />
          </button>
        ))}
      </div>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Xem ảnh" className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setOpen(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open.url} alt={open.caption ?? ''} className="max-h-full max-w-full rounded-xl object-contain shadow-2xl" />
          <button type="button" onClick={() => setOpen(null)} aria-label="Đóng" className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-slate-700 hover:bg-white">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </>
  );
}
