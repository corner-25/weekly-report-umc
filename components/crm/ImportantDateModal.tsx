'use client';

import { useState, type FormEvent } from 'react';
import { Select } from '@/components/ui/Select';
import { DATE_KIND_LABELS } from '@/lib/crm/constants';
import type { ImportantDateInput } from '@/lib/crm/schemas';
import { CrmApiError, crmSend, errorMessage } from './api';
import { cleanText, toInt } from './format';
import type { DateKind, ImportantDateDTO } from './types';
import { ErrorBanner, Field, ModalFooter, ModalShell, Toggle, inputClass } from './ui';

export type DateOwner = { contactId: string } | { organizationId: string };

interface ImportantDateModalProps {
  owner: DateOwner;
  initial?: ImportantDateDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const MAX_REMIND_DAYS = 60;

export function ImportantDateModal({ owner, initial, onClose, onSaved }: ImportantDateModalProps) {
  const isOrganization = 'organizationId' in owner;
  const [kind, setKind] = useState<DateKind>(initial?.kind ?? (isOrganization ? 'FOUNDING' : 'APPOINTMENT'));
  const [label, setLabel] = useState(initial?.label ?? '');
  const [day, setDay] = useState(initial ? String(initial.day) : '');
  const [month, setMonth] = useState(initial ? String(initial.month) : '');
  const [year, setYear] = useState(initial?.year ? String(initial.year) : '');
  const [isLunar, setIsLunar] = useState(initial?.isLunar ?? false);
  const [repeatsYearly, setRepeatsYearly] = useState(initial?.repeatsYearly ?? true);
  const [remind, setRemind] = useState(initial?.remindDaysBefore != null ? String(initial.remindDaysBefore) : '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState('');
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!day) next.day = 'Chọn ngày';
    if (!month) next.month = 'Chọn tháng';
    const y = toInt(year);
    if (year && (y === undefined || y < 1900 || y > 2100)) next.year = 'Năm không hợp lệ';
    const r = toInt(remind);
    if (remind && (r === undefined || r < 0 || r > MAX_REMIND_DAYS)) next.remindDaysBefore = `Từ 0 đến ${MAX_REMIND_DAYS} ngày`;
    if (!repeatsYearly && !year) next.year = 'Dịp một lần cần ghi năm';
    return next;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const clientErrors = validate();
    setErrors(clientErrors);
    setBanner('');
    if (Object.keys(clientErrors).length) return;

    setSaving(true);
    try {
      const body: ImportantDateInput = {
        ...owner,
        kind,
        label: cleanText(label),
        day: Number(day),
        month: Number(month),
        year: toInt(year),
        isLunar,
        repeatsYearly,
        remindDaysBefore: toInt(remind),
        note: cleanText(note),
      };
      if (initial) await crmSend(`/api/crm/important-dates/${initial.id}`, 'PATCH', body);
      else await crmSend('/api/crm/important-dates', 'POST', body);
      onSaved();
    } catch (error) {
      if (error instanceof CrmApiError && error.issues.length) setErrors(error.fieldErrors);
      setBanner(errorMessage(error, 'Không thể lưu ngày quan trọng.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={initial ? 'Sửa ngày quan trọng' : 'Thêm ngày quan trọng'} subtitle="Hệ thống tự đổi ngày âm lịch sang dương lịch mỗi năm." onClose={onClose} size="md">
      <form onSubmit={handleSubmit} noValidate className="space-y-5 p-5 sm:p-6">
        <ErrorBanner message={banner} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Loại" htmlFor="idate-kind" error={errors.kind}>
            <Select id="idate-kind" value={kind} onChange={(e) => setKind(e.target.value as DateKind)} className="px-3.5 py-2.5">
              {(Object.keys(DATE_KIND_LABELS) as DateKind[]).map((k) => <option key={k} value={k}>{DATE_KIND_LABELS[k]}</option>)}
            </Select>
          </Field>
          <Field label="Nhãn" error={errors.label}>
            <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass(errors.label)} placeholder={isOrganization ? 'Kỷ niệm thành lập' : 'Nhận chức Giám đốc'} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Ngày" required htmlFor="idate-day" error={errors.day}>
            <Select id="idate-day" value={day} onChange={(e) => setDay(e.target.value)} className="px-3.5 py-2.5">
              <option value="">—</option>
              {DAYS.map((d) => <option key={d} value={String(d)}>{d}</option>)}
            </Select>
          </Field>
          <Field label="Tháng" required htmlFor="idate-month" error={errors.month}>
            <Select id="idate-month" value={month} onChange={(e) => setMonth(e.target.value)} className="px-3.5 py-2.5">
              <option value="">—</option>
              {MONTHS.map((m) => <option key={m} value={String(m)}>Tháng {m}</option>)}
            </Select>
          </Field>
          <Field label="Năm" error={errors.year}>
            <input type="number" inputMode="numeric" min={1900} max={2100} value={year} onChange={(e) => setYear(e.target.value)} className={inputClass(errors.year)} placeholder="Tuỳ chọn" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle label="Âm lịch" checked={isLunar} onChange={setIsLunar} />
          <Toggle label="Lặp lại hằng năm" checked={repeatsYearly} onChange={setRepeatsYearly} hint="Tắt nếu là dịp một lần" />
        </div>
        <Field label="Nhắc trước (ngày)" error={errors.remindDaysBefore} hint="Để trống: theo hạng (VIP 7 ngày, A 3, B 1, C 0).">
          <input type="number" inputMode="numeric" min={0} max={MAX_REMIND_DAYS} value={remind} onChange={(e) => setRemind(e.target.value)} className={inputClass(errors.remindDaysBefore, 'sm:max-w-[200px]')} placeholder="Theo hạng" />
        </Field>
        <Field label="Ghi chú" error={errors.note}>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass(errors.note, 'resize-none')} />
        </Field>
        <ModalFooter onCancel={onClose} saving={saving} submitLabel={initial ? 'Lưu thay đổi' : 'Thêm ngày'} />
      </form>
    </ModalShell>
  );
}
