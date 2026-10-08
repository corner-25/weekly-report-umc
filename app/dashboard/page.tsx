'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useDashboardStats } from '@/lib/swr';
import { PageHeader } from '@/components/ui/PageHeader';
import { DashboardCrmWidget } from '@/components/crm/DashboardCrmWidget';
import { DashboardWorkWidget } from '@/components/dashboard/DashboardWorkWidget';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ClipboardCheck,
  CheckCircle2,
  FileText,
  CalendarDays,
  Users,
  Handshake,
  HeartHandshake,
  Briefcase,
  Building2,
  CalendarClock,
} from 'lucide-react';
import { BirthdayCard, EventsCard, MouCard, QuickActions, RecentWeeksCard, SecretaryCard, TransfersCard } from '@/components/dashboard/widgets';
import type { DashboardStats } from '@/components/dashboard/types';

type KpiTone = 'purple' | 'emerald' | 'amber' | 'sky' | 'blue' | 'teal' | 'indigo' | 'rose';

interface KpiToneStyle {
  border: string;
  bgGradient: string;
  badgeBg: string;
  badgeText: string;
  badgeShadow: string;
  titleText: string;
  divider: string;
}

const DASHBOARD_TONE_STYLES: Record<KpiTone, KpiToneStyle> = {
  purple: {
    border: 'border-purple-200/80',
    bgGradient: 'from-purple-50/60 via-white to-white',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-700',
    badgeShadow: 'shadow-purple-200/50',
    titleText: 'text-purple-800',
    divider: 'border-purple-100/80',
  },
  emerald: {
    border: 'border-emerald-200/80',
    bgGradient: 'from-emerald-50/60 via-white to-white',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-700',
    badgeShadow: 'shadow-emerald-200/50',
    titleText: 'text-emerald-800',
    divider: 'border-emerald-100/80',
  },
  amber: {
    border: 'border-amber-200/80',
    bgGradient: 'from-amber-50/60 via-white to-white',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    badgeShadow: 'shadow-amber-200/50',
    titleText: 'text-amber-800',
    divider: 'border-amber-100/80',
  },
  sky: {
    border: 'border-sky-200/80',
    bgGradient: 'from-sky-50/60 via-white to-white',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-700',
    badgeShadow: 'shadow-sky-200/50',
    titleText: 'text-sky-800',
    divider: 'border-sky-100/80',
  },
  blue: {
    border: 'border-blue-200/80',
    bgGradient: 'from-blue-50/60 via-white to-white',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700',
    badgeShadow: 'shadow-blue-200/50',
    titleText: 'text-blue-800',
    divider: 'border-blue-100/80',
  },
  teal: {
    border: 'border-teal-200/80',
    bgGradient: 'from-teal-50/60 via-white to-white',
    badgeBg: 'bg-teal-100',
    badgeText: 'text-teal-700',
    badgeShadow: 'shadow-teal-200/50',
    titleText: 'text-teal-800',
    divider: 'border-teal-100/80',
  },
  indigo: {
    border: 'border-indigo-200/80',
    bgGradient: 'from-indigo-50/60 via-white to-white',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-700',
    badgeShadow: 'shadow-indigo-200/50',
    titleText: 'text-indigo-800',
    divider: 'border-indigo-100/80',
  },
  rose: {
    border: 'border-rose-200/80',
    bgGradient: 'from-rose-50/60 via-white to-white',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-700',
    badgeShadow: 'shadow-rose-200/50',
    titleText: 'text-rose-800',
    divider: 'border-rose-100/80',
  },
};

function DashboardKpiCard({
  label,
  value,
  hint,
  href,
  tone,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  href: string;
  tone: KpiTone;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const st = DASHBOARD_TONE_STYLES[tone];
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 sm:p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
        st.border,
        'bg-gradient-to-br',
        st.bgGradient
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('text-xs font-bold uppercase tracking-wider', st.titleText)}>{label}</p>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold tabular-nums text-slate-900 sm:text-3xl">
              {value}
            </span>
          </div>
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-xs transition-transform group-hover:scale-105', st.badgeBg, st.badgeText, st.badgeShadow)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      {hint && (
        <div className={cn('mt-3 border-t pt-2.5 text-xs text-slate-500 leading-snug', st.divider)}>
          {hint}
        </div>
      )}
    </Link>
  );
}

const QUICK_ACTIONS = [
  { href: '/dashboard/crm/interactions', icon: Handshake, label: 'Ghi lượt dẫn khách / đoàn' },
  { href: '/dashboard/hospital-events', icon: CalendarDays, label: 'Thêm sự kiện' },
  { href: '/dashboard/secretaries', icon: Users, label: 'Thêm thư ký' },
  { href: '/dashboard/hospital-events-calendar', icon: CalendarClock, label: 'Xem lịch sự kiện' },
];

export default function Dashboard() {
  const { data: stats, error, isLoading, mutate } = useDashboardStats();
  const today = new Date();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error?.message || 'Không thể tải dữ liệu'}</p>
          <button
            onClick={() => mutate()}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const data = stats as DashboardStats;

  const workOpen = data.workStats?.open ?? 0;
  const workDone = data.workStats?.done ?? 0;
  const workOverdue = data.workStats?.overdue ?? 0;

  const mouActive = data.mouStats?.active ?? 0;
  const mouTotal = data.mouStats?.total ?? 0;

  const crmVipMonth = data.crmStats?.vipEscortsThisMonth ?? 0;
  const crmDelegationsMonth = data.crmStats?.delegationsThisMonth ?? 0;
  const crmTotalEscorts = data.crmStats?.totalVipEscorts ?? 0;
  const crmTotalContacts = data.crmStats?.totalContacts ?? 0;
  const crmTotalOrgs = data.crmStats?.totalOrgs ?? 0;

  const taskCompletionRate = data.totalMasterTasks > 0 ? Math.round((data.tasksCompleted / data.totalMasterTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Tổng quan hoạt động"
        description={format(today, "EEEE, 'ngày' d 'tháng' M 'năm' yyyy", { locale: vi })}
        actions={
          <Link
            href="/dashboard/weeks"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-600 text-white text-sm font-medium rounded-xl hover:bg-cyan-700 transition-all shadow-sm shadow-cyan-500/20"
          >
            <FileText className="w-4 h-4" />
            Báo cáo tuần Bệnh viện
          </Link>
        }
      />

      <QuickActions items={QUICK_ACTIONS} />

      {/* 2 Hàng KPI tổng thể toàn bộ hệ thống */}
      <div className="space-y-5">
        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Chỉ đạo & Báo cáo nhiệm vụ Bệnh viện</h3>
            <span className="text-xs text-slate-400">Giao ban tuần & Chỉ đạo BGĐ</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardKpiCard
              label="Nhiệm vụ báo cáo tuần"
              value={data.totalMasterTasks}
              hint={<><span>{data.totalWeeks} tuần báo cáo giao ban đã chốt</span></>}
              icon={ClipboardCheck}
              tone="purple"
              href="/dashboard/tasks/progress?xem=tong-quan"
            />
            <DashboardKpiCard
              label="Tiến độ hoàn thành"
              value={data.tasksCompleted}
              hint={<><span>{taskCompletionRate}% đã xong · {data.tasksInProgress} đang tiến hành</span></>}
              icon={CheckCircle2}
              tone="emerald"
              href="/dashboard/tasks/progress?xem=tong-quan"
            />
            <DashboardKpiCard
              label="Việc BGĐ chỉ đạo"
              value={workOpen}
              hint={<><span>{workDone} việc đã xong{workOverdue > 0 ? ` · ${workOverdue} quá hạn` : ''}</span></>}
              icon={Briefcase}
              tone="amber"
              href="/dashboard/work"
            />
            <DashboardKpiCard
              label="Thỏa thuận hợp tác MOU"
              value={mouActive}
              hint={<><span>{mouTotal} bản ký kết{data.expiringMOUs.length > 0 ? ` · ${data.expiringMOUs.length} sắp đến hạn` : ''}</span></>}
              icon={Handshake}
              tone="sky"
              href="/dashboard/mous"
            />
          </div>
        </div>

        <div>
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Đối tác, Đội ngũ & Vận hành</h3>
            <span className="text-xs text-slate-400">Tiếp đón VIP, Thư ký y khoa & Sự kiện</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <DashboardKpiCard
              label="Dẫn khám VIP tháng này"
              value={crmVipMonth}
              hint={<><span>{crmTotalEscorts} lượt dẫn khám tích luỹ</span></>}
              icon={HeartHandshake}
              tone="blue"
              href="/dashboard/crm/interactions"
            />
            <DashboardKpiCard
              label="Tiếp đoàn & Đối tác"
              value={crmDelegationsMonth}
              hint={<><span>{crmTotalContacts} đối tác · {crmTotalOrgs} tổ chức</span></>}
              icon={Building2}
              tone="teal"
              href="/dashboard/crm/interactions"
            />
            <DashboardKpiCard
              label="Thư ký y khoa"
              value={<>{data.activeSecretaries}<span className="text-base font-semibold text-slate-400">/{data.totalSecretaries}</span></>}
              hint={<><span>{data.activeSecretaries} thư ký đang công tác</span></>}
              icon={Users}
              tone="indigo"
              href="/dashboard/secretaries"
            />
            <DashboardKpiCard
              label="Sự kiện & Hoạt động"
              value={data.upcomingEvents.length}
              hint={<><span>{data.todayEvents.length} sự kiện hôm nay · {data.totalMeetingRooms} phòng họp</span></>}
              icon={CalendarDays}
              tone="rose"
              href="/dashboard/hospital-events"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Cột chính: việc BGĐ chỉ đạo, báo cáo và lịch — việc của phòng hằng tuần */}
        <div className="lg:col-span-2 space-y-6">
          <DashboardWorkWidget />
          <RecentWeeksCard weeks={data.recentWeeks} />
          <DashboardCrmWidget />
          <EventsCard today={data.todayEvents} upcoming={data.upcomingEvents} />
        </div>

        {/* Cột phụ: con người — sinh nhật, thư ký; khối trống thì ẩn */}
        <div className="space-y-6">
          <BirthdayCard people={data.birthdaySecretaries} preview={data.birthdayPreview} />
          {data.expiringMOUs.length > 0 && <MouCard mous={data.expiringMOUs} />}
          <SecretaryCard active={data.activeSecretaries} total={data.totalSecretaries} byType={data.secretariesByType} />
          {data.recentTransfers.length > 0 && <TransfersCard transfers={data.recentTransfers} />}
        </div>
      </div>
    </div>
  );
}
