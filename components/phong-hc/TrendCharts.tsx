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
  const [numCols, setNumCols] = useState(2);

  // Group rows by category
  const categoryGroups = new Map<string, PivotRow[]>();
  for (const row of rows) {
    if (!categoryGroups.has(row.category)) categoryGroups.set(row.category, []);
    categoryGroups.get(row.category)!.push(row);
  }

  const sortedCategories = Array.from(categoryGroups.keys()).sort(
    (a, b) => (CATEGORY_PRIORITY[a] ?? 999) - (CATEGORY_PRIORITY[b] ?? 999)
  );

  // Reverse timeColumns for charts (oldest first = left to right)
  const chronoColumns = [...timeColumns].reverse();

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center gap-4 bg-white rounded-lg border border-gray-200 p-4">
        <label className="text-sm font-medium text-gray-600">Số cột:</label>
        <div className="flex gap-1">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => setNumCols(n)}
              className={`px-3 py-1 text-sm rounded-md transition-all ${
                numCols === n
                  ? 'bg-cyan-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Category sections */}
      {sortedCategories.map((category) => {
        const catRows = categoryGroups.get(category)!;
        const icon = CATEGORY_ICONS[category] ?? '📁';

        return (
          <div
            key={category}
            className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
          >
            <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-white border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <span>{icon}</span>
                {category}
              </h3>
            </div>

            <div
              className="p-4 gap-4"
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

  // Find max/min indices
  const maxIdx = values.indexOf(Math.max(...values));
  const minIdx = values.indexOf(Math.min(...values.filter((v) => v > 0)));

  // Trend direction
  const lastTwo = values.filter((v) => v > 0).slice(-2);
  const trend = lastTwo.length === 2 ? (lastTwo[1] >= lastTwo[0] ? 'up' : 'down') : 'flat';

  return (
    <div className="border border-gray-100 rounded-lg p-3 hover:border-cyan-200 hover:shadow-sm transition-all">
      {/* Title */}
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-700 truncate flex-1" title={row.content}>
          {row.content}
        </h4>
        <span
          className={`text-xs font-bold ml-2 ${
            trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400'
          }`}
        >
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
        </span>
      </div>

      {/* SVG Bar chart */}
      <div className="relative h-14">
        <svg viewBox={`0 0 ${values.length * 20} 50`} className="w-full h-full" preserveAspectRatio="none">
          {values.map((val, i) => {
            const barHeight = max > 0 ? (val / max) * 40 : 0;
            const isMax = i === maxIdx && val > 0;
            const isMin = i === minIdx && val > 0;

            return (
              <rect
                key={i}
                x={i * 20 + 2}
                y={50 - barHeight - 5}
                width={16}
                height={barHeight}
                rx={2}
                className={
                  isMax
                    ? 'fill-emerald-400'
                    : isMin
                    ? 'fill-red-400'
                    : 'fill-cyan-300'
                }
                opacity={val === 0 ? 0.15 : 0.7}
              />
            );
          })}
          {/* Trend line */}
          {values.length > 1 && (
            <polyline
              points={values
                .map(
                  (val, i) =>
                    `${i * 20 + 10},${50 - (max > 0 ? (val / max) * 40 : 0) - 5}`
                )
                .join(' ')}
              fill="none"
              stroke="#0891b2"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.6"
            />
          )}
        </svg>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-gray-400">
        <span>Tổng: <span className="font-semibold text-gray-600">{formatNumberFull(row.total)}</span></span>
        <span>TB: <span className="font-semibold text-gray-600">{formatNumberFull(avg)}</span></span>
      </div>
    </div>
  );
}
