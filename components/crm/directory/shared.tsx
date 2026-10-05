'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { Eye, Mail, Pencil, Phone, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select } from '@/components/ui/Select';

export const SEARCH_DEBOUNCE_MS = 250;

export function useDebounced<T>(value: T, delay = SEARCH_DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block min-w-0 flex-1 basis-full sm:basis-64">
      <span className="sr-only">Tìm kiếm</span>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input pl-10" />
    </label>
  );
}

export function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <div className="w-full sm:w-52">
      <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="px-3.5 py-2.5">
        {children}
      </Select>
    </div>
  );
}

/** Nhóm nút chọn một (VIP / Đối tác…), có số đếm nếu biết. */
export function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('rounded-lg px-3 py-1.5 text-[13px] font-semibold transition', value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Điện thoại, email bấm gọi/gửi ngay. */
export function ContactLine({ phone, email }: { phone: string | null; email: string | null }) {
  if (!phone && !email) return <span className="text-xs text-slate-400">—</span>;
  return (
    <span className="flex flex-col gap-0.5 text-xs">
      {phone && (
        <a href={`tel:${phone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
          <Phone className="h-3 w-3" aria-hidden="true" />{phone}
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className="inline-flex max-w-[220px] items-center gap-1 truncate text-brand-700 hover:underline">
          <Mail className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="truncate">{email}</span>
        </a>
      )}
    </span>
  );
}

/** Nút Xem (mở hồ sơ) và Sửa (mở form sửa ngay tại danh sách). */
export function RowActions({ href, onEdit, name }: { href: string; onEdit: () => void; name: string }) {
  return (
    <span className="flex items-center justify-end gap-1">
      <Link href={href} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900" aria-label={`Xem hồ sơ ${name}`}>
        <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Xem
      </Link>
      <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50" aria-label={`Sửa ${name}`}>
        <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Sửa
      </button>
    </span>
  );
}
