'use client';

import { useState } from 'react';

interface SyncResult {
  name: string;
  file: string;
  fetchOk: boolean;
  uploadOk: boolean;
  message: string;
}

interface SyncResponse {
  success: boolean;
  results: SyncResult[];
  summary: string;
  syncedAt: string;
  error?: string;
}

export default function DataSyncPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Quản lý Đồng bộ Dữ liệu</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Đồng bộ dữ liệu từ API / GitHub cho các dashboard native
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HcSyncPanel />
        <FleetSyncPanel />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// HC SYNC PANEL
// ═══════════════════════════════════════════════════════════

function HcSyncPanel() {
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/sync-hc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Lỗi ${res.status}`);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-5 py-4">
        <div className="flex items-center gap-2 text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h2 className="font-semibold text-lg">Dashboard Phòng HC</h2>
        </div>
        <p className="text-blue-100 text-xs mt-1">
          Lấy dữ liệu từ officeapi.umc.edu.vn → xử lý → upload GitHub
        </p>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {/* Data sources info */}
        <div className="text-xs text-gray-500 space-y-0.5">
          <p className="font-medium text-gray-700 mb-1">Nguồn dữ liệu (6 loại):</p>
          <div className="grid grid-cols-2 gap-0.5">
            <span>📥 Tổng hợp</span>
            <span>📨 Văn bản đến</span>
            <span>📤 Văn bản phát hành</span>
            <span>💼 Quản lý công việc</span>
            <span>🏢 Đăng ký phòng họp</span>
            <span>📅 Đăng ký lịch họp</span>
          </div>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Từ ngày</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Đến ngày</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          </div>
        </div>

        {/* Sync button */}
        <button onClick={handleSync} disabled={syncing}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            syncing
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 shadow-sm'
          }`}>
          {syncing ? (
            <>
              <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              Đang đồng bộ...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Đồng bộ &amp; Upload GitHub
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
            <p className="font-semibold">Lỗi</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className={`rounded-lg border p-3 ${result.success ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`font-semibold text-sm ${result.success ? 'text-emerald-700' : 'text-amber-700'}`}>
                {result.success ? '✅ Thành công!' : '⚠️ Một số lỗi'}
              </span>
              <span className="text-xs text-gray-500">{result.summary}</span>
            </div>
            <div className="space-y-1">
              {result.results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span>{r.fetchOk && r.uploadOk ? '✅' : r.fetchOk ? '⚠️' : '❌'}</span>
                  <span className="font-medium text-gray-700">{r.name}</span>
                  <span className="text-gray-400 ml-auto truncate max-w-[200px]">{r.file}</span>
                </div>
              ))}
            </div>
            {result.syncedAt && (
              <p className="text-xs text-gray-400 mt-2">
                Synced: {new Date(result.syncedAt).toLocaleString('vi-VN')}
              </p>
            )}
          </div>
        )}

        {/* Target info */}
        <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
          <p><span className="font-medium">API:</span> officeapi.umc.edu.vn</p>
          <p><span className="font-medium">GitHub:</span> corner-25/dashboard-storage</p>
          <p><span className="font-medium">Dashboard:</span> /dashboard/reports/phong-hc-native</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// FLEET SYNC PANEL
// ═══════════════════════════════════════════════════════════

function FleetSyncPanel() {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<{ ok: boolean; message: string; fetchedAt?: string } | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshResult(null);

    try {
      const res = await fetch('/api/fleet-data', { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok || data.error) {
        setRefreshResult({ ok: false, message: data.error || `Lỗi ${res.status}` });
      } else {
        const recordCount = Array.isArray(data.data) ? data.data.length : 0;
        setRefreshResult({
          ok: true,
          message: `Đã tải ${recordCount.toLocaleString()} bản ghi`,
          fetchedAt: data.fetchedAt,
        });
      }
    } catch (err) {
      setRefreshResult({ ok: false, message: err instanceof Error ? err.message : 'Lỗi kết nối' });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4">
        <div className="flex items-center gap-2 text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <h2 className="font-semibold text-lg">Dashboard Tổ Xe</h2>
        </div>
        <p className="text-amber-100 text-xs mt-1">
          Kiểm tra & làm mới dữ liệu từ GitHub
        </p>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {/* Info */}
        <div className="text-xs text-gray-500 space-y-0.5">
          <p className="font-medium text-gray-700 mb-1">Dữ liệu Fleet:</p>
          <div className="space-y-0.5">
            <span className="block">🚗 Dữ liệu chuyến xe (từ Google Sheets → GitHub)</span>
            <span className="block">📊 Bao gồm: xe HC, xe cứu thương, tài xế, doanh thu</span>
          </div>
        </div>

        {/* Pipeline explanation */}
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
          <p className="font-semibold mb-1">📝 Quy trình đồng bộ:</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Tài xế nhập dữ liệu vào Google Sheets</li>
            <li>Script Python sync từ Google Sheets → GitHub</li>
            <li>Dashboard native đọc từ GitHub</li>
          </ol>
          <p className="mt-2 text-amber-600">
            Nút bên dưới kiểm tra kết nối và tải lại dữ liệu mới nhất từ GitHub.
          </p>
        </div>

        {/* Refresh button */}
        <button onClick={handleRefresh} disabled={refreshing}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            refreshing
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-sm'
          }`}>
          {refreshing ? (
            <>
              <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              Đang kiểm tra...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Kiểm tra &amp; Làm mới dữ liệu
            </>
          )}
        </button>

        {/* Result */}
        {refreshResult && (
          <div className={`rounded-lg border p-3 text-sm ${
            refreshResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-600'
          }`}>
            <p className="font-semibold">{refreshResult.ok ? '✅ Kết nối OK' : '❌ Lỗi'}</p>
            <p className="text-xs mt-1">{refreshResult.message}</p>
            {refreshResult.fetchedAt && (
              <p className="text-xs text-gray-400 mt-1">
                Fetched: {new Date(refreshResult.fetchedAt).toLocaleString('vi-VN')}
              </p>
            )}
          </div>
        )}

        {/* Target info */}
        <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
          <p><span className="font-medium">GitHub:</span> corner-25/vehicle-storage</p>
          <p><span className="font-medium">File:</span> data/latest/fleet_data_latest.json</p>
          <p><span className="font-medium">Dashboard:</span> /dashboard/reports/to-xe-native</p>
        </div>
      </div>
    </div>
  );
}
