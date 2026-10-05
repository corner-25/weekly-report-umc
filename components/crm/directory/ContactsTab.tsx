'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VIP_STAFF } from '@/lib/crm/constants';
import { crmFetch, errorMessage } from '../api';
import { ContactModal } from '../ContactModal';
import { displayName, formatDate } from '../format';
import type { ContactDetail, ContactListItem } from '../types';
import { EmptyState, ErrorBanner, PANEL, TagPill, TierBadge } from '../ui';
import { ContactLine, FilterSelect, RowActions, SearchBox, Segmented, useDebounced } from './shared';

type Kind = '' | 'vip' | 'partner' | 'focal';
const KINDS: Array<{ value: Kind; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'vip', label: 'VIP' },
  { value: 'partner', label: 'Đối tác' },
  { value: 'focal', label: 'Đầu mối của đơn vị' },
];

function OrgCell({ c }: { c: ContactListItem }) {
  const p = c.currentPosition;
  if (!p) return <span className="text-slate-400">—</span>;
  return (
    <span className="block min-w-0">
      {p.organization ? (
        <Link href={`/dashboard/crm/organizations/${p.organization.id}`} className="font-medium text-slate-700 hover:text-brand-700 hover:underline">{p.organization.name}</Link>
      ) : <span className="text-slate-500">Chưa gắn đơn vị</span>}
      <span className="block text-xs text-slate-500">
        {p.title}
        {c.focalCount > 0 && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">đầu mối{c.focalCount > 1 ? ` ${c.focalCount} đơn vị` : ''}</span>}
      </span>
    </span>
  );
}

/** Danh bạ cá nhân: VIP và Đối tác (đầu mối, người liên hệ của tổ chức). */
export function ContactsTab({ reloadKey, onChanged }: { reloadKey: number; onChanged: () => void }) {
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<Kind>('');
  const [tag, setTag] = useState('');
  const [owner, setOwner] = useState('');
  const [items, setItems] = useState<ContactListItem[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ContactDetail | null>(null);
  const debouncedSearch = useDebounced(search);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (kind === 'vip' || kind === 'partner') params.set('kind', kind);
    if (kind === 'focal') params.set('focal', '1');
    if (tag) params.set('tag', tag);
    if (owner) params.set('owner', owner);
    setLoading(true);
    setError('');
    crmFetch<ContactListItem[]>(`/api/crm/contacts?${params}`, { signal: controller.signal })
      .then((data) => {
        setItems(data);
        setKnownTags((prev) => Array.from(new Set([...prev, ...data.flatMap((c) => c.tags)])).sort((a, b) => a.localeCompare(b, 'vi')));
        setLoading(false);
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(loadError, 'Không thể tải danh bạ.'));
        setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedSearch, kind, tag, owner, reloadKey]);

  const openEdit = (id: string) => {
    crmFetch<ContactDetail>(`/api/crm/contacts/${id}`).then(setEditing).catch((e) => setError(errorMessage(e, 'Không mở được hồ sơ để sửa.')));
  };
  const hasFilter = Boolean(search || kind || tag || owner);

  return (
    <div className={PANEL}>
      <div className="space-y-3 border-b border-slate-100 p-4">
        <Segmented label="Loại" options={KINDS} value={kind} onChange={setKind} />
        <div className="flex flex-wrap gap-3">
          <SearchBox value={search} onChange={setSearch} placeholder="Tìm họ tên, điện thoại, email, tổ chức..." />
          <FilterSelect label="Lọc nhãn" value={tag} onChange={setTag}>
            <option value="">Mọi nhãn</option>
            {knownTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </FilterSelect>
          <FilterSelect label="Lọc người phụ trách" value={owner} onChange={setOwner}>
            <option value="">Mọi người phụ trách</option>
            {VIP_STAFF.map((name) => <option key={name} value={name}>{name}</option>)}
          </FilterSelect>
        </div>
      </div>
      {error && <div className="p-4"><ErrorBanner message={error} /></div>}

      {loading && items.length === 0 ? (
        <p className="p-12 text-center text-slate-500">Đang tải dữ liệu...</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<UserRound className="h-12 w-12" />}
          title={hasFilter ? 'Không có ai khớp bộ lọc' : 'Danh bạ còn trống'}
          hint={hasFilter ? 'Bỏ bớt điều kiện để xem lại.' : 'Nhấn “Thêm cá nhân”, hoặc thêm đầu mối ngay trong hồ sơ tổ chức.'}
        />
      ) : (
        <div className={cn(loading && 'opacity-60 transition-opacity')}>
          <p className="px-5 pt-3 text-xs text-slate-500">{items.length} người</p>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Họ tên</th>
                  <th scope="col" className="px-5 py-3">Đơn vị · chức vụ</th>
                  <th scope="col" className="px-5 py-3">Liên hệ</th>
                  <th scope="col" className="px-5 py-3">Phụ trách</th>
                  <th scope="col" className="px-5 py-3">Gần nhất</th>
                  <th scope="col" className="px-5 py-3 text-right"><span className="sr-only">Thao tác</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {items.map((c) => (
                  <tr key={c.id} className="align-top hover:bg-brand-50/30">
                    <td className="px-5 py-3.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Link href={`/dashboard/crm/contacts/${c.id}`} className="font-semibold text-slate-900 hover:text-brand-700 hover:underline">{displayName(c)}</Link>
                        <TierBadge tier={c.tier} partner />
                        {c.status === 'INACTIVE' && <span className="text-xs text-slate-400">(ngừng)</span>}
                      </span>
                      {c.tags.length > 0 && <span className="mt-1 flex max-w-[260px] flex-wrap gap-1">{c.tags.map((t) => <TagPill key={t}>{t}</TagPill>)}</span>}
                    </td>
                    <td className="max-w-[320px] px-5 py-3.5"><OrgCell c={c} /></td>
                    <td className="px-5 py-3.5"><ContactLine phone={c.phone} email={c.email} /></td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{c.ownerName ?? '—'}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-slate-600">{formatDate(c.lastInteractionAt) || '—'}</td>
                    <td className="px-5 py-3"><RowActions href={`/dashboard/crm/contacts/${c.id}`} onEdit={() => openEdit(c.id)} name={c.fullName} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-slate-100 md:hidden">
            {items.map((c) => (
              <li key={c.id} className="space-y-1.5 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/dashboard/crm/contacts/${c.id}`} className="font-semibold text-slate-900">{displayName(c)}</Link>
                  <TierBadge tier={c.tier} partner />
                </div>
                <div className="text-sm"><OrgCell c={c} /></div>
                <ContactLine phone={c.phone} email={c.email} />
                <RowActions href={`/dashboard/crm/contacts/${c.id}`} onEdit={() => openEdit(c.id)} name={c.fullName} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing && (
        <ContactModal
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
