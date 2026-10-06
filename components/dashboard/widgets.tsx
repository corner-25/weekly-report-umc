'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { AlertTriangle, ArrowLeftRight, ArrowRight, Cake, CalendarClock, FileText, Handshake, Users, type LucideIcon } from 'lucide-react';
import type { DashboardBirthday, DashboardEvent, DashboardMou, DashboardSecretaryType, DashboardTransfer, DashboardWeek } from './types';

const MS_PER_DAY = 86_400_000;
const MOU_URGENT_DAYS = 30;

interface WidgetCardProps {
  icon: LucideIcon;
  /** Lớp màu cho ô icon, vd "bg-rose-50 text-rose-600". */
  tone: string;
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
}

/** Khung chung cho mọi khối trên trang Tổng quan: icon, tiêu đề, liên kết "Xem". */
export function WidgetCard({ icon: Icon, tone, title, subtitle, href, linkLabel = 'Xem', children }: WidgetCardProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex min-w-[12rem] flex-1 items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="truncate text-sm text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {href && (
          <Link href={href} className="flex shrink-0 items-center gap-1 text-sm font-medium text-cyan-600 hover:text-cyan-700">
            {linkLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="px-5 py-4 text-sm text-slate-500">{children}</p>;
}

/** Báo cáo tuần gần nhất — khối có dữ liệu thường xuyên nhất nên đặt đầu cột chính. */
export function RecentWeeksCard({ weeks }: { weeks: DashboardWeek[] }) {
  return (
    <WidgetCard icon={FileText} tone="bg-cyan-50 text-cyan-600" title="Báo cáo tuần gần đây" href="/dashboard/weeks" linkLabel="Xem tất cả">
      {weeks.length === 0 ? (
        <div className="py-6 text-center">
          <p className="mb-3 text-slate-500">Chưa có báo cáo nào — báo cáo các phòng được quét tự động hằng ngày.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-3">
          {weeks.map((week) => (
            <Link
              key={week.id}
              href={`/dashboard/weeks/${week.id}/summary`}
              className="group block rounded-xl border border-slate-200 p-4 transition-all hover:border-cyan-300 hover:shadow-sm"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-bold text-slate-900">Tuần {week.weekNumber}</span>
                {week.status === 'COMPLETED' && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Đã chốt</span>
                )}
              </div>
              <p className="text-sm text-slate-500">
                {format(new Date(week.startDate), 'd/M', { locale: vi })} – {format(new Date(week.endDate), 'd/M/yyyy', { locale: vi })}
              </p>
              <p className="mt-2 text-xs text-slate-400">{week.taskCount} nhiệm vụ</p>
            </Link>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

/** Sự kiện hôm nay và sắp tới gộp một khối; trống thì chỉ còn một dòng. */
export function EventsCard({ today, upcoming }: { today: DashboardEvent[]; upcoming: DashboardEvent[] }) {
  const todayIds = new Set(today.map((e) => e.id));
  const later = upcoming.filter((e) => !todayIds.has(e.id));
  const subtitle = today.length > 0 ? `${today.length} sự kiện hôm nay` : 'Hôm nay không có sự kiện';

  return (
    <WidgetCard icon={CalendarClock} tone="bg-pink-100 text-pink-600" title="Sự kiện bệnh viện" subtitle={subtitle} href="/dashboard/hospital-events-calendar" linkLabel="Xem lịch">
      {today.length === 0 && later.length === 0 ? (
        <EmptyLine>Chưa có sự kiện nào sắp tới.</EmptyLine>
      ) : (
        <div className="divide-y divide-slate-100">
          {today.map((event) => (
            <div key={event.id} className="flex items-center gap-4 bg-pink-50/40 px-5 py-3">
              <div className="min-w-[45px] text-center text-sm font-bold tabular-nums text-pink-600">{event.time || '--:--'}</div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 font-medium text-slate-900">{event.name}</p>
                <p className="text-sm text-slate-500">Hôm nay · {event.meetingRoom?.name || 'Chưa có phòng'}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${event.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {event.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Chờ xác nhận'}
              </span>
            </div>
          ))}
          {later.map((event) => (
            <div key={event.id} className="flex items-center gap-4 px-5 py-3">
              <div className="min-w-[45px] text-center">
                <div className="text-xs font-medium uppercase text-slate-500">{format(new Date(event.date), 'MMM', { locale: vi })}</div>
                <div className="text-xl font-bold tabular-nums text-slate-900">{format(new Date(event.date), 'd')}</div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 font-medium text-slate-900">{event.name}</p>
                <p className="text-sm text-slate-500">
                  {event.time && <span>{event.time} · </span>}
                  {event.meetingRoom?.name || 'Chưa có phòng'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

export function BirthdayCard({ people, preview }: { people: DashboardBirthday[]; preview: DashboardBirthday[] }) {
  return (
    <WidgetCard
      icon={Cake}
      tone="bg-rose-50 text-rose-600"
      title="Sinh nhật thư ký tuần này"
      subtitle={people.length > 0 ? `${people.length} người · gần nhất trước` : undefined}
      href="/dashboard/secretaries/birthdays?period=week"
    >
      {people.length === 0 ? (
        <EmptyLine>Không có sinh nhật tuần này.</EmptyLine>
      ) : (
        <div className="divide-y divide-slate-100 px-5">
          {preview.map((s) => (
            <div key={s.id} className="flex items-center gap-3 py-3">
              <div className="w-10 shrink-0 text-center">
                <div className="text-lg font-semibold leading-none tabular-nums text-slate-900">{s.birthdayDay}</div>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">Thg {s.birthdayMonth}</div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{s.fullName}</p>
                <p className={`text-xs ${s.isToday ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>{s.isToday ? 'Hôm nay' : `Tròn ${s.age} tuổi`}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

/** Thư ký theo loại: thanh ngang thay cho biểu đồ tròn — đọc số dễ hơn trong cột hẹp. */
export function SecretaryCard({ active, total, byType }: { active: number; total: number; byType: DashboardSecretaryType[] }) {
  return (
    <WidgetCard icon={Users} tone="bg-blue-50 text-blue-600" title="Thư ký" subtitle={`${active} đang làm việc / ${total}`} href="/dashboard/secretaries" linkLabel="Quản lý">
      {byType.length === 0 ? (
        <EmptyLine>Chưa có dữ liệu.</EmptyLine>
      ) : (
        <div className="space-y-2.5 p-5">
          {byType.map((t) => {
            const pct = active > 0 ? Math.round((t.count / active) * 100) : 0;
            return (
              <div key={t.typeId ?? t.name} className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: t.color }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-slate-700" title={t.name}>{t.name}</span>
                  <span className="font-semibold tabular-nums text-slate-900">{t.count}</span>
                  <span className="w-9 text-right text-xs tabular-nums text-slate-400">{pct}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: t.color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}

export function MouCard({ mous }: { mous: DashboardMou[] }) {
  const now = Date.now();
  return (
    <WidgetCard icon={AlertTriangle} tone="bg-orange-50 text-orange-500" title="MOU cần chú ý" subtitle="Hết hạn trong 90 ngày" href="/dashboard/mous?status=EXPIRING">
      <div className="divide-y divide-slate-100">
        {mous.map((m) => {
          const expiry = new Date(m.expiryDate);
          const days = Math.ceil((expiry.getTime() - now) / MS_PER_DAY);
          const urgent = days <= MOU_URGENT_DAYS;
          return (
            <Link key={m.id} href="/dashboard/mous" className="flex items-start gap-2 px-5 py-3 transition-colors hover:bg-slate-50/50">
              <Handshake className={`mt-0.5 h-4 w-4 shrink-0 ${urgent ? 'text-red-500' : 'text-orange-500'}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium text-slate-900">{m.title}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{m.partnerName}</p>
                <p className={`mt-1 text-xs font-medium ${urgent ? 'text-red-600' : 'text-orange-600'}`}>
                  {days <= 0 ? `Đã hết hạn ${Math.abs(days)} ngày` : `Còn ${days} ngày (${format(expiry, 'd/M/yyyy', { locale: vi })})`}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </WidgetCard>
  );
}

export function TransfersCard({ transfers }: { transfers: DashboardTransfer[] }) {
  return (
    <WidgetCard icon={ArrowLeftRight} tone="bg-slate-100 text-slate-500" title="Luân chuyển thư ký gần đây" href="/dashboard/secretaries/transfers">
      <div className="divide-y divide-slate-100">
        {transfers.map((t) => (
          <div key={t.id} className="px-5 py-3">
            <p className="text-sm font-medium text-slate-900">{t.secretary?.fullName}</p>
            <p className="mt-1 text-xs text-slate-500">{t.fromDepartment?.name || 'Mới'} → {t.toDepartment?.name}</p>
            <p className="mt-1 text-xs text-slate-400">{format(new Date(t.transferDate), 'd/M/yyyy', { locale: vi })}</p>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

interface QuickActionItem {
  href: string;
  icon: LucideIcon;
  label: string;
}

/** Thao tác nhanh nằm ngang dưới tiêu đề, không phải cuộn xuống cuối cột phải mới thấy. */
export function QuickActions({ items }: { items: QuickActionItem[] }) {
  return (
    <nav aria-label="Thao tác nhanh" className="flex flex-wrap gap-2">
      {items.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          className="group inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition-colors hover:border-cyan-200 hover:bg-cyan-50/50 hover:text-slate-900"
        >
          <Icon className="h-4 w-4 text-slate-500 transition-colors group-hover:text-cyan-600" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
