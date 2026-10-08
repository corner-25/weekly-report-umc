'use client';

import Link from 'next/link';
import { Briefcase, HeartHandshake, Lock, Phone, Plus, Sparkles, Star, StarOff, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONTACT_STATUS_LABELS, RELATION_KIND_LABELS } from '@/lib/crm/constants';
import { formatDate } from './format';
import type { ContactDetail, PositionDTO, RelationDTO } from './types';
import { ICON_BTN, SectionCard, SmallAction } from './ui';

function KeyValue({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  const visible = rows.filter(([, value]) => value !== null && value !== undefined && value !== '');
  if (visible.length === 0) return <p className="text-sm text-slate-500">Chưa có thông tin.</p>;
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
      {visible.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-slate-500">{label}</dt>
          <dd className="min-w-0 break-words text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ContactInfoCard({ contact }: { contact: ContactDetail }) {
  return (
    <SectionCard title="Liên hệ" icon={<Phone className="h-4 w-4 text-cyan-600" aria-hidden="true" />}>
      <KeyValue
        rows={[
          ['Điện thoại', contact.phone && <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="text-cyan-700 hover:underline">{contact.phone}</a>],
          ['Email', contact.email && <a href={`mailto:${contact.email}`} className="text-cyan-700 hover:underline">{contact.email}</a>],
          ['Địa chỉ', contact.address],
          ['Mã hồ sơ bệnh án', contact.patientCode && <span className="tabular-nums">{contact.patientCode}</span>],
          ['Nhận quà tại', contact.giftAddress],
          ['Giới tính', contact.gender],
          ['Trạng thái', CONTACT_STATUS_LABELS[contact.status]],
          ['Nguồn', contact.source],
          ['Ghi chú', contact.note && <span className="whitespace-pre-line">{contact.note}</span>],
        ]}
      />
    </SectionCard>
  );
}

export function PreferencesCard({ contact }: { contact: ContactDetail }) {
  const prefs = contact.preferences ?? {};
  const hasSensitive = 'sensitiveNote' in contact;
  return (
    <SectionCard title="Sở thích & lưu ý" icon={<Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />}>
      <KeyValue
        rows={[
          ['Hoa yêu thích', prefs.flowers],
          ['Kiêng kỵ', prefs.avoid],
          ['Món ăn', prefs.food],
          ['Sở thích', prefs.hobbies],
        ]}
      />
      {hasSensitive && (
        <div className="mt-3 rounded-xl border border-dashed border-red-200 bg-red-50/40 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-red-600">
            <Lock className="h-3 w-3" aria-hidden="true" /> Lưu ý nhạy cảm
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{contact.sensitiveNote || <span className="text-slate-400">Chưa ghi.</span>}</p>
          <p className="mt-1.5 text-[11px] text-slate-500">Chỉ người phụ trách và quản trị thấy.</p>
        </div>
      )}
    </SectionCard>
  );
}

export function RelationsCard({ relations, onAdd, onDelete }: { relations: RelationDTO[]; onAdd: () => void; onDelete: (r: RelationDTO) => void }) {
  return (
    <SectionCard
      title="Người thân & trợ lý"
      icon={<HeartHandshake className="h-4 w-4 text-rose-500" aria-hidden="true" />}
      action={<SmallAction onClick={onAdd}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Thêm</SmallAction>}
    >
      {relations.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có. Thêm thư ký, trợ lý để biết ai nhận quà thay, ai đặt lịch.</p>
      ) : (
        <ul className="divide-y divide-dashed divide-slate-200">
          {relations.map((r) => {
            const name = r.toContact?.fullName ?? r.name ?? '—';
            return (
              <li key={r.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 text-sm">
                  <p>
                    {r.toContact ? (
                      <Link href={`/dashboard/crm/contacts/${r.toContact.id}`} className="font-semibold text-slate-900 hover:text-cyan-700 hover:underline">{name}</Link>
                    ) : (
                      <span className="font-semibold text-slate-900">{name}</span>
                    )}
                    <span className="text-slate-500"> · {RELATION_KIND_LABELS[r.kind].toLocaleLowerCase('vi')}</span>
                  </p>
                  {r.phone && <a href={`tel:${r.phone.replace(/\s+/g, '')}`} className="text-xs text-cyan-700 hover:underline">{r.phone}</a>}
                  {r.note && <p className="text-xs text-slate-500">{r.note}</p>}
                </div>
                <button type="button" onClick={() => onDelete(r)} aria-label={`Xoá ${name}`} className={cn(ICON_BTN, '-mr-1 hover:bg-red-50 hover:text-red-600')}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

function period(p: PositionDTO): string {
  const from = p.fromDate ? formatDate(p.fromDate, 'MM/yyyy') : '?';
  if (p.isCurrent) return `${from} → nay`;
  const to = p.toDate ? formatDate(p.toDate, 'MM/yyyy') : '?';
  return `${from} → ${to}`;
}

export function PositionsCard({
  positions,
  onAdd,
  onDelete,
  onToggleFocal,
}: {
  positions: PositionDTO[];
  onAdd: () => void;
  onDelete: (p: PositionDTO) => void;
  onToggleFocal?: (p: PositionDTO, isFocalPoint: boolean) => void;
}) {
  const sorted = [...positions].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || (b.fromDate ?? '').localeCompare(a.fromDate ?? ''));
  return (
    <SectionCard
      title="Chức vụ qua các thời kỳ"
      icon={<Briefcase className="h-4 w-4 text-blue-600" aria-hidden="true" />}
      action={<SmallAction onClick={onAdd}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Thêm</SmallAction>}
    >
      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có chức vụ nào.</p>
      ) : (
        <ul className="divide-y divide-dashed divide-slate-200">
          {sorted.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-slate-900">
                  {p.title}
                  {p.isCurrent && <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">hiện tại</span>}
                  {p.isFocalPoint && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">đầu mối liên hệ</span>}
                </p>
                <p className="text-slate-600">
                  {p.department && `${p.department}, `}
                  {p.organization ? (
                    <Link href={`/dashboard/crm/organizations/${p.organization.id}`} className="hover:text-cyan-700 hover:underline">{p.organization.name}</Link>
                  ) : '—'}
                </p>
                <p className="text-xs tabular-nums text-slate-500">{period(p)}</p>
              </div>
              {onToggleFocal && p.isCurrent && p.organization && (
                <button
                  type="button"
                  onClick={() => onToggleFocal(p, !p.isFocalPoint)}
                  className={cn(ICON_BTN, p.isFocalPoint ? 'text-amber-500' : '')}
                  title={p.isFocalPoint ? 'Bỏ đầu mối của đơn vị này' : 'Đặt làm đầu mối của đơn vị này'}
                >
                  {p.isFocalPoint ? <StarOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Star className="h-3.5 w-3.5" aria-hidden="true" />}
                  <span className="sr-only">{p.isFocalPoint ? 'Bỏ đầu mối' : 'Đặt làm đầu mối'}</span>
                </button>
              )}
              <button type="button" onClick={() => onDelete(p)} aria-label={`Xoá chức vụ ${p.title}`} className={cn(ICON_BTN, '-mr-1 hover:bg-red-50 hover:text-red-600')}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
