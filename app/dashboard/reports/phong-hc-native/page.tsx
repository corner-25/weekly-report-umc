'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import type { ProcessedRow, ReportType, TimeFilter } from '@/lib/phong-hc/types';
import {
  parseGitHubData,
  processData,
  filterData,
  aggregateByReportType,
  buildPivotTable,
  getCategoryConfigs,
  computeStats,
  getQuickFilters,
  formatNumber,
} from '@/lib/phong-hc/data-processing';
import { PivotTable } from '@/components/phong-hc/PivotTable';
import { TrendCharts } from '@/components/phong-hc/TrendCharts';
import { ExportPanel } from '@/components/phong-hc/ExportPanel';

type Tab = 'table' | 'trends' | 'export';

export default function PhongHcNativePage() {
  const [allData, setAllData] = useState<ProcessedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadataInfo, setMetadataInfo] = useState<string>('');

  const [activeTab, setActiveTab] = useState<Tab>('table');
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [showRatio, setShowRatio] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/phong-hc-data');
      if (!res.ok) throw new Error(`Lỗi ${res.status}: ${res.statusText}`);
      const pkg = await res.json();
      if (pkg.error) throw new Error(pkg.error);

      const raw = parseGitHubData(pkg);
      const processed = processData(raw);
      setAllData(processed);

      const configs = getCategoryConfigs(processed);
      setSelectedCategories(configs.map((c) => c.name));

      if (pkg.metadata) {
        setMetadataInfo(
          `${pkg.metadata.filename} — Tuần ${pkg.metadata.week_number}/${pkg.metadata.year}`
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => computeStats(allData), [allData]);
  const categoryConfigs = useMemo(() => getCategoryConfigs(allData), [allData]);
  const quickFilters = useMemo(() => getQuickFilters(allData), [allData]);

  const yearFilteredData = useMemo(() => {
    if (selectedYear === 'all') return allData;
    return allData.filter((r) => r['Năm'] === selectedYear);
  }, [allData, selectedYear]);

  const filteredData = useMemo(() => {
    if (!timeFilter) return yearFilteredData.filter((r) => selectedCategories.includes(r['Danh mục']));
    return filterData(yearFilteredData, timeFilter, selectedCategories);
  }, [yearFilteredData, timeFilter, selectedCategories]);

  const { rows: pivotRows, timeColumns } = useMemo(() => {
    const aggregated = aggregateByReportType(filteredData, reportType);
    return buildPivotTable(aggregated);
  }, [filteredData, reportType]);

  const toggleCategory = useCallback((catName: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName]
    );
  }, []);

  const selectAllCategories = useCallback(() => {
    setSelectedCategories(categoryConfigs.map((c) => c.name));
  }, [categoryConfigs]);

  const deselectAllCategories = useCallback(() => {
    setSelectedCategories([]);
  }, []);

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-cyan-100 rounded-full" />
            <div className="absolute inset-0 border-4 border-transparent border-t-cyan-500 rounded-full animate-spin" />
          </div>
          <p className="text-gray-500 text-sm font-medium">Đang tải dữ liệu...</p>
          <p className="text-gray-400 text-xs mt-1">Dashboard Phòng Hành Chính</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-red-100 p-8 text-center">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Không thể tải dữ liệu</h3>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'table',
      label: 'Bảng số liệu',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125" />
        </svg>
      ),
    },
    {
      key: 'trends',
      label: 'Xu hướng',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
        </svg>
      ),
    },
    {
      key: 'export',
      label: 'Xuất báo cáo',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            Dashboard Phòng Hành Chính
          </h1>
          <p className="mt-1 text-xs text-gray-400">
            {metadataInfo || 'Số liệu hoạt động hành chính'}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Làm mới
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <StatCard label="Danh mục" value={stats.totalCategories} accent="border-l-cyan-500" />
        <StatCard label="Nội dung" value={stats.totalContents} accent="border-l-blue-500" />
        <StatCard label="Tuần dữ liệu" value={stats.totalWeeks} accent="border-l-violet-500" />
        <StatCard label="Tuần mới nhất" value={`W${stats.latestWeek}`} accent="border-l-emerald-500" />
        <StatCard label="Dòng dữ liệu" value={formatNumber(stats.dataRows)} accent="border-l-amber-500" />
        <StatCard label="Năm" value={stats.years.join(', ')} accent="border-l-rose-500" />
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        {/* Top bar: tabs + data count */}
        <div className="flex items-center justify-between border-b border-gray-100 px-1">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
                  activeTab === tab.key
                    ? 'border-gray-900 text-gray-900'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 pr-4">
            <span className="text-xs text-gray-400 tabular-nums">
              {filteredData.length.toLocaleString('vi-VN')} dòng
            </span>
            {timeFilter && (
              <span className="text-[10px] font-medium text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full">
                Đã lọc
              </span>
            )}
          </div>
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-50">
          {/* Report type */}
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          >
            <option value="weekly">Theo tuần</option>
            <option value="monthly">Theo tháng</option>
            <option value="quarterly">Theo quý</option>
            <option value="yearly">Theo năm</option>
          </select>

          {/* Year pills */}
          {stats.years.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedYear('all')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  selectedYear === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                Tất cả
              </button>
              {stats.years.map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    selectedYear === year
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          )}

          <div className="w-px h-5 bg-gray-200" />

          {/* Show ratio toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                checked={showRatio}
                onChange={(e) => setShowRatio(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4.5 bg-gray-200 rounded-full peer-checked:bg-gray-900 transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-3.5" />
            </div>
            <span className="text-xs text-gray-500">Biến động %</span>
          </label>

          <div className="w-px h-5 bg-gray-200" />

          {/* Quick filters */}
          <div className="flex flex-wrap gap-1">
            {quickFilters.map((qf) => (
              <button
                key={qf.label}
                onClick={() => setTimeFilter(qf.filter)}
                className="px-2 py-1 text-[11px] font-medium text-gray-500 bg-gray-50 rounded-md hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                {qf.label}
              </button>
            ))}
            {timeFilter && (
              <button
                onClick={() => setTimeFilter(null)}
                className="px-2 py-1 text-[11px] font-medium text-red-500 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
              >
                Xóa lọc
              </button>
            )}
          </div>

          <div className="ml-auto">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                filtersOpen
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
              </svg>
              Danh mục
              <span className="bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full">
                {selectedCategories.length}/{categoryConfigs.length}
              </span>
            </button>
          </div>
        </div>

        {/* Category filter panel - collapsible */}
        {filtersOpen && (
          <div className="px-4 py-3 bg-gray-50/50 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-medium text-gray-500">Lọc theo danh mục</span>
              <div className="flex gap-2">
                <button onClick={selectAllCategories} className="text-[11px] text-gray-500 hover:text-gray-900 transition-colors">
                  Chọn tất cả
                </button>
                <span className="text-gray-300">|</span>
                <button onClick={deselectAllCategories} className="text-[11px] text-gray-500 hover:text-gray-900 transition-colors">
                  Bỏ chọn
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categoryConfigs.map((cat) => {
                const isSelected = selectedCategories.includes(cat.name);
                return (
                  <button
                    key={cat.name}
                    onClick={() => toggleCategory(cat.name)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-white text-gray-800 border-gray-300 shadow-sm font-medium'
                        : 'bg-transparent text-gray-400 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-sm">{cat.icon}</span>
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tab content */}
      {filteredData.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-gray-500">Không có dữ liệu phù hợp</p>
          <p className="text-xs text-gray-400 mt-1">Thử thay đổi bộ lọc hoặc chọn thêm danh mục</p>
        </div>
      ) : (
        <>
          {activeTab === 'table' && (
            <PivotTable
              rows={pivotRows}
              timeColumns={timeColumns}
              showRatio={showRatio && reportType === 'weekly'}
            />
          )}
          {activeTab === 'trends' && (
            <TrendCharts rows={pivotRows} timeColumns={timeColumns} />
          )}
          {activeTab === 'export' && (
            <ExportPanel
              pivotRows={pivotRows}
              timeColumns={timeColumns}
              rawData={filteredData}
            />
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 border-l-[3px] ${accent} px-3 py-2.5 shadow-sm`}>
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}
