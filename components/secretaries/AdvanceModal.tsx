'use client';

import { useState } from 'react';

interface Application {
  id: string;
  fullName: string;
  status: string;
  appliedType: { id: string; name: string } | null;
  desiredDepartment: { id: string; name: string } | null;
}

interface Props {
  application: Application;
  action: 'INTERVIEW' | 'ACCEPTED' | 'REJECTED';
  departments: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}

const ACTION_LABEL: Record<string, string> = {
  INTERVIEW: 'Chuyển sang Phỏng vấn',
  ACCEPTED: 'Nhận việc',
  REJECTED: 'Từ chối',
};

const ACTION_COLOR: Record<string, string> = {
  INTERVIEW: 'bg-blue-600 hover:bg-blue-700',
  ACCEPTED: 'bg-green-600 hover:bg-green-700',
  REJECTED: 'bg-red-600 hover:bg-red-700',
};

export function AdvanceModal({ application, action, departments, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewScore, setInterviewScore] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');
  const [departmentId, setDepartmentId] = useState(application.desiredDepartment?.id || '');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [rejectionNotes, setRejectionNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/secretary-applications/${application.id}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          interviewDate: interviewDate || null,
          interviewScore: interviewScore || null,
          interviewNotes: interviewNotes || null,
          departmentId: departmentId || null,
          startDate: startDate || null,
          rejectionNotes: rejectionNotes || null,
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const err = await res.json();
        alert(err.error || 'Có lỗi xảy ra');
      }
    } catch {
      alert('Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{ACTION_LABEL[action]}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Ứng viên: <span className="font-semibold text-gray-900">{application.fullName}</span>
          </p>

          {action === 'INTERVIEW' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày phỏng vấn</label>
                <input
                  type="date"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Điểm đánh giá (0–10)</label>
                <input
                  type="number"
                  min="0" max="10" step="0.1"
                  placeholder="Để trống nếu chưa có"
                  value={interviewScore}
                  onChange={(e) => setInterviewScore(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú phỏng vấn</label>
                <textarea
                  rows={3}
                  value={interviewNotes}
                  onChange={(e) => setInterviewNotes(e.target.value)}
                  placeholder="Nhận xét, lưu ý..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </>
          )}

          {action === 'ACCEPTED' && (
            <>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                Ứng viên sẽ được tự động tạo hồ sơ Thư ký sau khi nhận việc.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban phân công</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">-- Chọn phòng ban --</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu làm việc</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </>
          )}

          {action === 'REJECTED' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lý do từ chối (tuỳ chọn)</label>
              <textarea
                rows={3}
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                placeholder="Nhập lý do từ chối..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${ACTION_COLOR[action]}`}
            >
              {loading ? 'Đang xử lý...' : ACTION_LABEL[action]}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
