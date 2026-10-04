'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Send } from 'lucide-react';
import { crmFetch, crmSend, errorMessage } from '@/components/crm/api';
import { ErrorBanner, ModalShell, PRIMARY_BTN } from '@/components/crm/ui';
import { formatDate } from '@/components/crm/format';
import type { ReminderPreviewDTO } from './types';

const REASON = { overdue: 'Quá hạn', due_soon: 'Sắp đến hạn', stale: 'Lâu chưa cập nhật' } as const;

/** Xem trước email nhắc việc gửi thư ký; quản trị viên gửi thật khi đã có SMTP. */
export function RemindersModal({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const [preview, setPreview] = useState<ReminderPreviewDTO | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState('');

  useEffect(() => {
    crmFetch<ReminderPreviewDTO>('/api/work/reminders').then(setPreview).catch((e) => setError(errorMessage(e, 'Không tải được danh sách nhắc.')));
  }, []);

  const send = async () => {
    setSending(true);
    setError('');
    try {
      const r = await crmSend<{ sent: number; failures: unknown[]; itemsReminded: number }>('/api/work/reminders', 'POST');
      setDone(`Đã gửi ${r.sent} email, nhắc ${r.itemsReminded} việc${r.failures.length ? ` · ${r.failures.length} email lỗi` : ''}.`);
    } catch (sendError) {
      setError(errorMessage(sendError, 'Không gửi được email.'));
    } finally {
      setSending(false);
    }
  };

  const isAdmin = session?.user.role === 'ADMIN';
  return (
    <ModalShell title="Nhắc việc qua email" subtitle="Mỗi thư ký nhận một email gom việc của đơn vị mình. Việc đã nhắc trong 7 ngày không nhắc lại." onClose={onClose}>
      <div className="space-y-4 p-5 sm:p-6">
        <ErrorBanner message={error} />
        {done && <p role="status" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{done}</p>}
        {!preview ? (
          <p className="text-sm text-slate-500">Đang tính danh sách...</p>
        ) : (
          <>
            {preview.recipients.length === 0 && <p className="text-sm text-slate-500">Không có việc nào cần nhắc lúc này.</p>}
            {preview.recipients.map((r) => (
              <article key={r.secretaryId} className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">{r.name} <span className="font-normal text-slate-500">· {r.email} · {r.department}</span></p>
                <p className="mt-0.5 text-xs text-slate-500">Tiêu đề: {r.subject}</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {r.items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate text-slate-700">{i.title}</span>
                      <span className="shrink-0 text-xs font-semibold text-amber-700">{REASON[i.reason]}{i.dueDate ? ` · hạn ${formatDate(i.dueDate)}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
            {preview.departmentsWithoutEmail.length > 0 && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Chưa có email thư ký: {preview.departmentsWithoutEmail.map((d) => `${d.department} (${d.itemCount} việc)`).join(', ')}. Bổ sung email ở danh sách thư ký để các đơn vị này nhận nhắc.
              </p>
            )}
            {preview.unassignedCount > 0 && (
              <p className="text-sm text-slate-500">{preview.unassignedCount} việc chưa khớp được đơn vị chủ trì — mở việc và chọn đơn vị để đưa vào danh sách nhắc.</p>
            )}
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
              {!preview.canSend && <p className="text-xs text-slate-500">Máy chủ chưa cấu hình SMTP nên mới xem trước được, chưa gửi thật.</p>}
              {preview.canSend && !isAdmin && <p className="text-xs text-slate-500">Chỉ quản trị viên được gửi.</p>}
              <button type="button" onClick={send} disabled={!preview.canSend || !isAdmin || sending || preview.recipients.length === 0} className={PRIMARY_BTN}>
                <Send className="h-4 w-4" aria-hidden="true" /> {sending ? 'Đang gửi...' : `Gửi ${preview.recipients.length} email`}
              </button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}
