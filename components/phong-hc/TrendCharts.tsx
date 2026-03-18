'use client';

import { useState } from 'react';
import type { PivotRow } from '@/lib/phong-hc/types';
import {
  CATEGORY_ICONS,
  CATEGORY_PRIORITY,
  formatNumberFull,
} from '@/lib/phong-hc/data-processing';

interface TrendChartsProps {
  rows: PivotRow[];
  timeColumns: string[];
}

export function TrendCharts({ rows, timeColumns }: TrendChartsProps) {
  const [numCols, setNumCols] = useState(3);

  const categoryGroups = new Map<string, PivotRow[]>();
  for (const row of rows) {
    if (!categoryGroups.has(row.category)) categoryGroups.set(row.category, []);
    categoryGroups.get(row.category)!.push(row);
  }

  const sortedCategories = Array.from(categoryGroups.keys()).sort(
    (a, b) => (CATEGORY_PRIORITY[a] ?? 999) - (CATEGORY_PRIORITY[b] ?? 999)
  );

  const chronoColumns = [...timeColumns].reverse();

  return (
    <div className="space-y-4">
      {/* Layout controls */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Bố cục:</span>
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => setNumCols(n)}
            className={`w-7 h-7 text-xs font-medium rounded-md transition-all ${
              numCols === n
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      {sortedCategories.map((category) => {
        const catRows = categoryGroups.get(category)!;
        const icon = CATEGORY_ICONS[category] ?? '📁';

        return (
          <div
            key={category}
            className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <span className="text-lg">{icon}</span>
                {category}
              </h3>
            </div>

            <div
              className="p-3 gap-3"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${numCols}, 1fr)`,
              }}
            >
              {catRows.map((row) => (
                <MiniChart
                  key={row.content}
                  row={row}
                  timeColumns={chronoColumns}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniChart({
  row,
  timeColumns,
}: {
  row: PivotRow;
  timeColumns: string[];
}) {
  const values = timeColumns.map((col) => row.cells[col]?.value ?? 0);
  const max = Math.max(...values, 1);
  const nonZeroValues = values.filter((v) => v > 0);
  const avg = nonZeroValues.length > 0
    ? nonZeroValues.reduce((s, v) => s + v, 0) / nonZeroValues.length
    : 0;

  const lastTwo = nonZeroValues.slice(-2);
  const trend = lastTwo.length === 2 ? (lastTwo[1] >= lastTwo[0] ? 'up' : 'down') : 'flat';

  const barWidth = Math.max(4, Math.min(12, Math.floor(200 / values.length)));
  const gap = Math.max(1, Math.floor(barWidth * 0.25));
  const svgWidth = values.length * (barWidth + gap);

  return (
    <div className="border border-gray-100 rounded-lg p-3 hover:border-gray-200 hover:shadow-sm transition-all group">
      {/* Title row */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[11px] font-medium text-gray-700 truncate flex-1 leading-tight" title={row.content}>
          {row.content}
        </h4>
        <span
          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ml-1.5 ${
            trend === 'up'
              ? 'bg-emerald-50 text-emerald-500'
              : trend === 'down'
              ? 'bg-red-50 text-red-500'
              : 'bg-gray-50 text-gray-400'
          }`}
        >
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
        </span>
      </div>

      {/* Chart */}
      <div className="relative h-10 mb-2">
        <svg viewBox={`0 0 ${svgWidth} 40`} className="w-full h-full" preserveAspectRatio="none">
          {values.map((val, i) => {
            const barHeight = max > 0 ? (val / max) * 32 : 0;
            return (
              <rect
                key={i}
                x={i * (barWidth + gap)}
                y={40 - barHeight - 2}
                width={barWidth}
                height={Math.max(barHeight, 0.5)}
                rx={1.5}
                className={val === 0 ? 'fill-gray-100' : 'fill-gray-300 group-hover:fill-cyan-400'}
                style={{ transition: 'fill 0.2s' }}
              />
            );
          })}
          {/* Trend line */}
          {values.length > 1 && (
            <polyline
              points={values
                .map(
                  (val, i) =>
                    `${i * (barWidth + gap) + barWidth / 2},${40 - (max > 0 ? (val / max) * 32 : 0) - 2}`
                )
                .join(' ')}
              fill="none"
              stroke="#0e7490"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.4"
              className="group-hover:opacity-70"
              style={{ transition: 'opacity 0.2s' }}
            />
          )}
        </svg>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span>Tổng <span className="font-semibold text-gray-600 tabular-nums">{formatNumberFull(row.total)}</span></span>
        <span>TB <span className="font-semibold text-gray-600 tabular-nums">{formatNumberFull(avg)}</span></span>
      </div>
    </div>
  );
}
