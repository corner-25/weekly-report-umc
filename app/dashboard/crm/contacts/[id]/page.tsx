'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, MessagesSquare, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RELATION_KIND_LABELS } from '@/lib/crm/constants';
import { changeInteractionStatus, crmFetch, errorMessage } from '@/components/crm/api';
import { ContactModal } from '@/components/crm/ContactModal';
import { ContactInfoCard, PositionsCard, PreferencesCard, RelationsCard } from '@/components/crm/ContactProfileSections';
import { ImportantDateModal } from '@/components/crm/ImportantDateModal';
import { ImportantDatesPanel } from '@/components/crm/ImportantDatesPanel';
import { InteractionMenu } from '@/components/crm/InteractionMenu';
import { InteractionModal, interactionModeOf, type InteractionMode } from '@/components/crm/InteractionModal';
import { InteractionTimeline } from '@/components/crm/InteractionTimeline';
import { PositionModal } from '@/components/crm/PositionModal';
import { RelationModal } from '@/components/crm/RelationModal';
import { displayName, initials } from '@/components/crm/format';
import type { ContactDetail, ImportantDateDTO, InteractionDTO } from '@/components/crm/types';
import { EmptyState, ErrorBanner, ICON_BTN, PANEL, SECONDARY_BTN, SectionCard, TagPill, TierBadge } from '@/components/crm/ui';
import { useConfirmDelete } from '@/components/crm/useConfirmDelete';

type Dialog =
  | { kind: 'interaction'; mode: InteractionMode; initial?: InteractionDTO }
  | { kind: 'edit' }
  | { kind: 'date'; initial?: ImportantDateDTO }
  | { kind: 'position' }
  | { kind: 'relation' };

export default function ContactProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);
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
              <TierBadge tier={contact.tier} />
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
            onDelete={(p) => askDelete({
              title: 'Xoá chức vụ',
              message: `Xoá chức vụ “${p.title}”${p.organization ? ` tại ${p.organization.name}` : ''}?`,
              url: `/api/crm/positions/${p.id}`,
              onDone: load,
            })}
          />
        </div>

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
      {dialog?.kind === 'relation' && <RelationModal contactId={contact.id} onClose={() => setDialog(null)} onSaved={closeAndReload} />}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/dashboard/crm/contacts" className={cn(ICON_BTN, 'inline-flex items-center gap-1.5 px-2 text-sm font-medium')}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Danh bạ
    </Link>
  );
}
