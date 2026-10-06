'use client';

/**
 * Cửa sổ chi tiết + form thêm/sửa MOU dùng chung cho bảng điều hành và danh
 * sách. Sửa lấy đủ dữ liệu từ bản chi tiết để không xoá mất trường không hiện
 * trên danh sách (nội dung, ghi chú, điều khoản…).
 */
import { useMOUDetail } from '@/lib/swr';
import { MOUDetail } from '../MOUDetail';
import { MOUForm } from '../MOUForm';

type Detail = Parameters<typeof MOUDetail>[0]['mou'];
type FormData = NonNullable<Parameters<typeof MOUForm>[0]['initialData']>;

function toFormData(m: Detail): FormData {
  return {
    id: m.id,
    title: m.title,
    mouNumber: m.mouNumber ?? '',
    category: m.category,
    status: m.status,
    partnerName: m.partnerName,
    partnerCountry: m.partnerCountry ?? '',
    partnerContact: m.partnerContact ?? '',
    signedDate: m.signedDate ?? '',
    effectiveDate: m.effectiveDate ?? '',
    expiryDate: m.expiryDate ?? '',
    autoRenew: m.autoRenew,
    purpose: m.purpose ?? '',
    scope: m.scope ?? '',
    keyTerms: m.keyTerms ?? '',
    fileUrl: m.fileUrl ?? '',
    notes: m.notes ?? '',
    departmentId: m.department?.id ?? '',
    contactPerson: m.contactPerson ?? '',
    contactEmail: m.contactEmail ?? '',
    contactPhone: m.contactPhone ?? '',
  };
}

export type HostMode = { kind: 'none' } | { kind: 'view'; id: string } | { kind: 'edit'; id: string } | { kind: 'create' };

export function MouDetailHost({
  mode,
  onChange,
  departments,
  onSaved,
}: {
  mode: HostMode;
  onChange: (mode: HostMode) => void;
  departments: Array<{ id: string; name: string }>;
  onSaved: () => void;
}) {
  const id = mode.kind === 'view' || mode.kind === 'edit' ? mode.id : null;
  const { data, mutate } = useMOUDetail(id) as { data: Detail | undefined; mutate: () => Promise<unknown> };
  const detail = data && data.id === id ? data : undefined;

  if (mode.kind === 'create') {
    return <MOUForm departments={departments} onClose={() => onChange({ kind: 'none' })} onSuccess={() => { onChange({ kind: 'none' }); onSaved(); }} />;
  }
  if (mode.kind === 'edit' && detail) {
    return (
      <MOUForm
        initialData={toFormData(detail)}
        departments={departments}
        onClose={() => onChange({ kind: 'view', id: detail.id })}
        onSuccess={() => {
          void mutate();
          onChange({ kind: 'view', id: detail.id });
          onSaved();
        }}
      />
    );
  }
  if (mode.kind === 'view' && detail) {
    return (
      <MOUDetail
        mou={detail}
        onClose={() => onChange({ kind: 'none' })}
        onEdit={() => onChange({ kind: 'edit', id: detail.id })}
        onRefresh={() => {
          void mutate();
          onSaved();
        }}
      />
    );
  }
  return null;
}
