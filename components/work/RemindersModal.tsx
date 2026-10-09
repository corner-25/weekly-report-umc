'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { CheckSquare, Info, Mail, Send, Square } from 'lucide-react';
import { crmFetch, crmSend, errorMessage } from '@/components/crm/api';
import { ErrorBanner, ModalShell, PRIMARY_BTN } from '@/components/crm/ui';
import { formatDate } from '@/components/crm/format';
import type { ReminderPreviewDTO } from './types';

const REASON = { overdue: 'Quá hạn', due_soon: 'Sắp đến hạn', stale: 'Lâu chưa cập nhật' } as const;

export function RemindersModal({ onClose, onReminded }: { onClose: () => void; onReminded?: () => void }) {
  const { data: session } = useSession();
  const [preview, setPreview] = useState<ReminderPreviewDTO | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState('');

  useEffect(() => {
    crmFetch<ReminderPreviewDTO>('/api/work/reminders')
      .then((data) => {
        setPreview(data);
        // Mặc định chọn tất cả các công việc trong danh sách cần nhắc
        const allIds = new Set<string>();
        data.recipients.forEach((r) => r.items.forEach((i) => allIds.add(i.id)));
        setSelectedIds(allIds);
      })
      .catch((e) => setError(errorMessage(e, 'Không tải được danh sách nhắc.')));
  }, []);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (select: boolean) => {
    if (!preview) return;
    if (select) {
      const allIds = new Set<string>();
      preview.recipients.forEach((r) => r.items.forEach((i) => allIds.add(i.id)));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  // Tính số người nhận thực tế sau khi lọc theo các việc đã tick
  const activeRecipientsCount = preview?.recipients.filter((r) => r.items.some((i) => selectedIds.has(i.id))).length ?? 0;

  const send = async () => {
    if (selectedIds.size === 0) return;
    setSending(true);
    setError('');
    try {
      const r = await crmSend<{ sent: number; failures: unknown[]; itemsReminded: number }>('/api/work/reminders', 'POST', {
        selectedItemIds: Array.from(selectedIds),
      });
      setDone(`Đã gửi thành công ${r.sent} email, ghi nhận nhắc việc cho ${r.itemsReminded} công việc hôm nay.`);
      onReminded?.();
    } catch (sendError) {
      setError(errorMessage(sendError, 'Không gửi được email.'));
    } finally {
      setSending(false);
    }
  };

  const isAdmin = session?.user.role === 'ADMIN';

  return (
    <ModalShell
      title="Đôn đốc tiến độ công việc qua Email (UMC-Office)"
      subtitle="Chọn các công việc cần nhắc để gửi email cho Thư ký/Đầu mối đơn vị. Hệ thống sẽ tự động ghi nhận ngày nhắc hôm nay."
      onClose={onClose}
    >
      <div className="space-y-4 p-5 sm:p-6 max-h-[80vh] overflow-y-auto">
        <ErrorBanner message={error} />
        {done && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 flex items-center gap-2">
            <span className="font-semibold">✓ {done}</span>
          </div>
        )}

        {/* Khung hướng dẫn hành chính */}
        <div className="rounded-xl bg-cyan-50/70 border border-cyan-200/80 p-3.5 text-xs text-cyan-900 flex items-start gap-2.5">
          <Info className="h-4 w-4 shrink-0 text-cyan-700 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Mẫu email đôn đốc được gửi từ Phòng Hành chính (hanhchinh@umc.edu.vn):</p>
            <p className="text-cyan-800">
              Email có kèm <strong>quy định bắt buộc về nội dung báo cáo kết quả</strong> trên UMC-Office (phải nêu rõ sản phẩm đầu ra, số liệu nghiệm thu, văn bản đính kèm; không bấm hoàn thành suông).
            </p>
          </div>
        </div>

        {!preview ? (
          <div className="py-8 text-center text-sm text-slate-500 animate-pulse">Đang nạp danh sách công việc cần đôn đốc...</div>
        ) : (
          <>
            {preview.recipients.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">Hiện không có công việc nào quá hạn hoặc cần đôn đốc.</p>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleAll(true)}
                      className="inline-flex items-center gap-1 font-semibold text-cyan-700 hover:text-cyan-900"
                    >
                      <CheckSquare className="h-3.5 w-3.5" /> Chọn tất cả ({Array.from(preview.recipients.flatMap((r) => r.items)).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleAll(false)}
                      className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-800"
                    >
                      <Square className="h-3.5 w-3.5" /> Bỏ chọn
                    </button>
                  </div>
                  <span className="text-slate-500">
                    Đã chọn: <strong className="text-cyan-800">{selectedIds.size}</strong> việc cho{' '}
                    <strong className="text-cyan-800">{activeRecipientsCount}</strong> đơn vị
                  </span>
                </div>

                <div className="space-y-3">
                  {preview.recipients.map((r) => {
                    const recipientSelectedCount = r.items.filter((i) => selectedIds.has(i.id)).length;
                    return (
                      <article
                        key={r.secretaryId}
                        className={`rounded-xl border transition-colors p-3.5 ${
                          recipientSelectedCount > 0 ? 'border-cyan-200 bg-white shadow-2xs' : 'border-slate-200 bg-slate-50/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5 text-cyan-600" />
                              {r.name}
                              <span className="font-medium text-slate-500 text-xs">({r.department})</span>
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">{r.email}</p>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            Chọn {recipientSelectedCount}/{r.items.length} việc
                          </span>
                        </div>

                        <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100 pt-1 text-sm space-y-1">
                          {r.items.map((i) => {
                            const isChecked = selectedIds.has(i.id);
                            return (
                              <li
                                key={i.id}
                                onClick={() => toggleItem(i.id)}
                                className="flex items-start gap-2.5 py-1.5 cursor-pointer hover:bg-slate-50 rounded px-1 transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}} // handled by li onClick
                                  className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                                />
                                <div className="min-w-0 flex-1">
                                  <span className={`text-[13.5px] leading-snug block ${isChecked ? 'font-medium text-slate-900' : 'text-slate-500 line-through'}`}>
                                    {i.title}
                                  </span>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                                    <span>Trạng thái: {i.status}</span>
                                    {i.dueDate && <span>· Hạn: {formatDate(i.dueDate)}</span>}
                                  </div>
                                </div>
                                <span
                                  className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded ${
                                    i.reason === 'overdue' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                                  }`}
                                >
                                  {REASON[i.reason]}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </article>
                    );
                  })}
                </div>

                {preview.departmentsWithoutEmail.length > 0 && (
                  <p className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs text-amber-800">
                    <strong>Lưu ý:</strong> Chưa có email thư ký cho các đơn vị:{' '}
                    {preview.departmentsWithoutEmail.map((d) => `${d.department} (${d.itemCount} việc)`).join(', ')}. Bổ sung email ở danh sách thư ký để đơn vị nhận được thông báo.
                  </p>
                )}
              </>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div className="text-xs text-slate-500">
                {!preview.canSend && <span>⚠️ Chưa cấu hình SMTP trên máy chủ (chỉ xem trước).</span>}
                {preview.canSend && !isAdmin && <span>Chỉ tài khoản quản trị viên (ADMIN) mới có quyền gửi thật.</span>}
              </div>

              <div className="flex items-center gap-2.5">
                <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={send}
                  disabled={!preview.canSend || !isAdmin || sending || selectedIds.size === 0}
                  className={PRIMARY_BTN}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {sending ? 'Đang gửi email...' : `Gửi đôn đốc (${selectedIds.size} việc)`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}
