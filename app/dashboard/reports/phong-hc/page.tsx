'use client';

import { useEffect, useState } from 'react';

/**
 * Trang điều hướng sang các dashboard Streamlit.
 *
 * Hai dashboard này deploy thành service riêng trên Railway, không nhúng iframe
 * nữa: Streamlit gửi header chống nhúng và giữ kết nối websocket riêng, chạy
 * trong iframe hay mất session và vỡ layout. Mở tab mới ổn định hơn hẳn.
 */

interface DashboardLink {
  key: string;
  label: string;
  icon: string;
  description: string;
  envKey: string;
}

const DASHBOARDS: readonly DashboardLink[] = [
  {
    key: 'to-xe',
    label: 'Dashboard Tổ Xe',
    icon: '🚗',
    description: 'Chuyến xe, tài xế, nhiên liệu, đánh giá vận hành',
    envKey: 'DASHBOARD_TO_XE_URL',
  },
  {
    key: 'phong-hc-old',
    label: 'Dashboard Hành chính',
    icon: '📊',
    description: 'Số liệu văn thư, phòng họp, tổng đài, bãi xe',
    envKey: 'DASHBOARD_PHONG_HC_OLD_URL',
  },
];

export default function DashboardLinksPage() {
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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Số Liệu</h1>
        <p className="mt-1 text-sm text-slate-500">
          Dashboard phân tích chuyên sâu, mở trong tab mới
        </p>
      </header>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">
          Đang tải cấu hình…
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {DASHBOARDS.map((d) => (
            <DashboardCard key={d.key} dashboard={d} url={urls[d.key] ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardCard({ dashboard, url }: { dashboard: DashboardLink; url: string | null }) {
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
          Railway Variables (hoặc <code className="rounded bg-amber-100 px-1">.env</code> khi chạy máy cá nhân).
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
