'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { PageHeader } from '@/components/ui/PageHeader';
import { FileText, Plus, Search, Eye, Pencil, BarChart3 } from 'lucide-react';

interface Week {
  id: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'COMPLETED';
  reportFileUrl: string | null;
  departmentCount: number;
  taskCount: number;
}

export default function WeeksListPage() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchWeeks();
  }, [selectedYear]);

  const fetchWeeks = async () => {
    try {
      setError('');
      const params = new URLSearchParams();
      if (selectedYear) params.append('year', selectedYear.toString());
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/weeks?${params}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setWeeks(data);
    } catch {
      setError('Không thể tải danh sách báo cáo. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchWeeks();
  };

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);
  const inputClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white transition-colors';

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Danh sách Báo cáo Tuần"
        actions={
          <Link
            href="/dashboard/weeks/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all shadow-sm shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            Tạo báo cáo mới
          </Link>
        }
      />

      {/* Filter Section */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Tìm kiếm</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Nhập số tuần..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${inputClass} pl-9`}
              />
            </div>
          </div>
          <div className="w-48">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Năm</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className={inputClass}
            >
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSearch}
            className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors"
          >
            Tìm kiếm
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex justify-between items-center">
          {error}
          <button onClick={fetchWeeks} className="underline hover:no-underline ml-4">Thử lại</button>
        </div>
      )}

      {/* Weeks Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Đang tải...</p>
        </div>
      ) : weeks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200/80">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-4">Chưa có báo cáo nào</p>
          <Link
            href="/dashboard/weeks/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-cyan-600 hover:to-blue-700"
          >
            <Plus className="w-4 h-4" />
            Tạo báo cáo đầu tiên
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {weeks.map((week) => (
            <div
              key={week.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-slate-900">
                  Tuần {week.weekNumber}
                </h3>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                  week.status === 'COMPLETED'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {week.status === 'COMPLETED' ? 'Hoàn thành' : 'Nháp'}
                </span>
              </div>
              <p className="text-sm text-slate-500 mb-3">
                {format(new Date(week.startDate), 'd/M', { locale: vi })} -{' '}
                {format(new Date(week.endDate), 'd/M/yyyy', { locale: vi })}
              </p>
              <div className="flex items-center gap-4 mb-4 text-sm text-slate-600">
                <span>{week.departmentCount} phòng</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span>{week.taskCount} nhiệm vụ</span>
                {week.reportFileUrl && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span>1 file</span>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/weeks/${week.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100 font-medium text-sm transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Xem
                  </Link>
                  <Link
                    href={`/dashboard/weeks/${week.id}/edit`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium text-sm transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Sửa
                  </Link>
                </div>
                <Link
                  href={`/dashboard/weeks/${week.id}/metrics`}
                  className="flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 font-medium text-sm transition-colors"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Nhập số liệu
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
