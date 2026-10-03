'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { DELEGATION_PURPOSES, ESCORT_SERVICES, INTERACTION_TYPE_LABELS, VIP_STAFF, INTERACTION_STATUS_LABELS } from '@/lib/crm/constants';
import type { InteractionInput } from '@/lib/crm/schemas';
import { CrmApiError, crmSend, errorMessage } from './api';
import { EntityCombobox, type ComboValue } from './EntityCombobox';
import { cleanText, withCurrent, displayName, toDateTimeLocal, toInt } from './format';
import type { InteractionDTO, InteractionType, InteractionStatus } from './types';
import { ChipGroup, ErrorBanner, Field, ModalFooter, ModalShell, inputClass } from './ui';

export type InteractionMode = 'VIP_ESCORT' | 'DELEGATION' | 'OTHER';

export interface InteractionPreset {
  contactId?: string;
  contactName?: string;
  organizationId?: string;
  organizationName?: string;
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
  services: string[];
  guestCount: string;
  purpose: string;
  purposeIsCustom: boolean;
  staffName: string;
  companions: string[];
  note: string;
}

function initialState(mode: InteractionMode, initial?: InteractionDTO | null, preset?: InteractionPreset): FormState {
  if (initial) {
    const purpose = initial.purpose ?? '';
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
      services: initial.services,
      guestCount: initial.guestCount ? String(initial.guestCount) : '',
      purpose,
      purposeIsCustom: Boolean(purpose) && !(DELEGATION_PURPOSES as readonly string[]).includes(purpose),
      staffName: initial.staffName,
      companions: initial.companions,
      note: initial.note ?? '',
    };
  }
  return {
    type: mode === 'OTHER' ? 'MEETING' : mode,
    status: 'DONE',
    occurredAt: toDateTimeLocal(new Date()),
    contact: preset?.contactId ? { id: preset.contactId, label: preset.contactName ?? 'Khách đã chọn' } : null,
    newContactPhone: '',
    organization: preset?.organizationId ? { id: preset.organizationId, label: preset.organizationName ?? 'Đơn vị đã chọn' } : null,
    participants: [],
    title: '',
    content: '',
    destination: '',
    patientName: '',
    services: [],
    guestCount: '',
    purpose: '',
    purposeIsCustom: false,
    staffName: '',
    companions: [],
    note: '',
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
    guestCount: isDelegation ? toInt(form.guestCount) : undefined,
    purpose: isDelegation ? cleanText(form.purpose) : undefined,
    participantIds: isDelegation ? form.participants.map((p) => p.id) : [],
    staffName: form.staffName,
    companions: form.companions.filter((name) => name !== form.staffName),
    note: cleanText(form.note),
  };
}

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.occurredAt || Number.isNaN(new Date(form.occurredAt).getTime())) errors.occurredAt = 'Chọn ngày giờ';
  if (!form.content.trim()) errors.content = 'Nội dung là bắt buộc';
  if (!form.staffName) errors.staffName = 'Chọn nhân viên phụ trách';
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
  const text = MODE_TEXT[mode];

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
      const saved = initial
        ? await crmSend<InteractionDTO>(`/api/crm/interactions/${initial.id}`, 'PATCH', body)
        : await crmSend<InteractionDTO>('/api/crm/interactions', 'POST', body);
      onSaved(saved);
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
      <Field label={mode === 'OTHER' ? 'Nhân viên phụ trách' : 'Nhân viên dẫn'} required htmlFor="ix-staff" error={errors.staffName}>
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
    <ModalShell title={initial ? text.edit : text.create} subtitle={text.subtitle} onClose={onClose}>
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
            <input
              data-autofocus={mode !== 'OTHER' || undefined}
              type="datetime-local"
              value={form.occurredAt}
              onChange={(event) => {
                const occurredAt = event.target.value;
                // Ngày ở tương lai gần như luôn là lịch hẹn — tự chọn sẵn, người dùng đổi được.
                const future = new Date(occurredAt).getTime() > Date.now();
                setForm((prev) => ({
                  ...prev,
                  occurredAt,
                  status: prev.status === 'CANCELLED' ? prev.status : future ? 'PLANNED' : 'DONE',
                }));
              }}
              className={inputClass(errors.occurredAt)}
            />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1.5 block text-sm font-semibold text-slate-700">Trạng thái</legend>
          <div className="inline-flex rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Trạng thái">
            {(['DONE', 'PLANNED', 'CANCELLED'] as const).map((status) => (
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
        {mode === 'OTHER' && <OtherFields form={form} set={set} errors={errors} />}

        {staffAndCompanions}

        <Field label="Ghi chú" error={errors.note}>
          <textarea rows={2} value={form.note} onChange={(event) => set('note', event.target.value)} className={inputClass(errors.note, 'resize-none')} placeholder="Không bắt buộc" />
        </Field>

        <ModalFooter onCancel={onClose} saving={saving} submitLabel={initial ? 'Lưu thay đổi' : text.submit} />
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
  const isNewGuest = form.contact !== null && 'newName' in form.contact;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Khách" required htmlFor="ix-contact" error={errors.contactId} hint="Tìm trong danh bạ; chưa có thì gõ tên để tạo hồ sơ mới.">
          <EntityCombobox kind="contact" inputId="ix-contact" value={form.contact} onChange={(v) => set('contact', v)} invalid={Boolean(errors.contactId)} placeholder="Họ tên khách" />
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
        <Field label="Người được khám" error={errors.patientName} hint="Để trống nếu chính khách là người khám.">
          <input value={form.patientName} onChange={(event) => set('patientName', event.target.value)} className={inputClass(errors.patientName)} placeholder="Ví dụ: mẹ của khách" />
        </Field>
        <Field label="Khoa/phòng đến" error={errors.destination}>
          <input value={form.destination} onChange={(event) => set('destination', event.target.value)} className={inputClass(errors.destination)} placeholder="Ví dụ: Khoa Nội tim mạch" />
        </Field>
      </div>
      <ChipGroup legend="Dịch vụ hỗ trợ" options={ESCORT_SERVICES} value={form.services} onChange={(next) => set('services', next)} error={errors.services} />
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
          legend="Mục đích"
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

      <Field label="Lộ trình, điểm tham quan" error={errors.destination}>
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
