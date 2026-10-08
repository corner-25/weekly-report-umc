'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AlertCircle, Check, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tier } from './types';

export const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-cyan-500/20 transition hover:brightness-105 active:translate-y-px disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/30';
export const ACCENT_BTN =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 transition hover:brightness-105 active:translate-y-px disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/30';
export const SECONDARY_BTN =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 active:translate-y-px disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/20';
export const ICON_BTN =
  'rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500';
export const PANEL = 'rounded-2xl border border-slate-200/80 bg-white shadow-sm';

/**
 * Danh bạ cá nhân chỉ chia hai loại: VIP (Phòng HC tự gắn) và Đối tác (đầu mối,
 * người liên hệ của các tổ chức). Hạng A/B/C cũ không còn hiện — coi như Đối tác.
 * Tổ chức không phân hạng: không truyền `partner` thì chỉ hiện khi là VIP.
 */
export function TierBadge({ tier, partner = false, tags = [], className }: { tier: Tier; partner?: boolean; tags?: string[]; className?: string }) {
  const isLeader = tags.includes('Ban Giám đốc') || tags.includes('Lãnh đạo Bệnh viện');
  const isReferrer = tags.includes('Người giới thiệu');
  const isDoctor = tags.includes('Bác sĩ');

  if (isLeader) {
    return (
      <span
        className={cn('inline-flex items-center rounded-full bg-purple-900 px-2 py-0.5 text-[11px] font-bold tracking-wide text-amber-300 ring-1 ring-inset ring-amber-400/30', className)}
        title="Lãnh đạo Bệnh viện / Đại học Y Dược TP.HCM"
      >
        Lãnh đạo BV
      </span>
    );
  }
  if (isReferrer) {
    return (
      <span
        className={cn('inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-indigo-700 ring-1 ring-inset ring-indigo-200', className)}
        title="Người giới thiệu khách VIP"
      >
        Người giới thiệu
      </span>
    );
  }
  if (isDoctor) {
    return (
      <span
        className={cn('inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-teal-700 ring-1 ring-inset ring-teal-200', className)}
        title="Bác sĩ khám bệnh"
      >
        Bác sĩ
      </span>
    );
  }
  if (tier === 'VIP') {
    return (
      <span
        className={cn('inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-bold tracking-wide text-amber-300', className)}
        title="Khách VIP"
      >
        VIP
      </span>
    );
  }
  if (!partner) return null;
  return (
    <span
      className={cn('inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-blue-700 ring-1 ring-inset ring-blue-200', className)}
      title="Đối tác — đầu mối, người liên hệ của tổ chức"
    >
      Đối tác
    </span>
  );
}

export function TagPill({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">{children}</span>;
}

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'accent' | 'cyan' | 'blue' | 'purple' | 'green';
}) {
  const toneClasses = {
    default: {
      border: 'border-slate-200/80',
      bg: 'from-slate-50/60 via-white to-white',
      badge: 'bg-slate-100 text-slate-700 shadow-slate-200/50',
      title: 'text-slate-800',
      divider: 'border-slate-100/80',
    },
    accent: {
      border: 'border-amber-200/80',
      bg: 'from-amber-50/60 via-white to-white',
      badge: 'bg-amber-100 text-amber-700 shadow-amber-200/50',
      title: 'text-amber-800',
      divider: 'border-amber-100/80',
    },
    cyan: {
      border: 'border-cyan-200/80',
      bg: 'from-cyan-50/60 via-white to-white',
      badge: 'bg-cyan-100 text-cyan-700 shadow-cyan-200/50',
      title: 'text-cyan-800',
      divider: 'border-cyan-100/80',
    },
    blue: {
      border: 'border-blue-200/80',
      bg: 'from-blue-50/60 via-white to-white',
      badge: 'bg-blue-100 text-blue-700 shadow-blue-200/50',
      title: 'text-blue-800',
      divider: 'border-blue-100/80',
    },
    purple: {
      border: 'border-purple-200/80',
      bg: 'from-purple-50/60 via-white to-white',
      badge: 'bg-purple-100 text-purple-700 shadow-purple-200/50',
      title: 'text-purple-800',
      divider: 'border-purple-100/80',
    },
    green: {
      border: 'border-emerald-200/80',
      bg: 'from-emerald-50/60 via-white to-white',
      badge: 'bg-emerald-100 text-emerald-700 shadow-emerald-200/50',
      title: 'text-emerald-800',
      divider: 'border-emerald-100/80',
    },
  }[tone];

  return (
    <div className={cn('relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 sm:p-5 shadow-sm transition-all duration-200 hover:shadow-md bg-gradient-to-br', toneClasses.border, toneClasses.bg)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('text-xs font-bold uppercase tracking-wider', toneClasses.title)}>{label}</p>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold tabular-nums text-slate-900 sm:text-3xl">
              {value}
            </span>
          </div>
        </div>
        {Icon && (
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform hover:scale-105', toneClasses.badge)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
      </div>
      {hint && (
        <div className={cn('mt-3 border-t pt-2.5 text-xs text-slate-500 leading-snug', toneClasses.divider)}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return <p id={id} className="mt-1.5 text-xs font-medium text-red-600">{message}</p>;
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

/** Nhãn + ô nhập. Có `htmlFor` thì dùng nhãn rời (cho combobox), không thì bọc ô nhập trong `<label>`. */
export function Field({ label, required = false, error, hint, htmlFor, children, className }: FieldProps) {
  const caption = (
    <span className="mb-1.5 block text-sm font-semibold text-slate-700">
      {label}
      {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
    </span>
  );
  const footer = (
    <>
      {hint && !error && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs font-medium text-red-600">{error}</span>}
    </>
  );

  if (htmlFor) {
    return (
      <div className={cn('block', className)}>
        <label htmlFor={htmlFor}>{caption}</label>
        {children}
        {footer}
      </div>
    );
  }
  return (
    <label className={cn('block', className)}>
      {caption}
      {children}
      {footer}
    </label>
  );
}

export function inputClass(error?: string, extra?: string) {
  return cn('input', error && 'border-red-400 focus:border-red-500 focus:ring-red-500/10', extra);
}

interface ChipGroupProps {
  legend: string;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  single?: boolean;
  error?: string;
  required?: boolean;
  trailing?: ReactNode;
}

export function ChipGroup({ legend, options, value, onChange, single = false, error, required, trailing }: ChipGroupProps) {
  const toggle = (option: string) => {
    const isOn = value.includes(option);
    if (single) return onChange(isOn ? [] : [option]);
    return onChange(isOn ? value.filter((v) => v !== option) : [...value, option]);
  };
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-semibold text-slate-700">
        {legend}
        {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isOn = value.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isOn}
              onClick={() => toggle(option)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
                isOn
                  ? 'border-cyan-600 bg-cyan-600 text-white shadow-sm'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-cyan-400 hover:text-cyan-700',
              )}
            >
              {isOn && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              {option}
            </button>
          );
        })}
        {trailing}
      </div>
      <FieldError message={error} />
    </fieldset>
  );
}

/** Ô nhập nhãn: gõ rồi Enter (hoặc dấu phẩy) để thêm, Backspace khi trống để xoá nhãn cuối. */
export function TagInput({ label, value, onChange, error }: { label: string; value: string[]; onChange: (next: string[]) => void; error?: string }) {
  const id = useId();
  const [draft, setDraft] = useState('');

  const commit = () => {
    const tag = draft.trim().replace(/,$/, '').trim();
    if (tag && !value.some((v) => v.toLocaleLowerCase('vi') === tag.toLocaleLowerCase('vi'))) onChange([...value, tag]);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
      <div className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2 py-1.5 focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-cyan-500/10">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-cyan-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-cyan-800">
            {tag}
            <button type="button" aria-label={`Bỏ nhãn ${tag}`} onClick={() => onChange(value.filter((v) => v !== tag))} className="rounded-full p-0.5 hover:bg-cyan-100">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commit}
          placeholder={value.length ? '' : 'Gõ nhãn rồi nhấn Enter'}
          className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-slate-400"
        />
      </div>
      <FieldError message={error} />
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (next: boolean) => void; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 select-none">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span
        aria-hidden="true"
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-cyan-500/30',
          checked ? 'bg-cyan-600' : 'bg-slate-300',
        )}
      >
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
      </span>
      <span className="text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

interface ModalShellProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg';
}

const FOCUSABLE_FIELDS = 'input:not([type=hidden]):not([disabled]):not(.sr-only), textarea:not([disabled]), select:not([aria-hidden=true]), button[role=combobox]';

/**
 * Khung modal theo kiểu trang Khách VIP cũ: bottom-sheet trên điện thoại, căn giữa
 * trên desktop. Esc để đóng (trừ khi đang mở danh sách gợi ý), focus trường đầu.
 */
export function ModalShell({ title, subtitle, onClose, children, size = 'lg' }: ModalShellProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const first = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_FIELDS);
    first?.focus({ preventScroll: true });

    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      const active = document.activeElement;
      if (active?.getAttribute('aria-expanded') === 'true') return;
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-slate-950/45 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('max-h-[94vh] w-full animate-sheet-up overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:animate-pop-in sm:rounded-3xl', size === 'lg' ? 'max-w-3xl' : 'max-w-xl')}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6 sm:py-5">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-slate-900 sm:text-xl">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100">Đóng</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ModalFooter({ onCancel, saving, submitLabel }: { onCancel: () => void; saving: boolean; submitLabel: string }) {
  return (
    <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
      <button type="button" onClick={onCancel} className={SECONDARY_BTN}>Huỷ</button>
      <button type="submit" disabled={saving} className={PRIMARY_BTN}>{saving ? 'Đang lưu...' : submitLabel}</button>
    </div>
  );
}

export function SectionCard({ title, action, children, className, icon, info }: { title: string; action?: ReactNode; children: ReactNode; className?: string; icon?: ReactNode; info?: ReactNode }) {
  return (
    <section className={cn(PANEL, 'p-4 sm:p-5', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">{icon}{title}{info}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="px-4 py-10 text-center">
      {icon && <div className="mx-auto mb-3 flex justify-center text-slate-200">{icon}</div>}
      <p className="font-semibold text-slate-700">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

export function SmallAction({ onClick, children, label }: { onClick: () => void; children: ReactNode; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
      {children}
    </button>
  );
}
