'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Building2,
  CalendarDays,
  Check,
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
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { INTERACTION_STATUS_LABELS, INTERACTION_TYPE_LABELS } from '@/lib/crm/constants';
import { PhotoStrip } from './CrmPhotos';
import { displayName, formatDate } from './format';
import type { InteractionDTO, InteractionStatus, InteractionType } from './types';
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

const STATUS_TONES: Record<InteractionStatus, string> = {
  PLANNED: 'bg-amber-100 text-amber-800',
  DONE: 'bg-emerald-100 text-emerald-800',
  POSTPONED: 'bg-violet-100 text-violet-800',
  CANCELLED: 'bg-slate-100 text-slate-500 line-through',
};

/** Ngày giờ hiện trên dòng thời gian: khoảng ngày với đoàn nhiều ngày, giờ như ghi nhận, "chưa rõ ngày". */
function whenLabel(item: InteractionDTO): string {
  if (item.dateUnknown) return `Chưa rõ ngày (${formatDate(item.occurredAt, 'yyyy')})`;
  const start = formatDate(item.occurredAt, 'dd/MM/yyyy');
  const range = item.endAt ? `${start} – ${formatDate(item.endAt, 'dd/MM/yyyy')}` : start;
  const time = item.timeText ?? (formatDate(item.occurredAt, 'HH:mm') === '00:00' ? null : formatDate(item.occurredAt, 'HH:mm'));
  return time ? `${range} · ${time}` : range;
}

const money = (v: number) => `${v.toLocaleString('vi-VN')} đ`;

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
  onStatusChange?: (item: InteractionDTO, status: InteractionStatus) => void;
  /** Khi hiển thị trên hồ sơ của Người giới thiệu/Bác sĩ/VIP liên quan, làm rõ vai trò để tránh hiểu nhầm. */
  linkedRole?: { targetId: string; targetName: string };
  compact?: boolean;
}

export function InteractionTimeline({ items, hideContactId, hideOrganizationId, onEdit, onDelete, onStatusChange, linkedRole, compact = false }: InteractionTimelineProps) {
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
          onStatusChange={onStatusChange}
          linkedRole={linkedRole}
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

function TimelineItem({ item, isLast, hideContactId, hideOrganizationId, onEdit, onDelete, onStatusChange, linkedRole, compact }: TimelineItemProps) {
  const Icon = INTERACTION_ICONS[item.type];
  const { data: session } = useSession();
  // Khớp quy tắc phía API: quản trị viên hoặc người đã ghi lượt này mới sửa/xoá được.
  const canModify = session?.user.role === 'ADMIN' || (item.createdById !== null && item.createdById === session?.user.id);
  const editHandler = canModify ? onEdit : undefined;
  const deleteHandler = canModify ? onDelete : undefined;
  const showContact = item.contact && (Boolean(linkedRole) || item.contact.id !== hideContactId);
  const showOrganization = item.organization && item.organization.id !== hideOrganizationId;

  const isReferrerOfThis = Boolean(linkedRole && item.referrerContact?.id === linkedRole.targetId);
  const isDoctorOfThis = Boolean(linkedRole && item.doctors?.some((d) => d.id === linkedRole.targetId));
  const isVipOfThis = Boolean(linkedRole && item.relatedVipContact?.id === linkedRole.targetId);

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
              <time dateTime={item.occurredAt} className="font-semibold tabular-nums text-slate-700">{whenLabel(item)}</time>
              <span className="mx-1.5 text-slate-300">|</span>
              {linkedRole ? (
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  {isReferrerOfThis && (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-bold text-indigo-800">Do sếp giới thiệu</span>
                  )}
                  {isDoctorOfThis && (
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 font-bold text-teal-800">BS phụ trách khám</span>
                  )}
                  {isVipOfThis && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-800">{item.vipRelationship || 'Người thân'} của VIP</span>
                  )}
                  {!isReferrerOfThis && !isDoctorOfThis && !isVipOfThis && (
                    <span>Lượt khám liên quan</span>
                  )}
                </span>
              ) : (
                <span>{INTERACTION_TYPE_LABELS[item.type]}</span>
              )}
              {item.status !== 'DONE' && (
                <span className={cn('ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_TONES[item.status])}>
                  {INTERACTION_STATUS_LABELS[item.status]}
                </span>
              )}
              {item.needsReview && (
                <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800" title={item.reviewNote ?? undefined}>
                  Cần xác minh
                </span>
              )}
            </p>
            {item.title && <h3 className="mt-0.5 text-sm font-semibold text-slate-900">{item.title}</h3>}
            {(showContact || showOrganization) && (
              <p className="mt-0.5 text-sm">
                {showContact && item.contact && (
                  <span>
                    {linkedRole && <span className="text-xs font-medium text-slate-500">Khách được khám: </span>}
                    <Link href={`/dashboard/crm/contacts/${item.contact.id}`} className="font-semibold text-slate-900 hover:text-cyan-700 hover:underline">
                      {displayName(item.contact)}
                    </Link>
                  </span>
                )}
                {showContact && showOrganization && <span className="text-slate-400"> · </span>}
                {showOrganization && item.organization && (
                  <Link href={`/dashboard/crm/organizations/${item.organization.id}`} className="font-medium text-slate-600 hover:text-cyan-700 hover:underline">
                    {item.organization.name}
                  </Link>
                )}
              </p>
            )}
            {(item.followUpDate || item.followUp) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-teal-200/90 bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800 shadow-2xs">
                  <Stethoscope className="h-3.5 w-3.5 text-teal-600 shrink-0" aria-hidden="true" />
                  <span>
                    Hẹn tái khám: {item.followUpDate ? formatDate(item.followUpDate, 'dd/MM/yyyy') : 'Có dặn dò'}
                  </span>
                  {item.followUp && (
                    <span className="font-medium text-teal-700">· {item.followUp}</span>
                  )}
                </span>
              </div>
            )}
          </div>
          {(editHandler || deleteHandler || (onStatusChange && item.status === 'PLANNED')) && (
            <div className="-mr-1 flex shrink-0 items-center gap-1">
              {onStatusChange && item.status === 'PLANNED' && (
                <>
                  <button type="button" onClick={() => onStatusChange(item, 'DONE')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> Đã xong
                  </button>
                  <button type="button" onClick={() => onStatusChange(item, 'CANCELLED')} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">
                    <X className="h-3.5 w-3.5" aria-hidden="true" /> Huỷ
                  </button>
                </>
              )}
              {editHandler && (
                <button type="button" onClick={() => editHandler(item)} aria-label="Sửa tương tác" className={ICON_BTN}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {deleteHandler && (
                <button type="button" onClick={() => deleteHandler(item)} aria-label="Xoá tương tác" className={cn(ICON_BTN, 'hover:bg-red-50 hover:text-red-600')}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </header>

        <p className={cn('mt-1 whitespace-pre-line text-sm text-slate-700', compact && 'line-clamp-2')}>{item.content}</p>

        <PhotoStrip photos={item.photos} className="mt-2" />

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
          <span className="inline-flex items-center gap-1" title={item.purposeInferred ? 'Hình thức suy ra từ nội dung, sổ gốc không ghi' : undefined}>
            <Building2 className="h-3 w-3" aria-hidden="true" />{item.purpose}{item.purposeInferred && '*'}
          </span>
        )}
        {item.hostUnit && <span>Chủ trì: <b className="font-semibold text-slate-700">{item.hostUnit}</b></span>}
        {item.visitKind && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">{item.visitKind}</span>}
        {item.relatedVipContact && <span>Quan hệ: <b>{item.vipRelationship}</b> của <Link href={`/dashboard/crm/contacts/${item.relatedVipContact.id}`} className="text-cyan-700 hover:underline">{item.relatedVipContact.fullName}</Link></span>}
        {Boolean(item.doctors?.length) && <span>Bác sĩ: {item.doctors!.map(d => d.fullName).join(', ')}</span>}
        {item.referrer && <span>Giới thiệu: <b className="font-semibold text-slate-700">{item.referrer}</b></span>}
        {item.incomingDocNo && <span>Văn bản đến: {item.incomingDocNo}</span>}
      </div>
      {item.topics.length > 0 && (
        <ul className="flex flex-wrap gap-1" aria-label="Chủ đề làm việc">
          {item.topics.map((t) => <li key={t} className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-800">{t}</li>)}
        </ul>
      )}
      {item.coOrganizations.length > 0 && <p>Đi cùng: {item.coOrganizations.join('; ')}</p>}
      {item.hospitalAttendees && <p><span className="font-medium text-slate-600">Bệnh viện tiếp:</span> {item.hospitalAttendees}</p>}
      {item.guestMembers && <p><span className="font-medium text-slate-600">Thành phần đoàn:</span> {item.guestMembers}</p>}
      {(item.giftsGiven || item.giftsReceived || item.cashReceived || item.giftBudget || item.giftActualCost) && (
        <div className="rounded-lg bg-rose-50/50 px-2.5 py-1.5">
          {item.giftsGiven && <p><Gift className="mr-1 inline h-3 w-3 text-rose-500" aria-hidden="true" />Bệnh viện tặng: {item.giftsGiven}</p>}
          {item.giftsReceived && <p><Gift className="mr-1 inline h-3 w-3 text-emerald-600" aria-hidden="true" />Khách tặng: {item.giftsReceived}</p>}
          {item.cashReceived != null && <p>Tiền mặt khách tặng: <b className="text-emerald-700">{money(item.cashReceived)}</b></p>}
          {(item.giftBudget != null || item.giftActualCost != null) && (
            <p>
              Kinh phí quà: {item.giftBudget != null && <>dự trù <b className="text-slate-700">{money(item.giftBudget)}</b></>}
              {item.giftBudget != null && item.giftActualCost != null && ' · '}
              {item.giftActualCost != null && <>thực chi <b className="text-slate-700">{money(item.giftActualCost)}</b></>}
            </p>
          )}
        </div>
      )}
      {item.visitItems && item.visitItems.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-cyan-50/40 px-2.5 py-1.5" aria-label="Chuyên khoa đã khám">
          {item.visitItems.map((v, idx) => (
            <li key={idx}>
              <b className="font-semibold text-slate-700">{v.specialty ?? 'Khám'}</b>
              {v.doctor && <> · BS {v.doctor}</>}
              {v.followUp && (v.followUp.date || v.followUp.text) && (
                <> · hẹn: {v.followUp.date ? v.followUp.date.split('-').reverse().join('/') : v.followUp.text}</>
              )}
              {v.diagnosis && <span className="block text-slate-600">Chẩn đoán: {v.diagnosis}</span>}
            </li>
          ))}
        </ul>
      )}
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
      {team[0] && (
        <p>
          <span className="font-medium text-slate-600">{team[0]}</span>
          {team.length > 1 && <> · đi cùng {team.slice(1).join(', ')}</>}
        </p>
      )}
      {item.note && <p className="whitespace-pre-line italic">Ghi chú: {item.note}</p>}
      {item.needsReview && item.reviewNote && <p className="text-orange-700">Cần xác minh: {item.reviewNote}</p>}
      {item.externalCode && <p className="text-[11px] text-slate-400">Sổ tiếp đoàn {item.externalCode}{item.sourceRef && ` · ${item.sourceRef}`}</p>}
    </div>
  );
}
