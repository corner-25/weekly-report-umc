'use client';

/**
 * Ô chọn ngày / ngày giờ / giờ thay cho ô nhập native (trên iPhone hiện tiếng Anh,
 * dạng viên thuốc nhỏ, khó bấm). Dùng như <input>: value / onChange(e) với
 * e.target.value cùng định dạng HTML ("YYYY-MM-DD", "YYYY-MM-DDTHH:mm", "HH:mm"),
 * có name thì kèm ô ẩn để form gửi được. Máy tính: bảng nổi dưới ô; điện thoại:
 * bảng trượt từ dưới lên.
 */
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  addDays,
  addMonths,
  formatValue,
  monthGrid,
  outOfRange,
  pad,
  parseKey,
  parseTime,
  toKey,
  todayKey,
  WEEKDAYS,
  type DateMode,
  type Ymd,
} from '@/lib/date-picker';

const MOBILE_MAX = 640;
const PANEL_WIDTH = 312;
const MINUTE_STEP = 5;
const YEAR_SPAN = 12;

export interface DateInputProps {
  type?: DateMode;
  value?: string;
  defaultValue?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  name?: string;
  id?: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  'data-autofocus'?: boolean;
}

/** Sự kiện giả đủ dùng cho các handler đọc e.target.value / e.target.name. */
function fakeEvent(value: string, name?: string): ChangeEvent<HTMLInputElement> {
  const target = { value, name: name ?? '' } as HTMLInputElement;
  return { target, currentTarget: target } as ChangeEvent<HTMLInputElement>;
}

export function DateInput({
  type = 'date',
  value,
  defaultValue,
  onChange,
  name,
  id,
  min,
  max,
  required,
  disabled,
  placeholder,
  className,
  ...rest
}: DateInputProps) {
  const [inner, setInner] = useState(defaultValue ?? '');
  const current = value ?? inner;
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const autoId = useId();
  const triggerId = id ?? `date-${autoId.replace(/:/g, '')}`;

  const commit = (next: string) => {
    if (value === undefined) setInner(next);
    onChange?.(fakeEvent(next, name));
  };

  const label = formatValue(current, type);
  const Icon = type === 'time' ? Clock : CalendarDays;
  return (
    <div className="relative w-full">
      {name && <input type="hidden" name={name} value={current} />}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={rest['aria-label']}
        data-autofocus={rest['data-autofocus'] || undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex min-h-[42px] w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-left text-sm text-slate-800 shadow-sm transition',
          'hover:border-brand-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:bg-slate-100',
          className,
          'pr-10',
        )}
      >
        <Icon className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
        <span className={cn('min-w-0 flex-1 truncate', !label && 'text-slate-400')}>
          {label || placeholder || (type === 'time' ? 'Chọn giờ' : type === 'datetime-local' ? 'Chọn ngày giờ' : 'Chọn ngày')}
        </span>
      </button>
      {current && !required && !disabled && (
        <button
          type="button"
          onClick={() => commit('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Xoá ngày đã chọn"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      {open && (
        <Picker
          type={type}
          value={current}
          min={min}
          max={max}
          required={required}
          anchor={triggerRef}
          onPick={(next, close) => {
            commit(next);
            if (close) setOpen(false);
          }}
          onClose={() => {
            setOpen(false);
            triggerRef.current?.focus({ preventScroll: true });
          }}
        />
      )}
    </div>
  );
}

interface PickerProps {
  type: DateMode;
  value: string;
  min?: string;
  max?: string;
  required?: boolean;
  anchor: React.RefObject<HTMLButtonElement | null>;
  onPick: (value: string, close: boolean) => void;
  onClose: () => void;
}

function Picker({ type, value, min, max, required, anchor, onPick, onClose }: PickerProps) {
  const [mobile, setMobile] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = parseKey(value);
  const time = parseTime(value) ?? (type === 'datetime-local' ? { h: new Date().getHours(), min: 0 } : null);
  const today = todayKey();
  const start = selected ?? parseKey(min && today < min ? min : max && today > max ? max : today)!;
  const [view, setView] = useState({ y: start.y, m: start.m });
  const [yearMode, setYearMode] = useState(false);
  const [focusKey, setFocusKey] = useState(toKey(start));

  useLayoutEffect(() => {
    const place = () => {
      const isMobile = window.innerWidth < MOBILE_MAX;
      setMobile(isMobile);
      if (isMobile || !anchor.current) return;
      const r = anchor.current.getBoundingClientRect();
      const h = panelRef.current?.offsetHeight ?? 380;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - PANEL_WIDTH - 8);
      const top = r.bottom + 6 + h > window.innerHeight - 8 ? Math.max(8, r.top - 6 - h) : r.bottom + 6;
      setPos({ left, top });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, yearMode]);

  // Bấm ra ngoài (máy tính) hoặc Esc thì đóng.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !anchor.current?.contains(t)) onClose();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [anchor, onClose]);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('[data-focus="true"]')?.focus({ preventScroll: true });
  }, [focusKey, view, yearMode]);

  const withTime = (key: string, t = time) => (type === 'datetime-local' && t ? `${key}T${pad(t.h)}:${pad(t.min)}` : key);
  const pickDay = (day: Ymd) => {
    const key = toKey(day);
    if (outOfRange(key, min, max)) return;
    setFocusKey(key);
    // Ngày giờ: chọn ngày xong còn chọn giờ, chưa đóng.
    onPick(withTime(key), type === 'date');
  };
  const pickTime = (t: { h: number; min: number }) => {
    if (type === 'time') return onPick(`${pad(t.h)}:${pad(t.min)}`, false);
    onPick(withTime(selected ? toKey(selected) : today, t), false);
  };

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (delta === undefined) return;
    e.preventDefault();
    const next = addDays(parseKey(focusKey)!, delta);
    setFocusKey(toKey(next));
    if (next.m !== view.m || next.y !== view.y) setView({ y: next.y, m: next.m });
  };

  const showCalendar = type !== 'time';
  const body = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={type === 'time' ? 'Chọn giờ' : 'Chọn ngày'}
      style={mobile ? undefined : { left: pos?.left ?? -9999, top: pos?.top ?? -9999, width: PANEL_WIDTH }}
      className={cn(
        'z-[10001] bg-white p-3 shadow-[0_18px_50px_-12px_rgba(15,23,42,0.35)]',
        mobile ? 'fixed inset-x-0 bottom-0 animate-sheet-up rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]' : 'fixed animate-pop-in rounded-2xl border border-slate-200',
      )}
    >
      {mobile && <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-200" aria-hidden="true" />}
      {showCalendar && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setView(addMonths(view.y, view.m, yearMode ? -12 * YEAR_SPAN : -1))} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={yearMode ? 'Các năm trước' : 'Tháng trước'}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setYearMode((v) => !v)} className="rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 hover:bg-slate-100" aria-label="Chọn tháng, năm">
              {yearMode ? 'Chọn năm' : `Tháng ${view.m}, ${view.y}`}
            </button>
            <button type="button" onClick={() => setView(addMonths(view.y, view.m, yearMode ? 12 * YEAR_SPAN : 1))} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={yearMode ? 'Các năm sau' : 'Tháng sau'}>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {yearMode ? (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: YEAR_SPAN }, (_, i) => view.y - Math.floor(YEAR_SPAN / 2) + i).map((y) => (
                  <button key={y} type="button" data-focus={y === view.y} onClick={() => setView({ y, m: view.m })} className={cn('rounded-lg py-2 text-sm font-medium', y === view.y ? 'bg-brand-600 text-white' : 'text-slate-700 hover:bg-slate-100')}>
                    {y}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5 border-t border-slate-100 pt-3">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <button key={m} type="button" onClick={() => { setView({ y: view.y, m }); setYearMode(false); }} className={cn('rounded-lg py-2 text-sm', m === view.m ? 'bg-brand-50 font-semibold text-brand-800' : 'text-slate-700 hover:bg-slate-100')}>
                    Th {m}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div role="grid" onKeyDown={onGridKey}>
              <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-400" role="row">
                {WEEKDAYS.map((w) => <span key={w} role="columnheader" className="py-1">{w}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5" role="rowgroup">
                {monthGrid(view.y, view.m).map((day) => {
                  const key = toKey(day);
                  const isSelected = selected && key === toKey(selected);
                  const disabledDay = outOfRange(key, min, max);
                  return (
                    <button
                      key={key}
                      type="button"
                      role="gridcell"
                      aria-selected={Boolean(isSelected)}
                      aria-label={`${day.d}/${day.m}/${day.y}`}
                      tabIndex={key === focusKey ? 0 : -1}
                      data-focus={key === focusKey}
                      disabled={disabledDay}
                      onClick={() => pickDay(day)}
                      className={cn(
                        'h-10 rounded-xl text-sm tabular-nums transition sm:h-9',
                        isSelected ? 'bg-brand-600 font-bold text-white shadow-sm' : 'hover:bg-brand-50',
                        !isSelected && key === today && 'font-bold text-brand-700 ring-1 ring-inset ring-brand-300',
                        !isSelected && !day.inMonth && 'text-slate-300',
                        !isSelected && day.inMonth && key !== today && 'text-slate-700',
                        (day.m === view.m ? (weekend(day) && !isSelected ? 'text-rose-500' : '') : ''),
                        disabledDay && 'cursor-not-allowed opacity-30 hover:bg-transparent',
                      )}
                    >
                      {day.d}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {type !== 'date' && <TimeRow time={time} onPick={pickTime} />}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <div className="flex gap-1">
          {showCalendar && (
            <button type="button" onClick={() => pickDay(parseKey(today)!)} disabled={outOfRange(today, min, max)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-40">
              Hôm nay
            </button>
          )}
          {!required && value && (
            <button type="button" onClick={() => onPick('', true)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100">
              Xoá
            </button>
          )}
        </div>
        <button type="button" onClick={onClose} className="rounded-xl bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700">
          Xong
        </button>
      </div>
    </div>
  );

  if (mobile) {
    return createPortal(
      <div className="fixed inset-0 z-[10000] bg-slate-950/40 animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        {body}
      </div>,
      document.body,
    );
  }
  return createPortal(body, document.body);
}

/** Cuộn cột giờ/phút cho mục đang chọn vào giữa — chỉ cuộn cột, không kéo cả trang. */
function centerInColumn(el: HTMLButtonElement | null) {
  const column = el?.parentElement;
  if (!el || !column) return;
  column.scrollTop = el.offsetTop - column.clientHeight / 2 + el.clientHeight / 2;
}

const weekend = (day: Ymd) => {
  const w = new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay();
  return w === 0;
};

/** Chọn giờ: giờ và phút (bước 5 phút, giữ phút lẻ đang có). */
function TimeRow({ time, onPick }: { time: { h: number; min: number } | null; onPick: (t: { h: number; min: number }) => void }) {
  const minutes = Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP);
  if (time && !minutes.includes(time.min)) minutes.push(time.min);
  minutes.sort((a, b) => a - b);
  const col = 'max-h-40 overflow-y-auto overscroll-contain rounded-xl bg-slate-50 p-1';
  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Clock className="h-3.5 w-3.5" aria-hidden="true" />Giờ</p>
      <div className="grid grid-cols-2 gap-2">
        <div className={col} role="listbox" aria-label="Giờ">
          {Array.from({ length: 24 }, (_, h) => h).map((h) => (
            <button key={h} type="button" role="option" aria-selected={time?.h === h} ref={time?.h === h ? centerInColumn : undefined} onClick={() => onPick({ h, min: time?.min ?? 0 })} className={cn('block w-full rounded-lg py-1.5 text-center text-sm tabular-nums', time?.h === h ? 'bg-brand-600 font-bold text-white' : 'text-slate-700 hover:bg-white')}>
              {pad(h)} giờ
            </button>
          ))}
        </div>
        <div className={col} role="listbox" aria-label="Phút">
          {minutes.map((m) => (
            <button key={m} type="button" role="option" aria-selected={time?.min === m} ref={time?.min === m ? centerInColumn : undefined} onClick={() => onPick({ h: time?.h ?? 8, min: m })} className={cn('block w-full rounded-lg py-1.5 text-center text-sm tabular-nums', time?.min === m ? 'bg-brand-600 font-bold text-white' : 'text-slate-700 hover:bg-white')}>
              {pad(m)} phút
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
