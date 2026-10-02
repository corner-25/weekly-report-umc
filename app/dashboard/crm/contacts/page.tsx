'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Building2, Contact, Plus, Search, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { ORGANIZATION_TYPE_LABELS, TIER_LABELS, VIP_STAFF } from '@/lib/crm/constants';
import { crmFetch, errorMessage } from '@/components/crm/api';
import { ContactModal } from '@/components/crm/ContactModal';
import { OrganizationModal } from '@/components/crm/OrganizationModal';
import { displayName, formatDate } from '@/components/crm/format';
import type { ContactListItem, OrganizationListItem, OrganizationType, Tier } from '@/components/crm/types';
import { EmptyState, ErrorBanner, PANEL, PRIMARY_BTN, TagPill, TierBadge } from '@/components/crm/ui';

type Tab = 'contacts' | 'organizations';
const SEARCH_DEBOUNCE_MS = 250;
const TIERS = Object.keys(TIER_LABELS) as Tier[];

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function CrmContactsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500">Đang tải...</div>}>
      <ContactsDirectory />
    </Suspense>
  );
}

function ContactsDirectory() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'organizations' ? 'organizations' : 'contacts';
  const [showModal, setShowModal] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const switchTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'organizations') params.set('tab', 'organizations');
    else params.delete('tab');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Contact}
        title="Danh bạ đối tác"
        description="Cá nhân và tổ chức có quan hệ với bệnh viện"
        className="flex-wrap gap-4"
        actions={
          <button type="button" onClick={() => setShowModal(true)} className={PRIMARY_BTN}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {tab === 'contacts' ? 'Thêm cá nhân' : 'Thêm tổ chức'}
          </button>
        }
      />

      <div role="tablist" aria-label="Loại đối tác" className="flex gap-6 border-b border-slate-200">
        {([['contacts', 'Cá nhân', UserRound], ['organizations', 'Tổ chức', Building2]] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`panel-${value}`}
            onClick={() => switchTab(value)}
            className={cn(
              '-mb-px inline-flex items-center gap-2 border-b-2 px-1 pb-2.5 text-sm font-semibold transition',
              tab === value ? 'border-cyan-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'contacts' ? <ContactsTab reloadKey={reloadKey} /> : <OrganizationsTab reloadKey={reloadKey} />}
      </div>

      {showModal && tab === 'contacts' && (
        <ContactModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
      {showModal && tab === 'organizations' && (
        <OrganizationModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block min-w-0 flex-1 basis-full sm:basis-64">
      <span className="sr-only">Tìm kiếm</span>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input pl-10" />
    </label>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  const id = `filter-${label.replace(/\s+/g, '-')}`;
  return (
    <div className="w-full sm:w-48">
      <label htmlFor={id} className="sr-only">{label}</label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="px-3.5 py-2.5">
        {children}
      </Select>
    </div>
  );
}

function ContactsTab({ reloadKey }: { reloadKey: number }) {
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('');
  const [tag, setTag] = useState('');
  const [owner, setOwner] = useState('');
  const [items, setItems] = useState<ContactListItem[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (tier) params.set('tier', tier);
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
  }, [debouncedSearch, tier, tag, owner, reloadKey]);

  const hasFilter = Boolean(search || tier || tag || owner);

  return (
    <div className={PANEL}>
      <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
        <SearchBox value={search} onChange={setSearch} placeholder="Tìm họ tên, điện thoại, email, tổ chức..." />
        <FilterSelect label="Lọc hạng" value={tier} onChange={setTier}>
          <option value="">Mọi hạng</option>
          {TIERS.map((t) => <option key={t} value={t}>Hạng {TIER_LABELS[t]}</option>)}
        </FilterSelect>
        <FilterSelect label="Lọc nhãn" value={tag} onChange={setTag}>
          <option value="">Mọi nhãn</option>
          {knownTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </FilterSelect>
        <FilterSelect label="Lọc người phụ trách" value={owner} onChange={setOwner}>
          <option value="">Mọi người phụ trách</option>
          {VIP_STAFF.map((name) => <option key={name} value={name}>{name}</option>)}
        </FilterSelect>
      </div>
      {error && <div className="p-4"><ErrorBanner message={error} /></div>}

      {loading && items.length === 0 ? (
        <p className="p-12 text-center text-slate-500">Đang tải dữ liệu...</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<UserRound className="h-12 w-12" />}
          title={hasFilter ? 'Không có ai khớp bộ lọc' : 'Danh bạ còn trống'}
          hint={hasFilter ? 'Bỏ bớt điều kiện để xem lại.' : 'Nhấn “Thêm cá nhân” để tạo hồ sơ đầu tiên.'}
        />
      ) : (
        <div className={cn(loading && 'opacity-60 transition-opacity')}>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Họ tên</th>
                  <th scope="col" className="px-5 py-3">Chức vụ hiện tại</th>
                  <th scope="col" className="px-5 py-3">Tổ chức</th>
                  <th scope="col" className="px-5 py-3">Hạng</th>
                  <th scope="col" className="px-5 py-3">Nhãn</th>
                  <th scope="col" className="px-5 py-3">Phụ trách</th>
                  <th scope="col" className="px-5 py-3">Tương tác gần nhất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {items.map((c) => (
                  <tr key={c.id} className="align-top hover:bg-cyan-50/30">
                    <td className="px-5 py-3.5">
                      <Link href={`/dashboard/crm/contacts/${c.id}`} className="font-semibold text-slate-900 hover:text-cyan-700 hover:underline">{displayName(c)}</Link>
                      {c.status === 'INACTIVE' && <span className="ml-2 text-xs text-slate-400">(ngừng)</span>}
                      {c.phone && <p className="mt-0.5 text-xs text-slate-500">{c.phone}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{c.currentPosition?.title ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      {c.currentPosition?.organization ? (
                        <Link href={`/dashboard/crm/organizations/${c.currentPosition.organization.id}`} className="text-slate-600 hover:text-cyan-700 hover:underline">{c.currentPosition.organization.name}</Link>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-3.5"><TierBadge tier={c.tier} /></td>
                    <td className="px-5 py-3.5"><div className="flex max-w-[220px] flex-wrap gap-1">{c.tags.map((t) => <TagPill key={t}>{t}</TagPill>)}</div></td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{c.ownerName ?? '—'}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-slate-600">{formatDate(c.lastInteractionAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-slate-100 md:hidden">
            {items.map((c) => (
              <li key={c.id}>
                <Link href={`/dashboard/crm/contacts/${c.id}`} className="block px-4 py-3.5 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-slate-900">{displayName(c)}</p>
                    <TierBadge tier={c.tier} />
                  </div>
                  {c.currentPosition && (
                    <p className="mt-0.5 text-sm text-slate-600">
                      {c.currentPosition.title}{c.currentPosition.organization && ` · ${c.currentPosition.organization.name}`}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    {c.tags.map((t) => <TagPill key={t}>{t}</TagPill>)}
                    {c.ownerName && <span>· {c.ownerName}</span>}
                    {c.lastInteractionAt && <span>· {formatDate(c.lastInteractionAt)}</span>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function OrganizationsTab({ reloadKey }: { reloadKey: number }) {
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('');
  const [type, setType] = useState('');
  const [items, setItems] = useState<OrganizationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const debouncedSearch = useDebounced(search, SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    if (tier) params.set('tier', tier);
    if (type) params.set('type', type);
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
  }, [debouncedSearch, tier, type, reloadKey]);

  const hasFilter = Boolean(search || tier || type);

  return (
    <div className={PANEL}>
      <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
        <SearchBox value={search} onChange={setSearch} placeholder="Tìm tên tổ chức..." />
        <FilterSelect label="Lọc hạng" value={tier} onChange={setTier}>
          <option value="">Mọi hạng</option>
          {TIERS.map((t) => <option key={t} value={t}>Hạng {TIER_LABELS[t]}</option>)}
        </FilterSelect>
        <FilterSelect label="Lọc loại tổ chức" value={type} onChange={setType}>
          <option value="">Mọi loại</option>
          {(Object.keys(ORGANIZATION_TYPE_LABELS) as OrganizationType[]).map((t) => <option key={t} value={t}>{ORGANIZATION_TYPE_LABELS[t]}</option>)}
        </FilterSelect>
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
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3">Tên tổ chức</th>
                  <th scope="col" className="px-5 py-3">Loại</th>
                  <th scope="col" className="px-5 py-3">Hạng</th>
                  <th scope="col" className="px-5 py-3 text-right">Người liên hệ</th>
                  <th scope="col" className="px-5 py-3">Dịp kỷ niệm tới</th>
                  <th scope="col" className="px-5 py-3">Phụ trách</th>
                  <th scope="col" className="px-5 py-3">Tương tác gần nhất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {items.map((o) => (
                  <tr key={o.id} className="align-top hover:bg-cyan-50/30">
                    <td className="px-5 py-3.5">
                      <Link href={`/dashboard/crm/organizations/${o.id}`} className="font-semibold text-slate-900 hover:text-cyan-700 hover:underline">{o.name}</Link>
                      {o.tags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{o.tags.map((t) => <TagPill key={t}>{t}</TagPill>)}</div>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{ORGANIZATION_TYPE_LABELS[o.type]}</td>
                    <td className="px-5 py-3.5"><TierBadge tier={o.tier} /></td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-slate-700">{o.contactCount}</td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {o.nextAnniversary ? <><span className="tabular-nums">{formatDate(o.nextAnniversary.date, 'dd/MM')}</span> <span className="text-xs text-slate-500">{o.nextAnniversary.label}</span></> : '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{o.ownerName ?? '—'}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-slate-600">{formatDate(o.lastInteractionAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-slate-100 md:hidden">
            {items.map((o) => (
              <li key={o.id}>
                <Link href={`/dashboard/crm/organizations/${o.id}`} className="block px-4 py-3.5 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-slate-900">{o.name}</p>
                    <TierBadge tier={o.tier} />
                  </div>
                  <p className="mt-0.5 text-sm text-slate-600">{ORGANIZATION_TYPE_LABELS[o.type]} · {o.contactCount} người liên hệ</p>
                  {o.nextAnniversary && <p className="mt-1 text-xs text-orange-600">{o.nextAnniversary.label}: {formatDate(o.nextAnniversary.date, 'dd/MM')}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
