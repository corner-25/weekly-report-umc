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
  // Data state
  const [allData, setAllData] = useState<ProcessedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadataInfo, setMetadataInfo] = useState<string>('');

  // UI state
  const [activeTab, setActiveTab] = useState<Tab>('table');
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [showRatio, setShowRatio] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter | null>(null);

  // Fetch data
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

      // Set defaults
      const configs = getCategoryConfigs(processed);
      setSelectedCategories(configs.map((c) => c.name));

      // Set metadata info
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

  // Compute derived data
  const stats = useMemo(() => computeStats(allData), [allData]);
  const categoryConfigs = useMemo(() => getCategoryConfigs(allData), [allData]);
  const quickFilters = useMemo(() => getQuickFilters(allData), [allData]);

  // Year-filtered data
  const yearFilteredData = useMemo(() => {
    if (selectedYear === 'all') return allData;
    return allData.filter((r) => r['Năm'] === selectedYear);
  }, [allData, selectedYear]);

  // Time+category filtered data
  const filteredData = useMemo(() => {
    if (!timeFilter) return yearFilteredData.filter((r) => selectedCategories.includes(r['Danh mục']));
    return filterData(yearFilteredData, timeFilter, selectedCategories);
  }, [yearFilteredData, timeFilter, selectedCategories]);

  // Aggregated & pivot
  const { rows: pivotRows, timeColumns } = useMemo(() => {
    const aggregated = aggregateByReportType(filteredData, reportType);
    return buildPivotTable(aggregated);
  }, [filteredData, reportType]);

  // Handlers
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

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-200 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Đang tải dữ liệu Phòng Hành Chính...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <svg className="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="text-lg font-semibold text-red-800 mb-2">Không thể tải dữ liệu</h3>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'table', label: 'Bảng số liệu', icon: '📋' },
    { key: 'trends', label: 'Xu hướng', icon: '📈' },
    { key: 'export', label: 'Xuất báo cáo', icon: '💾' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Dashboard Phòng Hành Chính
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Số liệu hoạt động hành chính — {metadataInfo}
        </p>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Danh mục" value={stats.totalCategories} color="cyan" />
        <StatCard label="Nội dung" value={stats.totalContents} color="blue" />
        <StatCard label="Tuần dữ liệu" value={stats.totalWeeks} color="purple" />
        <StatCard label="Tuần mới nhất" value={`W${stats.latestWeek}`} color="emerald" />
        <StatCard label="Dòng dữ liệu" value={formatNumber(stats.dataRows)} color="orange" />
        <StatCard label="Năm" value={stats.years.join(', ')} color="pink" />
      </div>

      {/* Year quick filter */}
      {stats.years.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500">Năm:</span>
          <button
            onClick={() => setSelectedYear('all')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
              selectedYear === 'all'
                ? 'bg-cyan-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Tất cả
          </button>
          {stats.years.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                selectedYear === year
                  ? 'bg-cyan-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200 p-4">
        {/* Report type */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Báo cáo:</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          >
            <option value="weekly">Theo Tuần</option>
            <option value="monthly">Theo Tháng</option>
            <option value="quarterly">Theo Quý</option>
            <option value="yearly">Theo Năm</option>
          </select>
        </div>

        <div className="w-px h-6 bg-gray-200" />

        {/* Show ratio toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showRatio}
            onChange={(e) => setShowRatio(e.target.checked)}
            className="w-4 h-4 text-cyan-500 rounded focus:ring-cyan-500"
          />
          <span className="text-sm text-gray-600">Biến động %</span>
        </label>

        <div className="w-px h-6 bg-gray-200" />

        {/* Quick filters */}
        <div className="flex flex-wrap gap-1.5">
          {quickFilters.map((qf) => (
            <button
              key={qf.label}
              onClick={() => setTimeFilter(qf.filter)}
              className="px-2.5 py-1 text-xs bg-gray-50 text-gray-600 rounded-md hover:bg-cyan-50 hover:text-cyan-700 transition-colors border border-gray-100"
            >
              {qf.label}
            </button>
          ))}
          {timeFilter && (
            <button
              onClick={() => setTimeFilter(null)}
              className="px-2.5 py-1 text-xs bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors border border-red-100"
            >
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* Category filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Danh mục</h3>
          <div className="flex gap-2">
            <button
              onClick={selectAllCategories}
              className="text-xs text-cyan-600 hover:underline"
            >
              Chọn tất cả
            </button>
            <button
              onClick={deselectAllCategories}
              className="text-xs text-gray-400 hover:underline"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {categoryConfigs.map((cat) => {
            const isSelected = selectedCategories.includes(cat.name);
            return (
              <button
                key={cat.name}
                onClick={() => toggleCategory(cat.name)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-cyan-50 text-cyan-700 border-cyan-200 shadow-sm'
                    : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              activeTab === tab.key
                ? 'border-cyan-500 text-cyan-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}

        {/* Data info */}
        <div className="ml-auto flex items-center text-xs text-gray-400 pr-2">
          {filteredData.length.toLocaleString('vi-VN')} dòng
          {timeFilter && (
            <span className="ml-2 px-2 py-0.5 bg-cyan-50 text-cyan-600 rounded">
              Đã lọc
            </span>
          )}
        </div>
      </div>

      {/* Tab content */}
      {filteredData.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-12 text-center">
          <p className="text-gray-400 text-sm">Không có dữ liệu phù hợp với bộ lọc</p>
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
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    cyan: 'bg-cyan-50 text-cyan-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    orange: 'bg-orange-50 text-orange-700',
    pink: 'bg-pink-50 text-pink-700',
  };

  return (
    <div className={`rounded-lg p-3 ${colorClasses[color] ?? 'bg-gray-50 text-gray-700'}`}>
      <p className="text-[11px] font-medium opacity-70">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}
