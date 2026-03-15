'use client';

import { useState, useEffect } from 'react';
import { ApplicationForm } from '@/components/secretaries/ApplicationForm';
import { AdvanceModal } from '@/components/secretaries/AdvanceModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface Application {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  phone: string | null;
  email: string | null;
  cvUrl: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  interviewDate: string | null;
  interviewScore: number | null;
  interviewNotes: string | null;
  appliedType: { id: string; name: string; color: string | null } | null;
  desiredDepartment: { id: string; name: string } | null;
  convertedSecretary: { id: string; fullName: string } | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SCREENING: { label: 'Sơ tuyển', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  INTERVIEW: { label: 'Phỏng vấn', color: 'text-blue-700', bg: 'bg-blue-100' },
  ACCEPTED: { label: 'Nhận việc', color: 'text-green-700', bg: 'bg-green-100' },
  REJECTED: { label: 'Từ chối', color: 'text-red-700', bg: 'bg-red-100' },
};

const ALL_TABS = ['ALL', 'SCREENING', 'INTERVIEW', 'ACCEPTED', 'REJECTED'] as const;
const TAB_LABEL: Record<string, string> = {
  ALL: 'Tất cả',
  SCREENING: 'Sơ tuyển',
  INTERVIEW: 'Phỏng vấn',
  ACCEPTED: 'Nhận việc',
  REJECTED: 'Từ chối',
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [types, setTypes] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [advanceTarget, setAdvanceTarget] = useState<{ app: Application; action: 'INTERVIEW' | 'ACCEPTED' | 'REJECTED' } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const fetchApplications = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (activeTab !== 'ALL') params.append('status', activeTab);
      const res = await fetch(`/api/secretary-applications?${params}`);
      const data = await res.json();
      setApplications(Array.isArray(data) ? data : []);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.all([
      fetch('/api/secretary-types').then((r) => r.json()),
      fetch('/api/departments').then((r) => r.json()),
    ]).then(([t, d]) => {
      setTypes(Array.isArray(t) ? t : []);
      setDepartments(Array.isArray(d) ? d : []);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchApplications();
  }, [activeTab, search]);

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    await fetch(`/api/secretary-applications/${deleteTargetId}`, { method: 'DELETE' });
    setDeleteTargetId(null);
    fetchApplications();
  };

  const stats = {
    total: applications.length,
    SCREENING: applications.filter((a) => a.status === 'SCREENING').length,
    INTERVIEW: applications.filter((a) => a.status === 'INTERVIEW').length,
    ACCEPTED: applications.filter((a) => a.status === 'ACCEPTED').length,
    REJECTED: applications.filter((a) => a.status === 'REJECTED').length,
  };

  // Count from full data (independent of filter)
  const [allStats, setAllStats] = useState({ total: 0, SCREENING: 0, INTERVIEW: 0, ACCEPTED: 0, REJECTED: 0 });
  useEffect(() => {
    fetch('/api/secretary-applications').then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) {
        setAllStats({
          total: data.length,
          SCREENING: data.filter((a: Application) => a.status === 'SCREENING').length,
          INTERVIEW: data.filter((a: Application) => a.status === 'INTERVIEW').length,
          ACCEPTED: data.filter((a: Application) => a.status === 'ACCEPTED').length,
          REJECTED: data.filter((a: Application) => a.status === 'REJECTED').length,
        });
      }
    });
  }, [applications]);

  return (
    <div className="p-6">
      <ConfirmDialog
        open={!!deleteTargetId}
        title="Xác nhận xóa"
        message="Bạn có chắc muốn xóa hồ sơ này?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hồ sơ ứng tuyển</h1>
          <p className="text-gray-500 mt-1">Quản lý pipeline tuyển dụng thư ký</p>
        </div>
        <button
          onClick={() => { setEditingApp(null); setShowForm(true); }}
          className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Thêm hồ sơ
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { key: 'total', label: 'Tổng cộng', color: 'text-gray-700', val: allStats.total },
          { key: 'SCREENING', label: 'Sơ tuyển', color: 'text-yellow-600', val: allStats.SCREENING },
          { key: 'INTERVIEW', label: 'Phỏng vấn', color: 'text-blue-600', val: allStats.INTERVIEW },
          { key: 'ACCEPTED', label: 'Nhận việc', color: 'text-green-600', val: allStats.ACCEPTED },
          { key: 'REJECTED', label: 'Từ chối', color: 'text-red-600', val: allStats.REJECTED },
        ].map((s) => (
          <div key={s.key} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-sm text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-1 px-4 pt-3 border-b border-gray-200 overflow-x-auto">
          {ALL_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {TAB_LABEL[tab]}
            </button>
          ))}
        </div>
        <div className="p-4">
          <input
            type="text"
            placeholder="Tìm theo tên, email, SĐT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">Đang tải...</div>
      ) : applications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500">Không có hồ sơ nào</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ứng viên</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Loại TK</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phòng mong muốn</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nguồn</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Trạng thái</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ngày nộp</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {applications.map((app) => {
                const st = STATUS_CONFIG[app.status];
                const isExpanded = expandedId === app.id;
                return (
                  <>
                    <tr key={app.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : app.id)}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{app.fullName}</div>
                        <div className="text-xs text-gray-500">{app.email || app.phone || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{app.appliedType?.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{app.desiredDepartment?.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{app.source || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(app.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {/* Action buttons tùy theo trạng thái */}
                          {app.status === 'SCREENING' && (
                            <>
                              <button
                                onClick={() => setAdvanceTarget({ app, action: 'INTERVIEW' })}
                                className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                                title="Chuyển sang phỏng vấn"
                              >
                                → PV
                              </button>
                              <button
                                onClick={() => setAdvanceTarget({ app, action: 'REJECTED' })}
                                className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100"
                                title="Từ chối"
                              >
                                Từ chối
                              </button>
                            </>
                          )}
                          {app.status === 'INTERVIEW' && (
                            <>
                              <button
                                onClick={() => setAdvanceTarget({ app, action: 'ACCEPTED' })}
                                className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100"
                                title="Nhận việc"
                              >
                                Nhận việc
                              </button>
                              <button
                                onClick={() => setAdvanceTarget({ app, action: 'REJECTED' })}
                                className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100"
                                title="Từ chối"
                              >
                                Từ chối
                              </button>
                            </>
                          )}
                          {app.status === 'ACCEPTED' && app.convertedSecretary && (
                            <span className="text-xs text-green-600">✓ Đã tạo TK</span>
                          )}
                          <button
                            onClick={() => { setEditingApp(app); setShowForm(true); }}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            title="Chỉnh sửa"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {app.status !== 'ACCEPTED' && (
                            <button
                              onClick={() => setDeleteTargetId(app.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Xóa"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr key={`${app.id}-detail`} className="bg-gray-50">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Liên hệ</p>
                              <p className="text-gray-700">📞 {app.phone || '—'}</p>
                              <p className="text-gray-700">✉️ {app.email || '—'}</p>
                              {app.cvUrl && (
                                <a href={app.cvUrl} target="_blank" rel="noopener noreferrer"
                                  className="text-cyan-600 hover:underline">📄 Xem CV</a>
                              )}
                            </div>
                            {app.status === 'INTERVIEW' || app.status === 'ACCEPTED' ? (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Phỏng vấn</p>
                                <p className="text-gray-700">📅 {app.interviewDate ? new Date(app.interviewDate).toLocaleDateString('vi-VN') : '—'}</p>
                                <p className="text-gray-700">⭐ Điểm: {app.interviewScore != null ? app.interviewScore : '—'}</p>
                                {app.interviewNotes && <p className="text-gray-600 mt-1 italic">{app.interviewNotes}</p>}
                              </div>
                            ) : <div />}
                            <div>
                              {app.notes && (
                                <>
                                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Ghi chú</p>
                                  <p className="text-gray-600 italic">{app.notes}</p>
                                </>
                              )}
                              {app.status === 'ACCEPTED' && app.convertedSecretary && (
                                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-green-800 text-xs">
                                  ✓ Đã tạo thư ký: <strong>{app.convertedSecretary.fullName}</strong>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <ApplicationForm
          application={editingApp}
          types={types}
          departments={departments}
          onClose={() => { setShowForm(false); setEditingApp(null); }}
          onSuccess={() => { setShowForm(false); setEditingApp(null); fetchApplications(); }}
        />
      )}

      {/* Advance Modal */}
      {advanceTarget && (
        <AdvanceModal
          application={advanceTarget.app}
          action={advanceTarget.action}
          departments={departments}
          onClose={() => setAdvanceTarget(null)}
          onSuccess={() => { setAdvanceTarget(null); fetchApplications(); }}
        />
      )}
    </div>
  );
}
