'use client';

import { useState, useEffect } from 'react';
import {
  FileUser, Plus, Search, Edit, Trash2, ArrowRight, GraduationCap, MapPin, Phone, Mail,
  Briefcase, Award, ClipboardCheck, Calendar, X, CheckCircle2, XCircle, Star,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { ApplicationForm } from '@/components/secretaries/ApplicationForm';
import { AdvanceModal } from '@/components/secretaries/AdvanceModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface Application {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  birthPlace: string | null;
  phone: string | null;
  email: string | null;
  permanentAddress: string | null;
  temporaryAddress: string | null;
  cvUrl: string | null;
  education: string | null;
  educationInstitution: string | null;
  graduationYear: number | null;
  graduationRank: string | null;
  trainingCertificate: string | null;
  foreignLanguage: string | null;
  itSkill: string | null;
  appliedPosition: string | null;
  workExperience: string | null;
  previousSalary: number | string | null;
  resignReason: string | null;
  knowsHospital: boolean | null;
  hospitalRelative: string | null;
  source: string | null;
  status: string;
  screeningDate: string | null;
  screeningLocation: string | null;
  screeningPanel: string | null;
  ratingAppearance: string | null;
  ratingExpertise: string | null;
  ratingCommunication: string | null;
  ratingITSkill: string | null;
  ratingAI: string | null;
  ratingKnowledge: string | null;
  scoreMultipleChoice: number | null;
  scoreWordProcessing: number | null;
  scoreTypingSpeed: number | null;
  typingWordsPerMinute: number | null;
  screeningResult: string | null;
  screeningNotes: string | null;
  notes: string | null;
  interviewDate: string | null;
  interviewScore: number | null;
  interviewNotes: string | null;
  appliedType: { id: string; name: string; color: string | null } | null;
  desiredDepartment: { id: string; name: string } | null;
  convertedSecretary: { id: string; fullName: string } | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  SCREENING: { label: 'Sơ tuyển', color: 'text-amber-700', bg: 'bg-amber-100', ring: 'ring-amber-200' },
  INTERVIEW: { label: 'Phỏng vấn', color: 'text-blue-700', bg: 'bg-blue-100', ring: 'ring-blue-200' },
  ACCEPTED: { label: 'Nhận việc', color: 'text-emerald-700', bg: 'bg-emerald-100', ring: 'ring-emerald-200' },
  REJECTED: { label: 'Từ chối', color: 'text-red-700', bg: 'bg-red-100', ring: 'ring-red-200' },
};

const RATING_LABEL: Record<string, string> = {
  EXCELLENT: 'Xuất sắc',
  GOOD: 'Tốt',
  FAIR: 'Khá',
  AVERAGE: 'Trung bình',
  POOR: 'Kém',
};

const ALL_TABS = ['ALL', 'SCREENING', 'INTERVIEW', 'ACCEPTED', 'REJECTED'] as const;
const TAB_LABEL: Record<string, string> = {
  ALL: 'Tất cả',
  SCREENING: 'Sơ tuyển',
  INTERVIEW: 'Phỏng vấn',
  ACCEPTED: 'Nhận việc',
  REJECTED: 'Từ chối',
};

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN');
}

function fmtMoney(v: number | string | null): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('vi-VN') + ' đ';
}

function averageRating(app: Application): number | null {
  const values = [app.ratingAppearance, app.ratingExpertise, app.ratingCommunication, app.ratingITSkill, app.ratingAI, app.ratingKnowledge];
  const scores: Record<string, number> = { EXCELLENT: 5, GOOD: 4, FAIR: 3, AVERAGE: 2, POOR: 1 };
  const numbers = values.map((v) => (v ? scores[v] : null)).filter((n): n is number => n !== null);
  if (numbers.length === 0) return null;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

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
  const [detailApp, setDetailApp] = useState<Application | null>(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileUser}
        title="Hồ sơ ứng tuyển"
        description="Theo dõi pipeline tuyển dụng thư ký theo từng giai đoạn"
        actions={
          <button
            onClick={() => { setEditingApp(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all shadow-sm shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            Thêm hồ sơ
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Tổng hồ sơ" value={stats.total} accent="from-slate-500 to-slate-700" active={activeTab === 'ALL'} onClick={() => setActiveTab('ALL')} />
        <StatCard label="Sơ tuyển" value={stats.SCREENING} accent="from-amber-500 to-orange-600" active={activeTab === 'SCREENING'} onClick={() => setActiveTab('SCREENING')} />
        <StatCard label="Phỏng vấn" value={stats.INTERVIEW} accent="from-blue-500 to-cyan-600" active={activeTab === 'INTERVIEW'} onClick={() => setActiveTab('INTERVIEW')} />
        <StatCard label="Nhận việc" value={stats.ACCEPTED} accent="from-emerald-500 to-teal-600" active={activeTab === 'ACCEPTED'} onClick={() => setActiveTab('ACCEPTED')} />
        <StatCard label="Từ chối" value={stats.REJECTED} accent="from-red-500 to-rose-600" active={activeTab === 'REJECTED'} onClick={() => setActiveTab('REJECTED')} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Tìm theo tên / email / SĐT..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Đang tải...</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
            <FileUser className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">Chưa có hồ sơ trong nhóm {TAB_LABEL[activeTab]}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {applications.map((app) => (
            <ApplicantCard
              key={app.id}
              app={app}
              onView={() => setDetailApp(app)}
              onEdit={() => { setEditingApp(app); setShowForm(true); }}
              onDelete={() => setDeleteTargetId(app.id)}
              onAdvance={(action) => setAdvanceTarget({ app, action })}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ApplicationForm
          application={editingApp}
          types={types}
          departments={departments}
          onClose={() => { setShowForm(false); setEditingApp(null); }}
          onSuccess={() => { setShowForm(false); setEditingApp(null); fetchApplications(); }}
        />
      )}
      {advanceTarget && (
        <AdvanceModal
          application={advanceTarget.app}
          action={advanceTarget.action}
          departments={departments}
          onClose={() => setAdvanceTarget(null)}
          onSuccess={() => { setAdvanceTarget(null); fetchApplications(); }}
        />
      )}
      {detailApp && (
        <DetailDrawer
          app={detailApp}
          onClose={() => setDetailApp(null)}
          onEdit={() => { setEditingApp(detailApp); setDetailApp(null); setShowForm(true); }}
        />
      )}
      <ConfirmDialog
        open={!!deleteTargetId}
        title="Xác nhận xoá"
        message="Bạn có chắc muốn xoá hồ sơ ứng tuyển này?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}

function StatCard({
  label, value, accent, active, onClick,
}: {
  label: string; value: number; accent: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white rounded-2xl border shadow-sm p-4 transition-all ${
        active ? 'border-cyan-400 ring-2 ring-cyan-100' : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold leading-tight tabular-nums bg-gradient-to-br ${accent} bg-clip-text text-transparent mt-1`}>
        {value.toLocaleString('vi-VN')}
      </div>
    </button>
  );
}

function ApplicantCard({
  app, onView, onEdit, onDelete, onAdvance,
}: {
  app: Application;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAdvance: (action: 'INTERVIEW' | 'ACCEPTED' | 'REJECTED') => void;
}) {
  const status = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.SCREENING;
  const avgRating = averageRating(app);

  return (
    <div className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden flex flex-col">
      <div className="p-4 cursor-pointer" onClick={onView}>
        <div className="flex items-start gap-3 mb-3">
          <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center font-semibold text-sm shadow-sm">
            {initials(app.fullName)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-900 leading-snug truncate">{app.fullName}</h3>
            {app.appliedPosition && (
              <p className="text-xs text-slate-500 mt-0.5 truncate">{app.appliedPosition}</p>
            )}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${status.bg} ${status.color} ring-1 ring-inset ${status.ring}`}>
                {status.label}
              </span>
              {app.screeningResult === 'PASS' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded-full ring-1 ring-emerald-200">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Đạt sơ tuyển
                </span>
              )}
              {app.screeningResult === 'FAIL' && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 bg-red-50 rounded-full ring-1 ring-red-200">
                  <XCircle className="w-2.5 h-2.5" /> Không đạt
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-1.5 text-xs text-slate-600">
          {app.education && (
            <div className="flex items-center gap-1.5">
              <GraduationCap className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="truncate">{app.education}</span>
            </div>
          )}
          {app.workExperience && (
            <div className="flex items-start gap-1.5">
              <Briefcase className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{app.workExperience}</span>
            </div>
          )}
          {(app.phone || app.email) && (
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              {app.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {app.phone}</span>}
              {app.email && <span className="inline-flex items-center gap-1 truncate"><Mail className="w-3 h-3" /> {app.email}</span>}
            </div>
          )}
        </div>

        {(app.scoreMultipleChoice !== null || app.scoreWordProcessing !== null || app.scoreTypingSpeed !== null) && (
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[10px] text-slate-500">TN</div>
              <div className="text-sm font-semibold text-slate-900 tabular-nums">{app.scoreMultipleChoice ?? '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Soạn</div>
              <div className="text-sm font-semibold text-slate-900 tabular-nums">{app.scoreWordProcessing ?? '—'}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500">Máy</div>
              <div className="text-sm font-semibold text-slate-900 tabular-nums">{app.scoreTypingSpeed ?? '—'}</div>
            </div>
          </div>
        )}

        {avgRating !== null && (
          <div className="mt-2 flex items-center gap-1">
            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span className="text-[11px] text-slate-600">Đánh giá TB: <strong>{avgRating.toFixed(1)}/5</strong></span>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-1 bg-slate-50/50">
        <button onClick={onView} className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-white rounded-lg transition-colors">
          Chi tiết
        </button>
        <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-white rounded-lg transition-colors" title="Sửa">
          <Edit className="w-3.5 h-3.5" />
        </button>
        {app.status === 'SCREENING' && (
          <button onClick={() => onAdvance('INTERVIEW')} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-colors" title="Chuyển sang phỏng vấn">
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
        {app.status === 'INTERVIEW' && (
          <>
            <button onClick={() => onAdvance('ACCEPTED')} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-white rounded-lg transition-colors" title="Nhận việc">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onAdvance('REJECTED')} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors" title="Từ chối">
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </>
        )}
        <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors" title="Xoá">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function DetailDrawer({ app, onClose, onEdit }: { app: Application; onClose: () => void; onEdit: () => void }) {
  const status = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.SCREENING;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end z-40">
      <div className="bg-white w-full max-w-2xl h-full overflow-y-auto shadow-2xl">
        <header className="sticky top-0 z-10 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center font-semibold">
              {initials(app.fullName)}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 truncate">{app.fullName}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full ${status.bg} ${status.color}`}>
                  {status.label}
                </span>
                {app.appliedPosition && <span className="text-xs text-slate-500 truncate">· {app.appliedPosition}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50">
              Chỉnh sửa
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </header>

        <div className="px-6 py-4 space-y-6">
          <Section title="Thông tin cá nhân">
            <KV label="Ngày sinh" value={fmtDate(app.dateOfBirth)} />
            <KV label="Nơi sinh" value={app.birthPlace || '—'} />
            <KV label="Điện thoại" value={app.phone || '—'} />
            <KV label="Email" value={app.email || '—'} />
            {app.permanentAddress && <KV label="Thường trú" value={app.permanentAddress} span2 />}
            {app.temporaryAddress && <KV label="Tạm trú" value={app.temporaryAddress} span2 />}
            {app.cvUrl && (
              <KV
                label="CV"
                value={
                  <a href={app.cvUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:underline break-all">
                    {app.cvUrl}
                  </a>
                }
                span2
              />
            )}
          </Section>

          {(app.education || app.educationInstitution || app.foreignLanguage || app.itSkill || app.trainingCertificate) && (
            <Section title="Học vấn">
              {app.education && <KV label="Trình độ" value={app.education} span2 />}
              {app.educationInstitution && <KV label="Nơi đào tạo" value={app.educationInstitution} span2 />}
              {app.graduationYear && <KV label="Năm tốt nghiệp" value={String(app.graduationYear)} />}
              {app.graduationRank && <KV label="Xếp loại" value={app.graduationRank} />}
              {app.trainingCertificate && <KV label="Chứng chỉ" value={app.trainingCertificate} span2 />}
              {app.foreignLanguage && <KV label="Ngoại ngữ" value={app.foreignLanguage} />}
              {app.itSkill && <KV label="Tin học" value={app.itSkill} />}
            </Section>
          )}

          {(app.workExperience || app.previousSalary !== null || app.resignReason || app.appliedType || app.desiredDepartment) && (
            <Section title="Kinh nghiệm & Mong muốn">
              {app.workExperience && <KV label="Kinh nghiệm" value={app.workExperience} span2 />}
              {app.previousSalary !== null && <KV label="Thu nhập cũ" value={fmtMoney(app.previousSalary)} />}
              {app.resignReason && <KV label="Lý do nghỉ" value={app.resignReason} span2 />}
              {app.knowsHospital !== null && (
                <KV label="Hiểu biết BV" value={app.knowsHospital ? 'Có' : 'Chưa có'} />
              )}
              {app.hospitalRelative && <KV label="Thân nhân BV" value={app.hospitalRelative} span2 />}
              {app.appliedType && <KV label="Loại thư ký" value={app.appliedType.name} />}
              {app.desiredDepartment && <KV label="Phòng mong muốn" value={app.desiredDepartment.name} />}
              {app.source && <KV label="Nguồn" value={app.source} />}
            </Section>
          )}

          {(app.screeningDate || app.screeningResult || app.scoreMultipleChoice !== null) && (
            <Section title="Sơ tuyển">
              {app.screeningDate && <KV label="Ngày sơ tuyển" value={fmtDate(app.screeningDate)} />}
              {app.screeningResult && (
                <KV
                  label="Kết luận"
                  value={
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${app.screeningResult === 'PASS' ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100'}`}>
                      {app.screeningResult === 'PASS' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {app.screeningResult === 'PASS' ? 'Đạt' : 'Không đạt'}
                    </span>
                  }
                />
              )}
              {app.screeningLocation && <KV label="Địa điểm" value={app.screeningLocation} span2 />}
              {app.screeningPanel && <KV label="Hội đồng" value={app.screeningPanel} span2 />}

              {(app.ratingAppearance || app.ratingExpertise || app.ratingCommunication || app.ratingITSkill || app.ratingAI || app.ratingKnowledge) && (
                <div className="col-span-2 bg-slate-50 rounded-lg p-3 mt-2">
                  <h4 className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Đánh giá 6 mục</h4>
                  <div className="space-y-1">
                    {[
                      { key: 'ratingAppearance', label: 'Tác phong, ngoại hình' },
                      { key: 'ratingExpertise', label: 'Nghiệp vụ chuyên môn' },
                      { key: 'ratingCommunication', label: 'Kỹ năng giao tiếp' },
                      { key: 'ratingITSkill', label: 'Kỹ năng tin học' },
                      { key: 'ratingAI', label: 'Ứng dụng AI' },
                      { key: 'ratingKnowledge', label: 'Am hiểu kiến thức' },
                    ].map((r) => {
                      const v = app[r.key as keyof Application] as string | null;
                      if (!v) return null;
                      return (
                        <div key={r.key} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{r.label}</span>
                          <span className="font-medium text-slate-900">{RATING_LABEL[v] ?? v}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {(app.scoreMultipleChoice !== null || app.scoreWordProcessing !== null || app.scoreTypingSpeed !== null) && (
                <div className="col-span-2 bg-cyan-50 border border-cyan-200 rounded-lg p-3 mt-2">
                  <h4 className="text-xs font-semibold text-cyan-800 mb-2 uppercase tracking-wide">Điểm bài thi</h4>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div>
                      <div className="text-[10px] text-cyan-700 uppercase">Trắc nghiệm</div>
                      <div className="text-lg font-semibold text-cyan-900 tabular-nums">{app.scoreMultipleChoice ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-cyan-700 uppercase">Soạn thảo</div>
                      <div className="text-lg font-semibold text-cyan-900 tabular-nums">{app.scoreWordProcessing ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-cyan-700 uppercase">Đánh máy</div>
                      <div className="text-lg font-semibold text-cyan-900 tabular-nums">{app.scoreTypingSpeed ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-cyan-700 uppercase">Từ/phút</div>
                      <div className="text-lg font-semibold text-cyan-900 tabular-nums">{app.typingWordsPerMinute ?? '—'}</div>
                    </div>
                  </div>
                </div>
              )}
              {app.screeningNotes && <KV label="Ghi chú" value={app.screeningNotes} span2 />}
            </Section>
          )}

          {(app.interviewDate || app.interviewScore !== null || app.interviewNotes) && (
            <Section title="Phỏng vấn">
              {app.interviewDate && <KV label="Ngày phỏng vấn" value={fmtDate(app.interviewDate)} />}
              {app.interviewScore !== null && <KV label="Điểm phỏng vấn" value={`${app.interviewScore}/10`} />}
              {app.interviewNotes && <KV label="Ghi chú" value={app.interviewNotes} span2 />}
            </Section>
          )}

          {app.notes && (
            <Section title="Ghi chú chung">
              <div className="col-span-2 text-sm text-slate-700 whitespace-pre-wrap">{app.notes}</div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-slate-50/60 rounded-xl p-3 border border-slate-100">
        {children}
      </div>
    </div>
  );
}

function KV({ label, value, span2 }: { label: string; value: React.ReactNode; span2?: boolean }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      <div className="text-[10px] text-slate-500 uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-sm text-slate-800">{value}</div>
    </div>
  );
}
