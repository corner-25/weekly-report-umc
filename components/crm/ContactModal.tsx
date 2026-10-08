'use client';

import { EntityCombobox, type ComboValue } from './EntityCombobox';
import { useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { CONTACT_STATUS_LABELS, VIP_STAFF } from '@/lib/crm/constants';
import type { ContactInput } from '@/lib/crm/schemas';
import { CrmApiError, crmSend, errorMessage } from './api';
import { cleanText, textOrClear, toInt, withCurrent, type Clearable } from './format';
import type { ContactDetail, ContactStatus, Tier } from './types';
import { ErrorBanner, Field, ModalFooter, ModalShell, TagInput, Toggle, inputClass } from './ui';

interface ContactModalProps {
  initial?: ContactDetail | null;
  onClose: () => void;
  onSaved: (saved: { id: string }) => void;
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

interface FormState {
  fullName: string;
  academicTitle: string;
  salutation: string;
  gender: '' | 'Nam' | 'Nữ';
  birthDay: string;
  birthMonth: string;
  birthYear: string;
  birthIsLunar: boolean;
  phone: string;
  email: string;
  giftAddress: string;
  tier: Tier;
  tags: string[];
  ownerName: string;
  flowers: string;
  avoid: string;
  food: string;
  hobbies: string;
  sensitiveNote: string;
  status: ContactStatus;
  note: string;
  currentTitle: string;
  currentOrganizationName: string;
}

function initialState(initial?: ContactDetail | null): FormState {
  const currentPos = initial?.positions?.find((p) => p.isCurrent) ?? initial?.positions?.[0];
  return {
    fullName: initial?.fullName ?? '',
    academicTitle: initial?.academicTitle ?? '',
    salutation: initial?.salutation ?? '',
    gender: initial?.gender ?? '',
    birthDay: initial?.birthDay ? String(initial.birthDay) : '',
    birthMonth: initial?.birthMonth ? String(initial.birthMonth) : '',
    birthYear: initial?.birthYear ? String(initial.birthYear) : '',
    birthIsLunar: initial?.birthIsLunar ?? false,
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    giftAddress: initial?.giftAddress ?? '',
    tier: initial?.tier ?? 'C',
    tags: initial?.tags ?? [],
    ownerName: initial?.ownerName ?? '',
    flowers: initial?.preferences?.flowers ?? '',
    avoid: initial?.preferences?.avoid ?? '',
    food: initial?.preferences?.food ?? '',
    hobbies: initial?.preferences?.hobbies ?? '',
    sensitiveNote: initial?.sensitiveNote ?? '',
    status: initial?.status ?? 'ACTIVE',
    note: initial?.note ?? '',
    currentTitle: currentPos?.title ?? '',
    currentOrganizationName: currentPos?.organization?.name ?? '',
  };
}

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.fullName.trim()) errors.fullName = 'Họ tên là bắt buộc';
  if (Boolean(form.birthDay) !== Boolean(form.birthMonth)) errors.birthMonth = 'Ngày sinh cần đủ cả ngày và tháng';
  const year = toInt(form.birthYear);
  if (form.birthYear && (year === undefined || year < 1900 || year > 2100)) errors.birthYear = 'Năm sinh không hợp lệ';
  if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Email không hợp lệ';
  return errors;
}

export function ContactModal({ initial, onClose, onSaved }: ContactModalProps) {
  const [referrer, setReferrer] = useState<ComboValue | null>(initial?.referrerContact ? { id: initial.referrerContact.id, label: initial.referrerContact.fullName } : null);
  const [vip, setVip] = useState<ComboValue | null>(initial?.relatedVipContact ? { id: initial.relatedVipContact.id, label: initial.relatedVipContact.fullName } : null);
  const [relationship, setRelationship] = useState(initial?.vipRelationship ?? '');
  const isEdit = Boolean(initial);
  // Khi thêm mới, người tạo luôn được nhập lưu ý nhạy cảm; khi sửa thì theo quyền API trả về.
  const canEditSensitive = !initial || initial.canSeeSensitive;
  const [form, setForm] = useState<FormState>(() => initialState(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState('');
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const buildBody = (): Clearable<ContactInput> => {
    const preferences = {
      flowers: cleanText(form.flowers),
      avoid: cleanText(form.avoid),
      food: cleanText(form.food),
      hobbies: cleanText(form.hobbies),
    };
    const hasPreferences = Object.values(preferences).some(Boolean);
    const clearIfEdit = isEdit ? null : undefined;
    return {
      referrerContactId: referrer && 'id' in referrer ? referrer.id : null,
      newReferrerName: referrer && 'newName' in referrer ? referrer.newName : undefined,
      relatedVipContactId: vip && 'id' in vip ? vip.id : null,
      vipRelationship: relationship || undefined,
      fullName: form.fullName.trim(),
      academicTitle: textOrClear(form.academicTitle, isEdit),
      salutation: textOrClear(form.salutation, isEdit),
      gender: form.gender || clearIfEdit,
      birthDay: toInt(form.birthDay) ?? clearIfEdit,
      birthMonth: toInt(form.birthMonth) ?? clearIfEdit,
      birthYear: toInt(form.birthYear) ?? clearIfEdit,
      birthIsLunar: form.birthIsLunar,
      phone: textOrClear(form.phone, isEdit),
      email: textOrClear(form.email, isEdit),
      giftAddress: textOrClear(form.giftAddress, isEdit),
      tier: form.tier,
      tags: form.tags,
      ownerName: textOrClear(form.ownerName, isEdit),
      preferences: hasPreferences ? preferences : clearIfEdit,
      // Không có quyền xem thì không gửi trường này (API sẽ từ chối).
      sensitiveNote: canEditSensitive ? textOrClear(form.sensitiveNote, isEdit) : undefined,
      status: form.status,
      note: textOrClear(form.note, isEdit),
      currentTitle: cleanText(form.currentTitle) || (isEdit ? null : undefined),
      currentOrganizationName: cleanText(form.currentOrganizationName) || (isEdit ? null : undefined),
    };
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const clientErrors = validate(form);
    setErrors(clientErrors);
    setBanner('');
    if (Object.keys(clientErrors).length) return;

    setSaving(true);
    try {
      const body = buildBody();
      const saved = initial
        ? await crmSend<{ id: string }>(`/api/crm/contacts/${initial.id}`, 'PATCH', body)
        : await crmSend<{ id: string }>('/api/crm/contacts', 'POST', body);
      onSaved(saved);
    } catch (error) {
      if (error instanceof CrmApiError && error.issues.length) setErrors(error.fieldErrors);
      setBanner(errorMessage(error, 'Không thể lưu hồ sơ.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={isEdit ? 'Sửa hồ sơ cá nhân' : 'Thêm cá nhân'} subtitle="Chỉ họ tên là bắt buộc; các thông tin khác có thể bổ sung sau." onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="space-y-6 p-5 sm:p-6">
        <ErrorBanner message={banner} />

        <FormSection title="Thông tin chung">
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <Field label="Học hàm, học vị" error={errors.academicTitle}>
              <input value={form.academicTitle} onChange={(e) => set('academicTitle', e.target.value)} className={inputClass(errors.academicTitle)} placeholder="PGS.TS." />
            </Field>
            <Field label="Họ và tên" required error={errors.fullName}>
              <input data-autofocus value={form.fullName} onChange={(e) => set('fullName', e.target.value)} className={inputClass(errors.fullName)} placeholder="Nguyễn Văn A" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Xưng hô" error={errors.salutation}>
              <input value={form.salutation} onChange={(e) => set('salutation', e.target.value)} className={inputClass(errors.salutation)} placeholder="Thầy, Cô, Anh, Chị…" />
            </Field>
            <Field label="Giới tính" htmlFor="ct-gender" error={errors.gender}>
              <Select id="ct-gender" value={form.gender} onChange={(e) => set('gender', e.target.value as FormState['gender'])} className="px-3.5 py-2.5">
                <option value="">Không ghi</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
              </Select>
            </Field>
            <fieldset>
              <legend className="mb-1.5 block text-sm font-semibold text-slate-700">Loại</legend>
              <div className="inline-flex rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="Loại">
                {([['C', 'Đối tác'], ['VIP', 'VIP']] as const).map(([value, label]) => {
                  const on = value === 'VIP' ? form.tier === 'VIP' : form.tier !== 'VIP';
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set('tier', value)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${on ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-xs text-slate-500">Đối tác: đầu mối, người liên hệ của tổ chức. VIP: Phòng HC tự gắn.</p>
            </fieldset>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Chức vụ hiện tại" error={errors.currentTitle}>
              <input value={form.currentTitle} onChange={(e) => set('currentTitle', e.target.value)} className={inputClass(errors.currentTitle)} placeholder="Giám đốc" />
            </Field>
            <Field label="Tổ chức" error={errors.currentOrganizationName} hint="Chưa có trong danh bạ sẽ được tạo mới.">
              <input value={form.currentOrganizationName} onChange={(e) => set('currentOrganizationName', e.target.value)} className={inputClass(errors.currentOrganizationName)} placeholder="Bệnh viện Đại học Y Dược TP. Hồ Chí Minh" />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Ngày sinh">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-[110px_110px_130px_1fr] sm:items-end">
            <Field label="Ngày" htmlFor="ct-bday" error={errors.birthDay}>
              <Select id="ct-bday" value={form.birthDay} onChange={(e) => set('birthDay', e.target.value)} className="px-3.5 py-2.5">
                <option value="">—</option>
                {DAYS.map((d) => <option key={d} value={String(d)}>{d}</option>)}
              </Select>
            </Field>
            <Field label="Tháng" htmlFor="ct-bmonth" error={errors.birthMonth}>
              <Select id="ct-bmonth" value={form.birthMonth} onChange={(e) => set('birthMonth', e.target.value)} className="px-3.5 py-2.5">
                <option value="">—</option>
                {MONTHS.map((m) => <option key={m} value={String(m)}>Tháng {m}</option>)}
              </Select>
            </Field>
            <Field label="Năm" error={errors.birthYear}>
              <input type="number" inputMode="numeric" min={1900} max={2100} value={form.birthYear} onChange={(e) => set('birthYear', e.target.value)} className={inputClass(errors.birthYear)} placeholder="Tuỳ chọn" />
            </Field>
            <div className="col-span-3 sm:col-span-1 sm:pb-2.5">
              <Toggle label="Âm lịch" checked={form.birthIsLunar} onChange={(v) => set('birthIsLunar', v)} hint="Nhắc theo ngày âm của từng năm" />
            </div>
          </div>
        </FormSection>

        <FormSection title="Liên hệ & phụ trách">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Điện thoại" error={errors.phone}>
              <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputClass(errors.phone)} placeholder="0901 234 567" />
            </Field>
            <Field label="Email" error={errors.email}>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputClass(errors.email)} placeholder="ten@donvi.vn" />
            </Field>
          </div>
          <Field label="Địa chỉ nhận quà" error={errors.giftAddress}>
            <input value={form.giftAddress} onChange={(e) => set('giftAddress', e.target.value)} className={inputClass(errors.giftAddress)} placeholder="Ví dụ: Văn phòng Ban Giám đốc (qua thư ký)" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <TagInput label="Nhãn" value={form.tags} onChange={(v) => set('tags', v)} error={errors.tags} />
            <Field label="Người phụ trách" htmlFor="ct-owner" error={errors.ownerName}>
              <Select id="ct-owner" value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} className="px-3.5 py-2.5">
                <option value="">Chưa giao</option>
                {withCurrent(VIP_STAFF, form.ownerName).map((name) => <option key={name} value={name}>{name}</option>)}
              </Select>
            </Field>
          </div>
          {isEdit && (
            <Field label="Trạng thái" htmlFor="ct-status" error={errors.status} className="sm:max-w-xs">
              <Select id="ct-status" value={form.status} onChange={(e) => set('status', e.target.value as ContactStatus)} className="px-3.5 py-2.5">
                {(Object.keys(CONTACT_STATUS_LABELS) as ContactStatus[]).map((s) => <option key={s} value={s}>{CONTACT_STATUS_LABELS[s]}</option>)}
              </Select>
            </Field>
          )}
        </FormSection>

        <FormSection title="Người giới thiệu & quan hệ với VIP">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Người giới thiệu" hint="Người giới thiệu đối tác này vào danh bạ (lãnh đạo, bác sĩ...).">
              <EntityCombobox kind="contact" value={referrer} onChange={setReferrer} excludeIds={initial ? [initial.id] : []} />
            </Field>
            <Field label="VIP liên quan" hint="Nếu là người thân, trợ lý hoặc có quan hệ đặc biệt với VIP.">
              <EntityCombobox
                kind="contact"
                value={vip}
                onChange={(next) => {
                  setVip(next);
                  if (!next) setRelationship('');
                }}
                allowNew={false}
                excludeIds={initial ? [initial.id] : []}
              />
            </Field>
          </div>
          {vip && (
            <Field label="Mối quan hệ với VIP" hint="Ví dụ: Vợ/chồng, Con, Thư ký, Trợ lý, Bạn bè...">
              <Select value={relationship} onChange={(e) => setRelationship(e.target.value)} className="px-3.5 py-2.5">
                <option value="">Chọn mối quan hệ với VIP</option>
                {['Vợ/chồng', 'Con', 'Cha/mẹ', 'Anh/chị/em', 'Người thân', 'Trợ lý', 'Thư ký', 'Bạn bè', 'Đồng nghiệp', 'Khác'].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </Field>
          )}
        </FormSection>
        <FormSection title="Sở thích & lưu ý">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hoa yêu thích" error={errors['preferences.flowers']}>
              <input value={form.flowers} onChange={(e) => set('flowers', e.target.value)} className={inputClass(errors['preferences.flowers'])} placeholder="Lan hồ điệp trắng" />
            </Field>
            <Field label="Kiêng kỵ" error={errors['preferences.avoid']}>
              <input value={form.avoid} onChange={(e) => set('avoid', e.target.value)} className={inputClass(errors['preferences.avoid'])} placeholder="Không tặng hoa cúc vàng" />
            </Field>
            <Field label="Món ăn" error={errors['preferences.food']}>
              <input value={form.food} onChange={(e) => set('food', e.target.value)} className={inputClass(errors['preferences.food'])} placeholder="Ăn chay ngày rằm" />
            </Field>
            <Field label="Sở thích" error={errors['preferences.hobbies']}>
              <input value={form.hobbies} onChange={(e) => set('hobbies', e.target.value)} className={inputClass(errors['preferences.hobbies'])} placeholder="Sách lịch sử y học" />
            </Field>
          </div>
          {canEditSensitive && (
            <div className="rounded-2xl border border-dashed border-red-200 bg-red-50/30 p-4">
              <Field label="Lưu ý nhạy cảm" error={errors.sensitiveNote} hint="Chỉ người phụ trách và quản trị thấy. Chỉ ghi điều cần để chăm sóc, không ghi chẩn đoán.">
                <textarea rows={2} value={form.sensitiveNote} onChange={(e) => set('sensitiveNote', e.target.value)} className={inputClass(errors.sensitiveNote, 'resize-none')} placeholder="Ví dụ: hạn chế đồ ngọt" />
              </Field>
              <p className="mt-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-red-600"><Lock className="h-3 w-3" aria-hidden="true" />Nhạy cảm</p>
            </div>
          )}
          <Field label="Ghi chú" error={errors.note}>
            <textarea rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} className={inputClass(errors.note, 'resize-none')} placeholder="Không bắt buộc" />
          </Field>
        </FormSection>

        <ModalFooter onCancel={onClose} saving={saving} submitLabel={isEdit ? 'Lưu thay đổi' : 'Thêm cá nhân'} />
      </form>
    </ModalShell>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-cyan-700">{title}</legend>
      {children}
    </fieldset>
  );
}
