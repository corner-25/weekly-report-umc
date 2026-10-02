'use client';

import Link from 'next/link';
import {
  Building2,
  CalendarDays,
  Gift,
  Handshake,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Stethoscope,
  Trash2,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { INTERACTION_TYPE_LABELS } from '@/lib/crm/constants';
import { displayName, formatDate } from './format';
import type { InteractionDTO, InteractionType } from './types';
import { ICON_BTN } from './ui';

export const INTERACTION_ICONS: Record<InteractionType, LucideIcon> = {
  VIP_ESCORT: Stethoscope,
  DELEGATION: Users,
  MEETING: Handshake,
  CALL: Phone,
  EMAIL: Mail,
  EVENT: CalendarDays,
  GIFT: Gift,
  OTHER: MessageSquare,
};

const TONES: Record<InteractionType, string> = {
  VIP_ESCORT: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  DELEGATION: 'bg-orange-50 text-orange-700 ring-orange-200',
  MEETING: 'bg-blue-50 text-blue-700 ring-blue-200',
  CALL: 'bg-slate-50 text-slate-600 ring-slate-200',
  EMAIL: 'bg-slate-50 text-slate-600 ring-slate-200',
  EVENT: 'bg-violet-50 text-violet-700 ring-violet-200',
  GIFT: 'bg-rose-50 text-rose-700 ring-rose-200',
  OTHER: 'bg-slate-50 text-slate-600 ring-slate-200',
};

interface InteractionTimelineProps {
  items: InteractionDTO[];
  /** Ẩn liên kết tới hồ sơ đang xem (vd. trên hồ sơ cá nhân thì không cần lặp tên người đó). */
  hideContactId?: string;
  hideOrganizationId?: string;
  onEdit?: (item: InteractionDTO) => void;
  onDelete?: (item: InteractionDTO) => void;
  compact?: boolean;
}

export function InteractionTimeline({ items, hideContactId, hideOrganizationId, onEdit, onDelete, compact = false }: InteractionTimelineProps) {
  return (
    <ol className="relative">
      {items.map((item, index) => (
        <TimelineItem
          key={item.id}
          item={item}
          isLast={index === items.length - 1}
          hideContactId={hideContactId}
          hideOrganizationId={hideOrganizationId}
          onEdit={onEdit}
          onDelete={onDelete}
          compact={compact}
        />
      ))}
    </ol>
  );
}

interface TimelineItemProps extends Omit<InteractionTimelineProps, 'items'> {
  item: InteractionDTO;
  isLast: boolean;
}

function TimelineItem({ item, isLast, hideContactId, hideOrganizationId, onEdit, onDelete, compact }: TimelineItemProps) {
  const Icon = INTERACTION_ICONS[item.type];
  const showContact = item.contact && item.contact.id !== hideContactId;
  const showOrganization = item.organization && item.organization.id !== hideOrganizationId;

  return (
    <li className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
      {!isLast && <span aria-hidden="true" className="absolute bottom-0 left-[17px] top-9 w-0.5 bg-slate-100" />}
      <span className={cn('relative z-[1] flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset', TONES[item.type])}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <article className="min-w-0">
        <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">
              <time dateTime={item.occurredAt} className="font-semibold tabular-nums text-slate-700">{formatDate(item.occurredAt, 'dd/MM/yyyy · HH:mm')}</time>
              <span className="mx-1.5 text-slate-300">|</span>
              {INTERACTION_TYPE_LABELS[item.type]}
            </p>
            {item.title && <h3 className="mt-0.5 text-sm font-semibold text-slate-900">{item.title}</h3>}
            {(showContact || showOrganization) && (
              <p className="mt-0.5 text-sm">
                {showContact && item.contact && (
                  <Link href={`/dashboard/crm/contacts/${item.contact.id}`} className="font-semibold text-slate-900 hover:text-cyan-700 hover:underline">
                    {displayName(item.contact)}
                  </Link>
                )}
                {showContact && showOrganization && <span className="text-slate-400"> · </span>}
                {showOrganization && item.organization && (
                  <Link href={`/dashboard/crm/organizations/${item.organization.id}`} className="font-medium text-slate-600 hover:text-cyan-700 hover:underline">
                    {item.organization.name}
                  </Link>
                )}
              </p>
            )}
          </div>
          {(onEdit || onDelete) && (
            <div className="-mr-1 flex shrink-0">
              {onEdit && (
                <button type="button" onClick={() => onEdit(item)} aria-label="Sửa tương tác" className={ICON_BTN}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onDelete && (
                <button type="button" onClick={() => onDelete(item)} aria-label="Xoá tương tác" className={cn(ICON_BTN, 'hover:bg-red-50 hover:text-red-600')}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </header>

        <p className={cn('mt-1 whitespace-pre-line text-sm text-slate-700', compact && 'line-clamp-2')}>{item.content}</p>

        {!compact && <InteractionMeta item={item} />}
      </article>
    </li>
  );
}

function InteractionMeta({ item }: { item: InteractionDTO }) {
  const team = [item.staffName, ...item.companions.filter((n) => n !== item.staffName)];
  return (
    <div className="mt-2 space-y-1.5 text-xs text-slate-500">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {item.destination && (
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden="true" />{item.destination}</span>
        )}
        {item.patientName && (
          <span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" aria-hidden="true" />Người khám: {item.patientName}</span>
        )}
        {item.guestCount && (
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" aria-hidden="true" />Đoàn {item.guestCount} người</span>
        )}
        {item.purpose && (
          <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" aria-hidden="true" />{item.purpose}</span>
        )}
      </div>
      {item.services.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Dịch vụ hỗ trợ">
          {item.services.map((s) => <li key={s} className="rounded-full bg-cyan-50 px-2 py-0.5 font-medium text-cyan-800">{s}</li>)}
        </ul>
      )}
      {item.participants.length > 0 && (
        <p>
          Thành viên:{' '}
          {item.participants.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <Link href={`/dashboard/crm/contacts/${p.id}`} className="font-medium text-slate-600 hover:text-cyan-700 hover:underline">{p.fullName}</Link>
            </span>
          ))}
        </p>
      )}
      <p>
        <span className="font-medium text-slate-600">{team[0]}</span>
        {team.length > 1 && <> · đi cùng {team.slice(1).join(', ')}</>}
      </p>
      {item.note && <p className="italic">Ghi chú: {item.note}</p>}
    </div>
  );
}
