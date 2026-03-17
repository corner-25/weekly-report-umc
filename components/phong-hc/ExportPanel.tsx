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
      <h2 className="text-xl font-bold text-gray-800 mb-6">Xuất báo cáo</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pivot table CSV */}
        <div className="border border-gray-100 rounded-lg p-5 hover:border-cyan-200 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center text-cyan-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Pivot Table CSV</h3>
              <p className="text-xs text-gray-500">Bảng tổng hợp theo thời gian</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            {pivotRows.length} nội dung × {timeColumns.length} cột thời gian
          </p>
          <button
            onClick={exportCSV}
            disabled={exporting}
            className="w-full px-4 py-2 bg-cyan-500 text-white text-sm font-medium rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50"
          >
            {exporting ? 'Đang xuất...' : 'Tải Pivot CSV'}
          </button>
        </div>

        {/* Raw data CSV */}
        <div className="border border-gray-100 rounded-lg p-5 hover:border-cyan-200 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">Dữ liệu gốc CSV</h3>
              <p className="text-xs text-gray-500">Dữ liệu chi tiết từng tuần</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            {rawData.length.toLocaleString('vi-VN')} dòng dữ liệu
          </p>
          <button
            onClick={exportRawCSV}
            disabled={exporting}
            className="w-full px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
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
