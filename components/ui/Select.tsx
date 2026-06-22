'use client';
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type NativeOptionProps = {
  value?: string | number;
  disabled?: boolean;
  children?: ReactNode;
};

type SelectOption = {
  value: string;
  label: ReactNode;
  searchLabel: string;
  disabled: boolean;
};

function textFromNode(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textFromNode(node.props.children);
  }
  return '';
}

function collectOptions(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = [];

  function walk(nodes: ReactNode) {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;

      if (child.type === 'option') {
        const option = child as ReactElement<NativeOptionProps>;
        const label = option.props.children;
        options.push({
          value: String(option.props.value ?? textFromNode(label)),
          label,
          searchLabel: textFromNode(label).toLocaleLowerCase('vi'),
          disabled: Boolean(option.props.disabled),
        });
        return;
      }

      const nested = (child.props as { children?: ReactNode }).children;
      if (nested) walk(nested);
    });
  }

  walk(children);
  return options;
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({
  children,
  className,
  value,
  defaultValue,
  disabled,
  onChange,
  id,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const triggerId = id ?? `select-${generatedId.replace(/:/g, '')}`;
  const nativeRef = useRef<HTMLSelectElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [internalValue, setInternalValue] = useState(() =>
    String(value ?? defaultValue ?? '')
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const options = useMemo(() => collectOptions(children), [children]);
  const selectedValue = value !== undefined ? String(value) : internalValue;
  const selectedOption = options.find((option) => option.value === selectedValue);
  const searchable = options.length > 8;
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi');
    return normalized
      ? options.filter((option) => option.searchLabel.includes(normalized))
      : options;
  }, [options, query]);

  useEffect(() => {
    if (value !== undefined) setInternalValue(String(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const estimatedHeight = Math.min(360, 56 + filteredOptions.length * 42);
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < estimatedHeight && rect.top > spaceBelow;

      setMenuStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(360, openUpward ? rect.top - 10 : spaceBelow - 10),
        ...(openUpward
          ? { bottom: window.innerHeight - rect.top + 6 }
          : { top: rect.bottom + 6 }),
      });
    };

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      const menu = document.getElementById(`${triggerId}-menu`);
      if (!triggerRef.current?.contains(target) && !menu?.contains(target)) {
        setOpen(false);
      }
    };

    updatePosition();
    document.addEventListener('mousedown', closeOnOutsideClick);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [filteredOptions.length, open, triggerId]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }

    const selectedIndex = filteredOptions.findIndex(
      (option) => option.value === selectedValue
    );
    setActiveIndex(Math.max(0, selectedIndex));
    if (searchable) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, searchable, selectedValue, filteredOptions]);

  function choose(option: SelectOption) {
    if (option.disabled) return;

    setInternalValue(option.value);
    setOpen(false);
    triggerRef.current?.focus();

    const nativeSelect = nativeRef.current;
    if (!nativeSelect) return;
    nativeSelect.value = option.value;
    nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      return;
    }

    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((current) => {
        let next = current;
        do {
          next = (next + direction + filteredOptions.length) % filteredOptions.length;
        } while (filteredOptions[next]?.disabled && next !== current);
        return next;
      });
      return;
    }

    if (event.key === 'Enter' && filteredOptions[activeIndex]) {
      event.preventDefault();
      choose(filteredOptions[activeIndex]);
    }
  }

  const menu = open && typeof document !== 'undefined' && createPortal(
    <div
      id={`${triggerId}-menu`}
      role="listbox"
      aria-labelledby={triggerId}
      style={menuStyle}
      className="z-[10000] flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-[0_18px_50px_-12px_rgba(15,23,42,0.28)] backdrop-blur-xl animate-in fade-in zoom-in-95"
    >
      {searchable && (
        <div className="relative mb-1 border-b border-slate-100 pb-1.5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-[calc(50%+3px)] text-slate-400" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setOpen(false);
                triggerRef.current?.focus();
              }
            }}
            placeholder="Tìm nhanh..."
            className="h-9 w-full rounded-xl border-0 bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none ring-0 placeholder:text-slate-400 focus:bg-cyan-50/60"
          />
        </div>
      )}

      <div className="min-h-0 overflow-y-auto overscroll-contain py-0.5">
        {filteredOptions.length ? filteredOptions.map((option, index) => {
          const selected = option.value === selectedValue;
          const active = index === activeIndex;

          return (
            <button
              type="button"
              role="option"
              aria-selected={selected}
              disabled={option.disabled}
              key={`${option.value}-${index}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option)}
              className={cn(
                'group flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                selected
                  ? 'bg-cyan-50 font-semibold text-cyan-800'
                  : active
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                option.disabled && 'cursor-not-allowed opacity-40'
              )}
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              <Check
                className={cn(
                  'h-4 w-4 shrink-0 text-cyan-600 transition-opacity',
                  selected ? 'opacity-100' : 'opacity-0'
                )}
              />
            </button>
          );
        }) : (
          <div className="px-3 py-6 text-center text-sm text-slate-400">
            Không tìm thấy lựa chọn
          </div>
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <div className="relative inline-block w-full">
      <select
        ref={nativeRef}
        value={value}
        defaultValue={defaultValue}
        disabled={disabled}
        onChange={onChange}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        {...props}
      >
        {children}
      </select>

      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        aria-controls={`${triggerId}-menu`}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex min-h-[42px] w-full items-center rounded-xl border border-slate-300 bg-white text-left text-sm font-medium text-slate-700 shadow-sm transition-all',
          'hover:border-cyan-300 hover:bg-cyan-50/20 hover:shadow-md',
          'focus:outline-none focus:ring-4 focus:ring-cyan-500/15 focus:border-cyan-500',
          'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none',
          className,
          'pr-11'
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate', !selectedOption && 'text-slate-400')}>
          {selectedOption?.label ?? 'Chọn một mục'}
        </span>
        <span className="pointer-events-none absolute inset-y-2 right-2 flex w-8 items-center justify-center border-l border-slate-200 pl-2">
          <ChevronDown
            className={cn(
              'h-4 w-4 text-cyan-600 transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
        </span>
      </button>
      {menu}
    </div>
  );
}
