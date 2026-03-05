'use client';

import { useState, useEffect } from 'react';

interface BirthdaySecretary {
  id: string;
  fullName: string;
  dateOfBirth: string;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  age: number;
  birthdayDay: number;
  birthdayMonth: number;
  isToday: boolean;
  secretaryType: { id: string; name: string; color: string | null } | null;
  currentDepartment: { id: string; name: string } | null;
}

export default function SecretaryBirthdaysPage() {
  const [secretaries, setSecretaries] = useState<BirthdaySecretary[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('month');

  const fetchBirthdays = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/secretaries/birthdays?period=${period}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setSecretaries(data);
      } else {
        setSecretaries([]);
      }
    } catch (error) {
      console.error('Error fetching birthdays:', error);
      setSecretaries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBirthdays();
  }, [period]);

  const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];

  const currentMonth = new Date().getMonth();

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sinh nhật thư ký</h1>
            <p className="text-gray-500 mt-1">
              {period === 'today' && 'Sinh nhật hôm nay'}
              {period === 'week' && 'Sinh nhật trong 7 ngày tới'}
              {period === 'month' && `Sinh nhật ${monthNames[currentMonth]}`}
            </p>
          </div>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setPeriod('today')}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                period === 'today'
                  ? 'bg-white text-cyan-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                period === 'week'
                  ? 'bg-white text-cyan-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tuần này
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                period === 'month'
                  ? 'bg-white text-cyan-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tháng này
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-lg shadow-sm p-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
              </svg>
            </div>
            <div>
              <div className="text-3xl font-bold">{secretaries.length}</div>
              <div className="text-sm text-white/80">
                {period === 'today' && 'Sinh nhật hôm nay'}
                {period === 'week' && 'Sinh nhật tuần này'}
                {period === 'month' && 'Sinh nhật tháng này'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-cyan-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {secretaries.filter(s => s.isToday).length}
              </div>
              <div className="text-sm text-gray-500">Sinh nhật hôm nay</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{monthNames[currentMonth]}</div>
              <div className="text-sm text-gray-500">Tháng hiện tại</div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">Đang tải...</div>
      ) : secretaries.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
          </svg>
          <p className="text-gray-500">
            {period === 'today' && 'Không có ai sinh nhật hôm nay'}
            {period === 'week' && 'Không có sinh nhật trong tuần này'}
            {period === 'month' && 'Không có sinh nhật trong tháng này'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {secretaries.map((secretary) => (
            <div
              key={secretary.id}
              className={`bg-white rounded-lg shadow-sm border overflow-hidden transition-all hover:shadow-md ${
                secretary.isToday ? 'border-pink-300 ring-2 ring-pink-100' : 'border-gray-200'
              }`}
            >
              {secretary.isToday && (
                <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white text-center py-1 text-sm font-medium">
                  Sinh nhật hôm nay!
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 font-bold text-xl">
                      {secretary.avatar ? (
                        <img src={secretary.avatar} alt="" className="w-14 h-14 rounded-full object-cover" />
                      ) : (
                        secretary.fullName.charAt(0).toUpperCase()
                      )}
                    </div>
                    {secretary.isToday && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-pink-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">🎂</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{secretary.fullName}</h3>
                    <p className="text-sm text-gray-500">
                      {secretary.currentDepartment?.name || 'Chưa phân công'}
                    </p>
                    {secretary.secretaryType && (
                      <span
                        className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full"
                        style={{
                          backgroundColor: secretary.secretaryType.color ? `${secretary.secretaryType.color}20` : '#e5e7eb',
                          color: secretary.secretaryType.color || '#374151'
                        }}
                      >
                        {secretary.secretaryType.name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-gray-900">
                      {secretary.birthdayDay}/{secretary.birthdayMonth}
                    </div>
                    <div className="text-sm text-gray-500">Tròn {secretary.age} tuổi</div>
                  </div>
                  {(secretary.phone || secretary.email) && (
                    <div className="text-right text-sm">
                      {secretary.phone && <div className="text-gray-600">{secretary.phone}</div>}
                      {secretary.email && <div className="text-gray-500 text-xs">{secretary.email}</div>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
