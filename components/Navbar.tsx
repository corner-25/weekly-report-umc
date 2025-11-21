'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [showReportsMenu, setShowReportsMenu] = useState(false);

  const isActive = (path: string) => {
    return pathname === path ? 'bg-blue-700' : '';
  };

  const isReportsActive = () => {
    return pathname?.startsWith('/dashboard/reports') || pathname?.startsWith('/dashboard/tasks/overview')
      ? 'bg-blue-700'
      : '';
  };

  return (
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="text-xl font-bold">
              Quản lý Báo cáo Tuần
            </Link>
            <div className="hidden md:flex space-x-4">
              <Link
                href="/dashboard"
                className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 ${isActive('/dashboard')}`}
              >
                Tổng quan
              </Link>
              <Link
                href="/dashboard/weeks"
                className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 ${isActive('/dashboard/weeks')}`}
              >
                Báo cáo tuần
              </Link>
              <Link
                href="/dashboard/departments"
                className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 ${isActive('/dashboard/departments')}`}
              >
                Phòng ban
              </Link>
              <Link
                href="/dashboard/tasks"
                className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 ${isActive('/dashboard/tasks')}`}
              >
                Nhiệm vụ
              </Link>

              {/* Reports Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setShowReportsMenu(true)}
                onMouseLeave={() => setShowReportsMenu(false)}
              >
                <button
                  className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 ${isReportsActive()}`}
                >
                  Báo cáo & Phân tích ▾
                </button>

                {showReportsMenu && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-md shadow-lg py-1 z-50">
                    <Link
                      href="/dashboard/tasks/overview"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      📊 Tổng hợp Nhiệm vụ
                    </Link>
                    <Link
                      href="/dashboard/reports/timeline"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      📅 Timeline (Gantt)
                    </Link>
                    <Link
                      href="/dashboard/reports/metrics"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      📈 Báo cáo Số liệu
                    </Link>
                  </div>
                )}
              </div>

              <Link
                href="/dashboard/settings"
                className={`px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 ${isActive('/dashboard/settings')}`}
              >
                Cài đặt
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm">{session?.user?.email}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="px-4 py-2 rounded-md text-sm font-medium bg-blue-700 hover:bg-blue-800"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
