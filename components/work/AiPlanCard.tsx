'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { crmSend, errorMessage } from '@/components/crm/api';
import { formatDate, formatDateTime } from '@/components/crm/format';
import { ErrorBanner, SECONDARY_BTN, SectionCard } from '@/components/crm/ui';
import type { WorkItemDTO } from './types';

const LEVEL = {
  on_track: { label: 'Kịp tiến độ', tone: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  at_risk: { label: 'Có nguy cơ trễ', tone: 'bg-amber-50 text-amber-800 ring-amber-200' },
  late: { label: 'Đã trễ', tone: 'bg-red-50 text-red-700 ring-red-200' },
} as const;

/** B2: AI gợi ý các bước và đánh giá tiến độ, lưu lại để cả phòng cùng xem. */
export function AiPlanCard({ item, onSaved }: { item: WorkItemDTO; onSaved: (saved: WorkItemDTO) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      onSaved(await crmSend<WorkItemDTO>(`/api/work/items/${item.id}/ai`, 'POST'));
    } catch (runError) {
      setError(errorMessage(runError, 'AI chưa trả lời được.'));
    } finally {
      setBusy(false);
    }
  };

  const level = item.aiAssessment ? LEVEL[item.aiAssessment.level] : null;
  return (
    <SectionCard
      title="AI gợi ý các bước"
      icon={<Sparkles className="h-4 w-4 text-violet-500" aria-hidden="true" />}
      action={
        <button type="button" onClick={run} disabled={busy} className={SECONDARY_BTN}>
          <Sparkles className="h-4 w-4" aria-hidden="true" /> {busy ? 'Đang phân tích...' : item.aiPlan ? 'Phân tích lại' : 'Gợi ý'}
        </button>
      }
    >
      <ErrorBanner message={error} />
      {!item.aiPlan ? (
        <p className="text-sm text-slate-500">Bấm “Gợi ý” để AI đọc nội dung chỉ đạo, tính chất, lưu ý và các lần cập nhật rồi đề xuất các bước, đánh giá tiến độ.</p>
      ) : (
        <div className="space-y-4">
          {item.aiAssessment && level && (
            <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm">
              <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', level.tone)}>{level.label}</span>
              <p className="text-slate-700">{item.aiAssessment.summary}</p>
              <p className="text-slate-900"><b className="font-semibold">Nên làm ngay:</b> {item.aiAssessment.nextAction}</p>
            </div>
          )}
          <ol className="space-y-2.5">
            {item.aiPlan.map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                {step.done
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-label="Đã làm" />
                  : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-label="Chưa làm" />}
                <div className="min-w-0">
                  <p className={cn('font-medium', step.done ? 'text-slate-500 line-through' : 'text-slate-900')}>{step.title}</p>
                  {step.detail && <p className="text-slate-600">{step.detail}</p>}
                  {(step.owner || step.dueDate) && (
                    <p className="text-xs text-slate-500">{[step.owner, step.dueDate && `trước ${formatDate(step.dueDate)}`].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {item.aiUpdatedAt && <p className="text-xs text-slate-400">Phân tích lúc {formatDateTime(item.aiUpdatedAt)} — AI có thể sai, hãy đối chiếu trước khi dùng.</p>}
        </div>
      )}
    </SectionCard>
  );
}
