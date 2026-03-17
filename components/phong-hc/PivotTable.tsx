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
  // Group rows by category
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
        className="w-full flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-slate-50 to-white hover:from-slate-100 transition-all"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{icon}</span>
          <h3 className="text-base font-bold text-gray-800">{category}</h3>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {rows.length} mục
          </span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Table */}
      {isExpanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-t border-gray-100">
                <th className="sticky left-0 z-20 bg-gray-50 px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[260px] border-r border-gray-200">
                  Nội dung
                </th>
                {timeColumns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[120px] whitespace-nowrap"
                  >
                    {formatTimeColumn(col)}
                  </th>
                ))}
                <th className="sticky right-0 z-20 bg-gray-100 px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[100px] border-l border-gray-200">
                  Tổng
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row, idx) => (
                <tr key={row.content} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                  {/* Content name - sticky left */}
                  <td className="sticky left-0 z-10 px-4 py-2.5 font-medium text-gray-800 border-r border-gray-100 bg-inherit min-w-[260px]">
                    <span className="text-sm">{row.content}</span>
                    {row.aggregationMethod !== 'sum' && (
                      <span className="ml-1.5 text-[10px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded">
                        {row.aggregationMethod === 'mean' ? 'TB' : 'MN'}
                      </span>
                    )}
                  </td>

                  {/* Value cells */}
                  {timeColumns.map((col) => {
                    const cell = row.cells[col];
                    if (!cell) {
                      return (
                        <td key={col} className="px-3 py-2.5 text-center text-gray-300">
                          —
                        </td>
                      );
                    }

                    return (
                      <td key={col} className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span className="font-mono text-sm font-semibold text-gray-700">
                          {formatNumberFull(cell.value)}
                        </span>
                        {showRatio && cell.ratio !== null && cell.ratio !== 0 && (
                          <span
                            className={`ml-1 text-[11px] font-medium ${getChangeColor(cell.ratio)} ${getChangeBg(cell.ratio)} px-1 py-0.5 rounded`}
                          >
                            {getChangeArrow(cell.ratio)}
                            {cell.ratio === 999 ? '∞' : `${Math.abs(cell.ratio).toFixed(1)}%`}
                          </span>
                        )}
                      </td>
                    );
                  })}

                  {/* Total - sticky right */}
                  <td className="sticky right-0 z-10 px-4 py-2.5 text-right font-mono text-sm font-bold text-gray-800 bg-gray-50 border-l border-gray-200">
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
  // "2026-W05" → "W5"
  const weekMatch = col.match(/^\d{4}-W(\d{2})$/);
  if (weekMatch) return `W${parseInt(weekMatch[1])}`;

  // "T3/2026" → "T3/26"
  const monthMatch = col.match(/^T(\d+)\/(\d{4})$/);
  if (monthMatch) return `T${monthMatch[1]}/${monthMatch[2].slice(2)}`;

  return col;
}
