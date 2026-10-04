'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIER_LABELS } from '@/lib/crm/constants';
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

const TIER_STYLES: Record<Tier, string> = {
  VIP: 'bg-slate-900 text-white',
  A: 'bg-blue-600 text-white',
  B: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  C: 'bg-slate-100 text-slate-500',
};

export function TierBadge({ tier, className }: { tier: Tier; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide', TIER_STYLES[tier], className)}
      title={`Hạng ${TIER_LABELS[tier]}`}
    >
      {TIER_LABELS[tier]}
    </span>
  );
}

export function TagPill({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">{children}</span>;
}

export function Stat({ label, value, hint, tone = 'default' }: { label: string; value: ReactNode; hint?: string; tone?: 'default' | 'accent' }) {
  return (
    <div className={cn(PANEL, 'p-4', tone === 'accent' && 'border-orange-200 bg-orange-50/40')}>
      <p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
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
    first?.focus();

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

export function SectionCard({ title, action, children, className, icon }: { title: string; action?: ReactNode; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <section className={cn(PANEL, 'p-4 sm:p-5', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">{icon}{title}</h2>
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
