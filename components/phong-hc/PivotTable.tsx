'use client';

import type { PivotRow } from '@/lib/phong-hc/types';
import {
  CATEGORY_ICONS,
  CATEGORY_PRIORITY,
  formatNumberFull,
  getChangeArrow,
  getChangeColor,
  getChangeBg,
} from '@/lib/phong-hc/data-processing';
import { useState } from 'react';

interface PivotTableProps {
  rows: PivotRow[];
  timeColumns: string[];
  showRatio: boolean;
}

export function PivotTable({ rows, timeColumns, showRatio }: PivotTableProps) {
  const categoryGroups = new Map<string, PivotRow[]>();
  for (const row of rows) {
    if (!categoryGroups.has(row.category)) categoryGroups.set(row.category, []);
    categoryGroups.get(row.category)!.push(row);
  }

  const sortedCategories = Array.from(categoryGroups.keys()).sort(
    (a, b) => (CATEGORY_PRIORITY[a] ?? 999) - (CATEGORY_PRIORITY[b] ?? 999)
  );

  return (
    <div className="space-y-4">
      {sortedCategories.map((category) => (
        <CategorySection
          key={category}
          category={category}
          rows={categoryGroups.get(category)!}
          timeColumns={timeColumns}
          showRatio={showRatio}
        />
      ))}
    </div>
  );
}

function CategorySection({
  category,
  rows,
  timeColumns,
  showRatio,
}: {
  category: string;
  rows: PivotRow[];
  timeColumns: string[];
  showRatio: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const icon = CATEGORY_ICONS[category] ?? '📁';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Category Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <h3 className="text-sm font-semibold text-gray-900">{category}</h3>
          <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full tabular-nums">
            {rows.length}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Table */}
      {isExpanded && (
        <div className="overflow-x-auto border-t border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80">
                <th className="sticky left-0 z-20 bg-gray-50 px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider min-w-[240px] border-r border-gray-200">
                  Nội dung
                </th>
                {timeColumns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-center text-[11px] font-semibold text-gray-500 tracking-wider min-w-[100px] whitespace-nowrap"
                  >
                    {formatTimeColumn(col)}
                  </th>
                ))}
                <th className="sticky right-0 z-20 bg-gray-100 px-3 py-2 text-center text-[11px] font-semibold text-gray-600 uppercase tracking-wider min-w-[90px] border-l border-gray-200">
                  Tổng
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={row.content}
                  className={`border-t border-gray-50 hover:bg-cyan-50/30 transition-colors ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'
                  }`}
                >
                  {/* Content name */}
                  <td className="sticky left-0 z-10 px-4 py-2 text-gray-800 border-r border-gray-100 bg-inherit min-w-[240px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">{row.content}</span>
                      {row.aggregationMethod !== 'sum' && (
                        <span className="text-[9px] text-gray-400 bg-gray-100 px-1 py-px rounded font-medium">
                          {row.aggregationMethod === 'mean' ? 'TB' : 'MN'}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Value cells */}
                  {timeColumns.map((col) => {
                    const cell = row.cells[col];
                    if (!cell) {
                      return (
                        <td key={col} className="px-3 py-2 text-center text-gray-300 text-xs">
                          —
                        </td>
                      );
                    }

                    return (
                      <td key={col} className="px-3 py-2 text-right whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-gray-800">
                          {formatNumberFull(cell.value)}
                        </span>
                        {showRatio && cell.ratio !== null && cell.ratio !== 0 && (
                          <span
                            className={`ml-1 text-[10px] font-medium ${getChangeColor(cell.ratio)} ${getChangeBg(cell.ratio)} px-1 py-px rounded`}
                          >
                            {getChangeArrow(cell.ratio)}
                            {cell.ratio === 999 ? '∞' : `${Math.abs(cell.ratio).toFixed(0)}%`}
                          </span>
                        )}
                      </td>
                    );
                  })}

                  {/* Total */}
                  <td className="sticky right-0 z-10 px-3 py-2 text-right font-mono text-xs font-bold text-gray-900 bg-gray-50 border-l border-gray-200">
                    {formatNumberFull(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatTimeColumn(col: string): string {
  const weekMatch = col.match(/^\d{4}-W(\d{2})$/);
  if (weekMatch) return `W${parseInt(weekMatch[1])}`;

  const monthMatch = col.match(/^T(\d+)\/(\d{4})$/);
  if (monthMatch) return `T${monthMatch[1]}/${monthMatch[2].slice(2)}`;

  return col;
}
