'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WORK_KIND_LABELS, WORK_SOURCE_LABELS } from '@/lib/work/constants';
import { crmFetch, crmSend, errorMessage } from '@/components/crm/api';
import { formatDate, formatDateTime } from '@/components/crm/format';
import { EmptyState, ErrorBanner, ICON_BTN, PANEL, SECONDARY_BTN, SectionCard } from '@/components/crm/ui';
import { AiPlanCard } from '@/components/work/AiPlanCard';
import { CharacteristicsCard } from '@/components/work/CharacteristicsCard';
import { UpdatesPanel } from '@/components/work/UpdatesPanel';
import { WorkItemModal } from '@/components/work/WorkItemModal';
import { HealthChip, ProgressBar, StatusChip } from '@/components/work/WorkBits';
import type { WorkItemDetail, WorkItemDTO } from '@/components/work/types';

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2 py-1.5 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="min-w-0 text-slate-900">{children}</dd>
    </div>
  );
}

export default function WorkItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<WorkItemDetail | null>(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItem(await crmFetch<WorkItemDetail>(`/api/work/items/${id}`));
    } catch (loadError) {
      if ((loadError as { status?: number }).status === 404) setNotFound(true);
      else setError(errorMessage(loadError, 'Không tải được công việc.'));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Thẻ con trả về bản đã lưu (không kèm lịch sử) — giữ lịch sử đang có.
  const merge = (saved: WorkItemDTO) => setItem((prev) => (prev ? { ...prev, ...saved } : prev));

  const remove = async () => {
    try {
      await crmSend(`/api/work/items/${id}`, 'DELETE');
      router.push('/dashboard/work/items');
    } catch (removeError) {
      setError(errorMessage(removeError, 'Không xoá được.'));
    }
  };

  const back = (
    <Link href="/dashboard/work/items" className={cn(ICON_BTN, 'inline-flex items-center gap-1.5 px-2 text-sm font-medium')}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Danh sách công việc
    </Link>
  );
  if (notFound) return <div className="space-y-4">{back}<EmptyState title="Không tìm thấy công việc" hint="Việc có thể đã bị xoá." /></div>;
  if (!item) return <div className="space-y-4">{back}<ErrorBanner message={error} />{!error && <p className="p-12 text-center text-slate-500">Đang tải...</p>}</div>;

  return (
    <div className="space-y-5">
      {back}
      <ErrorBanner message={error} />

      <header className={cn(PANEL, 'space-y-3 p-4 sm:p-5')}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{WORK_KIND_LABELS[item.kind]}</span>
          <StatusChip status={item.status} />
          <HealthChip health={item.health} />
        </div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{item.title}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <ProgressBar value={item.progressPercent} />
          {item.externalUrl && (
            <a href={item.externalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-cyan-700 hover:underline">
              Mở trên ứng dụng nội bộ <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          )}
          {item.source === 'MANUAL' && (
            <span className="ml-auto flex gap-2">
              <button type="button" onClick={() => setEditing(true)} className={SECONDARY_BTN}><Pencil className="h-4 w-4" aria-hidden="true" /> Sửa</button>
              <button type="button" onClick={remove} aria-label="Xoá công việc" className={cn(SECONDARY_BTN, 'px-3 hover:border-red-300 hover:text-red-600')}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
            </span>
          )}
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <SectionCard title="Thông tin">
            <dl className="divide-y divide-slate-100">
              {item.directedBy && <Info label="Người chỉ đạo">{item.directedBy}{item.directedAt && ` · ${formatDate(item.directedAt)}`}</Info>}
              <Info label="Đơn vị chủ trì">{item.department?.name ?? item.leadUnit ?? <span className="text-slate-400">Chưa rõ</span>}</Info>
              {item.coordinatingUnits.length > 0 && <Info label="Phối hợp">{item.coordinatingUnits.join(', ')}</Info>}
              {item.assignees.length > 0 && <Info label="Người thực hiện">{item.assignees.join(', ')}</Info>}
              {item.watchers.length > 0 && <Info label="Người theo dõi">{item.watchers.join(', ')}</Info>}
              <Info label="Hạn chót">{item.dueDate ? formatDate(item.dueDate) : <span className="text-slate-400">Chưa có</span>}</Info>
              {item.externalStatus && <Info label="Trạng thái ở nguồn">{item.externalStatus}</Info>}
              <Info label="Cập nhật gần nhất">{item.lastActivityAt ? formatDateTime(item.lastActivityAt) : <span className="text-slate-400">Chưa có</span>}</Info>
              <Info label="Nguồn">{WORK_SOURCE_LABELS[item.source]}{item.externalId && ` · mã ${item.externalId}`}{item.lastSeenAt && ` · cào ${formatDateTime(item.lastSeenAt)}`}</Info>
            </dl>
            {item.description && <p className="mt-3 whitespace-pre-line border-t border-slate-100 pt-3 text-sm text-slate-700">{item.description}</p>}
          </SectionCard>
          <CharacteristicsCard key={item.id} item={item} onSaved={merge} />
        </div>
        <div className="space-y-4">
          <AiPlanCard item={item} onSaved={merge} />
          <UpdatesPanel itemId={item.id} updates={item.updates} onAdded={load} />
        </div>
      </div>

      {editing && (
        <WorkItemModal
          initial={item}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            merge(saved);
          }}
        />
      )}
    </div>
  );
}
