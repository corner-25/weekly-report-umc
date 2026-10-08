'use client';

import { useMemo, useState, useRef, type FormEvent } from 'react';
import { CalendarCheck, Stethoscope, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/Select';
import { DELEGATION_PURPOSES, ESCORT_SERVICES, INTERACTION_TYPE_LABELS, VIP_STAFF, INTERACTION_STATUS_LABELS } from '@/lib/crm/constants';
import type { InteractionInput } from '@/lib/crm/schemas';
import { CrmApiError, crmFetch, crmSend, errorMessage, syncCrmPhotos } from './api';
import { PhotoField } from './CrmPhotos';
import { EntityCombobox, type ComboValue } from './EntityCombobox';
import { cleanText, withCurrent, displayName, toDateTimeLocal, toInt, formatDate } from './format';
import type { InteractionDTO, InteractionType, InteractionStatus, PhotoKind } from './types';
import { ChipGroup, ErrorBanner, Field, ModalFooter, ModalShell, inputClass } from './ui';
import { DateInput } from '@/components/ui/DateInput';
import { DelegationDetailsFields, detailsBody, detailsFrom, validateDetails, type DelegationDetails } from './DelegationDetailsFields';

export type InteractionMode = 'VIP_ESCORT' | 'DELEGATION' | 'OTHER';

export interface InteractionPreset {
  contactId?: string;
  contactName?: string;
  organizationId?: string;
  organizationName?: string;
  /** Loại tương tác chọn sẵn ở chế độ OTHER (vd tặng quà từ trang nhập nhanh). */
  type?: InteractionType;
  /** Ảnh là quà bệnh viện nhận hay quà tặng đi, khi loại tương tác không tự nói lên. */
  photoKind?: PhotoKind;
  title?: string;
}

interface InteractionModalProps {
  mode: InteractionMode;
  initial?: InteractionDTO | null;
  preset?: InteractionPreset;
  onClose: () => void;
  onSaved: (saved: InteractionDTO) => void;
}

export const OTHER_INTERACTION_TYPES = ['MEETING', 'CALL', 'EMAIL', 'EVENT', 'GIFT', 'OTHER'] as const satisfies readonly InteractionType[];

export function interactionModeOf(type: InteractionType): InteractionMode {
  if (type === 'VIP_ESCORT' || type === 'DELEGATION') return type;
  return 'OTHER';
}

const MODE_TEXT: Record<InteractionMode, { create: string; edit: string; subtitle: string; submit: string }> = {
  VIP_ESCORT: {
    create: 'Dẫn khách VIP khám bệnh',
    edit: 'Sửa lượt dẫn khám VIP',
    subtitle: 'Lượt dẫn khám được gắn vào hồ sơ khách và đơn vị của khách.',
    submit: 'Lưu lượt dẫn khám',
  },
  DELEGATION: {
    create: 'Tiếp & dẫn đoàn',
    edit: 'Sửa lượt dẫn đoàn',
    subtitle: 'Ghi nhận đoàn đến làm việc, tham quan; gắn vào hồ sơ đơn vị.',
    submit: 'Lưu lượt dẫn đoàn',
  },
  OTHER: {
    create: 'Ghi tương tác',
    edit: 'Sửa tương tác',
    subtitle: 'Gặp mặt, gọi điện, email, sự kiện, tặng quà…',
    submit: 'Lưu tương tác',
  },
};

interface FormState {
  type: InteractionType;
  status: InteractionStatus;
  occurredAt: string;
  contact: ComboValue | null;
  newContactPhone: string;
  organization: ComboValue | null;
  participants: Array<{ id: string; label: string }>;
  title: string;
  content: string;
  destination: string;
  patientName: string;
  referrer: ComboValue | null;
  referrerChanged: boolean;
  legacyReferrer: string;
  vip: ComboValue | null;
  vipRelationship: string;
  doctors: ComboValue[];
  services: string[];
  guestCount: string;
  purpose: string;
  purposeIsCustom: boolean;
  staffName: string;
  companions: string[];
  note: string;
  details: DelegationDetails;
  followUpDate: string;
  followUpNote: string;
  followUpPreset: string;
  followUpType: 'INVESTIGATION' | 'RESULT' | 'FOLLOW_UP' | 'OTHER';
  autoCreatePlannedEscort: boolean;
}

function addDaysToDateString(baseIsoOrLocal: string, days: number): string {
  try {
    const d = new Date(baseIsoOrLocal);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

function initialState(mode: InteractionMode, initial?: InteractionDTO | null, preset?: InteractionPreset): FormState {
  if (initial) {
    const purpose = initial.purpose ?? '';
    const initialDate = initial.followUpDate ? initial.followUpDate.slice(0, 10) : '';
    const initialNote = initial.followUp ?? '';
    const isMriOrCls = /mri|ct|cls|cận lâm sàng|chụp/i.test(initialNote);
    const isResult = /kết quả|hội chẩn|đọc kq/i.test(initialNote);
    return {
      type: initial.type,
      status: initial.status,
      occurredAt: toDateTimeLocal(initial.occurredAt),
      contact: initial.contact ? { id: initial.contact.id, label: displayName(initial.contact) } : null,
      newContactPhone: '',
      organization: initial.organization ? { id: initial.organization.id, label: initial.organization.name } : null,
      participants: initial.participants.map((p) => ({ id: p.id, label: p.fullName })),
      title: initial.title ?? '',
      content: initial.content,
      destination: initial.destination ?? '',
      patientName: initial.patientName ?? '',
      referrer: initial.referrerContact ? { id: initial.referrerContact.id, label: displayName(initial.referrerContact) } : null,
      referrerChanged: false, legacyReferrer: initial.referrerContact ? '' : initial.referrer ?? '',
      vip: initial.relatedVipContact ? { id: initial.relatedVipContact.id, label: displayName(initial.relatedVipContact) } : null,
      vipRelationship: initial.vipRelationship ?? '',
      doctors: (initial.doctors ?? []).map(d => ({ id: d.id, label: displayName(d) })),
      services: initial.services,
      guestCount: initial.guestCount ? String(initial.guestCount) : '',
      purpose,
      purposeIsCustom: Boolean(purpose) && !(DELEGATION_PURPOSES as readonly string[]).includes(purpose),
      staffName: initial.staffName,
      companions: initial.companions,
      note: initial.note ?? '',
      details: detailsFrom(initial),
      followUpDate: initialDate,
      followUpNote: initialNote,
      followUpPreset: initialDate ? 'custom' : 'none',
      followUpType: isMriOrCls ? 'INVESTIGATION' : isResult ? 'RESULT' : 'FOLLOW_UP',
      autoCreatePlannedEscort: false,
    };
  }
  return {
    type: mode === 'OTHER' ? preset?.type ?? 'MEETING' : mode,
    status: 'DONE',
    occurredAt: toDateTimeLocal(new Date()),
    contact: preset?.contactId ? { id: preset.contactId, label: preset.contactName ?? 'Khách đã chọn' } : null,
    newContactPhone: '',
    organization: preset?.organizationId ? { id: preset.organizationId, label: preset.organizationName ?? 'Đơn vị đã chọn' } : null,
    participants: [],
    title: preset?.title ?? '',
    content: '',
    destination: '',
    patientName: '',
    referrer: null, referrerChanged: false, legacyReferrer: '', vip: null, vipRelationship: '', doctors: [],
    services: [],
    guestCount: '',
    purpose: '',
    purposeIsCustom: false,
    staffName: '',
    companions: [],
    note: '',
    details: detailsFrom(null),
    followUpDate: '',
    followUpNote: '',
    followUpPreset: 'none',
    followUpType: 'INVESTIGATION',
    autoCreatePlannedEscort: false,
  };
}

function buildBody(form: FormState): InteractionInput {
  const contact = form.contact;
  const organization = form.organization;
  const isDelegation = form.type === 'DELEGATION';
  const isEscort = form.type === 'VIP_ESCORT';
  return {
    type: form.type,
    status: form.status,
    occurredAt: new Date(form.occurredAt).toISOString(),
    contactId: contact && 'id' in contact ? contact.id : undefined,
    newContactName: contact && 'newName' in contact ? cleanText(contact.newName) : undefined,
    newContactPhone: contact && 'newName' in contact ? cleanText(form.newContactPhone) : undefined,
    organizationId: organization && 'id' in organization ? organization.id : undefined,
    organizationName: organization && 'newName' in organization ? cleanText(organization.newName) : undefined,
    title: cleanText(form.title),
    content: form.content.trim(),
    destination: cleanText(form.destination),
    patientName: isEscort ? cleanText(form.patientName) : undefined,
    services: isEscort ? form.services : [],
    newReferrerName: undefined, vipRelationship: undefined,
    ...(isEscort && {
      referrerContactId: form.referrer && 'id' in form.referrer ? form.referrer.id : form.referrerChanged || form.referrer ? null : undefined,
      newReferrerName: form.referrer && 'newName' in form.referrer ? form.referrer.newName : undefined,
      relatedVipContactId: form.vip && 'id' in form.vip ? form.vip.id : null,
      vipRelationship: cleanText(form.vipRelationship),
      doctors: form.doctors.map(d => 'id' in d ? { id: d.id } : { newName: d.newName }),
      followUpDate: form.followUpDate ? new Date(`${form.followUpDate}T08:00:00+07:00`).toISOString() : null,
      followUp: form.followUpNote ? cleanText(form.followUpNote) : form.followUpDate ? `Tái khám: ${formatDate(form.followUpDate)}` : undefined,
      autoCreatePlannedEscort: form.autoCreatePlannedEscort,
    }),
    guestCount: isDelegation ? toInt(form.guestCount) : undefined,
    purpose: isDelegation ? cleanText(form.purpose) : undefined,
    participantIds: isDelegation ? form.participants.map((p) => p.id) : [],
    staffName: form.staffName,
    companions: form.companions.filter((name) => name !== form.staffName),
    note: cleanText(form.note),
    ...detailsBody(isDelegation ? form.details : detailsFrom(null)),
  };
}

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.occurredAt || Number.isNaN(new Date(form.occurredAt).getTime())) errors.occurredAt = 'Chọn ngày giờ';
  if (!form.content.trim()) errors.content = 'Nội dung là bắt buộc';
  if (!form.staffName && form.type !== 'DELEGATION') errors.staffName = 'Chọn nhân viên phụ trách';
  Object.assign(errors, form.type === 'DELEGATION' ? validateDetails(form.details, form.occurredAt) : {});
  if (form.type === 'VIP_ESCORT' && !form.contact) errors.contactId = 'Chọn khách trong danh bạ hoặc nhập tên khách mới';
  if (form.type === 'DELEGATION' && !form.organization) errors.organizationId = 'Chọn hoặc nhập tên đơn vị';
  if (form.guestCount && (toInt(form.guestCount) === undefined || Number(form.guestCount) < 1)) errors.guestCount = 'Số người phải là số nguyên dương';
  return errors;
}

/** Lỗi của API cho trường liên kết hồ sơ (id hoặc tên mới) về cùng một chỗ hiển thị. */
function mergeApiErrors(fieldErrors: Record<string, string>): Record<string, string> {
  return {
    ...fieldErrors,
    contactId: fieldErrors.contactId ?? fieldErrors.newContactName,
    organizationId: fieldErrors.organizationId ?? fieldErrors.organizationName,
  };
}

export function InteractionModal({ mode, initial, preset, onClose, onSaved }: InteractionModalProps) {
  const [form, setForm] = useState<FormState>(() => initialState(mode, initial, preset));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  // Đã lưu nhưng ảnh lỗi: bấm Lưu lần nữa thì sửa bản đã lưu, không tạo bản trùng.
  const [saved, setSaved] = useState<InteractionDTO | null>(null);
  const savedId = saved?.id ?? initial?.id ?? null;
  // Đã lưu rồi mà đóng form vì lỗi ảnh: vẫn báo cho trang tải lại.
  const close = saved ? () => onSaved(saved) : onClose;
  const text = MODE_TEXT[mode];
  const photoKind: PhotoKind =
    preset?.photoKind ?? (form.type === 'DELEGATION' || form.type === 'VIP_ESCORT' ? 'RECEIVED' : form.type === 'GIFT' ? 'GIVEN' : 'OTHER');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const companionOptions = useMemo(() => VIP_STAFF.filter((name) => name !== form.staffName), [form.staffName]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const clientErrors = validate(form);
    setErrors(clientErrors);
    setBanner('');
    if (Object.keys(clientErrors).length) return;

    setSaving(true);
    try {
      const body = buildBody(form);
      const record = savedId
        ? await crmSend<InteractionDTO>(`/api/crm/interactions/${savedId}`, 'PATCH', body)
        : await crmSend<InteractionDTO>('/api/crm/interactions', 'POST', body);
      setSaved(record);
      const photoProblem = await syncCrmPhotos({ interactionId: record.id }, pendingPhotos, removedPhotoIds, photoKind);
      if (photoProblem) {
        setPendingPhotos([]);
        setRemovedPhotoIds([]);
        setBanner(`Đã lưu, nhưng có ảnh chưa tải được — ${photoProblem}`);
        return;
      }
      onSaved(record);
    } catch (error) {
      if (error instanceof CrmApiError && error.issues.length) {
        setErrors(mergeApiErrors(error.fieldErrors));
        setBanner(error.message);
      } else {
        setBanner(errorMessage(error, 'Không thể lưu tương tác.'));
      }
    } finally {
      setSaving(false);
    }
  };

  const staffAndCompanions = (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label={mode === 'OTHER' ? 'Nhân viên phụ trách' : mode === 'DELEGATION' ? 'Nhân viên Phòng HC dẫn' : 'Nhân viên dẫn'}
        required={mode !== 'DELEGATION'}
        hint={mode === 'DELEGATION' ? 'Để trống nếu khoa/phòng khác tự tiếp đoàn.' : undefined}
        htmlFor="ix-staff"
        error={errors.staffName}
      >
        <Select
          id="ix-staff"
          value={form.staffName}
          onChange={(event) => {
            const staffName = event.target.value;
            setForm((prev) => ({ ...prev, staffName, companions: prev.companions.filter((n) => n !== staffName) }));
          }}
          className="px-3.5 py-2.5"
        >
          <option value="">Chọn nhân viên</option>
          {withCurrent(VIP_STAFF, form.staffName).map((name) => <option key={name} value={name}>{name}</option>)}
        </Select>
      </Field>
      {mode !== 'OTHER' && (
        <ChipGroup legend="Người đi cùng" options={companionOptions} value={form.companions} onChange={(next) => set('companions', next)} error={errors.companions} />
      )}
    </div>
  );

  return (
    <ModalShell title={initial ? text.edit : text.create} subtitle={text.subtitle} onClose={close}>
      <form onSubmit={handleSubmit} noValidate className="space-y-5 p-5 sm:p-6">
        <ErrorBanner message={banner} />

        <div className="grid gap-4 sm:grid-cols-2">
          {mode === 'OTHER' && (
            <Field label="Loại tương tác" required htmlFor="ix-type" error={errors.type}>
              <Select id="ix-type" value={form.type} onChange={(event) => set('type', event.target.value as InteractionType)} className="px-3.5 py-2.5">
                {OTHER_INTERACTION_TYPES.map((type) => <option key={type} value={type}>{INTERACTION_TYPE_LABELS[type]}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Ngày giờ" required error={errors.occurredAt}>
            <DateInput
              data-autofocus={mode !== 'OTHER' || undefined}
              type="datetime-local"
              required
              value={form.occurredAt}
              onChange={(event) => {
                const occurredAt = event.target.value;
                // Ngày ở tương lai gần như luôn là lịch hẹn — tự chọn sẵn, người dùng đổi được.
                const future = new Date(occurredAt).getTime() > Date.now();
                setForm((prev) => ({
                  ...prev,
                  occurredAt,
                  status: prev.status === 'CANCELLED' || prev.status === 'POSTPONED' ? prev.status : future ? 'PLANNED' : 'DONE',
                }));
              }}
              className={inputClass(errors.occurredAt)}
            />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 block text-sm font-semibold text-slate-700">Trạng thái</legend>
          <div className="inline-flex rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Trạng thái">
            {(['DONE', 'PLANNED', 'POSTPONED', 'CANCELLED'] as const).map((status) => (
              <button
                key={status}
                type="button"
                role="radio"
                aria-checked={form.status === status}
                onClick={() => set('status', status)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${form.status === status ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {INTERACTION_STATUS_LABELS[status]}
              </button>
            ))}
          </div>
          {form.status === 'PLANNED' && (
            <p className="mt-1.5 text-xs text-slate-500">Lịch hẹn hiện ở Tổng quan và Dashboard; đến ngày bấm “Đã xong” để chốt.</p>
          )}
        </fieldset>

        {mode === 'VIP_ESCORT' && <EscortFields form={form} set={set} errors={errors} />}
        {mode === 'DELEGATION' && <DelegationFields form={form} set={set} errors={errors} />}
        {mode === 'DELEGATION' && (
          <DelegationDetailsFields value={form.details} onChange={(details) => set('details', details)} errors={errors} />
        )}
        {mode === 'OTHER' && <OtherFields form={form} set={set} errors={errors} />}

        {staffAndCompanions}

        <Field label="Ghi chú" error={errors.note}>
          <textarea rows={2} value={form.note} onChange={(event) => set('note', event.target.value)} className={inputClass(errors.note, 'resize-none')} placeholder="Không bắt buộc" />
        </Field>

        <PhotoField
          label={photoKind === 'RECEIVED' ? 'Ảnh quà, hoa khách tặng bệnh viện' : photoKind === 'GIVEN' ? 'Ảnh quà, hoa đã tặng' : 'Ảnh'}
          hint="Không bắt buộc. Ảnh được thu nhỏ trước khi gửi."
          existing={saved?.photos ?? initial?.photos ?? []}
          pending={pendingPhotos}
          onPendingChange={setPendingPhotos}
          removedIds={removedPhotoIds}
          onRemovedChange={setRemovedPhotoIds}
        />

        <ModalFooter onCancel={close} saving={saving} submitLabel={savedId ? 'Lưu thay đổi' : text.submit} />
      </form>
    </ModalShell>
  );
}

type Setter = <K extends keyof FormState>(key: K, value: FormState[K]) => void;
interface SectionProps {
  form: FormState;
  set: Setter;
  errors: Record<string, string>;
}

function EscortFields({ form, set, errors }: SectionProps) {
  const selectionVersion = useRef(0);
  const chooseGuest = async (value: ComboValue | null) => {
    const version = ++selectionVersion.current;
    set('contact', value);
    set('referrer', null); set('referrerChanged', true); set('legacyReferrer', ''); set('vip', null); set('vipRelationship', '');
    if (!value || !('id' in value)) return;
    try {
      const c = await crmFetch<import('./types').ContactDetail>(`/api/crm/contacts/${value.id}`);
      if (selectionVersion.current !== version) return;
      set('referrer', c.referrerContact ? { id: c.referrerContact.id, label: c.referrerContact.fullName } : null);
      set('vip', c.relatedVipContact ? { id: c.relatedVipContact.id, label: c.relatedVipContact.fullName } : null);
      set('vipRelationship', c.vipRelationship ?? '');
    } catch { /* The user can still enter these optional fields manually. */ }
  };
  const isNewGuest = form.contact !== null && 'newName' in form.contact;
  const handlePresetClick = (presetId: string) => {
    if (presetId === 'none') {
      set('followUpPreset', 'none');
      set('followUpDate', '');
      set('followUpNote', '');
      set('autoCreatePlannedEscort', false);
      return;
    }
    if (presetId === 'custom') {
      set('followUpPreset', 'custom');
      return;
    }
    const days = parseInt(presetId, 10);
    const dateStr = addDaysToDateString(form.occurredAt, days);
    set('followUpPreset', presetId);
    set('followUpDate', dateStr);
    const label = presetId === '1' ? 'Hẹn ngày mai quay lại'
      : presetId === '2' ? (form.followUpType === 'RESULT' ? 'Hẹn 2 ngày nữa quay lại đọc kết quả / CLS' : 'Hẹn 2 ngày nữa quay lại chụp MRI / Cận lâm sàng')
      : presetId === '3' ? 'Hẹn 3 ngày nữa quay lại đọc kết quả / CLS'
      : presetId === '7' ? 'Hẹn quay lại sau 1 tuần'
      : presetId === '14' ? 'Tái khám sau 14 ngày (2 tuần)'
      : presetId === '30' ? 'Tái khám sau 30 ngày (1 tháng)'
      : presetId === '60' ? 'Tái khám sau 60 ngày (2 tháng)'
      : presetId === '90' ? 'Tái khám sau 90 ngày (3 tháng)'
      : 'Tái khám sau 6 tháng';
    if (!form.followUpNote || form.followUpNote.startsWith('Tái khám sau') || form.followUpNote.startsWith('Hẹn')) {
      set('followUpNote', label);
    }
    // Các mốc hẹn ngắn ngày (dưới 7 ngày) hoặc mục đích CLS/kết quả: tự động tích đón khách
    if (days <= 7 || form.followUpType === 'INVESTIGATION' || form.followUpType === 'RESULT') {
      set('autoCreatePlannedEscort', true);
    } else {
      set('autoCreatePlannedEscort', false);
    }
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Khách được dẫn khám" required htmlFor="ix-contact" error={errors.contactId} hint="Tìm trong danh bạ; chưa có thì gõ tên để tạo hồ sơ mới.">
          <EntityCombobox kind="contact" inputId="ix-contact" value={form.contact} onChange={chooseGuest} invalid={Boolean(errors.contactId)} placeholder="Họ tên khách" />
        </Field>
        <Field label="Đơn vị của khách" htmlFor="ix-org" error={errors.organizationId}>
          <EntityCombobox kind="organization" inputId="ix-org" value={form.organization} onChange={(v) => set('organization', v)} invalid={Boolean(errors.organizationId)} placeholder="Chọn hoặc gõ tên đơn vị" />
        </Field>
      </div>
      {isNewGuest && (
        <Field label="Số điện thoại khách mới" error={errors.newContactPhone}>
          <input type="tel" value={form.newContactPhone} onChange={(event) => set('newContactPhone', event.target.value)} className={inputClass(errors.newContactPhone)} placeholder="Ví dụ: 0901 234 567" />
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Người giới thiệu" hint="Chọn người trong danh bạ hoặc nhập tên mới.">
          <EntityCombobox kind="contact" value={form.referrer} onChange={v => { set('referrer', v); set('referrerChanged', true); }} />
          {form.legacyReferrer && !form.referrerChanged && <p className="mt-1 text-xs text-slate-500">Thông tin gốc: {form.legacyReferrer}</p>}
        </Field>
        <Field
          label="Khoa/phòng đến"
          error={errors.destination}
          hint={form.doctors.some((d) => 'department' in d && d.department) && !form.destination ? 'Tự động gợi ý từ bác sĩ khám' : undefined}
        >
          <input value={form.destination} onChange={(event) => set('destination', event.target.value)} className={inputClass(errors.destination)} placeholder="Ví dụ: Tim mạch, Thần kinh, Tiết niệu..." />
          {form.doctors.find((d) => 'department' in d && d.department && d.department !== form.destination) && (
            <button
              type="button"
              onClick={() => {
                const docWithDept = form.doctors.find((d) => 'department' in d && d.department);
                if (docWithDept && 'department' in docWithDept && docWithDept.department) {
                  set('destination', docWithDept.department);
                }
              }}
              className="mt-1 text-xs font-medium text-cyan-700 hover:text-cyan-900 hover:underline"
            >
              Gợi ý từ bác sĩ: Điền “{form.doctors.find((d) => 'department' in d && d.department)?.department}”
            </button>
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Khách có quan hệ với VIP nào?" hint="Khách ở trên là người được khám. Chọn VIP liên quan nếu có.">
          <EntityCombobox kind="contact" value={form.vip} onChange={v => set('vip', v)} allowNew={false} excludeIds={form.contact && 'id' in form.contact ? [form.contact.id] : []} />
        </Field>
        <Field label="Khách là gì của VIP?">
          <Select value={form.vipRelationship} onChange={e => set('vipRelationship', e.target.value)}>
            <option value="">Chọn quan hệ</option>
            {['Vợ/chồng', 'Con', 'Cha/mẹ', 'Anh/chị/em', 'Người thân', 'Trợ lý', 'Thư ký', 'Bạn bè', 'Đồng nghiệp', 'Khác'].map(r => <option key={r}>{r}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Bác sĩ khám" hint="Có thể chọn nhiều bác sĩ; khi chọn hệ thống sẽ tự điền khoa/phòng tương ứng.">
        <EntityCombobox
          kind="contact"
          value={null}
          clearOnSelect
          onChange={(v) => {
            if (v) {
              set('doctors', [...form.doctors, v]);
              if ('department' in v && v.department && !form.destination.trim()) {
                set('destination', v.department);
              }
            }
          }}
          excludeIds={form.doctors.flatMap((d) => ('id' in d ? [d.id] : []))}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {form.doctors.map((d, index) => (
            <button
              type="button"
              key={index}
              className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200/80 bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-900 hover:bg-cyan-100 transition-colors"
              onClick={() => set('doctors', form.doctors.filter((_, i) => i !== index))}
            >
              <span>{'id' in d ? d.label : d.newName}</span>
              {'department' in d && d.department && (
                <span className="text-xs font-normal text-cyan-700">({d.department})</span>
              )}
              <span className="text-cyan-400 hover:text-cyan-700">×</span>
            </button>
          ))}
        </div>
      </Field>
      {form.patientName && <p className="text-xs text-slate-500">Người được khám ghi trong dữ liệu cũ: {form.patientName}</p>}
      <ChipGroup legend="Dịch vụ hỗ trợ" options={ESCORT_SERVICES} value={form.services} onChange={(next) => set('services', next)} error={errors.services} />
      
      {/* Lịch hẹn tái khám / chụp MRI / Cận lâm sàng */}
      <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/60 via-white to-white p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-teal-900 flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-teal-600" />
            Lịch hẹn tiếp theo của khách (Tái khám / Chụp MRI / CLS)
          </label>
          {form.followUpDate && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 bg-teal-100/80 px-2.5 py-0.5 rounded-full border border-teal-200/60">
              <CalendarCheck className="h-3 w-3" />
              Hẹn: {formatDate(form.followUpDate)}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Ghi nhận hẹn quay lại chụp MRI, làm cận lâm sàng, đọc kết quả hoặc tái khám sau điều trị để nhắc khách và tự động lên lịch đón.
        </p>

        {/* Chọn loại mục đích hẹn */}
        <div>
          <span className="text-xs font-semibold text-slate-600 block mb-1.5">Mục đích hẹn:</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'INVESTIGATION', label: 'Chụp MRI / Cận lâm sàng', icon: '🧲' },
              { id: 'RESULT', label: 'Đọc kết quả / Hội chẩn', icon: '📋' },
              { id: 'FOLLOW_UP', label: 'Tái khám sau điều trị', icon: '🔄' },
              { id: 'OTHER', label: 'Hẹn khác', icon: '📅' },
            ].map((t) => {
              const active = form.followUpType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    const nextType = t.id as FormState['followUpType'];
                    set('followUpType', nextType);
                    if (nextType === 'INVESTIGATION') {
                      const dateStr = addDaysToDateString(form.occurredAt, 2);
                      set('followUpPreset', '2');
                      set('followUpDate', dateStr);
                      set('followUpNote', 'Hẹn 2 ngày nữa quay lại chụp MRI / Cận lâm sàng');
                      set('autoCreatePlannedEscort', true);
                    } else if (nextType === 'RESULT') {
                      const dateStr = addDaysToDateString(form.occurredAt, 2);
                      set('followUpPreset', '2');
                      set('followUpDate', dateStr);
                      set('followUpNote', 'Hẹn 2 ngày nữa quay lại đọc kết quả / CLS');
                      set('autoCreatePlannedEscort', true);
                    } else if (nextType === 'FOLLOW_UP') {
                      const dateStr = addDaysToDateString(form.occurredAt, 14);
                      set('followUpPreset', '14');
                      set('followUpDate', dateStr);
                      set('followUpNote', 'Tái khám sau 14 ngày (2 tuần)');
                      set('autoCreatePlannedEscort', false);
                    }
                  }}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition border',
                    active
                      ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-teal-50 hover:text-teal-900'
                  )}
                >
                  <span>{t.icon}</span>
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nút chọn nhanh mốc thời gian */}
        <div>
          <span className="text-xs font-semibold text-slate-600 block mb-1.5">Mốc thời gian:</span>
          <div className="flex flex-wrap gap-2">
            {(form.followUpType === 'INVESTIGATION' || form.followUpType === 'RESULT'
              ? [
                  { id: 'none', label: 'Không hẹn' },
                  { id: '1', label: 'Ngày mai (+1d)' },
                  { id: '2', label: '2 ngày nữa (chụp MRI / CLS)' },
                  { id: '3', label: '3 ngày nữa' },
                  { id: '7', label: '1 tuần' },
                  { id: 'custom', label: 'Chọn ngày khác' },
                ]
              : form.followUpType === 'FOLLOW_UP'
              ? [
                  { id: 'none', label: 'Không hẹn' },
                  { id: '14', label: '14 ngày (2 tuần)' },
                  { id: '30', label: '30 ngày (1 tháng)' },
                  { id: '60', label: '60 ngày (2 tháng)' },
                  { id: '90', label: '90 ngày (3 tháng)' },
                  { id: 'custom', label: 'Chọn ngày khác' },
                ]
              : [
                  { id: 'none', label: 'Không hẹn' },
                  { id: '1', label: 'Ngày mai' },
                  { id: '2', label: '2 ngày nữa' },
                  { id: '7', label: '1 tuần' },
                  { id: '14', label: '2 tuần' },
                  { id: '30', label: '1 tháng' },
                  { id: 'custom', label: 'Chọn ngày khác' },
                ]
            ).map((preset) => {
              const active = form.followUpPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetClick(preset.id)}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium transition-all duration-150',
                    active
                      ? 'bg-teal-700 text-white shadow-xs ring-2 ring-teal-700/20'
                      : 'bg-white text-slate-700 border border-slate-200/90 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300'
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {form.followUpPreset !== 'none' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-teal-100/80">
              <Field label="Ngày hẹn" required>
                <input
                  type="date"
                  value={form.followUpDate}
                  onChange={(e) => {
                    set('followUpDate', e.target.value);
                    set('followUpPreset', 'custom');
                  }}
                  className={inputClass('')}
                />
              </Field>
              <Field label="Ghi chú dặn dò / thủ thuật / phòng máy">
                <input
                  type="text"
                  value={form.followUpNote}
                  onChange={(e) => set('followUpNote', e.target.value)}
                  placeholder={
                    form.followUpType === 'INVESTIGATION'
                      ? 'Ví dụ: Nhịn ăn sáng, chụp MRI sọ não lúc 08:30 phòng MRI...'
                      : form.followUpType === 'RESULT'
                      ? 'Ví dụ: Quay lại đọc KQ chụp MRI và lấy toa...'
                      : 'Ví dụ: Nhịn ăn sáng làm XN máu, mang phim cũ...'
                  }
                  className={inputClass('')}
                />
              </Field>
            </div>

            {/* Checkbox tự động lên lịch đón dẫn khách vào ngày hẹn */}
            {form.followUpDate && (
              <label className="flex items-start gap-2.5 rounded-xl border border-teal-200/90 bg-teal-50/70 p-3 cursor-pointer hover:bg-teal-100/60 transition-colors">
                <input
                  type="checkbox"
                  checked={form.autoCreatePlannedEscort}
                  onChange={(e) => set('autoCreatePlannedEscort', e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-teal-300 text-teal-600 focus:ring-teal-500"
                />
                <div className="text-xs">
                  <span className="font-semibold text-teal-900 block">
                    Tự động lên lịch đón dẫn khách vào ngày hẹn (tạo lịch hẹn PLANNED trên Dashboard)
                  </span>
                  <span className="text-teal-700 block mt-0.5">
                    Đúng ngày hẹn, Dashboard sẽ nổi lượt tiếp đón để nhân viên chủ động đón khách tại sảnh và dẫn vào phòng chụp MRI / phòng khám.
                  </span>
                </div>
              </label>
            )}
          </>
        )}
      </div>

      <Field label="Nội dung hỗ trợ" required error={errors.content}>
        <textarea rows={3} value={form.content} onChange={(event) => set('content', event.target.value)} className={inputClass(errors.content, 'resize-none')} placeholder="Ví dụ: Đón tại sảnh A, đưa đi chụp MRI, hỗ trợ lấy kết quả" />
      </Field>
    </>
  );
}

function DelegationFields({ form, set, errors }: SectionProps) {
  const purposeChips = form.purposeIsCustom ? [] : form.purpose ? [form.purpose] : [];
  const addParticipant = (value: ComboValue | null) => {
    if (!value || !('id' in value) || form.participants.some((p) => p.id === value.id)) return;
    set('participants', [...form.participants, { id: value.id, label: value.label }]);
  };
  const excludeIds = useMemo(
    () => [...form.participants.map((p) => p.id), ...(form.contact && 'id' in form.contact ? [form.contact.id] : [])],
    [form.participants, form.contact],
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Đơn vị" required htmlFor="ix-org" error={errors.organizationId} hint="Chưa có trong danh bạ thì gõ tên để tạo mới.">
          <EntityCombobox kind="organization" inputId="ix-org" value={form.organization} onChange={(v) => set('organization', v)} invalid={Boolean(errors.organizationId)} placeholder="Đơn vị của đoàn" />
        </Field>
        <Field label="Trưởng đoàn" htmlFor="ix-contact" error={errors.contactId}>
          <EntityCombobox kind="contact" inputId="ix-contact" value={form.contact} onChange={(v) => set('contact', v)} invalid={Boolean(errors.contactId)} placeholder="Họ tên trưởng đoàn" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
        <div>
          <Field label="Thành viên có hồ sơ" htmlFor="ix-participants" error={errors.participantIds}>
            <EntityCombobox kind="contact" inputId="ix-participants" value={null} onChange={addParticipant} allowNew={false} clearOnSelect excludeIds={excludeIds} placeholder="Tìm và thêm thành viên" />
          </Field>
          {form.participants.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Thành viên đã chọn">
              {form.participants.map((p) => (
                <li key={p.id} className="inline-flex items-center gap-1 rounded-full bg-cyan-50 py-1 pl-3 pr-1 text-xs font-medium text-cyan-800">
                  {p.label}
                  <button type="button" aria-label={`Bỏ ${p.label}`} onClick={() => set('participants', form.participants.filter((x) => x.id !== p.id))} className="rounded-full p-0.5 hover:bg-cyan-100">
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Field label="Số người" error={errors.guestCount}>
          <input type="number" inputMode="numeric" min={1} max={1000} value={form.guestCount} onChange={(event) => set('guestCount', event.target.value)} className={inputClass(errors.guestCount)} placeholder="Ví dụ: 12" />
        </Field>
      </div>

      <div>
        <ChipGroup
          legend="Hình thức tiếp"
          single
          options={DELEGATION_PURPOSES}
          value={purposeChips}
          onChange={(next) => {
            set('purposeIsCustom', false);
            set('purpose', next[0] ?? '');
          }}
          error={errors.purpose}
          trailing={
            <button
              type="button"
              aria-pressed={form.purposeIsCustom}
              onClick={() => {
                set('purposeIsCustom', !form.purposeIsCustom);
                set('purpose', '');
              }}
              className={form.purposeIsCustom
                ? 'rounded-full border border-cyan-600 bg-cyan-600 px-3 py-1.5 text-[13px] font-medium text-white'
                : 'rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-[13px] font-medium text-slate-500 hover:border-cyan-400 hover:text-cyan-700'}
            >
              Khác…
            </button>
          }
        />
        {form.purposeIsCustom && (
          <label className="mt-2 block">
            <span className="sr-only">Mục đích khác</span>
            <input autoFocus value={form.purpose} onChange={(event) => set('purpose', event.target.value)} className={inputClass(errors.purpose)} placeholder="Ghi mục đích của đoàn" />
          </label>
        )}
      </div>

      <Field label="Tên đoàn" error={errors.title} hint="Như ghi trong công văn/lịch tiếp, vd “Đoàn công tác Sở Y tế tỉnh Đồng Nai”.">
        <input value={form.title} onChange={(event) => set('title', event.target.value)} className={inputClass(errors.title)} />
      </Field>
      <Field label="Địa điểm, lộ trình" error={errors.destination}>
        <input value={form.destination} onChange={(event) => set('destination', event.target.value)} className={inputClass(errors.destination)} placeholder="Ví dụ: Khối Cận lâm sàng → Trung tâm Đào tạo" />
      </Field>
      <Field label="Nội dung làm việc" required error={errors.content}>
        <textarea rows={3} value={form.content} onChange={(event) => set('content', event.target.value)} className={inputClass(errors.content, 'resize-none')} placeholder="Tóm tắt nội dung làm việc với đoàn" />
      </Field>
    </>
  );
}

function OtherFields({ form, set, errors }: SectionProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cá nhân" htmlFor="ix-contact" error={errors.contactId}>
          <EntityCombobox kind="contact" inputId="ix-contact" value={form.contact} onChange={(v) => set('contact', v)} invalid={Boolean(errors.contactId)} placeholder="Họ tên đối tác" />
        </Field>
        <Field label="Tổ chức" htmlFor="ix-org" error={errors.organizationId}>
          <EntityCombobox kind="organization" inputId="ix-org" value={form.organization} onChange={(v) => set('organization', v)} invalid={Boolean(errors.organizationId)} placeholder="Tên tổ chức" />
        </Field>
      </div>
      <Field label="Tiêu đề" error={errors.title}>
        <input value={form.title} onChange={(event) => set('title', event.target.value)} className={inputClass(errors.title)} placeholder="Ví dụ: Trao đổi gia hạn MOU đào tạo" />
      </Field>
      <Field label="Nội dung" required error={errors.content}>
        <textarea rows={3} value={form.content} onChange={(event) => set('content', event.target.value)} className={inputClass(errors.content, 'resize-none')} placeholder="Diễn biến, kết quả, việc cần theo dõi" />
      </Field>
    </>
  );
}
