'use client';

import { useState, type FormEvent } from 'react';
import { Select } from '@/components/ui/Select';
import { DATE_KIND_LABELS, GIFT_TYPE_LABELS, VIP_STAFF } from '@/lib/crm/constants';
import type { CareTaskFields, CareTaskInput } from '@/lib/crm/schemas';
import { CrmApiError, crmSend, errorMessage } from './api';
import { cleanText, formatDate, toInt, withCurrent } from './format';
import type { CareTaskDTO, DateKind, GiftType, UpcomingDTO } from './types';
import { ErrorBanner, Field, ModalFooter, ModalShell, inputClass } from './ui';

export type CareOwner = { contactId: string } | { organizationId: string };

/** Một lần diễn ra của một dịp — đã biết ngày dương lịch. */
export interface CareOccasion {
  owner: CareOwner;
  importantDateId: string | null;
  occasionKind: DateKind;
  occasionDate: string;
  label: string;
  targetName: string;
}

interface CareTaskModalProps {
  /** Sửa việc đã có. */
  initial?: CareTaskDTO | null;
  /** Dịp cố định (bấm "Lên kế hoạch" ở tổng quan). */
  occasion?: CareOccasion;
  /** Thêm từ hồ sơ: chọn trong các dịp sắp tới, hoặc tự ghi dịp khác. */
  owner?: CareOwner;
  occasions?: UpcomingDTO[];
  /** Sở thích, điều kiêng của đối tác — nhắc khi chọn quà. */
  giftHint?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const GIFT_TYPES = Object.keys(GIFT_TYPE_LABELS) as GiftType[];
const CUSTOM = 'custom';
/** Cột tiền là Int của Postgres. */
const MAX_MONEY = 2_000_000_000;

/** Ngày quan trọng có key `date:<id>`; sinh nhật lấy từ hồ sơ nên không có id. */
function importantDateIdOf(key: string): string | null {
  return key.startsWith('date:') ? key.slice('date:'.length) : null;
}

export function CareTaskModal({ initial, occasion, owner, occasions = [], giftHint, onClose, onSaved }: CareTaskModalProps) {
  const isOrganization = owner !== undefined && 'organizationId' in owner;
  const [pick, setPick] = useState(occasions[0]?.key ?? CUSTOM);
  const [customKind, setCustomKind] = useState<DateKind>('OTHER');
  const [customDate, setCustomDate] = useState('');
  const [giftType, setGiftType] = useState<GiftType>(initial?.giftType ?? 'FLOWERS');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [budget, setBudget] = useState(initial?.budget != null ? String(initial.budget) : '');
  const [actualCost, setActualCost] = useState(initial?.actualCost != null ? String(initial.actualCost) : '');
  const [assigneeName, setAssigneeName] = useState(initial?.assigneeName ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState('');
  const [saving, setSaving] = useState(false);

  const fixedOccasion = initial
    ? `${initial.occasionLabel} · ${formatDate(initial.occasionDate)}`
    : occasion
      ? `${occasion.label} · ${occasion.targetName} · ${formatDate(occasion.occasionDate)}`
      : null;

  const validate = () => {
    const next: Record<string, string> = {};
    if (!description.trim()) next.description = 'Ghi rõ quà/hoa sẽ tặng';
    for (const [key, value] of [['budget', budget], ['actualCost', actualCost]] as const) {
      const amount = toInt(value);
      if (value && (amount === undefined || amount < 0 || amount > MAX_MONEY)) next[key] = 'Số tiền không hợp lệ';
    }
    if (!fixedOccasion && pick === CUSTOM && !customDate) next.occasionDate = 'Chọn ngày của dịp';
    return next;
  };

  /** Dịp của việc mới: cố định từ tổng quan, hoặc theo lựa chọn trên hồ sơ. */
  const occasionBody = (): Pick<CareTaskInput, 'contactId' | 'organizationId' | 'importantDateId' | 'occasionKind' | 'occasionDate'> => {
    if (occasion) {
      return {
        ...occasion.owner,
        importantDateId: occasion.importantDateId ?? undefined,
        occasionKind: occasion.occasionKind,
        occasionDate: occasion.occasionDate,
      };
    }
    const chosen = occasions.find((o) => o.key === pick);
    if (chosen) {
      return {
        ...owner,
        importantDateId: importantDateIdOf(chosen.key) ?? undefined,
        occasionKind: chosen.kind,
        occasionDate: chosen.date,
      };
    }
    return { ...owner, occasionKind: customKind, occasionDate: customDate };
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const clientErrors = validate();
    setErrors(clientErrors);
    setBanner('');
    if (Object.keys(clientErrors).length) return;

    setSaving(true);
    try {
      const fields: CareTaskFields = {
        giftType,
        description: description.trim(),
        budget: toInt(budget),
        actualCost: toInt(actualCost),
        assigneeName: cleanText(assigneeName),
        note: cleanText(note),
      };
      if (initial) await crmSend(`/api/crm/care-tasks/${initial.id}`, 'PATCH', fields);
      else await crmSend('/api/crm/care-tasks', 'POST', { ...fields, ...occasionBody() });
      onSaved();
    } catch (error) {
      if (error instanceof CrmApiError && error.issues.length) setErrors(error.fieldErrors);
      setBanner(errorMessage(error, 'Không thể lưu kế hoạch quà, hoa.'));
    } finally {
      setSaving(false);
    }
  };

  const kinds = (Object.keys(DATE_KIND_LABELS) as DateKind[]).filter((k) => !(isOrganization && k === 'BIRTHDAY'));

  return (
    <ModalShell
      title={initial ? 'Sửa kế hoạch quà, hoa' : 'Lên kế hoạch quà, hoa'}
      subtitle="Đánh dấu “Đã trao” sẽ tự ghi lượt tặng quà vào dòng thời gian đối tác."
      onClose={onClose}
      size="md"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5 p-5 sm:p-6">
        <ErrorBanner message={banner} />

        {fixedOccasion ? (
          <p className="rounded-xl bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-800">{fixedOccasion}</p>
        ) : (
          <div className="space-y-3">
            <Field label="Dịp" required htmlFor="care-occasion" error={errors.occasionKind}>
              <Select id="care-occasion" value={pick} onChange={(e) => setPick(e.target.value)} className="px-3.5 py-2.5">
                {occasions.map((o) => (
                  <option key={o.key} value={o.key}>{`${o.label} · ${formatDate(o.date)}${o.isLunar ? ' (âm lịch)' : ''}`}</option>
                ))}
                <option value={CUSTOM}>Dịp khác, tự ghi ngày…</option>
              </Select>
            </Field>
            {pick === CUSTOM && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Loại dịp" htmlFor="care-kind">
                  <Select id="care-kind" value={customKind} onChange={(e) => setCustomKind(e.target.value as DateKind)} className="px-3.5 py-2.5">
                    {kinds.map((k) => <option key={k} value={k}>{DATE_KIND_LABELS[k]}</option>)}
                  </Select>
                </Field>
                <Field label="Ngày (dương lịch)" required error={errors.occasionDate}>
                  <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} className={inputClass(errors.occasionDate)} />
                </Field>
              </div>
            )}
          </div>
        )}

        <fieldset>
          <legend className="mb-1.5 block text-sm font-semibold text-slate-700">Hình thức</legend>
          <div className="flex flex-wrap gap-1.5">
            {GIFT_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={giftType === t}
                onClick={() => setGiftType(t)}
                className={giftType === t
                  ? 'rounded-full border border-cyan-600 bg-cyan-600 px-3 py-1.5 text-[13px] font-medium text-white shadow-sm'
                  : 'rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:border-cyan-400 hover:text-cyan-700'}
              >
                {GIFT_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </fieldset>

        <Field label="Quà, hoa sẽ tặng" required error={errors.description} hint={giftHint ?? undefined}>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass(errors.description, 'resize-none')} placeholder="Ví dụ: Lẵng hoa lan hồ điệp kèm thiệp của Ban Giám đốc" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dự kiến (đồng)" error={errors.budget}>
            <input type="number" inputMode="numeric" min={0} step={10000} value={budget} onChange={(e) => setBudget(e.target.value)} className={inputClass(errors.budget)} placeholder="1500000" />
          </Field>
          <Field label="Thực chi (đồng)" error={errors.actualCost} hint="Ghi khi đã thanh toán.">
            <input type="number" inputMode="numeric" min={0} step={10000} value={actualCost} onChange={(e) => setActualCost(e.target.value)} className={inputClass(errors.actualCost)} />
          </Field>
        </div>

        <Field label="Nhân viên lo việc" htmlFor="care-assignee" error={errors.assigneeName}>
          <Select id="care-assignee" value={assigneeName} onChange={(e) => setAssigneeName(e.target.value)} className="px-3.5 py-2.5">
            <option value="">Chưa giao</option>
            {withCurrent(VIP_STAFF, assigneeName).map((name) => <option key={name} value={name}>{name}</option>)}
          </Select>
        </Field>

        <Field label="Ghi chú" error={errors.note}>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass(errors.note, 'resize-none')} placeholder="Nơi đặt, người nhận thay, lời chúc…" />
        </Field>

        <ModalFooter onCancel={onClose} saving={saving} submitLabel={initial ? 'Lưu thay đổi' : 'Lưu kế hoạch'} />
      </form>
    </ModalShell>
  );
}
