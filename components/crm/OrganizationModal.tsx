'use client';

import { useState, type FormEvent } from 'react';
import { Select } from '@/components/ui/Select';
import { ORGANIZATION_CATEGORIES, ORGANIZATION_SCOPES, VIP_STAFF } from '@/lib/crm/constants';
import type { OrganizationInput } from '@/lib/crm/schemas';
import { CrmApiError, crmSend, errorMessage } from './api';
import { textOrClear, withCurrent, type Clearable } from './format';
import type { OrganizationDetail, OrganizationType } from './types';
import { ErrorBanner, Field, ModalFooter, ModalShell, TagInput, inputClass } from './ui';

interface OrganizationModalProps {
  initial?: OrganizationDetail | null;
  onClose: () => void;
  onSaved: (saved: { id: string }) => void;
}

interface FormState {
  name: string;
  type: OrganizationType;
  category: string;
  scope: string;
  address: string;
  website: string;
  phone: string;
  email: string;
  ownerName: string;
  tags: string[];
  note: string;
}

function initialState(initial?: OrganizationDetail | null): FormState {
  return {
    name: initial?.name ?? '',
    type: initial?.type ?? 'OTHER',
    category: initial?.category ?? '',
    scope: initial?.scope ?? '',
    address: initial?.address ?? '',
    website: initial?.website ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    ownerName: initial?.ownerName ?? '',
    tags: initial?.tags ?? [],
    note: initial?.note ?? '',
  };
}

export function OrganizationModal({ initial, onClose, onSaved }: OrganizationModalProps) {
  const [form, setForm] = useState<FormState>(() => initialState(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState('');
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBanner('');
    if (!form.name.trim()) {
      setErrors({ name: 'Tên tổ chức là bắt buộc' });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const isEdit = Boolean(initial);
      const body: Clearable<OrganizationInput> = {
        name: form.name.trim(),
        // Loại gộp của CRM suy từ loại chi tiết; tổ chức quốc tế theo phạm vi. Không phân hạng tổ chức.
        type: form.scope === 'Tổ chức quốc tế' ? 'INTERNATIONAL' : ORGANIZATION_CATEGORIES[form.category] ?? form.type,
        category: textOrClear(form.category, isEdit),
        scope: textOrClear(form.scope, isEdit),
        address: textOrClear(form.address, isEdit),
        website: textOrClear(form.website, isEdit),
        phone: textOrClear(form.phone, isEdit),
        email: textOrClear(form.email, isEdit),
        ownerName: textOrClear(form.ownerName, isEdit),
        tags: form.tags,
        note: textOrClear(form.note, isEdit),
      };
      const saved = initial
        ? await crmSend<{ id: string }>(`/api/crm/organizations/${initial.id}`, 'PATCH', body)
        : await crmSend<{ id: string }>('/api/crm/organizations', 'POST', body);
      onSaved(saved);
    } catch (error) {
      if (error instanceof CrmApiError && error.issues.length) setErrors(error.fieldErrors);
      setBanner(errorMessage(error, 'Không thể lưu tổ chức.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={initial ? 'Sửa thông tin tổ chức' : 'Thêm tổ chức'} subtitle="Ngày thành lập, kỷ niệm thêm trong hồ sơ sau khi lưu." onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="space-y-5 p-5 sm:p-6">
        <ErrorBanner message={banner} />
        <Field label="Tên tổ chức" required error={errors.name}>
          <input data-autofocus value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass(errors.name)} placeholder="Bệnh viện X" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Loại tổ chức" htmlFor="org-category" error={errors.category}>
            <Select id="org-category" value={form.category} onChange={(e) => set('category', e.target.value)} className="px-3.5 py-2.5">
              <option value="">Chưa phân loại</option>
              {withCurrent(Object.keys(ORGANIZATION_CATEGORIES), form.category).map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Phạm vi" htmlFor="org-scope" error={errors.scope}>
            <Select id="org-scope" value={form.scope} onChange={(e) => set('scope', e.target.value)} className="px-3.5 py-2.5">
              <option value="">Chưa ghi</option>
              {withCurrent(ORGANIZATION_SCOPES, form.scope).map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Địa chỉ" error={errors.address}>
          <input value={form.address} onChange={(e) => set('address', e.target.value)} className={inputClass(errors.address)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Điện thoại" error={errors.phone}>
            <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputClass(errors.phone)} />
          </Field>
          <Field label="Email" error={errors.email}>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputClass(errors.email)} />
          </Field>
          <Field label="Website" error={errors.website}>
            <input value={form.website} onChange={(e) => set('website', e.target.value)} className={inputClass(errors.website)} placeholder="benhvien.vn" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TagInput label="Nhãn" value={form.tags} onChange={(v) => set('tags', v)} error={errors.tags} />
          <Field label="Người phụ trách" htmlFor="org-owner" error={errors.ownerName}>
            <Select id="org-owner" value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} className="px-3.5 py-2.5">
              <option value="">Chưa giao</option>
              {withCurrent(VIP_STAFF, form.ownerName).map((name) => <option key={name} value={name}>{name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Ghi chú" error={errors.note}>
          <textarea rows={3} value={form.note} onChange={(e) => set('note', e.target.value)} className={inputClass(errors.note, 'resize-none')} />
        </Field>
        <ModalFooter onCancel={onClose} saving={saving} submitLabel={initial ? 'Lưu thay đổi' : 'Thêm tổ chức'} />
      </form>
    </ModalShell>
  );
}
