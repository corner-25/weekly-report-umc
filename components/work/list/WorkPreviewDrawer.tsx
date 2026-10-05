'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown, ChevronUp, ExternalLink, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { crmFetch, errorMessage } from '@/components/crm/api';
import { formatDate } from '@/components/crm/format';
import { ErrorBanner, ICON_BTN } from '@/components/crm/ui';
import type { WorkListItem } from '@/lib/work/list';
import { ProgressBar, StatusChip, WorkBadges } from '../WorkBits';
import { UpdatesPanel } from '../UpdatesPanel';
import type { WorkItemDetail } from '../types';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-2 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 text-slate-900">{children}</dd>
    </div>
  );
}

/**
 * Xem nhanh một việc ngay cạnh danh sách: thông tin, toàn bộ lịch sử tiến độ,
 * ghi cập nhật. ↑/↓ (hoặc K/J) chuyển việc trước/sau, Esc đóng.
 */
export function WorkPreviewDrawer({
  item,
  onClose,
  onStep,
  onChanged,
}: {
  item: WorkListItem;
  onClose: () => void;
  onStep: (delta: 1 | -1) => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<WorkItemDetail | null>(null);
  const [error, setError] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<Element | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      setDetail(await crmFetch<WorkItemDetail>(`/api/work/items/${item.id}`));
    } catch (loadError) {
      setError(errorMessage(loadError, 'Không tải được chi tiết công việc.'));
    }
  }, [item.id]);

  useEffect(() => {
    setDetail(null);
    load();
  }, [load]);

  useEffect(() => {
    returnFocus.current = document.activeElement;
    closeRef.current?.focus();
    return () => (returnFocus.current as HTMLElement | null)?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === 'Escape') onClose();
      if (typing) return;
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); onStep(1); }
      if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); onStep(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onStep]);

  const unit = item.department?.name ?? item.leadUnit;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button type="button" aria-label="Đóng xem nhanh" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-slate-900/25 backdrop-blur-[1px] animate-fade-in" />
      <aside role="dialog" aria-modal="true" aria-labelledby="work-preview-title" className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl animate-sheet-in">
        <header className="space-y-2 border-b border-slate-100 px-5 pb-4 pt-3">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onStep(-1)} className={ICON_BTN} title="Việc trước (↑)"><ChevronUp className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Việc trước</span></button>
            <button type="button" onClick={() => onStep(1)} className={ICON_BTN} title="Việc sau (↓)"><ChevronDown className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Việc sau</span></button>
            <span className="ml-1 text-xs text-slate-400">{item.externalId ? `Mã ${item.externalId}` : 'Phòng HC mở'}</span>
            <span className="ml-auto flex items-center gap-1">
              <Link href={`/dashboard/work/items/${item.id}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50">
                Trang chi tiết <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
              <button ref={closeRef} type="button" onClick={onClose} className={ICON_BTN} title="Đóng (Esc)"><X className="h-5 w-5" aria-hidden="true" /><span className="sr-only">Đóng</span></button>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip status={item.status} />
            <WorkBadges item={item} />
          </div>
          <h2 id="work-preview-title" className="text-lg font-bold leading-snug text-slate-900">{item.title}</h2>
          <ProgressBar value={item.status === 'DONE' ? 100 : item.progressPercent} />
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <ErrorBanner message={error} />
          <dl className="divide-y divide-slate-100">
            <Row label="Đơn vị chủ trì">{unit ?? <span className="text-slate-400">Chưa rõ</span>}</Row>
            {item.leader && <Row label="Lãnh đạo chỉ đạo">{item.leader}{item.directedAt && ` · ${formatDate(item.directedAt)}`}</Row>}
            {item.assignees.length > 0 && <Row label="Người thực hiện">{item.assignees.join(', ')}</Row>}
            {detail && detail.watchers.length > 0 && <Row label="Người theo dõi">{detail.watchers.join(', ')}</Row>}
            <Row label="Hạn chót">
              {item.dueDate ? <span className={cn(item.isOverdue && 'font-semibold text-rose-600')}>{formatDate(item.dueDate)}</span> : <span className="text-slate-400">Chưa có</span>}
            </Row>
            {item.completedAt && <Row label="Hoàn thành">{formatDate(item.completedAt)}{item.lateDays !== null && (item.lateDays === 0 ? ' · đúng hạn' : ` · trễ ${item.lateDays} ngày`)}</Row>}
            <Row label="Đã giao">{item.ageDays} ngày · im lặng {item.silentDays} ngày</Row>
            {item.tags[0] && <Row label="Hình thức">{item.tags.join(', ')}</Row>}
          </dl>
          {detail?.description && <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{detail.description}</p>}
          {item.externalUrl && (
            <a href={item.externalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
              Mở trên phân hệ Quản lý công việc <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
          {detail ? (
            <UpdatesPanel
              itemId={item.id}
              updates={detail.updates}
              onAdded={() => {
                load();
                onChanged();
              }}
            />
          ) : (
            !error && <div className="h-40 animate-pulse rounded-2xl bg-slate-50" aria-label="Đang tải lịch sử" />
          )}
        </div>
      </aside>
    </div>
  );
}
