'use client';

import React from 'react';

// ─── SVG Bar Chart ──────────────────────────────────────────

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  title: string;
  height?: number;
  formatValue?: (v: number) => string;
  maxBars?: number;
}

export function BarChart({ data, title, height = 260, formatValue, maxBars = 10 }: BarChartProps) {
  const items = data.slice(0, maxBars);
  if (items.length === 0) return <div className="text-gray-400 text-sm p-4">Không có dữ liệu</div>;

  const maxVal = Math.max(...items.map((d) => d.value), 1);
  const barH = Math.max(16, Math.min(28, (height - 40) / items.length));
  const chartH = items.length * (barH + 6) + 20;
  const fmt = formatValue ?? ((v: number) => v.toLocaleString('vi-VN'));

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
      <svg width="100%" height={chartH} viewBox={`0 0 400 ${chartH}`} className="overflow-visible">
        {items.map((item, i) => {
          const y = i * (barH + 6) + 4;
          const barW = (item.value / maxVal) * 250;
          return (
            <g key={item.label}>
              <text x={0} y={y + barH / 2 + 4} fontSize={10} fill="#4b5563" className="select-none">
                {item.label.length > 14 ? item.label.slice(0, 14) + '…' : item.label}
              </text>
              <rect x={110} y={y} width={Math.max(2, barW)} height={barH} rx={3}
                fill={item.color ?? '#06b6d4'} opacity={0.85} />
              <text x={115 + barW} y={y + barH / 2 + 4} fontSize={10} fill="#374151" fontWeight={600}>
                {fmt(item.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── SVG Trend Line ─────────────────────────────────────────

interface TrendLineProps {
  data: { label: string; value: number }[];
  title: string;
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}

export function TrendLine({ data, title, height = 200, color = '#06b6d4', formatValue }: TrendLineProps) {
  if (data.length < 2) return <div className="text-gray-400 text-sm p-4">Không đủ dữ liệu</div>;

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const minVal = Math.min(...data.map((d) => d.value), 0);
  const range = maxVal - minVal || 1;
  const w = 380;
  const h = height - 40;
  const fmt = formatValue ?? ((v: number) => v.toLocaleString('vi-VN'));

  const points = data.map((d, i) => {
    const x = 40 + (i / (data.length - 1)) * (w - 60);
    const y = 10 + (1 - (d.value - minVal) / range) * (h - 20);
    return { x, y, ...d };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  // area fill
  const area = `${points[0].x},${h - 5} ${polyline} ${points[points.length - 1].x},${h - 5}`;

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>
      <svg width="100%" height={height} viewBox={`0 0 400 ${height}`} className="overflow-visible">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = 10 + frac * (h - 20);
          const val = maxVal - frac * range;
          return (
            <g key={frac}>
              <line x1={40} y1={y} x2={w} y2={y} stroke="#e5e7eb" strokeWidth={0.5} />
              <text x={36} y={y + 3} fontSize={8} fill="#9ca3af" textAnchor="end">
                {fmt(val)}
              </text>
            </g>
          );
        })}
        {/* Area */}
        <polygon points={area} fill={color} opacity={0.1} />
        {/* Line */}
        <polyline points={polyline} fill="none" stroke={color} strokeWidth={2} />
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />
        ))}
        {/* X labels (first, middle, last) */}
        {[0, Math.floor(data.length / 2), data.length - 1].map((idx) => (
          <text key={idx} x={points[idx].x} y={h + 12} fontSize={8} fill="#9ca3af" textAnchor="middle">
            {data[idx].label.length > 10 ? data[idx].label.slice(5) : data[idx].label}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── Mini Stat Card ─────────────────────────────────────────

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

export function StatCard({ icon, label, value, sub, accent = 'border-cyan-500' }: StatCardProps) {
  return (
    <div className={`bg-white rounded-lg border-l-4 ${accent} p-3 shadow-sm`}>
      <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-lg font-bold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Data Table ─────────────────────────────────────────────

interface Column<T> {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: (row: T) => string;
  className?: (row: T) => string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  maxRows?: number;
  title?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns, data, maxRows = 15, title
}: DataTableProps<T>) {
  const rows = data.slice(0, maxRows);

  return (
    <div>
      {title && <h4 className="text-sm font-semibold text-gray-700 mb-2">{title}</h4>}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map((col) => (
                <th key={col.key}
                  className={`px-3 py-2 font-semibold text-gray-600 whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/50">
                {columns.map((col) => (
                  <td key={col.key}
                    className={`px-3 py-1.5 tabular-nums whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    } ${col.className ? col.className(row) : ''}`}>
                    {col.format ? col.format(row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > maxRows && (
        <p className="text-xs text-gray-400 mt-1">
          Hiển thị {maxRows}/{data.length} dòng
        </p>
      )}
    </div>
  );
}

// ─── Progress Bar ───────────────────────────────────────────

interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  label: string;
  showPercent?: boolean;
}

export function ProgressBar({ value, max, color = '#06b6d4', label, showPercent = true }: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span className="tabular-nums font-medium">
          {showPercent ? `${pct.toFixed(1)}%` : value.toLocaleString('vi-VN')}
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
