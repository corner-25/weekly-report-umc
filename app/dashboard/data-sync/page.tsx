'use client';

import { useState, useRef } from 'react';

interface UploadSummary {
  totalRows: number;
  years: number[];
  latestWeek: string;
  filesProcessed: { name: string; rows: number; years: number[] }[];
  categories: number;
  uploadedAt: string;
}

export default function DataSyncPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Quản lý Đồng bộ Dữ liệu</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Upload file Excel / Kiểm tra dữ liệu GitHub cho các dashboard native
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HcUploadPanel />
        <FleetSyncPanel />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// HC UPLOAD PANEL - Upload Excel → Parse → GitHub
// ═══════════════════════════════════════════════════════════

function HcUploadPanel() {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setResult(null);
      setError(null);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Vui lòng chọn ít nhất 1 file Excel');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      files.forEach((file, i) => formData.append(`file_${i}`, file));

      const res = await fetch('/api/hc-data-upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Lỗi ${res.status}`);
      } else {
        setResult(data.summary);
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setUploading(false);
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
          Upload file Excel → Parse → Upload JSON lên GitHub
        </p>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {/* Pipeline explanation */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
          <p className="font-semibold mb-1">Quy trình:</p>
          <div className="flex items-center gap-1 flex-wrap">
            <span className="bg-white px-2 py-0.5 rounded border border-blue-200">File Excel</span>
            <span>→</span>
            <span className="bg-white px-2 py-0.5 rounded border border-blue-200">Parse dữ liệu</span>
            <span>→</span>
            <span className="bg-white px-2 py-0.5 rounded border border-blue-200">Merge &amp; Dedup</span>
            <span>→</span>
            <span className="bg-white px-2 py-0.5 rounded border border-blue-200">GitHub</span>
          </div>
          <p className="mt-2 text-blue-600">
            Upload 1 hoặc nhiều file Excel (VD: năm 2025 + 2026). Hệ thống tự merge và loại trùng.
          </p>
        </div>

        {/* File input */}
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1.5">Chọn file Excel (.xlsx, .xls)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={handleFileChange}
            className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />
        </div>

        {/* Selected files */}
        {files.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-700">File đã chọn ({files.length}):</p>
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm text-gray-700 flex-1 truncate">{file.name}</span>
                <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</span>
                <button onClick={() => removeFile(i)} className="text-red-400 hover:text-red-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload button */}
        <button onClick={handleUpload} disabled={uploading || files.length === 0}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
            uploading
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : files.length === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 shadow-sm'
          }`}>
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
              Đang xử lý &amp; upload...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload &amp; Cập nhật Dashboard
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

        {/* Success result */}
        {result && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            <p className="font-semibold text-sm text-emerald-700 mb-2">Upload thành công!</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white rounded-lg p-2 border border-emerald-100">
                <p className="text-gray-500">Tổng dòng dữ liệu</p>
                <p className="font-bold text-emerald-700 text-lg">{result.totalRows.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg p-2 border border-emerald-100">
                <p className="text-gray-500">Danh mục</p>
                <p className="font-bold text-emerald-700 text-lg">{result.categories}</p>
              </div>
              <div className="bg-white rounded-lg p-2 border border-emerald-100">
                <p className="text-gray-500">Năm dữ liệu</p>
                <p className="font-bold text-emerald-700">{result.years.join(', ')}</p>
              </div>
              <div className="bg-white rounded-lg p-2 border border-emerald-100">
                <p className="text-gray-500">Tuần mới nhất</p>
                <p className="font-bold text-emerald-700">{result.latestWeek}</p>
              </div>
            </div>
            {result.filesProcessed.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-emerald-700">Chi tiết file:</p>
                {result.filesProcessed.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-emerald-600">
                    <span>✅</span>
                    <span className="font-medium">{f.name}</span>
                    <span className="text-gray-400">
                      {f.rows} dòng | Năm: {f.years.join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">
              Uploaded: {new Date(result.uploadedAt).toLocaleString('vi-VN')}
            </p>
          </div>
        )}

        {/* Target info */}
        <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
          <p><span className="font-medium">Format:</span> Excel (.xlsx/.xls) với cột: Danh mục, Nội dung, Năm, Tháng, Tuần, Số liệu</p>
          <p><span className="font-medium">GitHub:</span> corner-25/dashboard-storage → current_dashboard_data.json</p>
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
          Kiểm tra &amp; làm mới dữ liệu từ GitHub
        </p>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        <div className="text-xs text-gray-500 space-y-0.5">
          <p className="font-medium text-gray-700 mb-1">Dữ liệu Fleet:</p>
          <div className="space-y-0.5">
            <span className="block">🚗 Dữ liệu chuyến xe (từ Google Sheets → GitHub)</span>
            <span className="block">📊 Bao gồm: xe HC, xe cứu thương, tài xế, doanh thu</span>
          </div>
        </div>

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

        <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
          <p><span className="font-medium">GitHub:</span> corner-25/vehicle-storage</p>
          <p><span className="font-medium">File:</span> data/latest/fleet_data_latest.json</p>
          <p><span className="font-medium">Dashboard:</span> /dashboard/reports/to-xe-native</p>
        </div>
      </div>
    </div>
  );
}
