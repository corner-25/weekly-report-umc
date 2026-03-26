'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useDashboardStats } from '@/lib/swr';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import {
  LayoutDashboard,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  FileText,
  CalendarDays,
  Users,
  Plus,
  CalendarClock,
  ArrowRight,
  ArrowLeftRight,
  Cake,
} from 'lucide-react';

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        icon={LayoutDashboard}
        title="Tổng quan hoạt động"
        description={format(today, "EEEE, 'ngày' d 'tháng' M 'năm' yyyy", { locale: vi })}
        actions={
          <Link
            href="/dashboard/weeks/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all shadow-sm shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            Tạo báo cáo tuần
          </Link>
        }
      />

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="NV thường kỳ" value={stats.totalMasterTasks} icon={ClipboardCheck} color="purple" href="/dashboard/tasks" />
        <StatCard label="Đang thực hiện" value={stats.tasksInProgress} icon={Clock} color="orange" />
        <StatCard label="Đã hoàn thành" value={stats.tasksCompleted} icon={CheckCircle2} color="green" />
        <StatCard label="Báo cáo đã nộp" value={stats.totalWeeks} icon={FileText} color="cyan" href="/dashboard/weeks" />
        <StatCard label="Sự kiện sắp tới" value={stats.upcomingEvents.length} icon={CalendarDays} color="pink" href="/dashboard/hospital-events" />
        <StatCard label="Thư ký" value={stats.activeSecretaries} subValue={`/${stats.totalSecretaries}`} icon={Users} color="blue" href="/dashboard/secretaries" />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Events */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
                  <CalendarClock className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">Sự kiện hôm nay</h2>
                  <p className="text-sm text-slate-500">{stats.todayEvents.length} sự kiện</p>
                </div>
              </div>
              <Link href="/dashboard/hospital-events-calendar" className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1 font-medium">
                Xem lịch <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="p-5">
              {stats.todayEvents.length === 0 ? (
                <div className="text-center py-6 text-slate-500">
                  <CalendarDays className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                  Không có sự kiện nào hôm nay
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.todayEvents.map((event: any) => (
                    <div key={event.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="text-center min-w-[50px]">
                        <div className="text-lg font-bold text-pink-600">{event.time || '--:--'}</div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900">{event.name}</h4>
                        {event.meetingRoom && (
                          <p className="text-sm text-slate-500">{event.meetingRoom.name}</p>
                        )}
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        event.status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {event.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Chờ xác nhận'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Sự kiện sắp tới</h2>
              <Link href="/dashboard/hospital-events" className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1 font-medium">
                Xem tất cả <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {stats.upcomingEvents.length === 0 ? (
                <div className="text-center py-8 text-slate-500">Chưa có sự kiện nào</div>
              ) : (
                stats.upcomingEvents.map((event: any) => (
                  <div key={event.id} className="px-5 py-3 hover:bg-slate-50/50 flex items-center gap-4 transition-colors">
                    <div className="text-center min-w-[45px]">
                      <div className="text-xs text-slate-500 uppercase font-medium">
                        {format(new Date(event.date), 'MMM', { locale: vi })}
                      </div>
                      <div className="text-xl font-bold text-slate-900">
                        {format(new Date(event.date), 'd')}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-slate-900 line-clamp-1">{event.name}</h4>
                      <p className="text-sm text-slate-500">
                        {event.time && <span>{event.time} · </span>}
                        {event.meetingRoom?.name || 'Chưa có phòng'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Reports */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">Báo cáo tuần gần đây</h2>
              <Link href="/dashboard/weeks" className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1 font-medium">
                Xem tất cả <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="p-5">
              {stats.recentWeeks.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-slate-500 mb-3">Chưa có báo cáo nào</p>
                  <Link
                    href="/dashboard/weeks/new"
                    className="inline-block px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm"
                  >
                    Tạo báo cáo đầu tiên
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {stats.recentWeeks.map((week: any) => (
                    <Link
                      key={week.id}
                      href={`/dashboard/weeks/${week.id}`}
                      className="block p-4 border border-slate-200 rounded-xl hover:border-cyan-300 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-900">Tuần {week.weekNumber}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          week.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {week.status === 'COMPLETED' ? 'Xong' : 'Nháp'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500">
                        {format(new Date(week.startDate), 'd/M', { locale: vi })} - {format(new Date(week.endDate), 'd/M', { locale: vi })}
                      </p>
                      <div className="mt-2 text-xs text-slate-400">
                        {week.taskCount || 0} nhiệm vụ
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - 1/3 */}
        <div className="space-y-6">
          {/* Birthday Widget */}
          <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl shadow-sm overflow-hidden text-white">
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <Cake className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold">Sinh nhật tuần này</h2>
                  <p className="text-sm text-white/80">{stats.birthdaySecretaries.length} thư ký</p>
                </div>
              </div>
              <Link href="/dashboard/secretaries/birthdays" className="text-sm text-white/90 hover:text-white flex items-center gap-1">
                Xem <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="px-5 pb-5">
              {stats.birthdaySecretaries.length === 0 ? (
                <p className="text-center py-4 text-white/70">Không có sinh nhật tuần này</p>
              ) : (
                <div className="space-y-2">
                  {stats.birthdaySecretaries.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-3 p-2 bg-white/10 rounded-xl backdrop-blur-sm">
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold text-sm">
                        {s.fullName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{s.fullName}</p>
                        <p className="text-xs text-white/70">
                          {s.birthdayDay}/{s.birthdayMonth} · {s.age} tuổi
                          {s.isToday && <span className="ml-1">🎉</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Secretary Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Thư ký</h2>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-3xl font-bold text-cyan-600">{stats.activeSecretaries}</p>
                  <p className="text-sm text-slate-500">Đang hoạt động</p>
                </div>
                <div className="w-16 h-16">
                  <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                    <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9155" fill="none" stroke="#0891b2" strokeWidth="3"
                      strokeDasharray={`${(stats.activeSecretaries / stats.totalSecretaries) * 100}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
              <Link
                href="/dashboard/secretaries"
                className="block w-full text-center py-2 text-sm text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors font-medium"
              >
                Quản lý thư ký →
              </Link>
            </div>
          </div>

          {/* Recent Transfers */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                Luân chuyển gần đây
              </h2>
              <Link href="/dashboard/secretaries/transfers" className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1 font-medium">
                Xem <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {stats.recentTransfers.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">Chưa có luân chuyển</div>
              ) : (
                stats.recentTransfers.map((t: any) => (
                  <div key={t.id} className="px-5 py-3">
                    <p className="font-medium text-slate-900 text-sm">{t.secretary?.fullName}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {t.fromDepartment?.name || 'Mới'} → {t.toDepartment?.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {format(new Date(t.transferDate), 'd/M/yyyy', { locale: vi })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Thao tác nhanh</h2>
            <div className="space-y-1.5">
              <QuickAction href="/dashboard/weeks/new" icon={Plus} label="Tạo báo cáo tuần" />
              <QuickAction href="/dashboard/hospital-events" icon={CalendarDays} label="Thêm sự kiện" />
              <QuickAction href="/dashboard/secretaries" icon={Users} label="Thêm thư ký" />
              <QuickAction href="/dashboard/calendar" icon={CalendarClock} label="Xem lịch làm việc" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label }: { href: string; icon: typeof Plus; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors group"
    >
      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-cyan-50 transition-colors">
        <Icon className="w-4 h-4 text-slate-500 group-hover:text-cyan-600 transition-colors" />
      </div>
      <span className="text-sm text-slate-700 group-hover:text-slate-900">{label}</span>
    </Link>
  );
}
