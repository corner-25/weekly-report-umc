'use client';

import { Pagination } from '@/components/crm/Pagination';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Building2, CalendarClock, Clock, Gift, Handshake, History, Plus, QrCode, UserRound, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import { DATE_KIND_LABELS, GIFT_TYPE_LABELS } from '@/lib/crm/constants';
import { changeCareTaskStatus, changeInteractionStatus, crmFetch, errorMessage } from '@/components/crm/api';
import { CareDueSection } from '@/components/crm/CareDueSection';
import { CareTaskModal } from '@/components/crm/CareTaskModal';
import { CareQuickActions } from '@/components/crm/CareTasksPanel';
import { ContactModal } from '@/components/crm/ContactModal';
import { QuickEntryQrModal } from '@/components/crm/QuickEntryQrModal';
import { InteractionModal, type InteractionMode } from '@/components/crm/InteractionModal';
import { INTERACTION_ICONS, InteractionTimeline } from '@/components/crm/InteractionTimeline';
import { daysUntilLabel, formatDate, yearsLabel } from '@/components/crm/format';
import type {
  CareDueItem,
  CareStatus,
  CareTaskDTO,
  DormantItem,
  InteractionDTO,
  InteractionStatus,
  OverviewDTO,
  OverviewUpcoming,
} from '@/components/crm/types';
import type { ReconcileRow } from '@/lib/crm/reconcile';
import { ACCENT_BTN, EmptyState, ErrorBanner, PANEL, PRIMARY_BTN, SECONDARY_BTN, SectionCard, Stat, TierBadge } from '@/components/crm/ui';

const WINDOWS = [7, 30, 90] as const;
type WindowDays = (typeof WINDOWS)[number];
const SOON_DAYS = 7;

function profileHref(target: { type: 'contact' | 'organization'; id: string }) {
  return target.type === 'contact' ? `/dashboard/crm/contacts/${target.id}` : `/dashboard/crm/organizations/${target.id}`;
}

export default function CrmOverviewPage() {
  const [upcomingPage, setUpcomingPage] = useState(1);
  const router = useRouter();
  const [windowDays, setWindowDays] = useState<WindowDays>(30);
  const [data, setData] = useState<OverviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [interactionMode, setInteractionMode] = useState<InteractionMode | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [careDialog, setCareDialog] = useState<{ due: CareDueItem } | { task: CareTaskDTO } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setUpcomingPage(1);
    setError('');
    try {
      setData(await crmFetch<OverviewDTO>(`/api/crm/overview?window=${windowDays}`));
    } catch (loadError) {
      setError(errorMessage(loadError, 'Không thể tải tổng quan CRM.'));
    } finally {
      setLoading(false);
    }
  }, [windowDays]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = (item: InteractionDTO, status: InteractionStatus) => {
    changeInteractionStatus(item.id, status)
      .then(() => load())
      .catch((statusError) => setError(errorMessage(statusError, 'Không cập nhật được lịch hẹn.')));
  };

  const changeCareStatus = (task: CareTaskDTO, status: CareStatus) => {
    changeCareTaskStatus(task.id, status)
      .then(() => load())
      .catch((statusError) => setError(errorMessage(statusError, 'Không cập nhật được việc quà, hoa.')));
  };

  const counts = data?.counts;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Handshake}
        title="CRM đối tác"
        description="Dịp sắp tới, tương tác gần đây và đối tác lâu chưa liên hệ"
        className="flex-wrap gap-4"
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setInteractionMode('VIP_ESCORT')} className={PRIMARY_BTN}>
              <INTERACTION_ICONS.VIP_ESCORT className="h-4 w-4" aria-hidden="true" /> Dẫn khách VIP khám
            </button>
            <button type="button" onClick={() => setInteractionMode('DELEGATION')} className={ACCENT_BTN}>
              <Users className="h-4 w-4" aria-hidden="true" /> Dẫn đoàn
            </button>
            <button type="button" onClick={() => setShowContactModal(true)} className={SECONDARY_BTN}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Thêm đối tác
            </button>
            <button type="button" onClick={() => setShowQr(true)} className={SECONDARY_BTN}>
              <QrCode className="h-4 w-4" aria-hidden="true" /> Mã QR nhập nhanh
            </button>
          </div>
        }
      />

      <ErrorBanner message={error} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Cá nhân trong danh bạ" value={counts?.contacts ?? '—'} />
        <Stat label="Tổ chức" value={counts?.organizations ?? '—'} />
        <Stat label="Tương tác tháng này" value={counts?.interactionsThisMonth ?? '—'} />
        <Stat
          label="Dẫn khám VIP · dẫn đoàn"
          value={counts ? `${counts.vipEscortsThisMonth} · ${counts.delegationsThisMonth}` : '—'}
          hint="trong tháng này"
          tone="accent"
        />
      </div>

      {data && data.overduePlanned.length > 0 && (
        <SectionCard
          title={`Lịch hẹn đã qua, chưa cập nhật kết quả (${data.overduePlanned.length})`}
          icon={<Clock className="h-4 w-4 text-amber-600" aria-hidden="true" />}
        >
          <p className="mb-3 text-xs text-slate-500">Bấm “Đã xong” nếu đã dẫn khách, “Huỷ” nếu khách không đến — số liệu tháng chỉ tính lượt đã xong.</p>
          <InteractionTimeline items={data.overduePlanned} compact onStatusChange={changeStatus} />
        </SectionCard>
      )}

      <SectionCard
        title="Lịch dẫn khách & đoàn sắp tới"
        icon={<CalendarClock className="h-4 w-4 text-cyan-600" aria-hidden="true" />}
        action={<span className="text-xs text-slate-500">{windowDays} ngày tới</span>}
      >
        {!data?.planned.length ? (
          <p className="py-6 text-center text-sm text-slate-500">
            {loading ? 'Đang tải...' : 'Chưa có lịch hẹn. Khi ghi lượt dẫn khách cho ngày tương lai, lịch sẽ hiện ở đây.'}
          </p>
        ) : (
          <InteractionTimeline items={data.planned} compact onStatusChange={changeStatus} />
        )}
      </SectionCard>

      {data && (
        <CareDueSection
          items={data.careDue}
          budget={data.careBudget}
          loading={loading}
          onPlan={(due) => setCareDialog({ due })}
          onEdit={(task) => setCareDialog({ task })}
          onStatusChange={changeCareStatus}
        />
      )}

      {data && data.careOverdue.length > 0 && (
        <SectionCard title={`Dịp đã qua, quà/hoa chưa trao (${data.careOverdue.length})`} icon={<Gift className="h-4 w-4 text-amber-600" aria-hidden="true" />}>
          <p className="mb-3 text-xs text-slate-500">Bấm “Đã trao” nếu đã tặng, “Huỷ” nếu không tặng nữa.</p>
          <ul className="divide-y divide-slate-100">
            {data.careOverdue.map((task) => (
              <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <button type="button" onClick={() => setCareDialog({ task })} className="min-w-0 text-left text-sm hover:text-cyan-700">
                  <span className="font-semibold tabular-nums text-slate-800">{formatDate(task.occasionDate)}</span>
                  <span className="text-slate-500"> · {task.occasionLabel} · </span>
                  <span className="font-semibold text-slate-900">{task.contact ? task.contact.fullName : task.organization?.name}</span>
                  <span className="block truncate text-xs text-slate-500">{GIFT_TYPE_LABELS[task.giftType]}: {task.description}</span>
                </button>
                <CareQuickActions task={task} onStatusChange={changeCareStatus} />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className={cn(PANEL, 'p-4 sm:p-5')} aria-labelledby="upcoming-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="upcoming-heading" className="text-[15px] font-bold text-slate-900">Sắp tới</h2>
            <div role="group" aria-label="Khoảng thời gian" className="inline-flex rounded-xl bg-slate-100 p-1">
              {WINDOWS.map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={windowDays === w}
                  onClick={() => setWindowDays(w)}
                  className={cn('rounded-lg px-3 py-1 text-xs font-semibold transition', windowDays === w ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                >
                  {w} ngày
                </button>
              ))}
            </div>
          </div>
          {loading && !data ? (
            <p className="py-10 text-center text-sm text-slate-500">Đang tải...</p>
          ) : !data?.upcoming.length ? (
            <EmptyState icon={<Clock className="h-10 w-10" />} title={`Không có dịp nào trong ${windowDays} ngày tới`} hint="Thêm sinh nhật, ngày nhận chức, kỷ niệm thành lập trong hồ sơ đối tác." />
          ) : (
            <ul className={cn('divide-y divide-slate-100', loading && 'opacity-60')}>
              {data.upcoming.slice((upcomingPage - 1) * 20, upcomingPage * 20).map((item) => <UpcomingRow key={item.key} item={item} />)}
            </ul>
          )}
          <Pagination page={upcomingPage} total={data?.upcoming.length ?? 0} onChange={setUpcomingPage} disabled={loading} />
        </section>

        <SectionCard title="Lâu chưa tương tác" icon={<History className="h-4 w-4 text-slate-400" aria-hidden="true" />} action={<span className="text-xs text-slate-500">trên 90 ngày</span>}>
          {!data?.dormant.length ? (
            <p className="py-6 text-center text-sm text-slate-500">{loading ? 'Đang tải...' : 'Đối tác nào cũng được liên hệ gần đây.'}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.dormant.map((item) => <DormantRow key={`${item.type}-${item.id}`} item={item} />)}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Tương tác gần đây"
        action={<Link href="/dashboard/crm/interactions" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:underline">Xem tất cả <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>}
      >
        {!data?.recentInteractions.length ? (
          <p className="py-6 text-center text-sm text-slate-500">{loading ? 'Đang tải...' : 'Chưa có tương tác nào.'}</p>
        ) : (
          <InteractionTimeline items={data.recentInteractions} compact />
        )}
      </SectionCard>

      {data && <ReconcileCard rows={data.reconcile} />}

      {interactionMode && (
        <InteractionModal
          mode={interactionMode}
          onClose={() => setInteractionMode(null)}
          onSaved={() => {
            setInteractionMode(null);
            load();
          }}
        />
      )}
      {careDialog && (
        <CareTaskModal
          initial={'task' in careDialog ? careDialog.task : undefined}
          occasion={'due' in careDialog ? {
            owner: careDialog.due.target.type === 'contact' ? { contactId: careDialog.due.target.id } : { organizationId: careDialog.due.target.id },
            importantDateId: careDialog.due.importantDateId,
            occasionKind: careDialog.due.kind,
            occasionDate: careDialog.due.date,
            label: careDialog.due.label,
            targetName: careDialog.due.target.name,
          } : undefined}
          onClose={() => setCareDialog(null)}
          onSaved={() => {
            setCareDialog(null);
            load();
          }}
        />
      )}
      {showQr && <QuickEntryQrModal onClose={() => setShowQr(false)} />}
      {showContactModal && (
        <ContactModal
          onClose={() => setShowContactModal(false)}
          onSaved={(saved) => {
            setShowContactModal(false);
            router.push(`/dashboard/crm/contacts/${saved.id}`);
          }}
        />
      )}
    </div>
  );
}

function UpcomingRow({ item }: { item: OverviewUpcoming }) {
  const soon = item.daysUntil <= SOON_DAYS;
  const [, month, day] = item.date.split('-');
  const years = yearsLabel(item.kind, item.years);
  const Icon = item.target.type === 'contact' ? UserRound : Building2;
  return (
    <li>
      <Link href={profileHref(item.target)} className="group grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl py-2.5 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:px-1">
        <span className={cn('rounded-xl py-1 text-center leading-tight tabular-nums', soon ? 'bg-orange-50 text-orange-700' : 'bg-slate-100 text-slate-500')}>
          <b className="block text-lg">{day}</b>
          <span className="text-[10px] font-semibold">Th{Number(month)}</span>
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm">
            <span className="text-slate-500">{item.label || DATE_KIND_LABELS[item.kind]} · </span>
            <span className="font-semibold text-slate-900 group-hover:text-cyan-700">{item.target.name}</span>
          </span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <Icon className="h-3 w-3" aria-hidden="true" />
            {item.target.subtitle && <span className="truncate">{item.target.subtitle}</span>}
            <span className={cn(soon && 'font-semibold text-orange-600')}>{formatDate(item.date, 'dd/MM')} · {daysUntilLabel(item.daysUntil)}</span>
            {item.isLunar && <span className="rounded-full bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-700">âm lịch</span>}
            {years && <span>{years}</span>}
          </span>
        </span>
        <TierBadge tier={item.target.tier} />
      </Link>
    </li>
  );
}

function DormantRow({ item }: { item: DormantItem }) {
  return (
    <li>
      <Link href={profileHref(item)} className="flex items-center justify-between gap-3 rounded-xl py-2.5 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 sm:px-1">
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900">{item.name}</span>
            <TierBadge tier={item.tier} />
          </span>
          <span className="text-xs text-slate-500">
            {item.lastInteractionAt ? `Lần cuối ${formatDate(item.lastInteractionAt)}` : 'Chưa từng ghi tương tác'}
          </span>
        </span>
        <span className="shrink-0 text-sm font-bold tabular-nums text-orange-600">{item.daysSince !== null ? `${item.daysSince} ngày` : '—'}</span>
      </Link>
    </li>
  );
}

/** CRM và Excel báo cáo tuần ghi cùng một việc: lệch nhau nghĩa là có lượt chưa nhập bên này hoặc bên kia. */
function ReconcileCard({ rows }: { rows: ReconcileRow[] }) {
  return (
    <SectionCard title="Đối chiếu với Excel báo cáo tuần" action={<span className="text-xs text-slate-500">CRM chỉ tính lượt đã thực hiện</span>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th scope="col" className="py-2 pr-3 font-semibold">Tháng</th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold">Dẫn khám VIP · CRM / Excel</th>
              <th scope="col" className="py-2 text-right font-semibold">Đoàn trong nước · CRM / Excel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={`${r.year}-${r.month}`}>
                <th scope="row" className="py-2 pr-3 text-left font-semibold text-slate-700">{String(r.month).padStart(2, '0')}/{r.year}</th>
                <ReconcileCell crm={r.crmVip} excel={r.excelVip} />
                <ReconcileCell crm={r.crmDelegations} excel={r.excelDelegations} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function ReconcileCell({ crm, excel }: { crm: number; excel: number | null }) {
  const mismatch = excel !== null && excel !== crm;
  return (
    <td className={cn('py-2 pr-3 text-right tabular-nums', mismatch ? 'font-semibold text-amber-700' : 'text-slate-700')}>
      {crm} / {excel ?? '—'}
      {mismatch && <span className="ml-1.5 text-xs font-medium">({crm > excel ? '+' : ''}{crm - excel})</span>}
    </td>
  );
}
