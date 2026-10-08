'use client';

import { Pagination } from '../Pagination';
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

type Kind = '' | 'doctor' | 'leader' | 'vip' | 'partner' | 'focal';
const KINDS: Array<{ value: Kind; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'doctor', label: 'Bác sĩ' },
  { value: 'leader', label: 'Lãnh đạo / Giới thiệu' },
  { value: 'vip', label: 'Khách VIP' },
  { value: 'partner', label: 'Đối tác' },
  { value: 'focal', label: 'Đầu mối đơn vị' },
];

function OrgCell({ c }: { c: ContactListItem }) {
  const p = c.currentPosition;
  if (!p) return <span className="text-slate-400">—</span>;
  return (
    <div className="min-w-0 pr-2">
      {p.organization ? (
        <Link
          href={`/dashboard/crm/organizations/${p.organization.id}`}
          className="block truncate font-medium text-slate-700 hover:text-cyan-700 hover:underline"
          title={p.organization.name}
        >
          {p.organization.name}
        </Link>
      ) : (
        <span className="block truncate text-slate-500">Chưa gắn đơn vị</span>
      )}
      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <span className="truncate max-w-[200px]" title={p.title}>{p.title}</span>
        {p.department && (
          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-800 border border-teal-200/60 shrink-0">
            {p.department}
          </span>
        )}
        {c.focalCount > 0 && (
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 shrink-0">
            đầu mối{c.focalCount > 1 ? ` ${c.focalCount}` : ''}
          </span>
        )}
      </span>
    </div>
  );
}

/** Danh bạ cá nhân: VIP, Lãnh đạo/Người giới thiệu, Bác sĩ, và Đối tác (đầu mối liên hệ). */
export function ContactsTab({ initialKind = '', reloadKey, onChanged }: { initialKind?: Kind; reloadKey: number; onChanged: () => void }) {
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<Kind>(initialKind);
  const [tag, setTag] = useState('');
  const [owner, setOwner] = useState('');
  const [items, setItems] = useState<ContactListItem[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ContactDetail | null>(null);
  const debouncedSearch = useDebounced(search);

  useEffect(() => setPage(1), [debouncedSearch, kind, tag, owner]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page) });
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (kind === 'doctor' || kind === 'leader' || kind === 'vip' || kind === 'partner') params.set('kind', kind);
    if (kind === 'focal') params.set('focal', '1');
    if (tag) params.set('tag', tag);
    if (owner) params.set('owner', owner);
    setLoading(true);
    setError('');
    crmFetch<{ items: ContactListItem[]; total: number; page: number; tags: string[] }>(`/api/crm/contacts?${params}`, { signal: controller.signal })
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
        setPage(data.page);
        setKnownTags(data.tags);
        setLoading(false);
      })
      .catch((loadError) => {
        if (controller.signal.aborted) return;
        setError(errorMessage(loadError, 'Không thể tải danh bạ.'));
        setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedSearch, kind, tag, owner, reloadKey, page]);

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
        <div className="p-16 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-cyan-600 border-r-transparent" />
          <p className="mt-3 text-sm text-slate-500">Đang tải dữ liệu danh bạ...</p>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<UserRound className="h-12 w-12" />}
          title={hasFilter ? 'Không có ai khớp bộ lọc' : 'Danh bạ còn trống'}
          hint={hasFilter ? 'Bỏ bớt điều kiện để xem lại.' : 'Nhấn “Thêm cá nhân”, hoặc thêm đầu mối ngay trong hồ sơ tổ chức.'}
        />
      ) : (
        <div className="relative">
          {loading && (
            <div className="absolute inset-x-0 top-0 z-10 h-1 overflow-hidden bg-slate-100">
              <div className="h-full w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 animate-pulse" />
            </div>
          )}
          <div className={cn('transition-opacity duration-200', loading && 'opacity-50 pointer-events-none')}>
            <p className="px-5 pt-3 text-xs text-slate-500">{total} người · 20 người/trang</p>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1020px] table-fixed divide-y divide-slate-100">
                <colgroup>
                  <col className="w-[20%]" />
                  <col className="w-[19%]" />
                  <col className="w-[13%]" />
                  <col className="w-[9%]" />
                  <col className="w-[11%]" />
                  <col className="w-[16%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Họ tên</th>
                    <th scope="col" className="px-4 py-3">Đơn vị · chức vụ</th>
                    <th scope="col" className="px-4 py-3">Liên hệ</th>
                    <th scope="col" className="px-4 py-3">Phụ trách</th>
                    <th scope="col" className="px-4 py-3">Hoạt động & Khám bệnh</th>
                    <th scope="col" className="px-4 py-3">Lưu ý / Giới thiệu</th>
                    <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Thao tác</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {items.map((c) => (
                    <tr key={c.id} className="align-top hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="min-w-0 pr-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link href={`/dashboard/crm/contacts/${c.id}`} className="font-semibold text-slate-900 hover:text-cyan-700 hover:underline">
                              {displayName(c)}
                            </Link>
                            <TierBadge tier={c.tier} partner tags={c.tags} />
                            {c.status === 'INACTIVE' && <span className="text-xs text-slate-400">(ngừng)</span>}
                          </div>
                          {c.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {c.tags.map((t) => <TagPill key={t}>{t}</TagPill>)}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5"><OrgCell c={c} /></td>
                      <td className="px-4 py-3.5"><ContactLine phone={c.phone} email={c.email} /></td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600 truncate">{c.ownerName ?? '—'}</td>
                      <td className="px-4 py-3.5 text-slate-700">
                        <div className="flex flex-col gap-1 text-xs">
                          {Boolean(c.doctorVisitCount) && (
                            <span className="inline-flex items-center gap-1 font-semibold text-teal-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 shrink-0" />
                              {c.doctorVisitCount} ca trực tiếp khám
                            </span>
                          )}
                          {Boolean(c.referredVisitCount) && (
                            <span className="inline-flex items-center gap-1 font-semibold text-indigo-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                              {c.referredVisitCount} ca giới thiệu VIP
                            </span>
                          )}
                          {Boolean(c.escortCount) && (
                            <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                              {c.escortCount} lượt dẫn khám
                            </span>
                          )}
                          {!c.doctorVisitCount && !c.referredVisitCount && !c.escortCount && (
                            <span className="text-slate-400">—</span>
                          )}
                          {c.lastEscortAt && (
                            <span className="text-[11px] text-slate-400">Gần nhất: {formatDate(c.lastEscortAt)}</span>
                          )}
                        </div>
                      </td>
                      <td className="min-w-0 px-4 py-3.5 text-slate-600">
                        {c.latestReferrer ? (
                          <span className="block truncate font-medium text-slate-700" title={`Người giới thiệu: ${c.latestReferrer}`}>
                            GT: {c.latestReferrer}
                          </span>
                        ) : c.tags.includes('Ban Giám đốc') ? (
                          <span className="text-xs font-semibold text-purple-700">Ban Giám đốc</span>
                        ) : c.tags.includes('Bác sĩ') ? (
                          <span className="text-xs font-medium text-teal-700">Bác sĩ Bệnh viện</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-right"><RowActions href={`/dashboard/crm/contacts/${c.id}`} onEdit={() => openEdit(c.id)} name={c.fullName} /></td>
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
                    <TierBadge tier={c.tier} partner tags={c.tags} />
                  </div>
                  <div className="text-sm"><OrgCell c={c} /></div>
                  <ContactLine phone={c.phone} email={c.email} />
                  <div className="flex flex-wrap gap-2 text-xs">
                    {Boolean(c.doctorVisitCount) && <span className="font-semibold text-teal-700">{c.doctorVisitCount} ca khám</span>}
                    {Boolean(c.referredVisitCount) && <span className="font-semibold text-indigo-700">{c.referredVisitCount} ca giới thiệu</span>}
                    {Boolean(c.escortCount) && <span className="text-amber-700">{c.escortCount} lượt dẫn khám</span>}
                    {c.latestReferrer && <span className="text-slate-500">· GT: {c.latestReferrer}</span>}
                  </div>
                  <RowActions href={`/dashboard/crm/contacts/${c.id}`} onEdit={() => openEdit(c.id)} name={c.fullName} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Pagination page={page} total={total} onChange={setPage} disabled={loading} />
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
