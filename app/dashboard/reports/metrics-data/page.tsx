'use client';

/**
 * Bảng số liệu — màn hình theo dõi chỉ số của người quản lý.
 *
 * Trước đây trang kéo toàn bộ 8.685 bản ghi về rồi dựng lưới 2.627 hàng × 31
 * cột. Chậm, và hầu hết ô trống: 1.701 chỉ số chỉ xuất hiện đúng MỘT lần trong
 * cả năm — AI trích từ một câu văn rồi tuần sau không còn.
 *
 * Một chỉ số xuất hiện một lần thì không nói được gì về xu hướng. Nên ở đây chỉ
 * hiện chỉ số BỀN VỮNG (đủ nhiều tuần để thấy tăng/giảm), sắp theo mức biến động
 * — thứ đổi nhiều nhất nằm trên cùng, vì đó là chỗ cần nhìn trước.
 *
 * Việc gom được đẩy xuống SQL: 8.685 bản ghi thành vài trăm dòng ngay tại
 * database, khoảng 300ms, thay vì chuyển hết qua mạng.
 */

import { Select } from '@/components/ui/Select';
import { useEffect, useState } from 'react';
import { Table2, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

interface Department {
  id: string;
  name: string;
}

/** Một chỉ số đã gom theo tuần, kèm sẵn số liệu để so sánh. */
interface MetricSummary {
  departmentId: string;
  departmentName: string;
  name: string;
  unit: string | null;
  weekCount: number;
  latestWeek: number;
  latestValue: number;
  previousValue: number | null;
  /** Số bản ghi bị đánh dấu cần rà soát (nhập sai, lệch bất thường…). */
  flaggedCount: number;
  minValue: number;
  maxValue: number;
  avgValue: number;
}

/** Ngưỡng phần trăm để coi một thay đổi là đáng chú ý, không phải dao động thường. */
const NOTABLE_CHANGE_PERCENT = 15;

function formatValue(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '') + ' tỷ';
  }
  if (Math.abs(value) >= 1_000_000) {
    return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' tr';
  }
  if (Number.isInteger(value)) return value.toLocaleString('vi-VN');
  return value.toFixed(1);
}

/** Phần trăm thay đổi so với kỳ trước; null khi không so sánh được. */
function changePercent(latest: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return ((latest - previous) / Math.abs(previous)) * 100;
}

export default function MetricsDataPage() {
  const [metrics, setMetrics] = useState<MetricSummary[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'change' | 'name' | 'coverage'>('change');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [summaryRes, deptsRes] = await Promise.all([
          fetch(`/api/extracted-metrics/summary?year=${selectedYear}`),
          fetch('/api/departments'),
        ]);
        if (cancelled) return;
        if (summaryRes.ok) setMetrics(await summaryRes.json());
        if (deptsRes.ok) setDepartments(await deptsRes.json());
      } catch (error) {
        console.error('Không tải được số liệu:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedYear]);

  // Chỉ liệt kê phòng thật sự có chỉ số bền vững.
  const activeDepartments = departments.filter((d) =>
    metrics.some((m) => m.departmentId === d.id),
  );

  const filtered = metrics.filter((m) => {
    if (selectedDept !== 'all' && m.departmentId !== selectedDept) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name, 'vi');
    if (sortBy === 'coverage') return b.weekCount - a.weekCount;

    // Mặc định: biến động mạnh nhất lên đầu — đó là chỗ cần nhìn trước.
    const ca = Math.abs(changePercent(a.latestValue, a.previousValue) ?? 0);
    const cb = Math.abs(changePercent(b.latestValue, b.previousValue) ?? 0);
    return cb - ca;
  });

  // Ba câu trả lời nhanh ở đầu màn hình.
  const rising = filtered.filter((m) => {
    const c = changePercent(m.latestValue, m.previousValue);
    return c !== null && c >= NOTABLE_CHANGE_PERCENT;
  });
  const falling = filtered.filter((m) => {
    const c = changePercent(m.latestValue, m.previousValue);
    return c !== null && c <= -NOTABLE_CHANGE_PERCENT;
  });
  const latestWeek = filtered.reduce((max, m) => Math.max(max, m.latestWeek), 0);
  const flaggedMetrics = filtered.filter((m) => m.flaggedCount > 0);

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Đang tải…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        icon={Table2}
        title="Số liệu theo dõi"
        description="Chỉ số xuất hiện đều đặn qua các tuần, sắp theo mức biến động"
        className="mb-6"
        actions={
          <span className="text-sm text-slate-500">
            {filtered.length} chỉ số · tuần {latestWeek}
          </span>
        }
      />

      {/* Ba con số trả lời: có gì bất thường tuần này không? */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
          <p className="text-sm text-slate-600">Tăng đáng kể</p>
          <p className="text-3xl font-bold text-emerald-600 tabular-nums mt-1">
            {rising.length}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            trên {NOTABLE_CHANGE_PERCENT}% so với tuần trước
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
          <p className="text-sm text-slate-600">Giảm đáng kể</p>
          <p className="text-3xl font-bold text-rose-600 tabular-nums mt-1">
            {falling.length}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            giảm trên {NOTABLE_CHANGE_PERCENT}% so với tuần trước
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
          <p className="text-sm text-slate-600">Chỉ số theo dõi</p>
          <p className="text-3xl font-bold text-slate-900 tabular-nums mt-1">
            {filtered.length}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            xuất hiện đủ nhiều tuần để so sánh
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5">
          <p className="text-sm text-slate-600">Cần rà soát</p>
          <p
            className={`text-3xl font-bold tabular-nums mt-1 ${
              flaggedMetrics.length > 0 ? 'text-amber-600' : 'text-slate-900'
            }`}
          >
            {flaggedMetrics.length}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            nghi nhập sai hoặc lệch bất thường
          </p>
        </div>
      </div>

      {/* Bộ lọc */}
      <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200/80">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Năm</label>
            <Select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(
                (year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ),
              )}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phòng ban</label>
            <Select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
            >
              <option value="all">Tất cả phòng</option>
              {activeDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Tìm chỉ số</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ví dụ: viện phí, hồ sơ, đào tạo…"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sắp xếp</label>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
            >
              <option value="change">Biến động mạnh nhất</option>
              <option value="coverage">Theo dõi lâu nhất</option>
              <option value="name">Tên chỉ số</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Danh sách chỉ số */}
      {sorted.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-12 text-center">
          <h3 className="text-lg font-medium text-slate-900 mb-2">Không có chỉ số nào</h3>
          <p className="text-slate-500">
            {search
              ? `Không tìm thấy chỉ số nào khớp "${search}"`
              : `Chưa có chỉ số nào theo dõi đủ nhiều tuần trong năm ${selectedYear}`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Chỉ số
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Tuần {latestWeek}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Thay đổi
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Trung bình
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Khoảng
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Số tuần
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((m) => {
                const change = changePercent(m.latestValue, m.previousValue);
                const notable = change !== null && Math.abs(change) >= NOTABLE_CHANGE_PERCENT;

                return (
                  <tr
                    key={`${m.departmentId}::${m.name}`}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <p className="text-sm text-slate-900 flex items-center gap-1.5">
                        {m.name}
                        {m.flaggedCount > 0 && (
                          <AlertTriangle
                            className="w-3.5 h-3.5 text-amber-500 shrink-0"
                            aria-label="Có số liệu cần rà soát"
                          />
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {m.departmentName}
                        {m.unit ? ` · ${m.unit}` : ''}
                      </p>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">
                        {formatValue(m.latestValue)}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {change === null ? (
                        <span className="text-xs text-slate-300">—</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 text-sm tabular-nums ${
                            !notable
                              ? 'text-slate-400'
                              : change > 0
                                ? 'text-emerald-600 font-medium'
                                : 'text-rose-600 font-medium'
                          }`}
                        >
                          {!notable ? (
                            <Minus className="w-3 h-3" />
                          ) : change > 0 ? (
                            <TrendingUp className="w-3.5 h-3.5" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5" />
                          )}
                          {change > 0 ? '+' : ''}
                          {change.toFixed(0)}%
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right text-sm text-slate-500 tabular-nums">
                      {formatValue(m.avgValue)}
                    </td>

                    <td className="px-4 py-3 text-right text-xs text-slate-400 tabular-nums whitespace-nowrap">
                      {formatValue(m.minValue)} – {formatValue(m.maxValue)}
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className="text-xs text-slate-500 tabular-nums">
                        {m.weekCount}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {flaggedMetrics.length > 0 && (
        <p className="text-xs text-amber-700 mt-4 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            {flaggedMetrics.length} chỉ số có số liệu nghi nhập sai — giá trị lệch
            hẳn khỏi mức thường thấy, hoặc nhiều giá trị cho cùng một mốc thời
            gian. Hệ thống chỉ đánh dấu, không tự sửa; cần đối chiếu báo cáo gốc.
          </span>
        </p>
      )}

      <p className="text-xs text-slate-400 mt-4">
        Chỉ hiện chỉ số xuất hiện từ 8 tuần trở lên. Chỉ số chỉ có một vài lần
        không đủ dữ liệu để so sánh nên được lược bớt.
      </p>
    </div>
  );
}
