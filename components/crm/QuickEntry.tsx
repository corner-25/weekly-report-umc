'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, Crown, Gift, HandHeart, Users } from 'lucide-react';
import { QUICK_ENTRY_KINDS, type QuickEntryKind } from '@/lib/crm/quick-entry';
import { InteractionModal, type InteractionMode, type InteractionPreset } from './InteractionModal';
import type { InteractionDTO } from './types';

const ICONS = { vip: Crown, doan: Users, 'nhan-qua': HandHeart, 'tang-qua': Gift } as const;

const MODAL: Record<QuickEntryKind, { mode: InteractionMode; preset?: InteractionPreset }> = {
  vip: { mode: 'VIP_ESCORT' },
  doan: { mode: 'DELEGATION' },
  'nhan-qua': { mode: 'OTHER', preset: { type: 'OTHER', photoKind: 'RECEIVED', title: 'Nhận quà, hoa' } },
  'tang-qua': { mode: 'OTHER', preset: { type: 'GIFT', photoKind: 'GIVEN' } },
};

/** Bốn nút lớn, bấm là mở form; lưu xong ở lại trang để ghi tiếp. */
export function QuickEntry({ initialKind, userName }: { initialKind?: QuickEntryKind; userName: string }) {
  const [kind, setKind] = useState<QuickEntryKind | null>(initialKind ?? null);
  const [lastSaved, setLastSaved] = useState<InteractionDTO | null>(null);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-md space-y-5">
        <header>
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Phòng Hành chính · CRM</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Nhập nhanh</h1>
          <p className="text-sm text-slate-500">{userName ? `Xin chào ${userName}. ` : ''}Chọn việc vừa làm để ghi lại.</p>
        </header>

        {lastSaved && (
          <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Đã lưu{lastSaved.photos.length ? ` kèm ${lastSaved.photos.length} ảnh` : ''}.</p>
              <Link href="/dashboard/crm/interactions" className="font-medium underline underline-offset-2">Xem trong CRM</Link>
            </div>
          </div>
        )}

        <nav aria-label="Chọn việc cần ghi" className="grid gap-3">
          {(Object.keys(QUICK_ENTRY_KINDS) as QuickEntryKind[]).map((k) => {
            const Icon = ICONS[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:border-cyan-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 active:scale-[0.99]"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-900">{QUICK_ENTRY_KINDS[k].label}</span>
                  <span className="block text-sm text-slate-500">{QUICK_ENTRY_KINDS[k].hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <Link href="/dashboard/crm" className="block text-center text-sm font-medium text-slate-500 hover:text-slate-800">Về trang CRM</Link>
      </div>

      {kind && (
        <InteractionModal
          key={kind}
          mode={MODAL[kind].mode}
          preset={MODAL[kind].preset}
          onClose={() => setKind(null)}
          onSaved={(saved) => {
            setLastSaved(saved);
            setKind(null);
          }}
        />
      )}
    </main>
  );
}
