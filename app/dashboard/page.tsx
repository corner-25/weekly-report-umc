'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useDashboardStats } from '@/lib/swr';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { DashboardCrmWidget } from '@/components/crm/DashboardCrmWidget';
import { DashboardWorkWidget } from '@/components/dashboard/DashboardWorkWidget';
import { LayoutDashboard, ClipboardCheck, Clock, CheckCircle2, FileText, CalendarDays, Users, Plus, CalendarClock, Handshake } from 'lucide-react';
import { BirthdayCard, EventsCard, MouCard, QuickActions, RecentWeeksCard, SecretaryCard, TransfersCard } from '@/components/dashboard/widgets';
import type { DashboardStats } from '@/components/dashboard/types';

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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Nhiệm vụ trong báo cáo" value={data.totalMasterTasks} icon={ClipboardCheck} color="purple" href="/dashboard/tasks/progress?xem=tong-quan" />
        <StatCard label="Nhiệm vụ đang có tiến độ" value={data.tasksInProgress} icon={Clock} color="orange" href="/dashboard/tasks/progress?xem=tong-quan" />
        <StatCard label="Nhiệm vụ đã hoàn thành" value={data.tasksCompleted} icon={CheckCircle2} color="green" href="/dashboard/tasks/progress?xem=tong-quan" />
        <StatCard label="Tuần báo cáo" value={data.totalWeeks} icon={FileText} color="cyan" href="/dashboard/weeks" />
        <StatCard label="Sự kiện sắp tới" value={data.upcomingEvents.length} icon={CalendarDays} color="pink" href="/dashboard/hospital-events" />
        <StatCard label="Thư ký" value={data.activeSecretaries} subValue={`/${data.totalSecretaries}`} icon={Users} color="blue" href="/dashboard/secretaries" />
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
