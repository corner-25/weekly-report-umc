'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Trang Dashboard — gộp mọi dashboard số liệu về một chỗ.
 *
 * Trước đây tách làm hai mục menu ("Dashboard Phòng HC" và "Dashboards Streamlit"),
 * gây khó hiểu vì cùng nói về số liệu vận hành. Nay gom lại: bảng số liệu Phòng HC
 * hiển thị ngay trong ứng dụng, hai dashboard chuyên sâu mở tab mới.
 *
 * Dashboard Streamlit không nhúng iframe — Streamlit chống nhúng và giữ websocket
 * riêng, chạy trong iframe hay mất phiên. Xem docs/DEPLOY.md.
 */

interface ExternalDashboard {
  key: string;
  label: string;
  icon: string;
  description: string;
  envKey: string;
}

const EXTERNAL_DASHBOARDS: readonly ExternalDashboard[] = [
  {
    key: 'phong-hc-old',
    label: 'Hành chính — chuyên sâu',
    icon: '📋',
    description: 'Văn thư, phòng họp, tổng đài, bãi xe, thư ký · 13 nhóm chỉ số',
    envKey: 'DASHBOARD_PHONG_HC_OLD_URL',
  },
  {
    key: 'to-xe',
    label: 'Tổ Xe',
    icon: '🚗',
    description: 'Chuyến xe, tài xế, nhiên liệu, đánh giá vận hành',
    envKey: 'DASHBOARD_TO_XE_URL',
  },
];

export default function DashboardsPage() {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard-urls')
      .then((r) => r.json())
      .then(setUrls)
      .catch(() => setUrls({}))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-0.5 text-xs text-slate-400">
          Số liệu vận hành các phòng ban, cập nhật tự động hằng ngày
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Trong ứng dụng</h2>
        <Link
          href="/dashboard/reports/phong-hc-native"
          className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-cyan-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
        >
          <div>
            <p className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <span aria-hidden className="text-xl">
                📊
              </span>
              Số liệu Phòng Hành chính
            </p>
            <p className="mt-1.5 text-sm text-slate-500">
              Bảng chéo theo tuần/tháng/quý, biểu đồ xu hướng, xuất Excel
            </p>
          </div>
          <span className="text-sm font-medium text-cyan-700 transition group-hover:translate-x-0.5">
            Mở →
          </span>
        </Link>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Dashboard chuyên sâu</h2>
          <p className="mt-0.5 text-xs text-slate-400">Mở trong tab mới</p>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Đang tải cấu hình…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {EXTERNAL_DASHBOARDS.map((d) => (
              <DashboardCard key={d.key} dashboard={d} url={urls[d.key] ?? null} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DashboardCard({
  dashboard,
  url,
}: {
  dashboard: ExternalDashboard;
  url: string | null;
}) {
  if (!url) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="flex items-center gap-2 font-semibold text-amber-900">
          <span aria-hidden>{dashboard.icon}</span>
          {dashboard.label}
        </p>
        <p className="mt-2 text-sm text-amber-800">Chưa cấu hình địa chỉ dashboard.</p>
        <p className="mt-1 text-xs text-amber-700">
          Thêm biến <code className="rounded bg-amber-100 px-1">{dashboard.envKey}</code> vào
          Railway Variables.
        </p>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-cyan-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
    >
      <div>
        <p className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <span aria-hidden className="text-xl">
            {dashboard.icon}
          </span>
          {dashboard.label}
        </p>
        <p className="mt-2 text-sm text-slate-500">{dashboard.description}</p>
      </div>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-cyan-700 transition group-hover:gap-2">
        Mở dashboard
        <span aria-hidden>↗</span>
      </span>
    </a>
  );
}
