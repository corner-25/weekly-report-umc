'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Building2, Check, Loader2, Plus, UserRound, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { crmFetch } from './api';
import { displayName } from './format';
import type { SearchDTO } from './types';

/** Kết quả chọn: hồ sơ có sẵn (`id`) hoặc tên mới gõ tay (`newName`). */
export type ComboValue = { id: string; label: string } | { newName: string };

export function comboLabel(value: ComboValue | null): string {
  if (!value) return '';
  return 'id' in value ? value.label : value.newName;
}

interface Suggestion {
  id: string;
  label: string;
  subtitle: string | null;
  /** Các tên dùng để so trùng khi gõ (có/không học hàm). */
  names: string[];
}

interface EntityComboboxProps {
  kind: 'contact' | 'organization';
  inputId?: string;
  value: ComboValue | null;
  onChange: (value: ComboValue | null) => void;
  placeholder?: string;
  /** Cho phép tạo mới bằng tên gõ tay (mặc định có). */
  allowNew?: boolean;
  /** Chế độ chọn nhiều: sau khi chọn thì xoá ô gõ (giá trị do cha giữ). */
  clearOnSelect?: boolean;
  excludeIds?: readonly string[];
  invalid?: boolean;
  describedBy?: string;
}

const SEARCH_DEBOUNCE_MS = 200;

const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');

function toSuggestions(kind: EntityComboboxProps['kind'], data: SearchDTO): Suggestion[] {
  if (kind === 'contact') {
    return (data.contacts ?? []).map((c) => ({ id: c.id, label: displayName(c), subtitle: c.subtitle, names: [c.fullName, displayName(c)] }));
  }
  return (data.organizations ?? []).map((o) => ({ id: o.id, label: o.name, subtitle: null, names: [o.name] }));
}

export function EntityCombobox({
  kind,
  inputId,
  value,
  onChange,
  placeholder,
  allowNew = true,
  clearOnSelect = false,
  excludeIds = [],
  invalid = false,
  describedBy,
}: EntityComboboxProps) {
  const generatedId = useId();
  const id = inputId ?? `combo-${generatedId.replace(/:/g, '')}`;
  const listId = `${id}-list`;
  const [text, setText] = useState(() => comboLabel(value));
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const typedRef = useRef(false);

  // Đồng bộ ô gõ khi giá trị đổi từ bên ngoài (mở form sửa, xoá chọn…).
  useEffect(() => {
    if (!clearOnSelect) setText(comboLabel(value));
  }, [value, clearOnSelect]);

  useEffect(() => {
    if (!typedRef.current) return;
    const query = text.trim();
    if (!query) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const data = await crmFetch<SearchDTO>(`/api/crm/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        setResults(toSuggestions(kind, data));
        setFailed(false);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [text, kind]);

  const visible = useMemo(() => results.filter((r) => !excludeIds.includes(r.id)), [results, excludeIds]);
  const findSame = (query: string) => visible.find((r) => r.names.some((name) => normalize(name) === normalize(query)));
  // Chưa hiện "Thêm mới" khi đang tìm: dòng này hiện ngay còn gợi ý tới sau
  // ~200ms debounce + thời gian gọi API, nên Enter lúc đó tạo hồ sơ trùng với
  // hồ sơ có sẵn (đã gặp khi chạy thử: gõ "Công" ra đơn vị mới thay vì "Công ty Y").
  const canCreate = allowNew && !loading && text.trim().length > 0 && !findSame(text);
  const optionCount = visible.length + (canCreate ? 1 : 0);
  const showList = open && text.trim().length > 0;

  // Chưa tô dòng nào khi danh sách mới hiện ra: tô sẵn dòng đầu thì phím ↓ đầu
  // tiên nhảy qua gợi ý xuống "Thêm mới", Enter tạo luôn tổ chức rác — đã gặp khi
  // chạy thử (gõ "Công" → ↓ → Enter tạo đơn vị tên "Công" thay vì "Công ty Y").
  useEffect(() => {
    setActiveIndex(-1);
  }, [results, text]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = (index: number) => {
    const suggestion = visible[index];
    typedRef.current = false;
    if (suggestion) {
      onChange({ id: suggestion.id, label: suggestion.label });
      setText(clearOnSelect ? '' : suggestion.label);
    } else if (canCreate) {
      const name = text.trim().replace(/\s+/g, ' ');
      onChange({ newName: name });
      setText(clearOnSelect ? '' : name);
    }
    setOpen(false);
  };

  const handleBlur = () => {
    // Rời ô khi chưa chọn: trùng tên có sẵn thì lấy hồ sơ đó, không thì giữ là tên mới (chuẩn hoá khoảng trắng).
    window.setTimeout(() => {
      if (rootRef.current?.contains(document.activeElement)) return;
      setOpen(false);
      if (clearOnSelect || !typedRef.current) return;
      typedRef.current = false;
      const trimmed = text.trim();
      if (!trimmed) return onChange(null);
      const same = findSame(trimmed);
      if (same) {
        onChange({ id: same.id, label: same.label });
        setText(same.label);
      } else if (allowNew) {
        onChange({ newName: trimmed.replace(/\s+/g, ' ') });
      } else {
        setText('');
      }
    }, 120);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return setOpen(true);
      if (optionCount === 0) return;
      setActiveIndex((current) => {
        if (current < 0) return event.key === 'ArrowDown' ? 0 : optionCount - 1;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        return (current + step + optionCount) % optionCount;
      });
    } else if (event.key === 'Enter') {
      if (showList && optionCount > 0) {
        event.preventDefault();
        // Enter khi chưa chọn dòng nào: ưu tiên gợi ý đầu tiên có sẵn.
        choose(activeIndex >= 0 ? activeIndex : 0);
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    }
  };

  const clear = () => {
    typedRef.current = false;
    setText('');
    onChange(null);
    document.getElementById(id)?.focus();
  };

  const Icon = kind === 'contact' ? UserRound : Building2;
  const isNew = !clearOnSelect && value !== null && 'newName' in value;
  const isLinked = !clearOnSelect && value !== null && 'id' in value;

  return (
    <div ref={rootRef} className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        value={text}
        placeholder={placeholder ?? (kind === 'contact' ? 'Gõ để tìm trong danh bạ' : 'Gõ để tìm tổ chức')}
        onChange={(event) => {
          const next = event.target.value;
          typedRef.current = true;
          setText(next);
          setOpen(true);
          // Gõ tay là bỏ liên kết hồ sơ cũ ngay (tránh lưu nhầm khi bấm Lưu trước khi rời ô).
          if (!clearOnSelect) onChange(allowNew && next.trim() ? { newName: next } : null);
        }}
        onFocus={() => text.trim() && setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        className={cn('input pl-10', (isNew || isLinked) && 'pr-24', invalid && 'border-red-400 focus:border-red-500 focus:ring-red-500/10')}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden="true" />}
        {isLinked && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Có hồ sơ</span>}
        {isNew && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Mới</span>}
        {text && (
          <button type="button" onClick={clear} aria-label="Xoá lựa chọn" className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-[0_18px_50px_-12px_rgba(15,23,42,0.28)] backdrop-blur-xl"
        >
          {visible.map((item, index) => (
            <li
              key={item.id}
              id={`${id}-opt-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
              className={cn('flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm', index === activeIndex ? 'bg-cyan-50 text-cyan-900' : 'text-slate-700')}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{item.label}</span>
                {item.subtitle && <span className="block truncate text-xs text-slate-500">{item.subtitle}</span>}
              </span>
              {value && 'id' in value && value.id === item.id && <Check className="h-4 w-4 text-cyan-600" aria-hidden="true" />}
            </li>
          ))}
          {canCreate && (
            <li
              id={`${id}-opt-${visible.length}`}
              role="option"
              aria-selected={activeIndex === visible.length}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(visible.length)}
              onClick={() => choose(visible.length)}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold',
                visible.length > 0 && 'mt-1 border-t border-slate-100',
                activeIndex === visible.length ? 'bg-amber-50 text-amber-800' : 'text-amber-700',
              )}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="truncate">Thêm mới: “{text.trim()}”</span>
            </li>
          )}
          {!canCreate && visible.length === 0 && (
            <li className="px-3 py-3 text-center text-sm text-slate-400" role="presentation">
              {loading ? 'Đang tìm...' : failed ? 'Không tìm được, thử lại sau.' : 'Không có kết quả phù hợp'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
