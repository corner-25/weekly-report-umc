'use client';

import { useState, type FormEvent } from 'react';
import { crmSend, errorMessage } from '@/components/crm/api';
import { formatDateTime, toInt } from '@/components/crm/format';
import { ErrorBanner, PRIMARY_BTN, SectionCard, inputClass } from '@/components/crm/ui';
import { WORK_SOURCE_LABELS } from '@/lib/work/constants';
import type { WorkUpdateDTO } from './types';

/** Lịch sử cập nhật tiến độ (cào về và ghi tay), kèm ô ghi nhanh một cập nhật. */
export function UpdatesPanel({ itemId, updates, onAdded }: { itemId: string; updates: WorkUpdateDTO[]; onAdded: () => void }) {
  const [content, setContent] = useState('');
  const [progress, setProgress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    setError('');
    try {
      await crmSend(`/api/work/items/${itemId}/updates`, 'POST', { content: content.trim(), progressPercent: toInt(progress) });
      setContent('');
      setProgress('');
      onAdded();
    } catch (addError) {
      setError(errorMessage(addError, 'Không ghi được cập nhật.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title={`Lịch sử cập nhật (${updates.length})`}>
      <form onSubmit={add} className="mb-4 space-y-2">
        <ErrorBanner message={error} />
        <label htmlFor="wk-update" className="sr-only">Nội dung cập nhật</label>
        <textarea id="wk-update" rows={2} value={content} onChange={(e) => setContent(e.target.value)} className={inputClass(undefined, 'resize-none')} placeholder="Ghi cập nhật: thư ký báo đã trình dự thảo, đang chờ góp ý…" />
        <div className="flex items-center justify-end gap-2">
          <label htmlFor="wk-progress" className="text-xs text-slate-500">Tiến độ</label>
          <input id="wk-progress" type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(e.target.value)} className={inputClass(undefined, 'w-20')} placeholder="%" />
          <button type="submit" disabled={saving || !content.trim()} className={PRIMARY_BTN}>{saving ? 'Đang ghi...' : 'Ghi cập nhật'}</button>
        </div>
      </form>
      {updates.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có cập nhật nào.</p>
      ) : (
        <ol className="space-y-3 border-l-2 border-slate-100 pl-4">
          {updates.map((u) => (
            <li key={u.id} className="relative text-sm">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-cyan-500" aria-hidden="true" />
              <p className="text-xs text-slate-500">
                {formatDateTime(u.occurredAt)}{u.author && ` · ${u.author}`}{u.progressPercent != null && ` · ${u.progressPercent}%`} · {WORK_SOURCE_LABELS[u.source]}
              </p>
              <p className="mt-0.5 whitespace-pre-line text-slate-800">{u.content}</p>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
