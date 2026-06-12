'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  CalendarDays,
  Upload,
  Building2,
  ClipboardCheck,
  DoorOpen,
  CalendarRange,
  CalendarClock,
  Users,
  Tag,
  ArrowLeftRight,
  FileUser,
  Cake,
  ShieldCheck,
  Handshake,
  BarChart3,
  TrendingUp,
  LineChart,
  Table2,
  PanelLeft,
  PanelLeftClose,
  Settings,
  LogOut,
  RefreshCw,
  Monitor,
  Gauge,
  ChevronDown,
  Truck,
  type LucideIcon,
} from 'lucide-react';

type MenuSection = 'weekReports' | 'calendar' | 'tasks' | 'secretaries' | 'partnerships' | 'analytics' | 'settings';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

interface NavGroup {
  id: MenuSection;
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    id: 'weekReports',
    title: 'Báo cáo tuần',
    icon: FileText,
    items: [
      { href: '/dashboard/weeks', label: 'Danh sách báo cáo', icon: FileText, exact: true },
      { href: '/dashboard/weeks/new', label: 'Tạo báo cáo mới', icon: FileText, exact: true },
      { href: '/dashboard/import', label: 'Nhập từ Excel', icon: Upload, exact: true },
    ],
  },
  {
    id: 'calendar',
    title: 'Lịch & Sự kiện',
    icon: CalendarRange,
    items: [
      { href: '/dashboard/calendar', label: 'Lịch công tác', icon: CalendarDays, exact: false },
      { href: '/dashboard/hospital-events', label: 'Sự kiện bệnh viện', icon: CalendarClock, exact: false },
      { href: '/dashboard/hospital-events-calendar', label: 'Lịch sự kiện', icon: CalendarDays, exact: true },
      { href: '/dashboard/meeting-rooms', label: 'Phòng họp', icon: DoorOpen, exact: false },
    ],
  },
  {
    id: 'tasks',
    title: 'Nhiệm vụ',
    icon: ClipboardCheck,
    items: [
      { href: '/dashboard/tasks', label: 'Nhiệm vụ thường kỳ', icon: ClipboardCheck, exact: true },
      { href: '/dashboard/tasks/overview', label: 'Tổng hợp tiến độ', icon: BarChart3, exact: true },
      { href: '/dashboard/reports/timeline', label: 'Timeline', icon: TrendingUp, exact: true },
    ],
  },
  {
    id: 'secretaries',
    title: 'Thư ký',
    icon: Users,
    items: [
      { href: '/dashboard/secretaries', label: 'Danh sách', icon: Users, exact: true },
      { href: '/dashboard/secretaries/transfers', label: 'Luân chuyển', icon: ArrowLeftRight, exact: true },
      { href: '/dashboard/secretaries/birthdays', label: 'Sinh nhật', icon: Cake, exact: true },
      { href: '/dashboard/secretaries/applications', label: 'Hồ sơ ứng tuyển', icon: FileUser, exact: true },
    ],
  },
  {
    id: 'partnerships',
    title: 'Hợp tác & Pháp lý',
    icon: Handshake,
    items: [
      { href: '/dashboard/mous', label: 'MOU', icon: Handshake, exact: false },
      { href: '/dashboard/licenses', label: 'Giấy phép', icon: ShieldCheck, exact: false },
      { href: '/dashboard/vehicles', label: 'Phương tiện vận chuyển', icon: Truck, exact: false },
    ],
  },
  {
    id: 'analytics',
    title: 'Phân tích & Số liệu',
    icon: BarChart3,
    items: [
      { href: '/dashboard/reports/metrics', label: 'Phân tích nhiệm vụ', icon: LineChart, exact: true },
      { href: '/dashboard/reports/metrics-data', label: 'Bảng số liệu', icon: Table2, exact: true },
      { href: '/dashboard/reports/phong-hc-native', label: 'Dashboard Phòng HC', icon: Gauge, exact: true },
      { href: '/dashboard/reports/phong-hc', label: 'Dashboards Streamlit', icon: Monitor, exact: true },
    ],
  },
  {
    id: 'settings',
    title: 'Cài đặt',
    icon: Settings,
    items: [
      { href: '/dashboard/settings', label: 'Chung', icon: Settings, exact: true },
      { href: '/dashboard/secretaries/types', label: 'Loại thư ký', icon: Tag, exact: true },
      { href: '/dashboard/data-sync', label: 'Đồng bộ dữ liệu', icon: RefreshCw, exact: true },
    ],
  },
];

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });
  const [openSections, setOpenSections] = useState<MenuSection[]>([]);

  // Auto-expand section based on current path
  useEffect(() => {
    for (const group of navGroups) {
      const hasActiveItem = group.items.some(item =>
        item.exact ? pathname === item.href : pathname?.startsWith(item.href)
      );
      if (hasActiveItem && !openSections.includes(group.id)) {
        setOpenSections(prev => [...prev, group.id]);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <aside
      className={cn(
        'flex flex-col bg-white border-r border-slate-200/80 h-screen sticky top-0 transition-all duration-300 shadow-sm',
        isCollapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-3 bg-gradient-to-r from-cyan-600 to-blue-600">
        {!isCollapsed && (
          <Link href="/dashboard" className="text-[15px] font-bold text-white flex items-center gap-2.5">
            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            UMC Reports
          </Link>
        )}
        <button
          onClick={() => {
            const next = !isCollapsed;
            setIsCollapsed(next);
            localStorage.setItem('sidebar-collapsed', String(next));
          }}
          className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors"
          title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
        >
          {isCollapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Logo */}
      {!isCollapsed && (
        <div className="px-4 py-3 border-b border-slate-100">
          <img src="/logo-ngang.png" alt="Logo" className="h-11 w-auto object-contain mx-auto" />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto min-h-0">
        {/* Tổng quan */}
        <Link
          href="/dashboard"
          className={cn(
            'flex items-center rounded-lg transition-all duration-200 group',
            isCollapsed ? 'justify-center px-1 py-2.5' : 'gap-3 px-3 py-2.5',
            isActivePath('/dashboard')
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/25'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          )}
          title="Tổng quan"
        >
          <LayoutDashboard className={cn('w-[18px] h-[18px] flex-shrink-0', !isActivePath('/dashboard') && 'text-slate-400 group-hover:text-slate-600')} />
          {!isCollapsed && <span className="text-sm font-medium">Tổng quan</span>}
        </Link>

        {/* Phòng ban */}
        <Link
          href="/dashboard/departments"
          className={cn(
            'flex items-center rounded-lg transition-all duration-200 group',
            isCollapsed ? 'justify-center px-1 py-2.5' : 'gap-3 px-3 py-2.5',
            isActivePath('/dashboard/departments', false)
              ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-500/25'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          )}
          title="Phòng ban"
        >
          <Building2 className={cn('w-[18px] h-[18px] flex-shrink-0', !isActivePath('/dashboard/departments', false) && 'text-slate-400 group-hover:text-slate-600')} />
          {!isCollapsed && <span className="text-sm font-medium">Phòng ban</span>}
        </Link>

        <div className="pt-1" />

        {/* Menu Groups */}
        {navGroups.map(group => {
          const GroupIcon = group.icon;
          const isOpen = openSections.includes(group.id);
          const hasActiveChild = group.items.some(item =>
            item.exact ? pathname === item.href : pathname?.startsWith(item.href)
          );

          if (isCollapsed) {
            const firstItem = group.items[0];
            return (
              <div key={group.id} className="py-0.5 relative group/collapsed">
                <Link
                  href={firstItem.href}
                  className={cn(
                    'flex justify-center px-1 py-2.5 rounded-lg transition-colors',
                    hasActiveChild
                      ? 'text-cyan-600 bg-cyan-50'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  )}
                  title={group.title}
                >
                  <GroupIcon className="w-[18px] h-[18px]" />
                </Link>
                {/* Flyout on hover */}
                <div className="absolute left-full top-0 ml-2 hidden group-hover/collapsed:block z-50">
                  <div className="bg-white rounded-xl shadow-lg border border-slate-200/80 py-1.5 min-w-[200px]">
                    <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100 mb-1">
                      {group.title}
                    </div>
                    {group.items.map((item) => {
                      const ItemIcon = item.icon;
                      const isActive = isActivePath(item.href, item.exact);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors',
                            isActive
                              ? 'bg-cyan-50 text-cyan-700 font-medium'
                              : 'text-slate-600 hover:bg-slate-50'
                          )}
                        >
                          <ItemIcon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-cyan-600' : 'text-slate-400')} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={group.id} className="space-y-0.5">
              <button
                onClick={() => toggleSection(group.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 group',
                  hasActiveChild
                    ? 'text-cyan-700 bg-cyan-50/60'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                <div className="flex items-center gap-3">
                  <GroupIcon className={cn('w-[18px] h-[18px]', hasActiveChild ? 'text-cyan-600' : 'text-slate-400 group-hover:text-slate-500')} />
                  <span className="text-sm font-medium">{group.title}</span>
                </div>
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 transition-transform duration-200',
                    hasActiveChild ? 'text-cyan-500' : 'text-slate-400',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>
              <div
                className={cn(
                  'overflow-hidden transition-all duration-200',
                  isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                )}
              >
                <div className="ml-3 pl-3 border-l-2 border-slate-100 space-y-0.5 py-1">
                  {group.items.map(item => {
                    const ItemIcon = item.icon;
                    const isActive = isActivePath(item.href, item.exact);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200 text-[13px] group/item',
                          isActive
                            ? 'bg-cyan-50 text-cyan-700 font-medium'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                        )}
                        title={item.label}
                      >
                        <ItemIcon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-cyan-600' : 'text-slate-400 group-hover/item:text-slate-500')} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

      </nav>

      {/* User Section */}
      <div className="border-t border-slate-200 p-3 bg-slate-50/80">
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                {session?.user?.email?.[0].toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {session?.user?.name || 'User'}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {session?.user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/auth/signin' })}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-800 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Đăng xuất
            </button>
          </>
        ) : (
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="w-full p-2 text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-700 transition-all"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4 mx-auto" />
          </button>
        )}
      </div>
    </aside>
  );
}
