'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Building2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ORGANIZATION_CATEGORIES } from '@/lib/crm/constants';
import { crmFetch, errorMessage } from '../api';
import { OrganizationModal } from '../OrganizationModal';
import { displayName, formatDate } from '../format';
import type { OrganizationDetail, OrganizationListItem } from '../types';
import { EmptyState, ErrorBanner, PANEL } from '../ui';
import { ContactLine, FilterSelect, RowActions, SearchBox, Segmented, useDebounced } from './shared';

type Focal = '' | 'yes' | 'no';
const FOCAL_OPTIONS: Array<{ value: Focal; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'yes', label: 'Đã có đầu mối' },
  { value: 'no', label: 'Chưa có đầu mối' },
];

function FocalCell({ o }: { o: OrganizationListItem }) {
  if (o.focalPoints.length === 0) {
    return (
      <Link href={`/dashboard/crm/organizations/${o.id}`} className="text-xs font-medium text-amber-700 hover:underline">
        + Thêm đầu mối
      </Link>
    );
  }
  return (
    <ul className="space-y-1.5 min-w-0">
      {o.focalPoints.map((f) => (
        <li key={f.id} className="min-w-0 text-sm">
          <Link href={`/dashboard/crm/contacts/${f.id}`} className="inline-flex max-w-full items-center gap-1 font-semibold text-slate-800 hover:text-brand-700 hover:underline truncate" title={displayName(f)}>
            <Star className="h-3 w-3 shrink-0 text-amber-500" aria-hidden="true" /><span className="truncate">{displayName(f)}</span>
          </Link>
          <span className="block truncate text-xs text-slate-500" title={f.title || undefined}>{f.title}</span>
          <ContactLine phone={f.phone} email={f.email} />
        </li>
      ))}
    </ul>
  );
}

/** Danh bạ tổ chức — không phân hạng; đầu mối liên hệ hiện ngay trên dòng. */
export function OrganizationsTab({ reloadKey, onChanged }: { reloadKey: number; onChanged: () => void }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [focal, setFocal] = useState<Focal>('');
  const [items, setItems] = useState<OrganizationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<OrganizationDetail | null>(null);
  const debouncedSearch = useDebounced(search);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (category) params.set('category', category);
    if (focal) params.set('focal', focal);
    setLoading(true);
    setError('');
    crmFetch<OrganizationListItem[]>(`/api/crm/organizations?${params}`, { signal: controller.signal })
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(loadError, 'Không thể tải danh sách tổ chức.'));
        setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedSearch, category, focal, reloadKey]);

  const openEdit = (id: string) => {
    crmFetch<OrganizationDetail>(`/api/crm/organizations/${id}`).then(setEditing).catch((e) => setError(errorMessage(e, 'Không mở được hồ sơ để sửa.')));
  };
  const hasFilter = Boolean(search || category || focal);

  return (
    <div className={PANEL}>
      <div className="space-y-3 border-b border-slate-100 p-4">
        <Segmented label="Đầu mối" options={FOCAL_OPTIONS} value={focal} onChange={setFocal} />
        <div className="flex flex-wrap gap-3">
          <SearchBox value={search} onChange={setSearch} placeholder="Tìm tên tổ chức (cả tên cũ, viết tắt)..." />
          <FilterSelect label="Lọc loại tổ chức" value={category} onChange={setCategory}>
            <option value="">Mọi loại tổ chức</option>
            {Object.keys(ORGANIZATION_CATEGORIES).map((c) => <option key={c} value={c}>{c}</option>)}
          </FilterSelect>
        </div>
      </div>
      {error && <div className="p-4"><ErrorBanner message={error} /></div>}

      {loading && items.length === 0 ? (
        <p className="p-12 text-center text-slate-500">Đang tải dữ liệu...</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-12 w-12" />}
          title={hasFilter ? 'Không có tổ chức nào khớp bộ lọc' : 'Chưa có tổ chức nào'}
          hint={hasFilter ? 'Bỏ bớt điều kiện để xem lại.' : 'Nhấn “Thêm tổ chức” để tạo hồ sơ đầu tiên.'}
        />
      ) : (
        <div className={cn(loading && 'opacity-60 transition-opacity')}>
          <p className="px-5 pt-3 text-xs text-slate-500">{items.length} tổ chức · {items.filter((o) => o.focalPoints.length > 0).length} đã có đầu mối</p>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full table-fixed divide-y divide-slate-100">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[26%]" />
                <col className="w-[9%]" />
                <col className="w-[10%]" />
                <col className="w-[13%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3">Tổ chức</th>
                  <th scope="col" className="px-4 py-3">Đầu mối liên hệ</th>
                  <th scope="col" className="px-3 py-3 text-right" title="Số người liên hệ hiện tại">Người LH</th>
                  <th scope="col" className="px-3 py-3 text-right" title="Số lượt tiếp đoàn đã thực hiện">Lượt tiếp</th>
                  <th scope="col" className="px-4 py-3">Gần nhất</th>
                  <th scope="col" className="px-2 py-3 text-right"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {items.map((o) => (
                  <tr key={o.id} className="align-top hover:bg-brand-50/30">
                    <td className="min-w-0 overflow-hidden px-4 py-3.5">
                      <Link href={`/dashboard/crm/organizations/${o.id}`} className="block truncate font-semibold text-slate-900 hover:text-brand-700 hover:underline" title={o.name}>{o.name}</Link>
                      <span className="block truncate text-xs text-slate-500">{[o.category, o.scope && o.scope !== 'Trong nước' ? o.scope : null].filter(Boolean).join(' · ') || 'Chưa phân loại'}</span>
                      {o.nextAnniversary && <span className="mt-0.5 block truncate text-xs text-orange-600">{o.nextAnniversary.label}: {formatDate(o.nextAnniversary.date, 'dd/MM')}</span>}
                    </td>
                    <td className="min-w-0 overflow-hidden px-4 py-3.5"><FocalCell o={o} /></td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-slate-700">{o.contactCount}</td>
                    <td className={cn('px-3 py-3.5 text-right tabular-nums', o.delegationCount ? 'font-semibold text-emerald-700' : 'text-slate-300')}>{o.delegationCount}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 tabular-nums text-slate-600">{formatDate(o.lastInteractionAt) || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-3.5 text-right"><RowActions href={`/dashboard/crm/organizations/${o.id}`} onEdit={() => openEdit(o.id)} name={o.name} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-slate-100 md:hidden">
            {items.map((o) => (
              <li key={o.id} className="space-y-1.5 px-4 py-3.5">
                <Link href={`/dashboard/crm/organizations/${o.id}`} className="font-semibold text-slate-900">{o.name}</Link>
                <p className="text-xs text-slate-500">{o.category ?? 'Chưa phân loại'} · {o.delegationCount} lượt tiếp · {o.contactCount} người liên hệ</p>
                <FocalCell o={o} />
                <RowActions href={`/dashboard/crm/organizations/${o.id}`} onEdit={() => openEdit(o.id)} name={o.name} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing && (
        <OrganizationModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
