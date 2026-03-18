'use client';

import type { PivotRow } from '@/lib/phong-hc/types';
import {
  CATEGORY_ICONS,
  CATEGORY_PRIORITY,
  formatNumberFull,
  getChangeArrow,
  getChangeColor,
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
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-30 bg-gray-50 px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider min-w-[260px] max-w-[260px] w-[260px] border-r-2 border-gray-200"
                  style={{ boxShadow: '4px 0 6px -2px rgba(0,0,0,0.06)' }}
                >
                  Nội dung
                </th>
                {timeColumns.map((col) => (
                  <th
                    key={col}
                    className="bg-gray-50 px-3 py-2.5 text-center text-[11px] font-semibold text-gray-500 tracking-wider whitespace-nowrap"
                    style={{ minWidth: showRatio ? '120px' : '90px' }}
                  >
                    {formatTimeColumn(col)}
                  </th>
                ))}
                <th
                  className="sticky right-0 z-30 bg-gray-100 px-3 py-2.5 text-center text-[11px] font-semibold text-gray-600 uppercase tracking-wider min-w-[90px] border-l-2 border-gray-200"
                  style={{ boxShadow: '-4px 0 6px -2px rgba(0,0,0,0.06)' }}
                >
                  Tổng
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const stripeBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40';
                const stickyBg = idx % 2 === 0 ? '#ffffff' : '#fafafa';

                return (
                  <tr
                    key={row.content}
                    className={`border-t border-gray-100 hover:bg-cyan-50/40 transition-colors ${stripeBg}`}
                  >
                    {/* Content name — solid bg to prevent overlap */}
                    <td
                      className="sticky left-0 z-20 px-4 py-2 border-r-2 border-gray-200 min-w-[260px] max-w-[260px] w-[260px]"
                      style={{
                        backgroundColor: stickyBg,
                        boxShadow: '4px 0 6px -2px rgba(0,0,0,0.06)',
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-800 truncate">{row.content}</span>
                        {row.aggregationMethod !== 'sum' && (
                          <span className="flex-shrink-0 text-[9px] text-gray-400 bg-gray-100 px-1 py-px rounded font-medium">
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
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="font-mono text-xs font-semibold text-gray-800 tabular-nums">
                              {formatNumberFull(cell.value)}
                            </span>
                            {showRatio && cell.ratio !== null && cell.ratio !== 0 && (
                              <span
                                className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${getChangeColor(cell.ratio)} tabular-nums`}
                              >
                                {getChangeArrow(cell.ratio)}
                                {cell.ratio === 999 ? '∞' : `${Math.abs(cell.ratio).toFixed(0)}%`}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Total */}
                    <td
                      className="sticky right-0 z-20 px-3 py-2 text-right font-mono text-xs font-bold text-gray-900 bg-gray-50 border-l-2 border-gray-200"
                      style={{ boxShadow: '-4px 0 6px -2px rgba(0,0,0,0.06)' }}
                    >
                      {formatNumberFull(row.total)}
                    </td>
                  </tr>
                );
              })}
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
