'use client';

import { useState, type FormEvent } from 'react';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { RELATION_KIND_LABELS } from '@/lib/crm/constants';
import type { RelationInput } from '@/lib/crm/schemas';
import { CrmApiError, crmSend, errorMessage } from './api';
import { EntityCombobox, type ComboValue } from './EntityCombobox';
import { cleanText } from './format';
import type { RelationKind } from './types';
import { ErrorBanner, Field, ModalFooter, ModalShell, inputClass } from './ui';

interface RelationModalProps {
  contactId: string;
  onClose: () => void;
  onSaved: () => void;
}

type Source = 'linked' | 'free';

export function RelationModal({ contactId, onClose, onSaved }: RelationModalProps) {
  const [kind, setKind] = useState<RelationKind>('ASSISTANT');
  const [source, setSource] = useState<Source>('linked');
  const [person, setPerson] = useState<ComboValue | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const linkedId = source === 'linked' && person && 'id' in person ? person.id : undefined;
    const clientErrors: Record<string, string> = {};
    if (source === 'linked' && !linkedId) clientErrors.toContactId = 'Chọn một người có hồ sơ';
    if (source === 'free' && !name.trim()) clientErrors.name = 'Ghi họ tên người thân, trợ lý';
    setErrors(clientErrors);
    setBanner('');
    if (Object.keys(clientErrors).length) return;

    setSaving(true);
    try {
      const body: RelationInput = {
        kind,
        toContactId: linkedId,
        name: source === 'free' ? cleanText(name) : undefined,
        phone: source === 'free' ? cleanText(phone) : undefined,
        note: cleanText(note),
      };
      await crmSend(`/api/crm/contacts/${contactId}/relations`, 'POST', body);
      onSaved();
    } catch (error) {
      if (error instanceof CrmApiError && error.issues.length) setErrors(error.fieldErrors);
      setBanner(errorMessage(error, 'Không thể lưu người thân, trợ lý.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Thêm người thân, trợ lý" subtitle="Người nhận quà thay, người đặt lịch, gia đình…" onClose={onClose} size="md">
      <form onSubmit={handleSubmit} noValidate className="space-y-5 p-5 sm:p-6">
        <ErrorBanner message={banner} />
        <Field label="Quan hệ" htmlFor="rel-kind" error={errors.kind}>
          <Select id="rel-kind" value={kind} onChange={(e) => setKind(e.target.value as RelationKind)} className="px-3.5 py-2.5">
            {(Object.keys(RELATION_KIND_LABELS) as RelationKind[]).map((k) => <option key={k} value={k}>{RELATION_KIND_LABELS[k]}</option>)}
          </Select>
        </Field>

        <div role="radiogroup" aria-label="Cách nhập" className="inline-flex rounded-xl bg-slate-100 p-1">
          {([['linked', 'Người có hồ sơ'], ['free', 'Chỉ ghi tên']] as const).map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={source === value}
              onClick={() => setSource(value)}
              className={cn('rounded-lg px-3 py-1.5 text-sm font-semibold transition', source === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
            >
              {text}
            </button>
          ))}
        </div>

        {source === 'linked' ? (
          <Field label="Người có hồ sơ" required htmlFor="rel-person" error={errors.toContactId}>
            <EntityCombobox kind="contact" inputId="rel-person" value={person} onChange={setPerson} allowNew={false} excludeIds={[contactId]} invalid={Boolean(errors.toContactId)} />
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Họ tên" required error={errors.name}>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass(errors.name)} />
            </Field>
            <Field label="Điện thoại" error={errors.phone}>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass(errors.phone)} />
            </Field>
          </div>
        )}
        <Field label="Ghi chú" error={errors.note}>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass(errors.note)} placeholder="Ví dụ: nhận quà thay, liên hệ đặt lịch" />
        </Field>
        <ModalFooter onCancel={onClose} saving={saving} submitLabel="Thêm" />
      </form>
    </ModalShell>
  );
}
