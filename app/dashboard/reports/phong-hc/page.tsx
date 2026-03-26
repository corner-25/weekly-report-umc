'use client';

import { useState, useEffect } from 'react';

const DASHBOARDS = [
  {
    key: 'phong-hc',
    label: 'Dashboard Phòng HC',
    icon: '📋',
    description: 'Dashboard số liệu hành chính (v2)',
    envKey: 'DASHBOARD_PHONG_HC_URL',
  },
  {
    key: 'phong-hc-old',
    label: 'Dashboard HC Cũ',
    icon: '📊',
    description: 'Dashboard hành chính phiên bản cũ',
    envKey: 'DASHBOARD_PHONG_HC_OLD_URL',
  },
  {
    key: 'to-xe',
    label: 'Dashboard Tổ Xe',
    icon: '🚗',
    description: 'Dashboard quản lý tổ xe',
    envKey: 'DASHBOARD_TO_XE_URL',
  },
  {
    key: 'umc',
    label: 'Dashboard UMC',
    icon: '🏥',
    description: 'Dashboard đa phòng ban UMC',
    envKey: 'DASHBOARD_UMC_URL',
  },
];

export default function PhongHcDashboardPage() {
  const [activeTab, setActiveTab] = useState('phong-hc');
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard-urls')
      .then(r => r.json())
      .then(data => setUrls(data))
      .finally(() => setLoading(false));
  }, []);

  const activeDashboard = DASHBOARDS.find(d => d.key === activeTab)!;
  const activeUrl = urls[activeTab];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Số Liệu</h1>
        <p className="mt-1 text-sm text-slate-500">
          Hệ thống dashboard phân tích số liệu Phòng Hành Chính - UMC
        </p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 border-b border-slate-200">
        {DASHBOARDS.map(d => (
          <button
            key={d.key}
            onClick={() => setActiveTab(d.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              activeTab === d.key
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <span>{d.icon}</span>
            <span>{d.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
          Đang tải cấu hình...
        </div>
      ) : !activeUrl ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <p className="font-semibold">Chưa cấu hình URL cho {activeDashboard.label}</p>
          <p className="mt-2 text-sm">
            Thêm biến môi trường{' '}
            <code className="bg-amber-100 px-1 rounded">{activeDashboard.envKey}</code>{' '}
            vào Railway Variables (hoặc file <code className="bg-amber-100 px-1 rounded">.env</code> khi dev).
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Toolbar */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {activeDashboard.icon} {activeDashboard.label}
              </p>
              <p className="text-xs text-slate-400">{activeDashboard.description}</p>
            </div>
            <a
              href={activeUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-cyan-200 px-3 py-1.5 text-xs font-medium text-cyan-700 transition hover:bg-cyan-50"
            >
              Mở tab mới ↗
            </a>
          </div>

          {/* iframe */}
          <iframe
            key={activeTab}
            src={activeUrl}
            title={activeDashboard.label}
            className="h-[calc(100vh-260px)] min-h-[680px] w-full border-0"
          />
        </div>
      )}
    </div>
  );
}
