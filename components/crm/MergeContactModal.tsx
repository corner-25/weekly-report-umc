'use client';

import { useState, type FormEvent } from 'react';
import { crmSend, errorMessage } from './api';
import { EntityCombobox, type ComboValue } from './EntityCombobox';
import { ErrorBanner, Field, ModalFooter, ModalShell } from './ui';

interface MergeContactModalProps {
  contactId: string;
  contactName: string;
  onClose: () => void;
  onSaved: () => void;
}

/** Chọn hồ sơ trùng để gộp vào hồ sơ đang xem. */
export function MergeContactModal({ contactId, contactName, onClose, onSaved }: MergeContactModalProps) {
  const [duplicate, setDuplicate] = useState<ComboValue | null>(null);
  const [fieldError, setFieldError] = useState('');
  const [banner, setBanner] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const sourceId = duplicate && 'id' in duplicate ? duplicate.id : null;
    setBanner('');
    if (!sourceId) {
      setFieldError('Chọn hồ sơ bị trùng');
      return;
    }
    setFieldError('');
    setSaving(true);
    try {
      await crmSend(`/api/crm/contacts/${contactId}/merge`, 'POST', { sourceId });
      onSaved();
    } catch (error) {
      setBanner(errorMessage(error, 'Không gộp được hồ sơ.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Gộp hồ sơ trùng" subtitle={`Giữ lại hồ sơ “${contactName}”.`} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} noValidate className="space-y-5 p-5 sm:p-6">
        <ErrorBanner message={banner} />
        <Field label="Hồ sơ bị trùng" required htmlFor="merge-source" error={fieldError}>
          <EntityCombobox
            kind="contact"
            inputId="merge-source"
            value={duplicate}
            onChange={setDuplicate}
            allowNew={false}
            excludeIds={[contactId]}
            invalid={Boolean(fieldError)}
          />
        </Field>
        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          Lượt dẫn khách, dẫn đoàn, chức vụ, người thân và ngày quan trọng của hồ sơ trùng sẽ chuyển sang hồ sơ này.
          Thông tin còn trống được bổ sung, ghi chú được nối lại. Hồ sơ trùng bị xoá và không hoàn tác được.
        </p>
        <ModalFooter onCancel={onClose} saving={saving} submitLabel="Gộp hồ sơ" />
      </form>
    </ModalShell>
  );
}
