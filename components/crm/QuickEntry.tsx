'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CalendarCheck, CheckCircle2, Crown, Gift, HandHeart, Users } from 'lucide-react';
import { QUICK_ENTRY_KINDS, type QuickEntryKind } from '@/lib/crm/quick-entry';
import { InteractionModal, type InteractionMode, type InteractionPreset } from './InteractionModal';
import { FollowUpPickerModal } from './FollowUpPickerModal';
import type { InteractionDTO } from './types';

const ICONS = { vip: Crown, doan: Users, 'nhan-qua': HandHeart, 'tang-qua': Gift } as const;

const MODAL: Record<QuickEntryKind, { mode: InteractionMode; preset?: InteractionPreset }> = {
  vip: { mode: 'VIP_ESCORT' },
  doan: { mode: 'DELEGATION' },
  'nhan-qua': { mode: 'OTHER', preset: { type: 'OTHER', photoKind: 'RECEIVED', title: 'Nhận quà, hoa' } },
  'tang-qua': { mode: 'OTHER', preset: { type: 'GIFT', photoKind: 'GIVEN' } },
};

/** Các nút lớn nhập nhanh trên điện thoại, bấm là mở form; lưu xong ở lại trang để ghi tiếp. */
export function QuickEntry({ initialKind, userName }: { initialKind?: QuickEntryKind; userName: string }) {
  const [kind, setKind] = useState<QuickEntryKind | null>(initialKind ?? null);
  const [appointmentPreset, setAppointmentPreset] = useState<InteractionPreset | undefined>(undefined);
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);
  const [lastSaved, setLastSaved] = useState<InteractionDTO | null>(null);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-md space-y-4">
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

        {/* Nút tắt cho khách đến theo lịch hẹn (±7 ngày) */}
        <button
          type="button"
          onClick={() => setShowFollowUpPicker(true)}
          className="w-full flex items-center gap-3.5 rounded-2xl border border-teal-200/90 bg-gradient-to-r from-teal-50/90 via-cyan-50/40 to-white p-3.5 text-left shadow-2xs transition hover:border-teal-400 hover:shadow-md active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-800">
            <CalendarCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-slate-900 text-sm">Khách đến theo lịch hẹn</span>
            <span className="block text-xs text-slate-500">Hẹn tái khám, chụp MRI trong khoảng ±7 ngày</span>
          </span>
          <span className="text-xs font-bold text-teal-800 bg-teal-100/80 px-2.5 py-1 rounded-full border border-teal-200/70 shrink-0">
            Chọn hẹn →
          </span>
        </button>

        <nav aria-label="Chọn việc cần ghi" className="grid gap-3">
          {(Object.keys(QUICK_ENTRY_KINDS) as QuickEntryKind[]).map((k) => {
            const Icon = ICONS[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setAppointmentPreset(undefined);
                  setKind(k);
                }}
                className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-2xs transition hover:border-cyan-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 active:scale-[0.99]"
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

      {showFollowUpPicker && (
        <FollowUpPickerModal
          onClose={() => setShowFollowUpPicker(false)}
          onSelect={(item) => {
            setShowFollowUpPicker(false);
            setAppointmentPreset({
              contactId: item.contact?.id,
              contactName: item.contact?.fullName,
              organizationId: item.organization?.id,
              organizationName: item.organization?.name,
              destination: item.destination ?? '',
              content: item.followUp ? `Đón tiếp theo hẹn: ${item.followUp}` : 'Đón tiếp và hỗ trợ theo lịch hẹn',
              referrerContactId: item.referrerContact?.id,
              referrerName: item.referrerContact?.fullName,
              relatedVipContactId: item.relatedVipContact?.id,
              relatedVipName: item.relatedVipContact?.fullName,
              vipRelationship: item.vipRelationship ?? '',
              doctors: item.doctors?.map((d) => ({ id: d.id, label: d.fullName })),
              services: item.services,
            });
            setKind('vip');
          }}
        />
      )}

      {kind && (
        <InteractionModal
          key={`${kind}-${appointmentPreset?.contactId ?? 'new'}`}
          mode={MODAL[kind].mode}
          preset={appointmentPreset ?? MODAL[kind].preset}
          onClose={() => {
            setKind(null);
            setAppointmentPreset(undefined);
          }}
          onSaved={(saved) => {
            setLastSaved(saved);
            setKind(null);
            setAppointmentPreset(undefined);
          }}
        />
      )}
    </main>
  );
}
