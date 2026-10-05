'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { crmFetch, crmSend, errorMessage } from '@/components/crm/api';
import { ErrorBanner, Field, ModalShell, PRIMARY_BTN, SECONDARY_BTN, inputClass } from '@/components/crm/ui';
import type { ThreadDto } from '@/lib/task-tracking/server';
import { KIND_LABELS, ProgressTrack, STATUS_LABELS, ThreadStatusChip, type ThreadKind, type ThreadStatus } from './ThreadBits';

interface Entry {
  week: number;
  progress: number | null;
  resultText: string;
  nextWeekPlan: string | null;
  timePeriod: string | null;
}

/** Diễn tiến một việc qua các tuần, nhận định của AI, và chỗ Phòng HC xác nhận/sửa. */
export function ThreadDetailModal({ thread, onClose, onSaved }: { thread: ThreadDto; onClose: () => void; onSaved: (t: ThreadDto) => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [kind, setKind] = useState<ThreadKind>((thread.kind ?? 'PROJECT') as ThreadKind);
  const [status, setStatus] = useState<ThreadStatus>((thread.status ?? 'IN_PROGRESS') as ThreadStatus);
  const [progress, setProgress] = useState(thread.progress != null ? String(thread.progress) : '');
  const [note, setNote] = useState(thread.override?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    crmFetch<{ entries: Entry[] }>(`/api/task-threads/${thread.id}`)
      .then((d) => setEntries(d.entries))
      .catch((e) => setError(errorMessage(e, 'Không tải được diễn tiến.')));
  }, [thread.id]);

  const save = async (body: unknown) => {
    setSaving(true);
    setError('');
    try {
      onSaved(await crmSend<ThreadDto>(`/api/task-threads/${thread.id}`, 'PATCH', body));
    } catch (e) {
      setError(errorMessage(e, 'Không lưu được.'));
    } finally {
      setSaving(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const pct = progress.trim() === '' ? null : Number(progress);
    if (pct !== null && (!Number.isInteger(pct) || pct < 0 || pct > 100)) {
      setError('Tiến độ là số nguyên từ 0 đến 100.');
      return;
    }
    save({ kind, status, progress: kind === 'ROUTINE' ? null : pct, note: note.trim() || undefined });
  };

  return (
    <ModalShell title={thread.title} subtitle={thread.rawName !== '(không tên)' ? `Nhiệm vụ: ${thread.rawName}` : undefined} onClose={onClose}>
      <div className="space-y-5 p-5 sm:p-6">
        <ErrorBanner message={error} />

        <div className="flex flex-wrap items-center gap-3">
          <ThreadStatusChip status={thread.status} />
          <span className="text-sm text-slate-600">{thread.kind ? KIND_LABELS[thread.kind as ThreadKind] : 'Chưa phân loại'}</span>
          <ProgressTrack value={thread.progress} status={thread.status} />
        </div>

        {thread.ai.judged && (
          <section className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm">
            <p className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Sparkles className="h-4 w-4 text-violet-500" aria-hidden="true" /> AI nhận định
              {thread.ai.confidence !== null && <span className="text-xs font-normal text-slate-500">· độ tin cậy {Math.round(thread.ai.confidence * 100)}%</span>}
            </p>
            {thread.ai.reasoning && <p className="text-slate-700">{thread.ai.reasoning}</p>}
            {thread.ai.evidence && <p className="border-l-2 border-slate-300 pl-2 italic text-slate-600">“{thread.ai.evidence}”</p>}
          </section>
        )}

        <section>
          <h3 className="mb-2 text-sm font-bold text-slate-800">Diễn tiến qua các tuần</h3>
          {!entries ? (
            <p className="text-sm text-slate-500">Đang tải...</p>
          ) : (
            <ol className="space-y-3 border-l-2 border-slate-100 pl-4">
              {[...entries].reverse().map((e) => (
                <li key={e.week} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500" aria-hidden="true" />
                  <p className="text-xs font-semibold text-slate-500">
                    Tuần {e.week}{e.progress !== null ? ` · ${e.progress}%` : ' · không ghi %'}{e.timePeriod ? ` · ${e.timePeriod}` : ''}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-slate-800">{e.resultText}</p>
                  {e.nextWeekPlan && <p className="mt-0.5 text-xs text-slate-500">Kế hoạch tuần sau: {e.nextWeekPlan}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>

        <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-800">Phòng Hành chính xác nhận</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Loại việc" htmlFor="th-kind">
              <Select id="th-kind" value={kind} onChange={(e) => setKind(e.target.value as ThreadKind)} className="px-3.5 py-2.5">
                {(Object.keys(KIND_LABELS) as ThreadKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
              </Select>
            </Field>
            <Field label="Tình trạng" htmlFor="th-status">
              <Select id="th-status" value={status} onChange={(e) => setStatus(e.target.value as ThreadStatus)} className="px-3.5 py-2.5">
                {(Object.keys(STATUS_LABELS) as ThreadStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </Select>
            </Field>
            <Field label="Tiến độ (%)" hint={kind === 'ROUTINE' ? 'Thường kỳ không gán %' : undefined}>
              <input type="number" min={0} max={100} value={kind === 'ROUTINE' ? '' : progress} disabled={kind === 'ROUTINE'} onChange={(e) => setProgress(e.target.value)} className={inputClass()} />
            </Field>
          </div>
          <Field label="Ghi chú">
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass()} placeholder="Vd: phòng xác nhận đã ban hành ngày 20/9" />
          </Field>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {thread.override && (
              <button type="button" disabled={saving} onClick={() => save({ clear: true })} className={SECONDARY_BTN}>Trả lại cho AI quyết</button>
            )}
            <button type="submit" disabled={saving} className={PRIMARY_BTN}>{saving ? 'Đang lưu...' : 'Lưu xác nhận'}</button>
          </div>
          {thread.override && <p className="text-xs text-slate-500">Đã xác nhận bởi {thread.override.by ?? 'không rõ'} — lần chạy AI sau không ghi đè.</p>}
        </form>
      </div>
    </ModalShell>
  );
}
