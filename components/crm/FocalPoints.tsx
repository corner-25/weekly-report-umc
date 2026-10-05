'use client';

/**
 * Đầu mối liên hệ của tổ chức: người Phòng HC liên lạc khi cần làm việc với đơn
 * vị. Hiện số điện thoại, email bấm gọi/gửi được ngay; thêm đầu mối từ danh bạ
 * hoặc nhập nhanh người mới; đánh dấu/bỏ đánh dấu người liên hệ có sẵn.
 */
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Mail, Phone, Plus, Star, StarOff, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CrmApiError, crmSend, errorMessage } from './api';
import { EntityCombobox, type ComboValue } from './EntityCombobox';
import { cleanText, displayName } from './format';
import type { OrganizationContact } from './types';
import { ErrorBanner, Field, ICON_BTN, ModalFooter, ModalShell, SectionCard, inputClass } from './ui';

function ContactLinks({ c }: { c: OrganizationContact }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {c.phone ? (
        <a href={`tel:${c.phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />{c.phone}
        </a>
      ) : <span className="text-slate-400">Chưa có số điện thoại</span>}
      {c.email && (
        <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
          <Mail className="h-3.5 w-3.5" aria-hidden="true" />{c.email}
        </a>
      )}
    </span>
  );
}

export function FocalPointsCard({
  contacts,
  onAdd,
  onToggle,
}: {
  contacts: OrganizationContact[];
  onAdd: () => void;
  onToggle: (c: OrganizationContact, isFocalPoint: boolean) => void;
}) {
  const current = contacts.filter((c) => c.isCurrent);
  const focal = current.filter((c) => c.isFocalPoint);
  const others = current.filter((c) => !c.isFocalPoint);
  const former = contacts.filter((c) => !c.isCurrent);

  return (
    <SectionCard
      title="Đầu mối liên hệ"
      icon={<Star className="h-4 w-4 text-amber-500" aria-hidden="true" />}
      action={
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Thêm đầu mối
        </button>
      }
    >
      {focal.length === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-3 text-sm text-amber-900">
          Chưa có đầu mối. Bấm <b>Thêm đầu mối</b> để lưu người Phòng HC liên lạc khi làm việc với đơn vị này
          {others.length > 0 && <>, hoặc gắn sao cho một người liên hệ bên dưới</>}.
        </div>
      ) : (
        <ul className="space-y-2">
          {focal.map((c) => (
            <li key={c.positionId} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
              <div className="min-w-0 flex-1">
                <Link href={`/dashboard/crm/contacts/${c.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">{displayName(c)}</Link>
                <p className="text-xs text-slate-600">{[c.title, c.department].filter(Boolean).join(' · ')}</p>
                <div className="mt-1"><ContactLinks c={c} /></div>
              </div>
              <button type="button" onClick={() => onToggle(c, false)} className={cn(ICON_BTN, 'text-amber-500')} title="Bỏ đầu mối">
                <StarOff className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Bỏ đầu mối {c.fullName}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {others.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400"><Users className="h-3.5 w-3.5" aria-hidden="true" />Người liên hệ khác</p>
          <ul className="divide-y divide-dashed divide-slate-200">
            {others.map((c) => (
              <li key={c.positionId} className="flex items-start gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/crm/contacts/${c.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">{displayName(c)}</Link>
                  {c.title && <span className="text-slate-500"> · {c.title}</span>}
                  <div className="mt-0.5"><ContactLinks c={c} /></div>
                </div>
                <button type="button" onClick={() => onToggle(c, true)} className={ICON_BTN} title="Đặt làm đầu mối">
                  <Star className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Đặt {c.fullName} làm đầu mối</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {former.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Đã từng làm việc tại đây</p>
          <ul className="space-y-1 text-sm">
            {former.map((c) => (
              <li key={c.positionId}>
                <Link href={`/dashboard/crm/contacts/${c.id}`} className="text-slate-500 hover:text-brand-700 hover:underline">{displayName(c)}</Link>
                {c.title && <span className="text-slate-400"> · {c.title}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

/** Thêm đầu mối: chọn người trong danh bạ hoặc nhập nhanh người mới. */
export function FocalPointModal({ organizationId, organizationName, onClose, onSaved }: { organizationId: string; organizationName: string; onClose: () => void; onSaved: () => void }) {
  const [person, setPerson] = useState<ComboValue | null>(null);
  const [academicTitle, setAcademicTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState('');
  const [saving, setSaving] = useState(false);
  const isNew = person !== null && 'newName' in person;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBanner('');
    if (!person) {
      setErrors({ contactId: 'Chọn người trong danh bạ hoặc gõ họ tên người mới' });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await crmSend(`/api/crm/organizations/${organizationId}/focal-points`, 'POST', {
        ...('id' in person
          ? { contactId: person.id }
          : { newContact: { fullName: person.newName.trim(), academicTitle: cleanText(academicTitle), phone: cleanText(phone), email: cleanText(email) } }),
        title: cleanText(title),
      });
      onSaved();
    } catch (error) {
      if (error instanceof CrmApiError && error.issues.length) {
        const f = error.fieldErrors;
        setErrors({ ...f, contactId: f.contactId ?? f['newContact.fullName'], email: f['newContact.email'], phone: f['newContact.phone'] });
      }
      setBanner(errorMessage(error, 'Không lưu được đầu mối.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Thêm đầu mối liên hệ" subtitle={organizationName} onClose={onClose} size="md">
      <form onSubmit={submit} noValidate className="space-y-5 p-5 sm:p-6">
        <ErrorBanner message={banner} />
        <Field label="Người đầu mối" required htmlFor="fp-person" error={errors.contactId} hint="Tìm trong danh bạ; chưa có thì gõ họ tên để tạo hồ sơ mới.">
          <EntityCombobox kind="contact" inputId="fp-person" value={person} onChange={setPerson} invalid={Boolean(errors.contactId)} placeholder="Họ tên" />
        </Field>
        {isNew && (
          <div className="grid gap-4 rounded-xl bg-slate-50 p-3 sm:grid-cols-3">
            <Field label="Học hàm, học vị">
              <input value={academicTitle} onChange={(e) => setAcademicTitle(e.target.value)} className={inputClass()} placeholder="ThS.BS." />
            </Field>
            <Field label="Điện thoại" error={errors.phone}>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass(errors.phone)} placeholder="0901 234 567" />
            </Field>
            <Field label="Email" error={errors.email}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass(errors.email)} />
            </Field>
          </div>
        )}
        <Field label="Chức vụ tại đơn vị" hint="Để trống sẽ ghi “Đầu mối liên hệ”.">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass()} placeholder="Chuyên viên Phòng Hành chính" />
        </Field>
        <ModalFooter onCancel={onClose} saving={saving} submitLabel="Lưu đầu mối" />
      </form>
    </ModalShell>
  );
}
