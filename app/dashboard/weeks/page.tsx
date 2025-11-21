'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

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
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchWeeks();
  }, [selectedYear]);

  const fetchWeeks = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedYear) {
        params.append('year', selectedYear.toString());
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`/api/weeks?${params}`);
      if (response.ok) {
        const data = await response.json();
        setWeeks(data);
      }
    } catch (error) {
      console.error('Error fetching weeks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchWeeks();
  };

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Danh sách Báo cáo Tuần
        </h1>
        <Link
          href="/dashboard/weeks/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
        >
          + Tạo báo cáo mới
        </Link>
      </div>

      {/* Filter Section */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tìm kiếm
            </label>
            <input
              type="text"
              placeholder="Nhập số tuần..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Năm
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Tìm kiếm
          </button>
        </div>
      </div>

      {/* Weeks Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Đang tải...</p>
        </div>
      ) : weeks.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">Chưa có báo cáo nào</p>
          <Link
            href="/dashboard/weeks/new"
            className="mt-4 inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Tạo báo cáo đầu tiên
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {weeks.map((week) => (
            <div
              key={week.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">
                  Tuần {week.weekNumber}
                </h3>
                {week.status === 'COMPLETED' ? (
                  <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded">
                    Hoàn thành
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-100 rounded">
                    Nháp
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {format(new Date(week.startDate), 'd/M', { locale: vi })} -{' '}
                {format(new Date(week.endDate), 'd/M/yyyy', { locale: vi })}
              </p>
              <div className="space-y-2 mb-4 text-sm text-gray-700">
                <p>{week.departmentCount} phòng</p>
                <p>{week.taskCount} nhiệm vụ</p>
                {week.reportFileUrl && <p>1 file</p>}
              </div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Link
                    href={`/dashboard/weeks/${week.id}`}
                    className="flex-1 text-center px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 font-medium text-sm"
                  >
                    Xem
                  </Link>
                  <Link
                    href={`/dashboard/weeks/${week.id}/edit`}
                    className="flex-1 text-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium text-sm"
                  >
                    Sửa
                  </Link>
                </div>
                <Link
                  href={`/dashboard/weeks/${week.id}/metrics`}
                  className="block w-full text-center px-3 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 font-medium text-sm"
                >
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
