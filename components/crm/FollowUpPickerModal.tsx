'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CalendarCheck, Search } from 'lucide-react';
import { crmFetch } from './api';
import { displayName, formatDate } from './format';
import type { InteractionDTO } from './types';
import { ModalShell } from './ui';
import { cn } from '@/lib/utils';

interface FollowUpPickerModalProps {
  onClose: () => void;
  onSelect: (interaction: InteractionDTO) => void;
}

type Scope = 'window7' | 'today' | 'upcoming30' | 'all';

export function FollowUpPickerModal({ onClose, onSelect }: FollowUpPickerModalProps) {
  const [scope, setScope] = useState<Scope>('window7');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<InteractionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      followUp: '1',
      followUpScope: scope,
    });
    if (search.trim()) {
      params.set('search', search.trim());
      if (scope === 'window7') {
        params.set('followUpScope', 'all');
      }
    }
    crmFetch<{ items: InteractionDTO[] } | InteractionDTO[]>(`/api/crm/interactions?${params}`, { signal: controller.signal })
      .then((res) => {
        const list = Array.isArray(res) ? res : res.items || [];
        setItems(list);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError('Không tải được danh sách hẹn.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [scope, search]);

  const getRelativeDay = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Ngày mai';
    if (diffDays === -1) return 'Hôm qua';
    if (diffDays > 0) return `Còn ${diffDays} ngày nữa`;
    return `Đã qua ${Math.abs(diffDays)} ngày`;
  };

  return (
    <ModalShell
      title="Danh sách hẹn tái khám & cận lâm sàng"
      subtitle="Chọn khách có hẹn để tự động điền toàn bộ thông tin tiếp đón."
      onClose={onClose}
      size="lg"
    >
      <div className="p-4 sm:p-6 space-y-4">
        {/* Bộ lọc nhanh & tìm kiếm */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Khoảng thời gian hẹn">
            {[
              { id: 'window7', label: '±7 ngày (Mặc định)' },
              { id: 'today', label: 'Hôm nay' },
              { id: 'upcoming30', label: '30 ngày tới' },
              { id: 'all', label: 'Tất cả' },
            ].map((tab) => {
              const active = scope === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setScope(tab.id as Scope)}
                  className={cn(
                    'rounded-xl px-3.5 py-2 text-xs font-semibold transition border min-h-[38px] active:scale-95',
                    active
                      ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-teal-50 hover:text-teal-800'
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên khách, số điện thoại..."
              className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-base sm:text-sm text-slate-800 shadow-sm transition placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/10 min-h-[44px]"
            />
          </div>
        </div>

        {/* Danh sách hẹn */}
        <div className="min-h-[200px] max-h-[60vh] overflow-y-auto space-y-2.5 pr-0.5">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">Đang tải danh sách hẹn...</div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-red-600 flex items-center justify-center gap-2">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6">
              Không có lịch hẹn nào phù hợp {scope === 'window7' ? 'trong khoảng ±7 ngày' : ''}.
              {scope === 'window7' && (
                <p className="mt-1 text-xs text-slate-400">
                  Thử chọn tab <strong>Tất cả</strong> hoặc gõ tên khách vào ô tìm kiếm ở trên.
                </p>
              )}
            </div>
          ) : (
            items.map((item) => {
              const guestName = item.contact ? displayName(item.contact) : item.patientName || 'Khách chưa gắn tên';
              const rel = getRelativeDay(item.followUpDate);
              const isToday = rel === 'Hôm nay';
              const isPast = rel.startsWith('Đã qua');

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  className="w-full text-left rounded-2xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-2xs hover:border-teal-400 hover:shadow-md transition-all active:scale-[0.99] group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 group-hover:text-teal-900 text-sm sm:text-base">
                        {guestName}
                      </span>
                      {item.followUpDate && (
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-[11px] font-semibold border',
                            isToday
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isPast
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-teal-50 text-teal-800 border-teal-200'
                          )}
                        >
                          {formatDate(item.followUpDate)} ({rel})
                        </span>
                      )}
                    </div>

                    {item.followUp && (
                      <p className="text-xs font-medium text-teal-800 truncate">
                        {item.followUp}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {item.destination && (
                        <span>Khoa/Phòng: <strong className="text-slate-700">{item.destination}</strong></span>
                      )}
                      {item.doctors && item.doctors.length > 0 && (
                        <span>BS: <strong className="text-slate-700">{item.doctors.map((d) => d.fullName).join(', ')}</strong></span>
                      )}
                      {item.referrerContact && (
                        <span>GT: <strong className="text-slate-700">{item.referrerContact.fullName}</strong></span>
                      )}
                    </div>
                  </div>

                  <div className="self-end sm:self-center shrink-0">
                    <span className="inline-flex items-center gap-1 rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 border border-teal-200/80 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                      Tiếp đón ngay →
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </ModalShell>
  );
}
