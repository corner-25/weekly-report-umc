'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

type MenuSection = 'reports' | 'management' | 'events' | 'statistics' | 'secretaries';

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<MenuSection[]>([]);

  // Auto-expand section based on current path
  useEffect(() => {
    if (pathname?.startsWith('/dashboard/weeks') || pathname?.startsWith('/dashboard/calendar')) {
      if (!openSections.includes('reports')) setOpenSections(prev => [...prev, 'reports']);
    }
    if (pathname?.startsWith('/dashboard/departments') || pathname?.startsWith('/dashboard/tasks') || pathname?.startsWith('/dashboard/meeting-rooms')) {
      if (!openSections.includes('management')) setOpenSections(prev => [...prev, 'management']);
    }
    if (pathname?.startsWith('/dashboard/hospital-events')) {
      if (!openSections.includes('events')) setOpenSections(prev => [...prev, 'events']);
    }
    if (pathname?.startsWith('/dashboard/reports')) {
      if (!openSections.includes('statistics')) setOpenSections(prev => [...prev, 'statistics']);
    }
    if (pathname?.startsWith('/dashboard/secretaries')) {
      if (!openSections.includes('secretaries')) setOpenSections(prev => [...prev, 'secretaries']);
    }
  }, []);

  const toggleSection = (section: MenuSection) => {
    setOpenSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const isActivePath = (path: string, exact = true) => {
    if (exact) return pathname === path;
    return pathname?.startsWith(path);
  };

  const linkClass = (path: string, exact = true) =>
    `flex items-center px-4 py-2 rounded-lg transition-all duration-200 ${
      isActivePath(path, exact)
        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md'
        : 'text-gray-600 hover:bg-cyan-50 hover:text-cyan-600'
    }`;

  const subLinkClass = (path: string, exact = true) =>
    `flex items-center px-4 py-2 ml-4 rounded-lg transition-all duration-200 text-sm ${
      isActivePath(path, exact)
        ? 'bg-cyan-100 text-cyan-700 font-medium'
        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
    }`;

  const MenuGroup = ({
    id,
    title,
    icon,
    children,
  }: {
    id: MenuSection;
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
  }) => {
    const isOpen = openSections.includes(id);

    if (isCollapsed) {
      return <>{children}</>;
    }

    return (
      <div className="space-y-1">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-gray-700 hover:bg-gray-50 transition-all duration-200"
        >
          <div className="flex items-center">
            {icon}
            <span className="ml-3 text-sm font-medium">{title}</span>
          </div>
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div
          className={`overflow-hidden transition-all duration-200 ${
            isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="space-y-1 pb-2">
            {children}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`flex flex-col bg-white border-r border-gray-200 min-h-screen transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-3 bg-gradient-to-r from-cyan-500 to-blue-600">
        {!isCollapsed && (
          <Link href="/dashboard" className="text-base font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            UMC Reports
          </Link>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg text-white hover:bg-white/20 transition-colors"
          title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {/* Logo */}
      {!isCollapsed && (
        <div className="px-4 py-4 border-b border-gray-100">
          <img src="/logo-ngang.png" alt="Logo" className="h-12 w-auto object-contain mx-auto" />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-2 overflow-y-auto">
        {/* Tổng quan - standalone */}
        <Link href="/dashboard" className={linkClass('/dashboard')} title="Tổng quan">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          {!isCollapsed && <span className="ml-3 text-sm font-medium">Tổng quan</span>}
        </Link>

        {/* Báo cáo */}
        <MenuGroup
          id="reports"
          title="Báo cáo"
          icon={
            <svg className="w-5 h-5 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        >
          <Link href="/dashboard/weeks" className={subLinkClass('/dashboard/weeks')} title="Báo cáo tuần">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="ml-3">Báo cáo tuần</span>
          </Link>
          <Link href="/dashboard/calendar" className={subLinkClass('/dashboard/calendar', false)} title="Lịch làm việc">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="ml-3">Lịch làm việc</span>
          </Link>
        </MenuGroup>

        {/* Quản lý */}
        <MenuGroup
          id="management"
          title="Quản lý"
          icon={
            <svg className="w-5 h-5 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        >
          <Link href="/dashboard/departments" className={subLinkClass('/dashboard/departments')} title="Phòng ban">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="ml-3">Phòng ban</span>
          </Link>
          <Link href="/dashboard/tasks" className={subLinkClass('/dashboard/tasks')} title="NV thường kỳ">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span className="ml-3">NV thường kỳ</span>
          </Link>
          <Link href="/dashboard/meeting-rooms" className={subLinkClass('/dashboard/meeting-rooms', false)} title="Phòng họp">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
            </svg>
            <span className="ml-3">Phòng họp</span>
          </Link>
        </MenuGroup>

        {/* Sự kiện */}
        <MenuGroup
          id="events"
          title="Sự kiện"
          icon={
            <svg className="w-5 h-5 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        >
          <Link href="/dashboard/hospital-events" className={subLinkClass('/dashboard/hospital-events', false)} title="Quản lý sự kiện">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span className="ml-3">Quản lý sự kiện</span>
          </Link>
          <Link href="/dashboard/hospital-events-calendar" className={subLinkClass('/dashboard/hospital-events-calendar')} title="Lịch sự kiện">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="ml-3">Lịch sự kiện</span>
          </Link>
        </MenuGroup>

        {/* Thư ký */}
        <MenuGroup
          id="secretaries"
          title="Thư ký"
          icon={
            <svg className="w-5 h-5 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        >
          <Link href="/dashboard/secretaries" className={subLinkClass('/dashboard/secretaries')} title="Danh sách thư ký">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <span className="ml-3">Danh sách</span>
          </Link>
          <Link href="/dashboard/secretaries/types" className={subLinkClass('/dashboard/secretaries/types')} title="Loại thư ký">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span className="ml-3">Loại thư ký</span>
          </Link>
          <Link href="/dashboard/secretaries/transfers" className={subLinkClass('/dashboard/secretaries/transfers')} title="Luân chuyển">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span className="ml-3">Luân chuyển</span>
          </Link>
          <Link href="/dashboard/secretaries/applications" className={subLinkClass('/dashboard/secretaries/applications')} title="Hồ sơ ứng tuyển">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="ml-3">Hồ sơ ứng tuyển</span>
          </Link>
          <Link href="/dashboard/secretaries/birthdays" className={subLinkClass('/dashboard/secretaries/birthdays')} title="Sinh nhật">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
            </svg>
            <span className="ml-3">Sinh nhật</span>
          </Link>
        </MenuGroup>

        {/* Thống kê */}
        <MenuGroup
          id="statistics"
          title="Thống kê"
          icon={
            <svg className="w-5 h-5 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        >
          <Link href="/dashboard/tasks/overview" className={subLinkClass('/dashboard/tasks/overview')} title="Tổng hợp NV">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="ml-3">Tổng hợp NV</span>
          </Link>
          <Link href="/dashboard/reports/timeline" className={subLinkClass('/dashboard/reports/timeline')} title="Timeline">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
            <span className="ml-3">Timeline</span>
          </Link>
          <Link href="/dashboard/reports/metrics" className={subLinkClass('/dashboard/reports/metrics')} title="Biểu đồ">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="ml-3">Biểu đồ</span>
          </Link>
          <Link href="/dashboard/reports/metrics-data" className={subLinkClass('/dashboard/reports/metrics-data')} title="Bảng số liệu">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="ml-3">Bảng số liệu</span>
          </Link>
        </MenuGroup>

        {/* Cài đặt - standalone */}
        <div className="pt-2 border-t border-gray-100">
          <Link href="/dashboard/settings" className={linkClass('/dashboard/settings')} title="Cài đặt">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {!isCollapsed && <span className="ml-3 text-sm font-medium">Cài đặt</span>}
          </Link>
        </div>
      </nav>

      {/* User Section */}
      <div className="border-t border-gray-200 p-3 bg-gray-50">
        {!isCollapsed ? (
          <>
            <div className="flex items-center mb-2">
              <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {session?.user?.email?.[0].toUpperCase() || 'U'}
              </div>
              <div className="ml-2 flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {session?.user?.name || 'User'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {session?.user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="w-full px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-all"
            >
              Đăng xuất
            </button>
          </>
        ) : (
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="w-full p-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-all"
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
