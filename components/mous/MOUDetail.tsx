'use client';

import { useState } from 'react';
import { CATEGORY_LABELS, CATEGORY_COLORS, STATUS_COLORS, STATUS_LABELS, getMOUDisplayStatus, formatDate, getOverallProgress } from './MOUUtils';

interface Clause {
  id: string;
  orderNumber: number;
  title: string;
  content: string | null;
  responsible: string | null;
  deadline: string | null;
  progress: number;
  isCompleted: boolean;
  completedAt: string | null;
  notes: string | null;
}

interface ProgressLog {
  id: string;
  date: string;
  content: string;
  achievement: string | null;
  issues: string | null;
  nextSteps: string | null;
  updatedBy: string | null;
}

interface MOUDetailData {
  id: string;
  title: string;
  mouNumber: string | null;
  category: string;
  status: string;
  partnerName: string;
  partnerCountry: string | null;
  partnerContact: string | null;
  signedDate: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  autoRenew: boolean;
  purpose: string | null;
  scope: string | null;
  keyTerms: string | null;
  fileUrl: string | null;
  notes: string | null;
  department: { id: string; name: string } | null;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  clauses: Clause[];
  progressLogs: ProgressLog[];
}

interface Props {
  mou: MOUDetailData;
  onClose: () => void;
  onEdit: () => void;
  onRefresh: () => void;
}

type Tab = 'info' | 'clauses' | 'progress';

export function MOUDetail({ mou, onClose, onEdit, onRefresh }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [showClauseForm, setShowClauseForm] = useState(false);
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [editingClause, setEditingClause] = useState<Clause | null>(null);

  const displayStatus = getMOUDisplayStatus(mou);
  const overallProgress = getOverallProgress(mou.clauses);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[mou.category]}`}>
                {CATEGORY_LABELS[mou.category]}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[displayStatus]}`}>
                {STATUS_LABELS[displayStatus]}
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 line-clamp-2">{mou.title}</h2>
            {mou.mouNumber && <p className="text-sm text-gray-400">{mou.mouNumber}</p>}
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <button onClick={onEdit} className="px-3 py-1.5 text-sm text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100">
              Sửa
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 px-6 pt-3 bg-gray-50 border-b border-gray-200">
          {([['info', 'Thông tin'], ['clauses', `Điều khoản (${mou.clauses.length})`], ['progress', `Nhật ký (${mou.progressLogs.length})`]] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === key ? 'bg-white text-cyan-700 border border-gray-200 border-b-white -mb-px' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Info Tab */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              {/* Partner info */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">Đối tác</h3>
                <p className="text-sm font-medium text-blue-900">{mou.partnerName}</p>
                {mou.partnerCountry && <p className="text-sm text-blue-700">{mou.partnerCountry}</p>}
                {mou.partnerContact && <p className="text-sm text-blue-600 mt-1 whitespace-pre-line">{mou.partnerContact}</p>}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoField label="Ngày ký kết" value={formatDate(mou.signedDate)} />
                <InfoField label="Ngày hiệu lực" value={formatDate(mou.effectiveDate)} />
                <InfoField label="Ngày hết hạn" value={formatDate(mou.expiryDate)} />
                <InfoField label="Tự động gia hạn" value={mou.autoRenew ? 'Có' : 'Không'} />
              </div>

              {/* Department & contact */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoField label="Phòng đầu mối" value={mou.department?.name || '-'} />
                <InfoField label="Người phụ trách" value={mou.contactPerson || '-'} />
                <InfoField label="Email" value={mou.contactEmail || '-'} />
                <InfoField label="Điện thoại" value={mou.contactPhone || '-'} />
              </div>

              {/* Content sections */}
              {mou.purpose && <TextSection label="Mục đích" text={mou.purpose} />}
              {mou.scope && <TextSection label="Phạm vi" text={mou.scope} />}
              {mou.keyTerms && <TextSection label="Điều khoản chính" text={mou.keyTerms} />}
              {mou.notes && <TextSection label="Ghi chú" text={mou.notes} />}

              {/* File */}
              {mou.fileUrl && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">File đính kèm</p>
                  <a href={mou.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm text-cyan-600 hover:underline">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Tải file
                  </a>
                </div>
              )}

              {/* Overall progress */}
              {mou.clauses.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Tiến độ tổng thể</p>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${overallProgress === 100 ? 'bg-green-500' : 'bg-cyan-500'}`} style={{ width: `${overallProgress}%` }} />
                    </div>
                    <span className="text-sm font-bold text-gray-700">{overallProgress}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Clauses Tab */}
          {activeTab === 'clauses' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-500">{mou.clauses.length} điều khoản</p>
                <button
                  onClick={() => { setEditingClause(null); setShowClauseForm(true); }}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-cyan-500 rounded-lg hover:bg-cyan-600"
                >
                  + Thêm điều khoản
                </button>
              </div>

              {mou.clauses.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Chưa có điều khoản nào</p>
              ) : (
                <div className="space-y-3">
                  {mou.clauses.map(clause => (
                    <ClauseCard
                      key={clause.id}
                      clause={clause}
                      mouId={mou.id}
                      onEdit={() => { setEditingClause(clause); setShowClauseForm(true); }}
                      onRefresh={onRefresh}
                    />
                  ))}
                </div>
              )}

              {showClauseForm && (
                <ClauseFormModal
                  mouId={mou.id}
                  initialData={editingClause}
                  onClose={() => { setShowClauseForm(false); setEditingClause(null); }}
                  onSuccess={() => { setShowClauseForm(false); setEditingClause(null); onRefresh(); }}
                />
              )}
            </div>
          )}

          {/* Progress Tab */}
          {activeTab === 'progress' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-500">{mou.progressLogs.length} cập nhật</p>
                <button
                  onClick={() => setShowProgressForm(true)}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-cyan-500 rounded-lg hover:bg-cyan-600"
                >
                  + Cập nhật tiến độ
                </button>
              </div>

              {mou.progressLogs.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Chưa có nhật ký nào</p>
              ) : (
                <div className="space-y-4">
                  {mou.progressLogs.map(log => (
                    <div key={log.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">{formatDate(log.date)}</span>
                        {log.updatedBy && <span className="text-xs text-gray-400">{log.updatedBy}</span>}
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{log.content}</p>
                      {log.achievement && (
                        <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-700">
                          <span className="font-medium">Kết quả:</span> {log.achievement}
                        </div>
                      )}
                      {log.issues && (
                        <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
                          <span className="font-medium">Vấn đề:</span> {log.issues}
                        </div>
                      )}
                      {log.nextSteps && (
                        <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-700">
                          <span className="font-medium">Kế hoạch:</span> {log.nextSteps}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {showProgressForm && (
                <ProgressFormModal
                  mouId={mou.id}
                  onClose={() => setShowProgressForm(false)}
                  onSuccess={() => { setShowProgressForm(false); onRefresh(); }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Helper components ---

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <p className="text-sm text-gray-800">{value}</p>
    </div>
  );
}

function TextSection({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-line">{text}</div>
    </div>
  );
}

function ClauseCard({ clause, mouId, onEdit, onRefresh }: {
  clause: Clause;
  mouId: string;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  const handleToggleComplete = async () => {
    await fetch(`/api/mous/${mouId}/clauses`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clauseId: clause.id,
        isCompleted: !clause.isCompleted,
        progress: !clause.isCompleted ? 100 : clause.progress,
      }),
    });
    onRefresh();
  };

  const handleDelete = async () => {
    if (!confirm('Xóa điều khoản này?')) return;
    await fetch(`/api/mous/${mouId}/clauses?clauseId=${clause.id}`, { method: 'DELETE' });
    onRefresh();
  };

  return (
    <div className={`border rounded-lg p-4 ${clause.isCompleted ? 'border-green-200 bg-green-50/50' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <button onClick={handleToggleComplete} className="mt-0.5">
            {clause.isCompleted ? (
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            ) : (
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={2} /></svg>
            )}
          </button>
          <div className="flex-1">
            <p className={`text-sm font-medium ${clause.isCompleted ? 'text-green-700 line-through' : 'text-gray-900'}`}>
              {clause.orderNumber}. {clause.title}
            </p>
            {clause.content && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{clause.content}</p>}
            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
              {clause.responsible && <span>Phụ trách: {clause.responsible}</span>}
              {clause.deadline && <span>Hạn: {formatDate(clause.deadline)}</span>}
            </div>
            {!clause.isCompleted && (
              <div className="flex items-center space-x-2 mt-2">
                <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${clause.progress}%` }} />
                </div>
                <span className="text-xs text-gray-400">{clause.progress}%</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-1 ml-2">
          <button onClick={onEdit} className="p-1 text-gray-400 hover:text-yellow-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
          <button onClick={handleDelete} className="p-1 text-gray-400 hover:text-red-600"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
        </div>
      </div>
    </div>
  );
}

function ClauseFormModal({ mouId, initialData, onClose, onSuccess }: {
  mouId: string;
  initialData: Clause | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    title: initialData?.title || '',
    content: initialData?.content || '',
    responsible: initialData?.responsible || '',
    deadline: initialData?.deadline ? new Date(initialData.deadline).toISOString().split('T')[0] : '',
    progress: initialData?.progress ?? 0,
    notes: initialData?.notes || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const method = initialData ? 'PUT' : 'POST';
      const body = initialData
        ? { ...form, clauseId: initialData.id, deadline: form.deadline || null }
        : { ...form, deadline: form.deadline || null };

      await fetch(`/api/mous/${mouId}/clauses`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500';

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
        <h3 className="text-lg font-bold">{initialData ? 'Sửa điều khoản' : 'Thêm điều khoản'}</h3>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tiêu đề *</label>
          <input type="text" required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nội dung</label>
          <textarea rows={3} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Bên phụ trách</label>
            <input type="text" value={form.responsible} onChange={e => setForm(p => ({ ...p, responsible: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hạn thực hiện</label>
            <input type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))} className={inputClass} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tiến độ: {form.progress}%</label>
          <input type="range" min={0} max={100} step={5} value={form.progress} onChange={e => setForm(p => ({ ...p, progress: parseInt(e.target.value) }))} className="w-full" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Ghi chú</label>
          <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={inputClass} />
        </div>
        <div className="flex justify-end space-x-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Hủy</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-cyan-500 rounded-lg hover:bg-cyan-600 disabled:opacity-50">
            {loading ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ProgressFormModal({ mouId, onClose, onSuccess }: {
  mouId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    content: '',
    achievement: '',
    issues: '',
    nextSteps: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`/api/mous/${mouId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500';

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
        <h3 className="text-lg font-bold">Cập nhật tiến độ</h3>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nội dung cập nhật *</label>
          <textarea rows={3} required value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Kết quả đạt được</label>
          <textarea rows={2} value={form.achievement} onChange={e => setForm(p => ({ ...p, achievement: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Vấn đề phát sinh</label>
          <textarea rows={2} value={form.issues} onChange={e => setForm(p => ({ ...p, issues: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Kế hoạch tiếp theo</label>
          <textarea rows={2} value={form.nextSteps} onChange={e => setForm(p => ({ ...p, nextSteps: e.target.value }))} className={inputClass} />
        </div>
        <div className="flex justify-end space-x-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Hủy</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-cyan-500 rounded-lg hover:bg-cyan-600 disabled:opacity-50">
            {loading ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </form>
    </div>
  );
}
