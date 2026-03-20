'use client';

import { useState } from 'react';
import {
  CATEGORY_LABELS, CATEGORY_COLORS, STATUS_COLORS, STATUS_LABELS,
  CLAUSE_STATUS_LABELS, CLAUSE_STATUS_COLORS, QUALITY_OPTIONS,
  getMOUDisplayStatus, formatDate, getOverallProgress,
} from './MOUUtils';

interface ClauseProgressLog {
  id: string;
  date: string;
  content: string;
  achievement: string | null;
  issues: string | null;
  nextSteps: string | null;
  progressBefore: number | null;
  progressAfter: number | null;
  updatedBy: string | null;
}

interface Clause {
  id: string;
  orderNumber: number;
  title: string;
  content: string | null;
  responsible: string | null;
  deadline: string | null;
  progress: number;
  clauseStatus: string;
  isCompleted: boolean;
  completedAt: string | null;
  result: string | null;
  quality: string | null;
  budget: string | null;
  notes: string | null;
  clauseProgress: ClauseProgressLog[];
  _count: { clauseProgress: number };
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
  const [activeTab, setActiveTab] = useState<Tab>('clauses');
  const [showClauseForm, setShowClauseForm] = useState(false);
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [editingClause, setEditingClause] = useState<Clause | null>(null);
  const [expandedClause, setExpandedClause] = useState<string | null>(null);

  const displayStatus = getMOUDisplayStatus(mou);
  const overallProgress = getOverallProgress(mou.clauses);

  const statusCounts = {
    total: mou.clauses.length,
    completed: mou.clauses.filter(c => c.clauseStatus === 'COMPLETED').length,
    inProgress: mou.clauses.filter(c => c.clauseStatus === 'IN_PROGRESS').length,
    notStarted: mou.clauses.filter(c => c.clauseStatus === 'NOT_STARTED').length,
    onHold: mou.clauses.filter(c => c.clauseStatus === 'ON_HOLD' || c.clauseStatus === 'CANCELLED').length,
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[92vh] flex flex-col">
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
          {([
            ['info', 'Thông tin'],
            ['clauses', `Hạng mục (${mou.clauses.length})`],
            ['progress', `Nhật ký chung (${mou.progressLogs.length})`],
          ] as [Tab, string][]).map(([key, label]) => (
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
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">Đối tác</h3>
                <p className="text-sm font-medium text-blue-900">{mou.partnerName}</p>
                {mou.partnerCountry && <p className="text-sm text-blue-700">{mou.partnerCountry}</p>}
                {mou.partnerContact && <p className="text-sm text-blue-600 mt-1 whitespace-pre-line">{mou.partnerContact}</p>}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoField label="Ngày ký kết" value={formatDate(mou.signedDate)} />
                <InfoField label="Ngày hiệu lực" value={formatDate(mou.effectiveDate)} />
                <InfoField label="Ngày hết hạn" value={formatDate(mou.expiryDate)} />
                <InfoField label="Tự động gia hạn" value={mou.autoRenew ? 'Có' : 'Không'} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoField label="Phòng đầu mối" value={mou.department?.name || '-'} />
                <InfoField label="Người phụ trách" value={mou.contactPerson || '-'} />
                <InfoField label="Email" value={mou.contactEmail || '-'} />
                <InfoField label="Điện thoại" value={mou.contactPhone || '-'} />
              </div>

              {mou.purpose && <TextSection label="Mục đích" text={mou.purpose} />}
              {mou.scope && <TextSection label="Phạm vi" text={mou.scope} />}
              {mou.keyTerms && <TextSection label="Điều khoản chính" text={mou.keyTerms} />}
              {mou.notes && <TextSection label="Ghi chú" text={mou.notes} />}

              {mou.fileUrl && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">File đính kèm</p>
                  <a href={mou.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-sm text-cyan-600 hover:underline">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Tải file
                  </a>
                </div>
              )}

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

          {/* Clauses Tab - UPGRADED */}
          {activeTab === 'clauses' && (
            <div>
              {/* Summary bar */}
              {mou.clauses.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                  <MiniStat label="Tổng hạng mục" value={statusCounts.total} color="text-gray-700" />
                  <MiniStat label="Hoàn thành" value={statusCounts.completed} color="text-green-600" />
                  <MiniStat label="Đang triển khai" value={statusCounts.inProgress} color="text-blue-600" />
                  <MiniStat label="Chưa triển khai" value={statusCounts.notStarted} color="text-gray-500" />
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Tiến độ chung</p>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${overallProgress === 100 ? 'bg-green-500' : 'bg-cyan-500'}`} style={{ width: `${overallProgress}%` }} />
                      </div>
                      <span className="text-sm font-bold text-gray-700">{overallProgress}%</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-500">{mou.clauses.length} hạng mục</p>
                <button
                  onClick={() => { setEditingClause(null); setShowClauseForm(true); }}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-cyan-500 rounded-lg hover:bg-cyan-600"
                >
                  + Thêm hạng mục
                </button>
              </div>

              {mou.clauses.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Chưa có hạng mục nào. Thêm các hạng mục đã ký để theo dõi tiến độ triển khai.</p>
              ) : (
                <div className="space-y-3">
                  {mou.clauses.map(clause => (
                    <ClauseCard
                      key={clause.id}
                      clause={clause}
                      mouId={mou.id}
                      isExpanded={expandedClause === clause.id}
                      onToggleExpand={() => setExpandedClause(expandedClause === clause.id ? null : clause.id)}
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

          {/* Progress Tab (general MOU progress) */}
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

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

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

function ClauseCard({ clause, mouId, isExpanded, onToggleExpand, onEdit, onRefresh }: {
  clause: Clause;
  mouId: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [allLogs, setAllLogs] = useState<ClauseProgressLog[] | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const statusColor = CLAUSE_STATUS_COLORS[clause.clauseStatus] || CLAUSE_STATUS_COLORS.NOT_STARTED;
  const statusLabel = CLAUSE_STATUS_LABELS[clause.clauseStatus] || 'Chưa triển khai';

  const isOverdue = clause.deadline && !clause.isCompleted && new Date(clause.deadline) < new Date();

  const handleDelete = async () => {
    if (!confirm('Xóa hạng mục này?')) return;
    await fetch(`/api/mous/${mouId}/clauses?clauseId=${clause.id}`, { method: 'DELETE' });
    onRefresh();
  };

  const handleLoadAllLogs = async () => {
    if (allLogs) return;
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/mous/${mouId}/clauses/${clause.id}/progress`);
      const data = await res.json();
      setAllLogs(data);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleToggle = () => {
    if (!isExpanded) handleLoadAllLogs();
    onToggleExpand();
  };

  const progressLogs = allLogs || clause.clauseProgress;
  const totalLogs = clause._count.clauseProgress;

  return (
    <div className={`border rounded-lg overflow-hidden ${
      clause.isCompleted ? 'border-green-200 bg-green-50/30' :
      isOverdue ? 'border-red-200 bg-red-50/30' :
      clause.clauseStatus === 'IN_PROGRESS' ? 'border-blue-200' :
      'border-gray-200'
    }`}>
      {/* Clause header - always visible */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1 min-w-0">
            <button onClick={handleToggle} className="mt-0.5 flex-shrink-0">
              <svg className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-900">
                  {clause.orderNumber}. {clause.title}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColor}`}>
                  {statusLabel}
                </span>
                {isOverdue && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-700">
                    Quá hạn
                  </span>
                )}
                {clause.quality && (
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    clause.quality === 'Tốt' ? 'bg-green-100 text-green-700' :
                    clause.quality === 'Đạt' ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {clause.quality}
                  </span>
                )}
              </div>
              {clause.content && <p className="text-xs text-gray-500 line-clamp-1">{clause.content}</p>}
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
                {clause.responsible && <span>Phụ trách: <span className="text-gray-600">{clause.responsible}</span></span>}
                {clause.deadline && (
                  <span className={isOverdue ? 'text-red-500' : ''}>
                    Hạn: <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}>{formatDate(clause.deadline)}</span>
                  </span>
                )}
                {clause.budget && <span>Ngân sách: <span className="text-gray-600">{clause.budget}</span></span>}
                {totalLogs > 0 && <span className="text-cyan-500">{totalLogs} cập nhật</span>}
              </div>
              {/* Progress bar */}
              <div className="flex items-center space-x-2 mt-2">
                <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${
                    clause.progress >= 100 ? 'bg-green-500' :
                    clause.progress > 0 ? 'bg-cyan-500' : 'bg-gray-300'
                  }`} style={{ width: `${clause.progress}%` }} />
                </div>
                <span className={`text-xs font-medium ${clause.progress >= 100 ? 'text-green-600' : 'text-gray-500'}`}>{clause.progress}%</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
            <button
              onClick={() => setShowProgressForm(true)}
              title="Cập nhật tiến độ"
              className="p-1.5 text-cyan-500 hover:text-cyan-700 hover:bg-cyan-50 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </button>
            <button onClick={onEdit} title="Sửa" className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button onClick={handleDelete} title="Xóa" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
          {/* Result & info */}
          {clause.result && (
            <div className="mb-3 p-3 bg-green-50 rounded-lg">
              <p className="text-xs font-medium text-green-700 mb-1">Kết quả đạt được</p>
              <p className="text-sm text-green-800 whitespace-pre-line">{clause.result}</p>
            </div>
          )}
          {clause.notes && (
            <div className="mb-3 p-3 bg-gray-100 rounded-lg">
              <p className="text-xs font-medium text-gray-500 mb-1">Ghi chú</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{clause.notes}</p>
            </div>
          )}

          {/* Progress timeline */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-600">Lịch sử cập nhật ({totalLogs})</p>
              <button
                onClick={() => setShowProgressForm(true)}
                className="text-xs text-cyan-600 hover:text-cyan-700 font-medium"
              >
                + Thêm cập nhật
              </button>
            </div>

            {loadingLogs ? (
              <p className="text-xs text-gray-400 py-2">Đang tải...</p>
            ) : progressLogs.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">Chưa có cập nhật nào cho hạng mục này.</p>
            ) : (
              <div className="space-y-2">
                {progressLogs.map((log, idx) => (
                  <div key={log.id} className="relative pl-5 pb-2">
                    {/* Timeline dot & line */}
                    <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full bg-cyan-400 border-2 border-white shadow-sm" />
                    {idx < progressLogs.length - 1 && (
                      <div className="absolute left-[4.5px] top-4 bottom-0 w-px bg-gray-200" />
                    )}
                    <div className="bg-white border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{formatDate(log.date)}</span>
                        <div className="flex items-center space-x-2">
                          {log.progressBefore !== null && log.progressAfter !== null && log.progressBefore !== log.progressAfter && (
                            <span className="text-[11px] text-cyan-600 font-medium">
                              {log.progressBefore}% → {log.progressAfter}%
                            </span>
                          )}
                          {log.updatedBy && <span className="text-[11px] text-gray-400">{log.updatedBy}</span>}
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 whitespace-pre-line">{log.content}</p>
                      {log.achievement && (
                        <p className="text-xs text-green-600 mt-1"><span className="font-medium">Kết quả:</span> {log.achievement}</p>
                      )}
                      {log.issues && (
                        <p className="text-xs text-red-600 mt-1"><span className="font-medium">Vấn đề:</span> {log.issues}</p>
                      )}
                      {log.nextSteps && (
                        <p className="text-xs text-blue-600 mt-1"><span className="font-medium">Tiếp theo:</span> {log.nextSteps}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Clause progress form */}
      {showProgressForm && (
        <ClauseProgressFormModal
          mouId={mouId}
          clause={clause}
          onClose={() => setShowProgressForm(false)}
          onSuccess={() => {
            setShowProgressForm(false);
            setAllLogs(null); // force reload
            onRefresh();
          }}
        />
      )}
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
    clauseStatus: initialData?.clauseStatus || 'NOT_STARTED',
    result: initialData?.result || '',
    quality: initialData?.quality || '',
    budget: initialData?.budget || '',
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
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <h3 className="text-lg font-bold">{initialData ? 'Sửa hạng mục' : 'Thêm hạng mục'}</h3>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tiêu đề hạng mục *</label>
          <input type="text" required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nội dung chi tiết</label>
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Trạng thái</label>
            <select value={form.clauseStatus} onChange={e => setForm(p => ({ ...p, clauseStatus: e.target.value }))} className={inputClass}>
              {Object.entries(CLAUSE_STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Đánh giá chất lượng</label>
            <select value={form.quality} onChange={e => setForm(p => ({ ...p, quality: e.target.value }))} className={inputClass}>
              {QUALITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tiến độ: {form.progress}%</label>
            <input type="range" min={0} max={100} step={5} value={form.progress} onChange={e => setForm(p => ({ ...p, progress: parseInt(e.target.value) }))} className="w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ngân sách / Chi phí</label>
            <input type="text" placeholder="VD: 500 triệu" value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Kết quả đạt được</label>
          <textarea rows={2} value={form.result} onChange={e => setForm(p => ({ ...p, result: e.target.value }))} className={inputClass} placeholder="Mô tả kết quả triển khai hạng mục này..." />
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

function ClauseProgressFormModal({ mouId, clause, onClose, onSuccess }: {
  mouId: string;
  clause: Clause;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    content: '',
    achievement: '',
    issues: '',
    nextSteps: '',
    progressAfter: clause.progress,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`/api/mous/${mouId}/clauses/${clause.id}/progress`, {
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
        <h3 className="text-lg font-bold">Cập nhật: {clause.title}</h3>
        <p className="text-xs text-gray-400">Tiến độ hiện tại: {clause.progress}%</p>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nội dung cập nhật *</label>
          <textarea rows={3} required value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} className={inputClass} placeholder="Mô tả công việc đã thực hiện..." />
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
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Cập nhật tiến độ: {form.progressAfter}%</label>
          <input type="range" min={0} max={100} step={5} value={form.progressAfter} onChange={e => setForm(p => ({ ...p, progressAfter: parseInt(e.target.value) }))} className="w-full" />
          <div className="flex justify-between text-[11px] text-gray-400 mt-1">
            <span>0%</span>
            <span>Trước: {clause.progress}% → Sau: {form.progressAfter}%</span>
            <span>100%</span>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">Hủy</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-cyan-500 rounded-lg hover:bg-cyan-600 disabled:opacity-50">
            {loading ? 'Đang lưu...' : 'Lưu cập nhật'}
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
        <h3 className="text-lg font-bold">Cập nhật tiến độ chung</h3>
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
