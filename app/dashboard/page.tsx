'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface DashboardStats {
  // Báo cáo & Nhiệm vụ
  totalWeeks: number;
  totalDepartments: number;
  totalMasterTasks: number;
  tasksInProgress: number;
  tasksCompleted: number;
  recentWeeks: any[];

  // Sự kiện
  totalEvents: number;
  upcomingEvents: any[];
  todayEvents: any[];

  // Phòng họp
  totalMeetingRooms: number;

  // Thư ký
  totalSecretaries: number;
  activeSecretaries: number;
  birthdaySecretaries: any[];
  recentTransfers: any[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const today = new Date();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/dashboard-stats');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStats({
        totalWeeks: data.totalWeeks,
        totalDepartments: 0,
        totalMasterTasks: data.totalMasterTasks,
        tasksInProgress: data.tasksInProgress,
        tasksCompleted: data.tasksCompleted,
        recentWeeks: data.recentWeeks,
        totalEvents: data.upcomingEvents.length,
        upcomingEvents: data.upcomingEvents,
        todayEvents: data.todayEvents,
        totalMeetingRooms: data.totalMeetingRooms,
        totalSecretaries: data.totalSecretaries,
        activeSecretaries: data.activeSecretaries,
        birthdaySecretaries: data.birthdaySecretaries,
        recentTransfers: data.recentTransfers,
      });
    } catch {
      setError('Không thể tải dữ liệu tổng quan. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Không thể tải dữ liệu'}</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tổng quan hoạt động</h1>
          <p className="text-gray-500 mt-1">
            {format(today, "EEEE, 'ngày' d 'tháng' M 'năm' yyyy", { locale: vi })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/weeks/new"
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tạo báo cáo tuần
          </Link>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <QuickStatCard
          label="NV thường kỳ"
          value={stats.totalMasterTasks}
          icon={<TaskIcon />}
          color="purple"
          href="/dashboard/tasks"
        />
        <QuickStatCard
          label="Đang thực hiện"
          value={stats.tasksInProgress}
          icon={<ClockIcon />}
          color="orange"
        />
        <QuickStatCard
          label="Đã hoàn thành"
          value={stats.tasksCompleted}
          icon={<CheckIcon />}
          color="green"
        />
        <QuickStatCard
          label="Báo cáo đã nộp"
          value={stats.totalWeeks}
          icon={<DocumentIcon />}
          color="cyan"
          href="/dashboard/weeks"
        />
        <QuickStatCard
          label="Sự kiện sắp tới"
          value={stats.upcomingEvents.length}
          icon={<CalendarIcon />}
          color="pink"
          href="/dashboard/hospital-events"
        />
        <QuickStatCard
          label="Thư ký"
          value={stats.activeSecretaries}
          subValue={`/${stats.totalSecretaries}`}
          icon={<UsersIcon />}
          color="blue"
          href="/dashboard/secretaries"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Events */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Sự kiện hôm nay</h2>
                  <p className="text-sm text-gray-500">{stats.todayEvents.length} sự kiện</p>
                </div>
              </div>
              <Link href="/dashboard/hospital-events-calendar" className="text-sm text-cyan-600 hover:text-cyan-700">
                Xem lịch →
              </Link>
            </div>
            <div className="p-5">
              {stats.todayEvents.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <svg className="w-12 h-12 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Không có sự kiện nào hôm nay
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.todayEvents.map((event: any) => (
                    <div key={event.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="text-center min-w-[50px]">
                        <div className="text-lg font-bold text-pink-600">{event.time || '--:--'}</div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{event.name}</h4>
                        {event.meetingRoom && (
                          <p className="text-sm text-gray-500">{event.meetingRoom.name}</p>
                        )}
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        event.status === 'CONFIRMED'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Sự kiện sắp tới</h2>
              <Link href="/dashboard/hospital-events" className="text-sm text-cyan-600 hover:text-cyan-700">
                Xem tất cả →
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {stats.upcomingEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Chưa có sự kiện nào</div>
              ) : (
                stats.upcomingEvents.map((event: any) => (
                  <div key={event.id} className="px-5 py-3 hover:bg-gray-50 flex items-center gap-4">
                    <div className="text-center min-w-[45px]">
                      <div className="text-xs text-gray-500 uppercase">
                        {format(new Date(event.date), 'MMM', { locale: vi })}
                      </div>
                      <div className="text-xl font-bold text-gray-900">
                        {format(new Date(event.date), 'd')}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 line-clamp-1">{event.name}</h4>
                      <p className="text-sm text-gray-500">
                        {event.time && <span>{event.time} • </span>}
                        {event.meetingRoom?.name || 'Chưa có phòng'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Reports */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Báo cáo tuần gần đây</h2>
              <Link href="/dashboard/weeks" className="text-sm text-cyan-600 hover:text-cyan-700">
                Xem tất cả →
              </Link>
            </div>
            <div className="p-5">
              {stats.recentWeeks.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 mb-3">Chưa có báo cáo nào</p>
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
                      className="block p-4 border border-gray-200 rounded-lg hover:border-cyan-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-gray-900">Tuần {week.weekNumber}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          week.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {week.status === 'COMPLETED' ? 'Xong' : 'Nháp'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {format(new Date(week.startDate), 'd/M', { locale: vi })} - {format(new Date(week.endDate), 'd/M', { locale: vi })}
                      </p>
                      <div className="mt-2 text-xs text-gray-400">
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
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🎂</span>
                </div>
                <div>
                  <h2 className="font-semibold">Sinh nhật tuần này</h2>
                  <p className="text-sm text-white/80">{stats.birthdaySecretaries.length} thư ký</p>
                </div>
              </div>
              <Link href="/dashboard/secretaries/birthdays" className="text-sm text-white/90 hover:text-white">
                Xem →
              </Link>
            </div>
            <div className="px-5 pb-5">
              {stats.birthdaySecretaries.length === 0 ? (
                <p className="text-center py-4 text-white/70">Không có sinh nhật tuần này</p>
              ) : (
                <div className="space-y-2">
                  {stats.birthdaySecretaries.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-3 p-2 bg-white/10 rounded-lg">
                      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold text-sm">
                        {s.fullName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{s.fullName}</p>
                        <p className="text-xs text-white/70">
                          {s.birthdayDay}/{s.birthdayMonth} • {s.age} tuổi
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Thư ký</h2>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-3xl font-bold text-cyan-600">{stats.activeSecretaries}</p>
                  <p className="text-sm text-gray-500">Đang hoạt động</p>
                </div>
                <div className="w-16 h-16">
                  <svg viewBox="0 0 36 36" className="w-full h-full">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#0891b2"
                      strokeWidth="3"
                      strokeDasharray={`${(stats.activeSecretaries / stats.totalSecretaries) * 100}, 100`}
                    />
                  </svg>
                </div>
              </div>
              <Link
                href="/dashboard/secretaries"
                className="block w-full text-center py-2 text-sm text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
              >
                Quản lý thư ký →
              </Link>
            </div>
          </div>

          {/* Recent Transfers */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Luân chuyển gần đây</h2>
              <Link href="/dashboard/secretaries/transfers" className="text-sm text-cyan-600 hover:text-cyan-700">
                Xem →
              </Link>
            </div>
            <div className="divide-y divide-gray-100">
              {stats.recentTransfers.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm">Chưa có luân chuyển</div>
              ) : (
                stats.recentTransfers.map((t: any) => (
                  <div key={t.id} className="px-5 py-3">
                    <p className="font-medium text-gray-900 text-sm">{t.secretary?.fullName}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t.fromDepartment?.name || 'Mới'} → {t.toDepartment?.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(t.transferDate), 'd/M/yyyy', { locale: vi })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Thao tác nhanh</h2>
            <div className="space-y-2">
              <QuickAction href="/dashboard/weeks/new" icon="+" label="Tạo báo cáo tuần" />
              <QuickAction href="/dashboard/hospital-events" icon="📅" label="Thêm sự kiện" />
              <QuickAction href="/dashboard/secretaries" icon="👤" label="Thêm thư ký" />
              <QuickAction href="/dashboard/calendar" icon="📋" label="Xem lịch làm việc" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function QuickStatCard({
  label,
  value,
  subValue,
  icon,
  color,
  href
}: {
  label: string;
  value: number;
  subValue?: string;
  icon: React.ReactNode;
  color: string;
  href?: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    pink: 'bg-pink-50 text-pink-600',
    teal: 'bg-teal-50 text-teal-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    green: 'bg-green-50 text-green-600',
  };

  const content = (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${href ? 'hover:shadow-md hover:border-gray-300 transition-all cursor-pointer' : ''}`}>
      <div className={`w-10 h-10 ${colorClasses[color]} rounded-lg flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">
        {value}
        {subValue && <span className="text-gray-400 text-lg">{subValue}</span>}
      </p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function QuickAction({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <span className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm">
        {icon}
      </span>
      <span className="text-sm text-gray-700">{label}</span>
    </Link>
  );
}

// Icons
function TaskIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
