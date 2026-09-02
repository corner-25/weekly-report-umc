'use client';

import { useState, useEffect } from 'react';
import { Cake } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';

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
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');

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
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <PageHeader
        icon={Cake}
        title="Sinh nhật thư ký"
        description={
          period === 'today' ? 'Sinh nhật hôm nay' :
          period === 'week' ? 'Sinh nhật trong 7 ngày tới' :
          `Sinh nhật ${monthNames[currentMonth]}`
        }
        className="mb-6"
        actions={
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setPeriod('today')}
              className={`px-4 py-2 text-sm rounded-xl transition-colors ${
                period === 'today'
                  ? 'bg-white text-cyan-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hôm nay
            </button>
            <button
              onClick={() => setPeriod('week')}
              className={`px-4 py-2 text-sm rounded-xl transition-colors ${
                period === 'week'
                  ? 'bg-white text-cyan-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tuần này
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-4 py-2 text-sm rounded-xl transition-colors ${
                period === 'month'
                  ? 'bg-white text-cyan-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tháng này
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-semibold text-slate-900">{secretaries.length}</div>
              <div className="text-sm text-slate-500">
                {period === 'today' && 'Sinh nhật hôm nay'}
                {period === 'week' && 'Sinh nhật tuần này'}
                {period === 'month' && 'Sinh nhật tháng này'}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-semibold text-slate-900">
                {secretaries.filter(s => s.isToday).length}
              </div>
              <div className="text-sm text-slate-500">Sinh nhật hôm nay</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-semibold text-slate-900">{monthNames[currentMonth]}</div>
              <div className="text-sm text-slate-500">Tháng hiện tại</div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">Đang tải...</div>
      ) : secretaries.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-10 text-center">
          <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
          </svg>
          <p className="text-slate-500">
            {period === 'today' && 'Không có ai sinh nhật hôm nay'}
            {period === 'week' && 'Không có sinh nhật trong tuần này'}
            {period === 'month' && 'Không có sinh nhật trong tháng này'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {secretaries.map((secretary) => (
            <div
              key={secretary.id}
              className={`p-4 flex items-center gap-4 transition-colors hover:bg-slate-50 ${secretary.isToday ? 'bg-rose-50/50' : ''}`}
            >
              <div className="w-14 flex-shrink-0 text-center border-r border-slate-100 pr-4">
                <div className="text-xl font-semibold text-slate-900">{secretary.birthdayDay}</div>
                <div className="text-xs uppercase tracking-wide text-slate-400">Tháng {secretary.birthdayMonth}</div>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-semibold flex-shrink-0">
                      {secretary.avatar ? (
                  <img src={secretary.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        secretary.fullName.charAt(0).toUpperCase()
                      )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2"><h3 className="font-medium text-slate-900 truncate">{secretary.fullName}</h3>{secretary.isToday && <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-medium">Hôm nay</span>}</div>
                <p className="text-sm text-slate-500 truncate">{secretary.currentDepartment?.name || 'Chưa phân công'} · {secretary.secretaryType?.name || 'Chưa phân loại'}</p>
              </div>
              <div className="hidden sm:block text-right flex-shrink-0">
                <div className="text-sm font-medium text-slate-700">Tròn {secretary.age} tuổi</div>
                <div className="text-xs text-slate-400">{secretary.email || 'Chưa có email'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
