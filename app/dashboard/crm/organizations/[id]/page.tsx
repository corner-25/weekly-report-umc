'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Building2, MessagesSquare, Pencil, Trash2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ORGANIZATION_TYPE_LABELS } from '@/lib/crm/constants';
import { changeCareTaskStatus, changeInteractionStatus, crmFetch, errorMessage } from '@/components/crm/api';
import { CareTaskModal } from '@/components/crm/CareTaskModal';
import { CareTasksPanel } from '@/components/crm/CareTasksPanel';
import { ImportantDateModal } from '@/components/crm/ImportantDateModal';
import { ImportantDatesPanel } from '@/components/crm/ImportantDatesPanel';
import { InteractionModal, interactionModeOf, type InteractionMode } from '@/components/crm/InteractionModal';
import { INTERACTION_ICONS, InteractionTimeline } from '@/components/crm/InteractionTimeline';
import { OrganizationModal } from '@/components/crm/OrganizationModal';
import { daysUntilLabel, displayName, formatDate, initials } from '@/components/crm/format';
import type { CareTaskDTO, ImportantDateDTO, InteractionDTO, OrganizationDetail } from '@/components/crm/types';
import { ACCENT_BTN, EmptyState, ErrorBanner, ICON_BTN, PANEL, SECONDARY_BTN, SectionCard, TagPill, TierBadge } from '@/components/crm/ui';
import { useConfirmDelete } from '@/components/crm/useConfirmDelete';

type Dialog =
  | { kind: 'interaction'; mode: InteractionMode; initial?: InteractionDTO }
  | { kind: 'edit' }
  | { kind: 'date'; initial?: ImportantDateDTO }
  | { kind: 'care'; initial?: CareTaskDTO };

const SOON_DAYS = 30;

export default function OrganizationProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const { askDelete, deleteDialog } = useConfirmDelete(setError);

  const load = useCallback(async () => {
    setError('');
    try {
      setOrg(await crmFetch<OrganizationDetail>(`/api/crm/organizations/${id}`));
      setNotFound(false);
    } catch (loadError) {
      const status = (loadError as { status?: number }).status;
      if (status === 404) setNotFound(true);
      else setError(errorMessage(loadError, 'Không thể tải hồ sơ tổ chức.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const closeAndReload = () => {
    setDialog(null);
    load();
  };

  if (loading) return <p className="p-12 text-center text-slate-500">Đang tải hồ sơ...</p>;
  if (notFound || !org) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorBanner message={error} />
        {notFound && <EmptyState title="Không tìm thấy tổ chức" hint="Hồ sơ có thể đã bị xoá." />}
      </div>
    );
  }

  const nextOccasion = org.upcoming[0];
  const currentContacts = org.contacts.filter((c) => c.isCurrent);
  const formerContacts = org.contacts.filter((c) => !c.isCurrent);
  // Tóm tắt tiếp đoàn: số lượt đã tiếp, lần gần nhất, các hình thức.
  const doneVisits = org.interactions.filter((x) => x.type === 'DELEGATION' && x.status === 'DONE');
  const visits = {
    done: doneVisits.length,
    last: doneVisits[0]?.occurredAt ?? null,
    purposes: [...new Set(doneVisits.map((x) => x.purpose).filter(Boolean))].join(' · '),
  };
  const website = org.website && (/^https?:\/\//i.test(org.website) ? org.website : `https://${org.website}`);

  return (
    <div className="space-y-5">
      <BackLink />
      <ErrorBanner message={error} />

      <header className={cn(PANEL, 'grid gap-4 p-4 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center sm:p-5')}>
        <div className="flex items-center gap-4 sm:contents">
          <div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-cyan-100 text-lg font-extrabold text-slate-700 sm:h-[72px] sm:w-[72px] sm:text-xl">
            {initials(org.name)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{org.name}</h1>
              <TierBadge tier={org.tier} />
            </div>
            <p className="mt-0.5 text-sm text-slate-600">
              {ORGANIZATION_TYPE_LABELS[org.type]}
              {website && <> · <a href={website} target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:underline">{org.website}</a></>}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              {org.tags.map((t) => <TagPill key={t}>{t}</TagPill>)}
              <span>Phụ trách: <b className="font-semibold text-slate-700">{org.ownerName ?? 'chưa giao'}</b></span>
              {nextOccasion && nextOccasion.daysUntil <= SOON_DAYS && (
                <span className="rounded-full bg-orange-50 px-2 py-0.5 font-semibold text-orange-700">
                  {nextOccasion.label} · {daysUntilLabel(nextOccasion.daysUntil)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button type="button" onClick={() => setDialog({ kind: 'interaction', mode: 'DELEGATION' })} className={ACCENT_BTN}>
            <INTERACTION_ICONS.DELEGATION className="h-4 w-4" aria-hidden="true" /> Dẫn đoàn
          </button>
          <button type="button" onClick={() => setDialog({ kind: 'interaction', mode: 'OTHER' })} className={SECONDARY_BTN}>
            <MessagesSquare className="h-4 w-4" aria-hidden="true" /> Tương tác khác
          </button>
          <button type="button" onClick={() => setDialog({ kind: 'edit' })} className={SECONDARY_BTN}>
            <Pencil className="h-4 w-4" aria-hidden="true" /> Sửa
          </button>
          <button
            type="button"
            aria-label="Xoá tổ chức"
            onClick={() => askDelete({
              title: 'Xoá tổ chức',
              message: `Xoá hồ sơ “${org.name}”? Các cá nhân vẫn được giữ lại.`,
              url: `/api/crm/organizations/${org.id}`,
              onDone: () => router.push('/dashboard/crm/contacts?tab=organizations'),
            })}
            className={cn(SECONDARY_BTN, 'px-3 hover:border-red-300 hover:text-red-600')}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> <span className="sm:sr-only">Xoá</span>
          </button>
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="grid gap-4">
          <SectionCard title="Thông tin" icon={<Building2 className="h-4 w-4 text-cyan-600" aria-hidden="true" />}>
            <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-slate-500">Loại</dt>
              <dd className="text-slate-800">{org.category ?? ORGANIZATION_TYPE_LABELS[org.type]}</dd>
              {org.scope && <><dt className="text-slate-500">Phạm vi</dt><dd className="text-slate-800">{org.scope}</dd></>}
              {visits.done > 0 && (
                <>
                  <dt className="text-slate-500">Tiếp đoàn</dt>
                  <dd className="text-slate-800">
                    <b className="text-emerald-700">{visits.done}</b> lượt đã tiếp{visits.last && ` · gần nhất ${formatDate(visits.last)}`}
                    {visits.purposes && <span className="block text-xs text-slate-500">{visits.purposes}</span>}
                  </dd>
                </>
              )}
              {org.aliases.length > 0 && <><dt className="text-slate-500">Tên khác</dt><dd className="text-slate-800">{org.aliases.join(' · ')}</dd></>}
              {org.externalCode && <><dt className="text-slate-500">Mã sổ tiếp đoàn</dt><dd className="tabular-nums text-slate-500">{org.externalCode}</dd></>}
              {org.address && <><dt className="text-slate-500">Địa chỉ</dt><dd className="text-slate-800">{org.address}</dd></>}
              {org.phone && <><dt className="text-slate-500">Điện thoại</dt><dd><a href={`tel:${org.phone.replace(/\s+/g, '')}`} className="text-cyan-700 hover:underline">{org.phone}</a></dd></>}
              {org.email && <><dt className="text-slate-500">Email</dt><dd className="break-words"><a href={`mailto:${org.email}`} className="text-cyan-700 hover:underline">{org.email}</a></dd></>}
              {org.note && <><dt className="text-slate-500">Ghi chú</dt><dd className="whitespace-pre-line text-slate-800">{org.note}</dd></>}
            </dl>
          </SectionCard>

          <ImportantDatesPanel
            dates={org.importantDates}
            upcoming={org.upcoming}
            onAdd={() => setDialog({ kind: 'date' })}
            onEdit={(d) => setDialog({ kind: 'date', initial: d })}
            onDelete={(d) => askDelete({
              title: 'Xoá ngày quan trọng',
              message: 'Xoá ngày này khỏi hồ sơ tổ chức?',
              url: `/api/crm/important-dates/${d.id}`,
              onDone: load,
            })}
          />

          <CareTasksPanel
            tasks={org.careTasks}
            onAdd={() => setDialog({ kind: 'care' })}
            onEdit={(t) => setDialog({ kind: 'care', initial: t })}
            onDelete={(t) => askDelete({
              title: 'Xoá kế hoạch quà, hoa',
              message: t.interactionId
                ? 'Xoá việc này? Lượt tặng quà đã ghi trên dòng thời gian vẫn được giữ.'
                : 'Xoá kế hoạch quà, hoa cho dịp này?',
              url: `/api/crm/care-tasks/${t.id}`,
              onDone: load,
            })}
            onStatusChange={(t, status) => {
              changeCareTaskStatus(t.id, status).then(() => load()).catch((e) => setError(errorMessage(e)));
            }}
          />

          <SectionCard title="Người liên hệ" icon={<Users className="h-4 w-4 text-blue-600" aria-hidden="true" />} action={<span className="text-xs text-slate-500">{currentContacts.length} người</span>}>
            {org.contacts.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có ai. Thêm chức vụ tại tổ chức này trong hồ sơ cá nhân.</p>
            ) : (
              <>
                <ContactList items={currentContacts} />
                {formerContacts.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Đã từng làm việc tại đây</p>
                    <ContactList items={formerContacts} muted />
                  </div>
                )}
              </>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Dòng thời gian tương tác" icon={<MessagesSquare className="h-4 w-4 text-cyan-600" aria-hidden="true" />} action={<span className="text-xs text-slate-500">{org.interactions.length} lượt</span>}>
          {org.interactions.length === 0 ? (
            <EmptyState title="Chưa có tương tác" hint="Dùng “Dẫn đoàn” hoặc “Tương tác khác” để ghi lại." />
          ) : (
            <InteractionTimeline
              items={org.interactions}
              hideOrganizationId={org.id}
              onEdit={(item) => setDialog({ kind: 'interaction', mode: interactionModeOf(item.type), initial: item })}
              onDelete={(item) => askDelete({
                title: 'Xoá tương tác',
                message: 'Xoá lượt tương tác này khỏi dòng thời gian?',
                url: `/api/crm/interactions/${item.id}`,
                onDone: load,
              })}
              onStatusChange={(item, status) => {
                changeInteractionStatus(item.id, status).then(() => load()).catch((e) => setError(errorMessage(e)));
              }}
            />
          )}
        </SectionCard>
      </div>

      {deleteDialog}

      {dialog?.kind === 'interaction' && (
        <InteractionModal
          mode={dialog.mode}
          initial={dialog.initial}
          preset={{ organizationId: org.id, organizationName: org.name }}
          onClose={() => setDialog(null)}
          onSaved={closeAndReload}
        />
      )}
      {dialog?.kind === 'edit' && <OrganizationModal initial={org} onClose={() => setDialog(null)} onSaved={closeAndReload} />}
      {dialog?.kind === 'care' && (
        <CareTaskModal
          initial={dialog.initial}
          owner={{ organizationId: org.id }}
          occasions={org.upcoming}
          onClose={() => setDialog(null)}
          onSaved={closeAndReload}
        />
      )}
      {dialog?.kind === 'date' && <ImportantDateModal owner={{ organizationId: org.id }} initial={dialog.initial} onClose={() => setDialog(null)} onSaved={closeAndReload} />}
    </div>
  );
}

function ContactList({ items, muted = false }: { items: OrganizationDetail['contacts']; muted?: boolean }) {
  return (
    <ul className="divide-y divide-dashed divide-slate-200">
      {items.map((c) => (
        <li key={`${c.id}-${c.title ?? ''}`} className="py-2 first:pt-0 last:pb-0 text-sm">
          <Link href={`/dashboard/crm/contacts/${c.id}`} className={cn('font-semibold hover:text-cyan-700 hover:underline', muted ? 'text-slate-500' : 'text-slate-900')}>
            {displayName(c)}
          </Link>
          {c.title && <span className="text-slate-500"> · {c.title}</span>}
        </li>
      ))}
    </ul>
  );
}

function BackLink() {
  return (
    <Link href="/dashboard/crm/contacts?tab=organizations" className={cn(ICON_BTN, 'inline-flex items-center gap-1.5 px-2 text-sm font-medium')}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Danh bạ tổ chức
    </Link>
  );
}
