'use client';

/** Thêm / sửa phòng ban (tên, mô tả) — gọi /api/departments như trước. */
import { useState, type FormEvent } from 'react';
import { crmFetch, errorMessage } from '@/components/crm/api';
import { ErrorBanner, Field, ModalFooter, ModalShell, inputClass } from '@/components/crm/ui';

export interface EditableDepartment {
  id: string;
  name: string;
  description: string | null;
}

interface DepartmentFormProps {
  /** null = thêm mới. */
  department: EditableDepartment | null;
  onCancel: () => void;
  onSaved: (saved: EditableDepartment) => void;
}

const NAME_MAX = 200;

export function DepartmentForm({ department, onCancel, onSaved }: DepartmentFormProps) {
  const [name, setName] = useState(department?.name ?? '');
  const [description, setDescription] = useState(department?.description ?? '');
  const [nameError, setNameError] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setNameError('Nhập tên phòng.');
    if (trimmed.length > NAME_MAX) return setNameError(`Tên phòng tối đa ${NAME_MAX} ký tự.`);
    setNameError('');
    setError('');
    setSaving(true);
    try {
      const saved = await crmFetch<EditableDepartment>(department ? `/api/departments/${department.id}` : '/api/departments', {
        method: department ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, description: description.trim() }),
      });
      onSaved({ id: saved.id, name: saved.name, description: saved.description });
    } catch (saveError) {
      setError(errorMessage(saveError, 'Không lưu được phòng ban.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-5 sm:p-6" noValidate>
      <ErrorBanner message={error} />
      <Field label="Tên phòng" required error={nameError}>
        <input
          data-autofocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          required
          aria-invalid={Boolean(nameError)}
          className={inputClass(nameError)}
        />
      </Field>
      <Field label="Mô tả" hint="Chức năng, nhiệm vụ chính — hiện ở đầu hồ sơ phòng.">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass()} />
      </Field>
      <ModalFooter onCancel={onCancel} saving={saving} submitLabel={department ? 'Lưu thay đổi' : 'Thêm phòng'} />
    </form>
  );
}

/** Hộp thoại riêng cho form — dùng ở trang hồ sơ và nút "Thêm phòng". */
export function DepartmentFormModal({ department, onClose, onSaved }: { department: EditableDepartment | null; onClose: () => void; onSaved: (saved: EditableDepartment) => void }) {
  return (
    <ModalShell title={department ? 'Sửa phòng ban' : 'Thêm phòng ban'} subtitle={department?.name} onClose={onClose} size="md">
      <DepartmentForm department={department} onCancel={onClose} onSaved={onSaved} />
    </ModalShell>
  );
}
