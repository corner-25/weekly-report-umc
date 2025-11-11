'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import MetricsInput from '@/components/MetricsInput';

interface Week {
  id: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
}

interface MetricValue {
  metricId: string;
  value: number;
  note?: string;
}

export default function WeekMetricsPage() {
  const params = useParams();
  const router = useRouter();
  const weekId = params.id as string;

  const [week, setWeek] = useState<Week | null>(null);
  const [metricValues, setMetricValues] = useState<MetricValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchWeek();
  }, [weekId]);

  const fetchWeek = async () => {
    try {
      const response = await fetch(`/api/weeks/${weekId}`);
      if (response.ok) {
        const data = await response.json();
        setWeek(data);
      } else {
        setError('Không tìm thấy tuần báo cáo');
      }
    } catch (error) {
      console.error('Error fetching week:', error);
      setError('Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      // Save all metric values
      const promises = metricValues.map((value) =>
        fetch('/api/week-metrics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...value,
            weekId,
          }),
        })
      );

      const results = await Promise.all(promises);
      const allSuccess = results.every((r) => r.ok);

      if (allSuccess) {
        setSuccess(`Đã lưu ${metricValues.length} chỉ số thành công!`);
        setTimeout(() => {
          router.push('/dashboard/weeks');
        }, 1500);
      } else {
        setError('Có lỗi khi lưu một số chỉ số');
      }
    } catch (error) {
      console.error('Error saving metrics:', error);
      setError('Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  if (!week) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error || 'Không tìm thấy tuần báo cáo'}</p>
        <Link
          href="/dashboard/weeks"
          className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Quay lại
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link href="/dashboard/weeks" className="text-blue-600 hover:text-blue-800">
          ← Quay lại Báo cáo tuần
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Nhập Số liệu - Tuần {week.weekNumber}/{week.year}
        </h1>
        <p className="text-gray-600 mt-2">
          Nhập các chỉ số định lượng cho tuần này
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Metrics Input Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <MetricsInput
          weekId={weekId}
          onChange={(values) => setMetricValues(values)}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <Link
          href="/dashboard/weeks"
          className="px-6 py-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
        >
          Hủy
        </Link>
        <button
          onClick={handleSave}
          disabled={saving || metricValues.length === 0}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Đang lưu...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Lưu số liệu ({metricValues.length})
            </>
          )}
        </button>
      </div>
    </div>
  );
}
