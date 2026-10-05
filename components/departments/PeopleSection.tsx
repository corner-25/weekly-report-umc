'use client';

/** Khối nhân sự và hồ sơ pháp lý của phòng: thư ký, giấy phép, MOU. */
import Link from 'next/link';
import { Mail, Phone, ShieldCheck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/components/crm/format';
import { SectionCard } from '@/components/crm/ui';
import type { DepartmentProfile } from '@/lib/department-profile';
import { FOCUS_RING } from './bits';

const LICENSE_WARN_DAYS = 60;

export function PeopleSection({ data }: { data: DepartmentProfile }) {
  const link = (href: string, label: string) => (
    <Link href={href} className={cn('rounded text-xs font-semibold text-brand-700 hover:underline', FOCUS_RING)}>{label}</Link>
  );
  return (
    <div id="nhan-su" className="grid scroll-mt-20 items-start gap-4 lg:grid-cols-2">
      <SectionCard title={`Thư ký (${data.secretaries.length})`} icon={<Users className="h-4 w-4 text-brand-600" aria-hidden="true" />} action={link('/dashboard/secretaries', 'Danh sách thư ký →')}>
        {data.secretaries.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có thư ký nào đang làm việc tại phòng này.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.secretaries.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5 py-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color ?? '#94a3b8' }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{s.fullName}</span>
                  <span className="block truncate text-xs text-slate-500">{[s.type, s.birthday && `SN ${s.birthday}`].filter(Boolean).join(' · ') || '—'}</span>
                </span>
                {s.phone && (
                  <a href={`tel:${s.phone}`} className={cn('rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-700', FOCUS_RING)} aria-label={`Gọi ${s.fullName}`} title={s.phone}>
                    <Phone className="h-4 w-4" aria-hidden="true" />
                  </a>
                )}
                {s.email ? (
                  <a href={`mailto:${s.email}`} className={cn('rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-700', FOCUS_RING)} aria-label={`Gửi email cho ${s.fullName}`} title={s.email}>
                    <Mail className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-[11px] text-amber-700" title="Thư ký chưa có email — không nhận được email nhắc việc">chưa có email</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">{data.counts.accounts} tài khoản đăng nhập hệ thống gắn với phòng.</p>
      </SectionCard>

      <SectionCard title="Giấy phép & MOU" icon={<ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />} action={<span className="flex gap-3">{link('/dashboard/licenses', 'Giấy phép →')}{link('/dashboard/mous', 'MOU →')}</span>}>
        {data.licenses.length === 0 && data.mous.length === 0 ? (
          <p className="text-sm text-slate-500">Phòng chưa có giấy phép hay MOU nào trong hệ thống.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {data.licenses.map((l) => {
              const expired = l.daysLeft !== null && l.daysLeft < 0;
              const soon = l.daysLeft !== null && l.daysLeft >= 0 && l.daysLeft < LICENSE_WARN_DAYS;
              return (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate text-slate-800" title={l.name}>{l.name}</span>
                  <span
                    className={cn('shrink-0 text-xs font-semibold', expired ? 'text-rose-600' : soon ? 'text-orange-600' : 'text-slate-500')}
                    title={expired ? 'Đã hết hạn' : soon ? `Hết hạn trong ${LICENSE_WARN_DAYS} ngày tới` : undefined}
                  >
                    {l.expiryDate ? `${expired ? 'đã hết hạn' : 'hết hạn'} ${formatDate(l.expiryDate)}` : 'không thời hạn'}
                  </span>
                </li>
              );
            })}
            {data.mous.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-slate-800" title={m.title}>MOU · {m.partnerName}</span>
                <span className="shrink-0 text-xs text-slate-500">{m.expiryDate ? formatDate(m.expiryDate) : m.status}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
