'use client';

import { useState } from 'react';
import type { PivotRow } from '@/lib/phong-hc/types';
import type { ProcessedRow } from '@/lib/phong-hc/types';

interface ExportPanelProps {
  pivotRows: PivotRow[];
  timeColumns: string[];
  rawData: ProcessedRow[];
}

export function ExportPanel({ pivotRows, timeColumns, rawData }: ExportPanelProps) {
  const [exporting, setExporting] = useState(false);

  const exportCSV = () => {
    setExporting(true);
    try {
      const headers = ['Danh mục', 'Nội dung', ...timeColumns, 'Tổng'];
      const csvRows = [headers.join(',')];

      for (const row of pivotRows) {
        const values = [
          `"${row.category}"`,
          `"${row.content}"`,
          ...timeColumns.map((col) => {
            const cell = row.cells[col];
            return cell ? String(Math.round(cell.value)) : '0';
          }),
          String(Math.round(row.total)),
        ];
        csvRows.push(values.join(','));
      }

      const bom = '\uFEFF';
      const blob = new Blob([bom + csvRows.join('\n')], {
        type: 'text/csv;charset=utf-8;',
      });
      downloadBlob(blob, `phong-hc-report-${formatDate()}.csv`);
    } finally {
      setExporting(false);
    }
  };

  const exportRawCSV = () => {
    setExporting(true);
    try {
      const headers = ['Danh mục', 'Nội dung', 'Năm', 'Tháng', 'Tuần', 'Số liệu'];
      const csvRows = [headers.join(',')];

      for (const row of rawData) {
        csvRows.push(
          [
            `"${row['Danh mục']}"`,
            `"${row['Nội dung']}"`,
            row['Năm'],
            row['Tháng'],
            row['Tuần'],
            row['Số liệu'],
          ].join(',')
        );
      }

      const bom = '\uFEFF';
      const blob = new Blob([bom + csvRows.join('\n')], {
        type: 'text/csv;charset=utf-8;',
      });
      downloadBlob(blob, `phong-hc-data-${formatDate()}.csv`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-1">Xuất báo cáo</h2>
      <p className="text-xs text-gray-400 mb-6">Tải dữ liệu dưới dạng CSV để sử dụng trong Excel</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pivot CSV */}
        <div className="border border-gray-100 rounded-xl p-5 hover:border-gray-200 hover:shadow-sm transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5c0 .621-.504 1.125-1.125 1.125" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Bảng tổng hợp</h3>
              <p className="text-[11px] text-gray-400">Pivot table theo thời gian</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4 tabular-nums">
            {pivotRows.length} nội dung × {timeColumns.length} cột
          </p>
          <button
            onClick={exportCSV}
            disabled={exporting}
            className="w-full px-4 py-2.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {exporting ? 'Đang xuất...' : 'Tải Pivot CSV'}
          </button>
        </div>

        {/* Raw CSV */}
        <div className="border border-gray-100 rounded-xl p-5 hover:border-gray-200 hover:shadow-sm transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Dữ liệu gốc</h3>
              <p className="text-[11px] text-gray-400">Chi tiết từng tuần</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4 tabular-nums">
            {rawData.length.toLocaleString('vi-VN')} dòng
          </p>
          <button
            onClick={exportRawCSV}
            disabled={exporting}
            className="w-full px-4 py-2.5 bg-white text-gray-700 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {exporting ? 'Đang xuất...' : 'Tải dữ liệu gốc'}
          </button>
        </div>
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDate(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
}
