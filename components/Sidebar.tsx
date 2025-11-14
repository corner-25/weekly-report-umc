'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isActive = (path: string) => {
    return pathname === path
      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
      : 'text-gray-600 hover:bg-cyan-50 hover:text-cyan-600';
  };

  return (
    <div
      className={`flex flex-col bg-white border-r border-cyan-100 min-h-screen transition-all duration-300 shadow-lg ${
        isCollapsed ? 'w-20' : 'w-72'
      }`}
    >
      {/* Logo/Header */}
      <div className="flex items-center justify-between h-16 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 shadow-md">
        {!isCollapsed && (
          <Link href="/dashboard" className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            UMC Weekly Reports
          </Link>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg text-white hover:bg-white/20 transition-colors"
          title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
        >
          {isCollapsed ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Logo Section */}
      {!isCollapsed && (
        <div className="px-4 py-6 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-center">
            <img
              src="/logo-ngang.png"
              alt="Logo"
              className="h-16 w-auto object-contain max-w-full"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        <Link
          href="/dashboard"
          className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${isActive('/dashboard')}`}
          title="Tổng quan"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          {!isCollapsed && <span className="ml-3 font-medium">Tổng quan</span>}
        </Link>

        <Link
          href="/dashboard/weeks"
          className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${isActive('/dashboard/weeks')}`}
          title="Báo cáo tuần"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {!isCollapsed && <span className="ml-3 font-medium">Báo cáo tuần</span>}
        </Link>

        <Link
          href="/dashboard/calendar"
          className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
            pathname?.startsWith('/dashboard/calendar')
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
              : 'text-gray-600 hover:bg-cyan-50 hover:text-cyan-600'
          }`}
          title="Lịch làm việc"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {!isCollapsed && <span className="ml-3 font-medium">Lịch làm việc</span>}
        </Link>

        <Link
          href="/dashboard/departments"
          className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${isActive('/dashboard/departments')}`}
          title="Phòng ban"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          {!isCollapsed && <span className="ml-3 font-medium">Phòng ban</span>}
        </Link>

        <Link
          href="/dashboard/tasks"
          className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${isActive('/dashboard/tasks')}`}
          title="NV Thường kỳ"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          {!isCollapsed && <span className="ml-3 font-medium">NV Thường kỳ</span>}
        </Link>

        {/* Reports Section */}
        {!isCollapsed && (
          <div className="pt-6 pb-2">
            <div className="px-4 text-xs font-bold text-cyan-600 uppercase tracking-wider">
              Báo cáo & Phân tích
            </div>
          </div>
        )}
        {isCollapsed && <div className="border-t border-cyan-100 my-2"></div>}

        <Link
          href="/dashboard/tasks/overview"
          className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
            pathname === '/dashboard/tasks/overview'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
              : 'text-gray-600 hover:bg-cyan-50 hover:text-cyan-600'
          }`}
          title="Tổng hợp NV"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          {!isCollapsed && <span className="ml-3 font-medium">Tổng hợp NV</span>}
        </Link>

        <Link
          href="/dashboard/reports/timeline"
          className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
            pathname === '/dashboard/reports/timeline'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
              : 'text-gray-600 hover:bg-cyan-50 hover:text-cyan-600'
          }`}
          title="Timeline"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {!isCollapsed && <span className="ml-3 font-medium">Timeline</span>}
        </Link>

        <Link
          href="/dashboard/reports/metrics"
          className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
            pathname === '/dashboard/reports/metrics'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
              : 'text-gray-600 hover:bg-cyan-50 hover:text-cyan-600'
          }`}
          title="Số liệu"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {!isCollapsed && <span className="ml-3 font-medium">Số liệu</span>}
        </Link>

        <Link
          href="/dashboard/reports/metrics-data"
          className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${
            pathname === '/dashboard/reports/metrics-data'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
              : 'text-gray-600 hover:bg-cyan-50 hover:text-cyan-600'
          }`}
          title="Số liệu - Bảng"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {!isCollapsed && <span className="ml-3 font-medium">Số liệu - Bảng</span>}
        </Link>

        {!isCollapsed && <div className="border-t border-cyan-100 my-4"></div>}
        {isCollapsed && <div className="border-t border-cyan-100 my-2"></div>}

        <Link
          href="/dashboard/settings"
          className={`flex items-center px-4 py-3 rounded-lg transition-all duration-200 ${isActive('/dashboard/settings')}`}
          title="Cài đặt"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {!isCollapsed && <span className="ml-3 font-medium">Cài đặt</span>}
        </Link>
      </nav>

      {/* User Section */}
      <div className="border-t border-cyan-100 p-4 bg-gradient-to-br from-cyan-50/50 to-blue-50/50">
        {!isCollapsed ? (
          <>
            <div className="flex items-center mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
                {session?.user?.email?.[0].toUpperCase() || 'U'}
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {session?.user?.name || 'User'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {session?.user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-sm hover:shadow-md"
            >
              Đăng xuất
            </button>
          </>
        ) : (
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="w-full p-2 text-white bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-sm hover:shadow-md"
            title="Đăng xuất"
          >
            <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
