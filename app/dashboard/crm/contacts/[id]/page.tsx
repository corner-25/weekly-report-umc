'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, Merge, MessagesSquare, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RELATION_KIND_LABELS } from '@/lib/crm/constants';
import { changeCareTaskStatus, changeInteractionStatus, crmFetch, crmSend, errorMessage } from '@/components/crm/api';
import { CareTaskModal } from '@/components/crm/CareTaskModal';
import { CareTasksPanel } from '@/components/crm/CareTasksPanel';
import { ContactModal } from '@/components/crm/ContactModal';
import { ContactInfoCard, PositionsCard, PreferencesCard, RelationsCard } from '@/components/crm/ContactProfileSections';
import { ImportantDateModal } from '@/components/crm/ImportantDateModal';
import { ImportantDatesPanel } from '@/components/crm/ImportantDatesPanel';
import { InteractionMenu } from '@/components/crm/InteractionMenu';
import { InteractionModal, interactionModeOf, type InteractionMode } from '@/components/crm/InteractionModal';
import { InteractionTimeline } from '@/components/crm/InteractionTimeline';
import { PositionModal } from '@/components/crm/PositionModal';
import { RelationModal } from '@/components/crm/RelationModal';
import { MergeContactModal } from '@/components/crm/MergeContactModal';
import { displayName, initials } from '@/components/crm/format';
import type { CareTaskDTO, ContactDetail, ImportantDateDTO, InteractionDTO } from '@/components/crm/types';
import { EmptyState, ErrorBanner, ICON_BTN, PANEL, SECONDARY_BTN, SectionCard, TagPill, TierBadge } from '@/components/crm/ui';
import { useConfirmDelete } from '@/components/crm/useConfirmDelete';

type Dialog =
  | { kind: 'interaction'; mode: InteractionMode; initial?: InteractionDTO }
  | { kind: 'edit' }
  | { kind: 'date'; initial?: ImportantDateDTO }
  | { kind: 'position' }
  | { kind: 'relation' }
  | { kind: 'merge' }
  | { kind: 'care'; initial?: CareTaskDTO };

export default function ContactProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [visitRoleTab, setVisitRoleTab] = useState<'referred' | 'doctor' | 'vip' | 'all'>('referred');
  const { askDelete, deleteDialog } = useConfirmDelete(setError);

  const load = useCallback(async () => {
    setError('');
    try {
      setContact(await crmFetch<ContactDetail>(`/api/crm/contacts/${id}`));
      setNotFound(false);
    } catch (loadError) {
      const status = (loadError as { status?: number }).status;
      if (status === 404) setNotFound(true);
      else setError(errorMessage(loadError, 'Không thể tải hồ sơ.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!contact) return;
    if (contact.referredVisits && contact.referredVisits.length > 0) setVisitRoleTab('referred');
    else if (contact.doctorVisits && contact.doctorVisits.length > 0) setVisitRoleTab('doctor');
    else if (contact.relatedVipVisits && contact.relatedVipVisits.length > 0) setVisitRoleTab('vip');
    else setVisitRoleTab('all');
  }, [contact?.id]);

  const activeVisitItems = useMemo(() => {
    if (!contact) return [];
    if (visitRoleTab === 'referred' && contact.referredVisits?.length) return contact.referredVisits;
    if (visitRoleTab === 'doctor' && contact.doctorVisits?.length) return contact.doctorVisits;
    if (visitRoleTab === 'vip' && contact.relatedVipVisits?.length) return contact.relatedVipVisits;
    return contact.linkedVisits ?? [];
  }, [contact, visitRoleTab]);

  const closeAndReload = () => {
    setDialog(null);
    load();
  };

  if (loading) return <p className="p-12 text-center text-slate-500">Đang tải hồ sơ...</p>;
  if (notFound || !contact) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorBanner message={error} />
        {notFound && <EmptyState title="Không tìm thấy hồ sơ" hint="Hồ sơ có thể đã bị xoá." />}
      </div>
    );
  }

  const name = displayName(contact);
  const current = contact.positions.filter((p) => p.isCurrent);
  const primaryOrganization = current.find((p) => p.organization)?.organization ?? null;

  const roleVisitCount = [
    Boolean(contact.referredVisits?.length),
    Boolean(contact.doctorVisits?.length),
    Boolean(contact.relatedVipVisits?.length),
  ].filter(Boolean).length;
  const multiRoleVisits = roleVisitCount > 1;
  const hasLinked = Boolean(contact.linkedVisits?.length || activeVisitItems.length);

  return (
    <div className="space-y-5">
      <BackLink />
      <ErrorBanner message={error} />

      <header className={cn(PANEL, 'grid gap-4 p-4 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center sm:p-5')}>
        <div className="flex items-center gap-4 sm:contents">
          <div aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 text-lg font-extrabold text-blue-700 sm:h-[72px] sm:w-[72px] sm:text-xl">
            {initials(contact.fullName)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{name}</h1>
              <TierBadge tier={contact.tier} partner />
              {contact.status === 'INACTIVE' && <span className="text-xs font-medium text-slate-400">Ngừng quan hệ</span>}
            </div>
            <p className="mt-0.5 text-sm text-slate-600">
              {contact.salutation && <span>Xưng hô: <b className="font-semibold">{contact.salutation}</b></span>}
              {contact.salutation && current.length > 0 && <span className="text-slate-300"> · </span>}
              {current.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && '; '}
                  {p.title}
                  {p.organization && (
                    <> @ <Link href={`/dashboard/crm/organizations/${p.organization.id}`} className="font-medium text-cyan-700 hover:underline">{p.organization.name}</Link></>
                  )}
                </span>
              ))}
            </p>
            {/* Vai trò tập trung: Lãnh đạo, Bác sĩ, Người giới thiệu, Khách VIP */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {contact.tags.some((t) => ['Ban Giám đốc', 'Lãnh đạo Bệnh viện'].includes(t)) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-800 ring-1 ring-inset ring-purple-600/20">
                  🏛️ Lãnh đạo Bệnh viện
                </span>
              )}
              {Boolean(contact.totalDoctorVisits || contact.tags.includes('Bác sĩ')) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-800 ring-1 ring-inset ring-teal-600/20">
                  🩺 Bác sĩ khám bệnh {Boolean(contact.totalDoctorVisits) && `(${contact.totalDoctorVisits} ca)`}
                </span>
              )}
              {Boolean(contact.totalReferredVisits || contact.tags.includes('Người giới thiệu')) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-800 ring-1 ring-inset ring-indigo-600/20">
                  🤝 Người giới thiệu {Boolean(contact.totalReferredVisits) && `(${contact.totalReferredVisits} ca khách)`}
                </span>
              )}
              {contact.tier === 'VIP' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-600/20">
                  ⭐ Khách VIP
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              {contact.tags.map((t) => <TagPill key={t}>{t}</TagPill>)}
              <span>Phụ trách: <b className="font-semibold text-slate-700">{contact.ownerName ?? 'chưa giao'}</b></span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <InteractionMenu onPick={(mode) => setDialog({ kind: 'interaction', mode })} />
          <button type="button" onClick={() => setDialog({ kind: 'edit' })} className={SECONDARY_BTN}>
            <Pencil className="h-4 w-4" aria-hidden="true" /> Sửa
          </button>
          <button type="button" onClick={() => setDialog({ kind: 'merge' })} className={SECONDARY_BTN}>
            <Merge className="h-4 w-4" aria-hidden="true" /> Gộp trùng
          </button>
          <button
            type="button"
            aria-label="Xoá hồ sơ"
            onClick={() => askDelete({
              title: 'Xoá hồ sơ cá nhân',
              message: `Xoá hồ sơ “${name}” cùng chức vụ, người thân và ngày quan trọng?`,
              url: `/api/crm/contacts/${contact.id}`,
              onDone: () => router.push('/dashboard/crm/contacts'),
            })}
            className={cn(SECONDARY_BTN, 'px-3 hover:border-red-300 hover:text-red-600')}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> <span className="sm:sr-only">Xoá</span>
          </button>
        </div>
      </header>

      {hasLinked && (
        <SectionCard
          title={
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900">
                {!multiRoleVisits && visitRoleTab === 'referred'
                  ? `Khách do ${name} giới thiệu (${contact.totalReferredVisits ?? contact.referredVisits?.length ?? 0} lượt)`
                  : !multiRoleVisits && visitRoleTab === 'doctor'
                  ? `Lượt khám BS ${name} phụ trách chuyên môn (${contact.totalDoctorVisits ?? contact.doctorVisits?.length ?? 0} lượt)`
                  : !multiRoleVisits && visitRoleTab === 'vip'
                  ? `Người thân / quan hệ VIP (${contact.totalRelatedVipVisits ?? contact.relatedVipVisits?.length ?? 0} lượt)`
                  : 'Lượt khám & tiếp đón liên quan'}
              </span>
              {multiRoleVisits && (
                <div role="tablist" aria-label="Lọc theo vai trò" className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                  {contact.referredVisits && contact.referredVisits.length > 0 && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={visitRoleTab === 'referred'}
                      onClick={() => setVisitRoleTab('referred')}
                      className={cn(
                        'rounded-md px-2.5 py-1 transition',
                        visitRoleTab === 'referred' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900',
                      )}
                    >
                      Khách giới thiệu ({contact.totalReferredVisits ?? contact.referredVisits.length})
                    </button>
                  )}
                  {contact.doctorVisits && contact.doctorVisits.length > 0 && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={visitRoleTab === 'doctor'}
                      onClick={() => setVisitRoleTab('doctor')}
                      className={cn(
                        'rounded-md px-2.5 py-1 transition',
                        visitRoleTab === 'doctor' ? 'bg-white text-teal-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900',
                      )}
                    >
                      BS phụ trách ({contact.totalDoctorVisits ?? contact.doctorVisits.length})
                    </button>
                  )}
                  {contact.relatedVipVisits && contact.relatedVipVisits.length > 0 && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={visitRoleTab === 'vip'}
                      onClick={() => setVisitRoleTab('vip')}
                      className={cn(
                        'rounded-md px-2.5 py-1 transition',
                        visitRoleTab === 'vip' ? 'bg-white text-amber-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900',
                      )}
                    >
                      Người thân VIP ({contact.totalRelatedVipVisits ?? contact.relatedVipVisits.length})
                    </button>
                  )}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={visitRoleTab === 'all'}
                    onClick={() => setVisitRoleTab('all')}
                    className={cn(
                      'rounded-md px-2.5 py-1 transition',
                      visitRoleTab === 'all' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900',
                    )}
                  >
                    Tất cả ({contact.linkedVisits?.length ?? 0})
                  </button>
                </div>
              )}
            </div>
          }
          action={<span className="text-xs font-medium text-slate-500">Phòng Hành chính hỗ trợ tiếp đón & dẫn khám</span>}
        >
          <InteractionTimeline items={activeVisitItems} linkedRole={{ targetId: contact.id, targetName: name }} compact />
        </SectionCard>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="grid gap-4">
          <ContactInfoCard contact={contact} />
          <ImportantDatesPanel
            dates={contact.importantDates}
            upcoming={contact.upcoming}
            birth={{ day: contact.birthDay, month: contact.birthMonth, year: contact.birthYear, isLunar: contact.birthIsLunar }}
            onAdd={() => setDialog({ kind: 'date' })}
            onEdit={(d) => setDialog({ kind: 'date', initial: d })}
            onDelete={(d) => askDelete({
              title: 'Xoá ngày quan trọng',
              message: 'Xoá ngày này khỏi hồ sơ? Các nhắc nhở theo ngày này cũng dừng.',
              url: `/api/crm/important-dates/${d.id}`,
              onDone: load,
            })}
          />
          <CareTasksPanel
            tasks={contact.careTasks}
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
          <PreferencesCard contact={contact} />
          <RelationsCard
            relations={contact.relations}
            onAdd={() => setDialog({ kind: 'relation' })}
            onDelete={(r) => askDelete({
              title: 'Xoá người thân, trợ lý',
              message: `Bỏ liên kết ${RELATION_KIND_LABELS[r.kind].toLocaleLowerCase('vi')} “${r.toContact?.fullName ?? r.name ?? ''}”?`,
              url: `/api/crm/relations/${r.id}`,
              onDone: load,
            })}
          />
          <PositionsCard
            positions={contact.positions}
            onAdd={() => setDialog({ kind: 'position' })}
            onToggleFocal={(p, isFocalPoint) => {
              crmSend(`/api/crm/positions/${p.id}`, 'PATCH', { isFocalPoint }).then(() => load()).catch((e) => setError(errorMessage(e)));
            }}
            onDelete={(p) => askDelete({
              title: 'Xoá chức vụ',
              message: `Xoá chức vụ “${p.title}”${p.organization ? ` tại ${p.organization.name}` : ''}?`,
              url: `/api/crm/positions/${p.id}`,
              onDone: load,
            })}
          />
        </div>

        <div className="grid gap-4">
        <SectionCard title="Dòng thời gian tương tác" icon={<MessagesSquare className="h-4 w-4 text-cyan-600" aria-hidden="true" />} action={<span className="text-xs text-slate-500">{contact.interactions.length} lượt</span>}>
          {contact.interactions.length === 0 ? (
            <EmptyState title="Chưa có tương tác" hint="Dùng “Ghi tương tác” để ghi lượt dẫn khám, gặp mặt, gọi điện…" />
          ) : (
            <InteractionTimeline
              items={contact.interactions}
              hideContactId={contact.id}
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
        {contact.orgActivity.length > 0 && (
          <SectionCard
            title="Hoạt động gần đây của đơn vị"
            icon={<Building2 className="h-4 w-4 text-brand-600" aria-hidden="true" />}
            action={<span className="text-xs text-slate-500">đoàn, tương tác với đơn vị</span>}
          >
            <InteractionTimeline items={contact.orgActivity} compact />
          </SectionCard>
        )}
        </div>
      </div>

      {deleteDialog}

      {dialog?.kind === 'interaction' && (
        <InteractionModal
          mode={dialog.mode}
          initial={dialog.initial}
          preset={{
            contactId: contact.id,
            contactName: name,
            organizationId: primaryOrganization?.id,
            organizationName: primaryOrganization?.name,
          }}
          onClose={() => setDialog(null)}
          onSaved={closeAndReload}
        />
      )}
      {dialog?.kind === 'edit' && <ContactModal initial={contact} onClose={() => setDialog(null)} onSaved={closeAndReload} />}
      {dialog?.kind === 'date' && <ImportantDateModal owner={{ contactId: contact.id }} initial={dialog.initial} onClose={() => setDialog(null)} onSaved={closeAndReload} />}
      {dialog?.kind === 'position' && <PositionModal contactId={contact.id} onClose={() => setDialog(null)} onSaved={closeAndReload} />}
      {dialog?.kind === 'merge' && <MergeContactModal contactId={contact.id} contactName={name} onClose={() => setDialog(null)} onSaved={closeAndReload} />}
      {dialog?.kind === 'care' && (
        <CareTaskModal
          initial={dialog.initial}
          owner={{ contactId: contact.id }}
          occasions={contact.upcoming}
          giftHint={giftHint(contact)}
          onClose={() => setDialog(null)}
          onSaved={closeAndReload}
        />
      )}
      {dialog?.kind === 'relation' && <RelationModal contactId={contact.id} onClose={() => setDialog(null)} onSaved={closeAndReload} />}
    </div>
  );
}

/** Sở thích hoa và điều kiêng — nhắc ngay dưới ô chọn quà. */
function giftHint(contact: ContactDetail): string | null {
  const p = contact.preferences;
  const parts = [p?.flowers && `Thích: ${p.flowers}`, p?.avoid && `Kiêng: ${p.avoid}`].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function BackLink() {
  return (
    <Link href="/dashboard/crm/contacts" className={cn(ICON_BTN, 'inline-flex items-center gap-1.5 px-2 text-sm font-medium')}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Danh bạ
    </Link>
  );
}
