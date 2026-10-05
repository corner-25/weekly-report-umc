'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { cn } from '@/lib/utils';
import { toSearchKey } from '@/lib/crm/constants';
import {
  Building2,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  FileText,
  Gauge,
  Handshake,
  HeartHandshake,
  LayoutDashboard,
  LineChart,
  LogOut,
  PanelLeft,
  PanelLeftClose,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Table2,
  Tag,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';

type BadgeKey = 'work' | 'crm' | 'vehicles';

interface NavLink {
  href: string;
  label: string;
  /** Mặc định: đang ở trang này hoặc trang con của nó. */
  exact?: boolean;
}

interface NavItem extends NavLink {
  icon: LucideIcon;
  badge?: BadgeKey;
  /** Trang con — chỉ hiện khi đang ở trong mục này. */
  children?: NavLink[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

/** Menu gom theo việc thường làm; nhãn nhóm cố định, không xổ xuống. */
const NAV: NavSection[] = [
  {
    title: 'Hằng ngày',
    items: [
      { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard, exact: true },
      { href: '/dashboard/departments', label: 'Phòng ban', icon: Building2 },
    ],
  },
  {
    title: 'Điều hành',
    items: [
      {
        href: '/dashboard/work', label: 'Quản lý công việc', icon: ClipboardList, badge: 'work',
        children: [
          { href: '/dashboard/work', label: 'Theo dõi', exact: true },
          { href: '/dashboard/work/items', label: 'Danh sách công việc' },
        ],
      },
      {
        href: '/dashboard/crm', label: 'CRM đối tác', icon: HeartHandshake, badge: 'crm',
        children: [
          { href: '/dashboard/crm', label: 'Tổng quan', exact: true },
          { href: '/dashboard/crm/contacts', label: 'Danh bạ' },
          { href: '/dashboard/crm/interactions', label: 'Tiếp đón & dẫn đoàn' },
        ],
      },
      {
        href: '/dashboard/weeks', label: 'Báo cáo tuần', icon: FileText,
        children: [
          { href: '/dashboard/weeks', label: 'Danh sách báo cáo', exact: true },
          { href: '/dashboard/weeks/new', label: 'Tạo báo cáo mới', exact: true },
          { href: '/dashboard/import', label: 'Nhập từ Excel', exact: true },
        ],
      },
      {
        href: '/dashboard/tasks', label: 'Nhiệm vụ thường kỳ', icon: ClipboardCheck,
        children: [
          { href: '/dashboard/tasks', label: 'Danh sách nhiệm vụ', exact: true },
          { href: '/dashboard/tasks/progress', label: 'Tiến độ nhiệm vụ', exact: true },
          { href: '/dashboard/tasks/overview', label: 'Tổng hợp theo đầu mục', exact: true },
          { href: '/dashboard/reports/timeline', label: 'Timeline', exact: true },
        ],
      },
    ],
  },
  {
    title: 'Quản lý sự kiện',
    items: [
      { href: '/dashboard/hospital-events', label: 'Sự kiện bệnh viện', icon: CalendarClock },
      { href: '/dashboard/hospital-events-calendar', label: 'Lịch sự kiện', icon: CalendarDays, exact: true },
      { href: '/dashboard/meeting-rooms', label: 'Phòng họp', icon: DoorOpen },
    ],
  },
  {
    title: 'Nhân sự & tài sản',
    items: [
      {
        href: '/dashboard/secretaries', label: 'Thư ký', icon: Users,
        children: [
          { href: '/dashboard/secretaries', label: 'Danh sách', exact: true },
          { href: '/dashboard/secretaries/transfers', label: 'Luân chuyển', exact: true },
          { href: '/dashboard/secretaries/birthdays', label: 'Sinh nhật', exact: true },
          { href: '/dashboard/secretaries/applications', label: 'Hồ sơ ứng tuyển', exact: true },
        ],
      },
      { href: '/dashboard/vehicles', label: 'Phương tiện', icon: Truck, badge: 'vehicles' },
      { href: '/dashboard/mous', label: 'MOU', icon: Handshake },
      { href: '/dashboard/licenses', label: 'Giấy phép', icon: ShieldCheck },
    ],
  },
  {
    title: 'Số liệu',
    items: [
      { href: '/dashboard/reports/metrics', label: 'Phân tích nhiệm vụ', icon: LineChart, exact: true },
      { href: '/dashboard/reports/metrics-data', label: 'Số liệu theo dõi', icon: Table2, exact: true },
      { href: '/dashboard/reports/dashboards', label: 'Dashboard', icon: Gauge },
    ],
  },
  {
    title: 'Cài đặt',
    items: [
      { href: '/dashboard/settings', label: 'Cài đặt chung', icon: Settings, exact: true },
      { href: '/dashboard/secretaries/types', label: 'Loại thư ký', icon: Tag, exact: true },
      { href: '/dashboard/data-sync', label: 'Đồng bộ dữ liệu', icon: RefreshCw, exact: true },
    ],
  },
];

/** Trang con không thuộc mục cha theo đường dẫn (vd /dashboard/import thuộc Báo cáo tuần). */
const isOn = (pathname: string, link: NavLink) =>
  link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);

/** Mục cha đang mở khi đang ở chính nó hoặc bất kỳ trang con nào — trừ trang con thuộc mục khác (Loại thư ký). */
function itemActive(pathname: string, item: NavItem): boolean {
  if (pathname === '/dashboard/secretaries/types' && item.href === '/dashboard/secretaries') return false;
  return isOn(pathname, item) || Boolean(item.children?.some((c) => isOn(pathname, c)));
}

const COLLAPSED_KEY = 'sidebar-collapsed';

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null));

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname() ?? '';
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const { data: badges } = useSWR<Record<BadgeKey, number> | null>('/api/nav-badges', fetcher, {
    refreshInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
  });

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === 'true');
    } catch {
      /* trình duyệt chặn lưu trữ: mở rộng mặc định */
    }
  }, []);

  // Ctrl K / ⌘K: nhảy vào ô tìm trang.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCollapsed(false);
        requestAnimationFrame(() => searchRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, String(!prev));
      } catch {
        /* bỏ qua */
      }
      return !prev;
    });
  };

  // Tìm trang: lọc theo tên mục và tên trang con, gõ không dấu được.
  const sections = useMemo(() => {
    const q = toSearchKey(query);
    if (!q) return NAV;
    return NAV.map((s) => ({
      ...s,
      items: s.items.filter((i) => toSearchKey(i.label, s.title, ...(i.children?.map((c) => c.label) ?? [])).includes(q)),
    })).filter((s) => s.items.length > 0);
  }, [query]);

  const name = session?.user?.name || session?.user?.email || 'Người dùng';
  const initials = name.split(/\s+/).filter(Boolean).slice(-2).map((w) => w[0]).join('').toUpperCase();

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen shrink-0 flex-col border-r border-brand-100 bg-[#f5f9fe] transition-[width] duration-200 ease-out',
        collapsed ? 'w-[68px]' : 'w-64',
      )}
    >
      <div className={cn('flex h-16 items-center border-b border-brand-100', collapsed ? 'justify-center px-2' : 'justify-between gap-2 px-4')}>
        {!collapsed && (
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-[11px] font-extrabold tracking-wide text-white shadow-sm">UMC</span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-bold text-slate-900">Phòng Hành chính</span>
              <span className="block truncate text-[11px] text-slate-500">BV Đại học Y Dược TP.HCM</span>
            </span>
          </Link>
        )}
        <button
          type="button"
          onClick={toggle}
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-brand-100 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          title={collapsed ? 'Mở rộng' : 'Thu gọn'}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 pt-3">
          <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-500 ring-1 ring-inset ring-brand-100 focus-within:ring-2 focus-within:ring-brand-400">
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="sr-only">Tìm trang</span>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
              placeholder="Tìm trang..."
              className="min-w-0 flex-1 bg-transparent text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            <kbd className="rounded-md border border-slate-200 px-1.5 text-[10px] font-medium text-slate-400">Ctrl K</kbd>
          </label>
        </div>
      )}

      <nav aria-label="Menu chính" className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        {sections.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">Không có trang nào khớp.</p>}
        {sections.map((section) => (
          <div key={section.title} className={collapsed ? 'border-t border-brand-100/70 pt-2 first:border-0' : ''}>
            {!collapsed && (
              <p className="px-3 pb-1.5 pt-4 text-[10.5px] font-bold uppercase tracking-[0.09em] text-slate-400">{section.title}</p>
            )}
            <ul className={cn('space-y-0.5', collapsed && 'py-1')}>
              {section.items.map((item) => {
                const active = itemActive(pathname, item);
                const count = item.badge ? badges?.[item.badge] ?? 0 : 0;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.children?.[0]?.href ?? item.href}
                      title={collapsed ? item.label : undefined}
                      aria-current={active && !item.children ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                        collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2',
                        active ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20' : 'text-slate-700 hover:bg-brand-100/70 hover:text-slate-900',
                      )}
                    >
                      <Icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-white' : 'text-slate-400 group-hover:text-brand-600')} aria-hidden="true" />
                      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                      {count > 0 &&
                        (collapsed ? (
                          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#f5f9fe]" aria-label={`${count} việc cần xử lý`} />
                        ) : (
                          <span className={cn('rounded-full px-1.5 text-[11px] font-bold tabular-nums', active ? 'bg-white/25 text-white' : 'bg-red-100 text-red-700')}>
                            {count}
                          </span>
                        ))}
                    </Link>
                    {!collapsed && item.children && (active || query) && (
                      <ul className="mb-1 ml-[22px] mt-0.5 space-y-0.5 border-l border-brand-200 pl-3">
                        {item.children.map((child) => {
                          const on = isOn(pathname, child);
                          return (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                aria-current={on ? 'page' : undefined}
                                className={cn(
                                  'block rounded-lg px-2.5 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
                                  on ? 'font-semibold text-brand-700' : 'text-slate-500 hover:bg-brand-100/60 hover:text-slate-800',
                                )}
                              >
                                {child.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn('border-t border-brand-100 p-3', collapsed ? 'flex justify-center' : 'flex items-center gap-2.5')}>
        {!collapsed && (
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{initials || 'U'}</span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-semibold text-slate-800">{name}</span>
              <span className="block truncate text-[11px] text-slate-500">{session?.user?.role === 'ADMIN' ? 'Quản trị viên' : session?.user?.email}</span>
            </span>
          </>
        )}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          aria-label="Đăng xuất"
          title="Đăng xuất"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

