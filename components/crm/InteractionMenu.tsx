'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, MessageSquarePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { INTERACTION_ICONS } from './InteractionTimeline';
import type { InteractionMode } from './InteractionModal';
import { PRIMARY_BTN } from './ui';

const ITEMS: Array<{ mode: InteractionMode; label: string; icon: typeof MessageSquarePlus }> = [
  { mode: 'VIP_ESCORT', label: 'Dẫn khám VIP', icon: INTERACTION_ICONS.VIP_ESCORT },
  { mode: 'DELEGATION', label: 'Dẫn đoàn', icon: INTERACTION_ICONS.DELEGATION },
  { mode: 'OTHER', label: 'Tương tác khác', icon: MessageSquarePlus },
];

/** Nút "Ghi tương tác ▾" với ba lựa chọn, điều khiển được bằng bàn phím. */
export function InteractionMenu({ onPick, modes }: { onPick: (mode: InteractionMode) => void; modes?: InteractionMode[] }) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const items = modes ? ITEMS.filter((i) => modes.includes(i.mode)) : ITEMS;

  useEffect(() => {
    if (!open) return;
    itemRefs.current[active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const onMenuKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + items.length) % items.length);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      rootRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          setActive(0);
          setOpen((v) => !v);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive(0);
            setOpen(true);
          }
        }}
        className={PRIMARY_BTN}
      >
        Ghi tương tác <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div id={menuId} role="menu" onKeyDown={onMenuKey} className="absolute right-0 z-30 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.mode}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={index === active ? 0 : -1}
                onMouseEnter={() => setActive(index)}
                onClick={() => {
                  setOpen(false);
                  onPick(item.mode);
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-cyan-50 hover:text-cyan-800 focus:bg-cyan-50 focus:text-cyan-800 focus:outline-none"
              >
                <Icon className="h-4 w-4 text-cyan-600" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
