'use client';

import { useState, type FormEvent } from 'react';
import type { PositionInput } from '@/lib/crm/schemas';
import { CrmApiError, crmSend, errorMessage } from './api';
import { EntityCombobox, comboLabel, type ComboValue } from './EntityCombobox';
import { cleanText } from './format';
import { ErrorBanner, Field, ModalFooter, ModalShell, Toggle, inputClass } from './ui';

interface PositionModalProps {
  contactId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function PositionModal({ contactId, onClose, onSaved }: PositionModalProps) {
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState<ComboValue | null>(null);
  const [department, setDepartment] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const clientErrors: Record<string, string> = {};
    if (!title.trim()) clientErrors.title = 'Chức vụ là bắt buộc';
    if (fromDate && toDate && toDate < fromDate) clientErrors.toDate = 'Ngày kết thúc phải sau ngày bắt đầu';
    setErrors(clientErrors);
    setBanner('');
    if (Object.keys(clientErrors).length) return;

    setSaving(true);
    try {
      const body: PositionInput = {
        title: title.trim(),
        // API nhận tổ chức theo tên: có sẵn thì khớp, chưa có thì tạo mới.
        organizationName: cleanText(comboLabel(organization)),
        department: cleanText(department),
        fromDate: fromDate || undefined,
        toDate: isCurrent ? undefined : toDate || undefined,
        isCurrent,
      };
      await crmSend(`/api/crm/contacts/${contactId}/positions`, 'POST', body);
      onSaved();
    } catch (error) {
      if (error instanceof CrmApiError && error.issues.length) setErrors(error.fieldErrors);
      setBanner(errorMessage(error, 'Không thể lưu chức vụ.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Thêm chức vụ" subtitle="Ghi lại chức vụ hiện tại hoặc đã từng giữ." onClose={onClose} size="md">
      <form onSubmit={handleSubmit} noValidate className="space-y-5 p-5 sm:p-6">
        <ErrorBanner message={banner} />
        <Field label="Chức vụ" required error={errors.title}>
          <input data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass(errors.title)} placeholder="Phó Giám đốc" />
        </Field>
        <Field label="Tổ chức" htmlFor="pos-org" error={errors.organizationName}>
          <EntityCombobox kind="organization" inputId="pos-org" value={organization} onChange={setOrganization} invalid={Boolean(errors.organizationName)} />
        </Field>
        <Field label="Khoa, phòng, bộ phận" error={errors.department}>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass(errors.department)} />
        </Field>
        <Toggle label="Đang giữ chức vụ này" checked={isCurrent} onChange={setIsCurrent} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Từ ngày" error={errors.fromDate}>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputClass(errors.fromDate)} />
          </Field>
          {!isCurrent && (
            <Field label="Đến ngày" error={errors.toDate}>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputClass(errors.toDate)} />
            </Field>
          )}
        </div>
        <ModalFooter onCancel={onClose} saving={saving} submitLabel="Thêm chức vụ" />
      </form>
    </ModalShell>
  );
}
