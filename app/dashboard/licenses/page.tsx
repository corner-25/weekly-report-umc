'use client';

import { Select } from '@/components/ui/Select';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileText, GanttChart, LayoutGrid, ShieldCheck, Table2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import LicenseList from '@/components/licenses/LicenseList';
import LicenseKanban from '@/components/licenses/LicenseKanban';
import LicenseTimeline from '@/components/licenses/LicenseTimeline';
import LicenseForm from '@/components/licenses/LicenseForm';
import LicenseDetail from '@/components/licenses/LicenseDetail';
import { CATEGORY_LABELS } from '@/components/licenses/LicenseUtils';

type ViewMode = 'table' | 'kanban' | 'timeline';
const VIEW_STORAGE_KEY = 'licenses.viewMode';

interface Department { id: string; name: string; }
interface License {
  id: string;
  name: string;
  licenseNumber: string | null;
  category: string;
  issuedBy: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  scope: string | null;
  fileUrl: string | null;
  notes: string | null;
  department: Department | null;
  renewals: any[];
  _count: { renewals: number };
}

interface Stats { total: number; expired: number; expiringSoon: number; noExpiry: number; }

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, expired: 0, expiringSoon: 0, noExpiry: 0 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [viewingLicense, setViewingLicense] = useState<License | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode | null;
      if (saved === 'table' || saved === 'kanban' || saved === 'timeline') setViewMode(saved);
    }
    fetchDepartments();
    fetchStats();
  }, []);

  const changeView = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') window.localStorage.setItem(VIEW_STORAGE_KEY, mode);
  };

  useEffect(() => {
    fetchLicenses();
  }, [search, filterCategory, filterDept, filterStatus]);

  const fetchDepartments = async () => {
    const res = await fetch('/api/departments');
    if (res.ok) setDepartments(await res.json());
  };

  const fetchStats = async () => {
    const res = await fetch('/api/licenses/stats');
    if (res.ok) setStats(await res.json());
  };

  const fetchLicenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterCategory) params.set('category', filterCategory);
      if (filterDept) params.set('departmentId', filterDept);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/licenses?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLicenses(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xác nhận xóa giấy phép này?')) return;
    const res = await fetch(`/api/licenses/${id}`, { method: 'DELETE' });
    if (res.ok) { fetchLicenses(); fetchStats(); }
  };

  const handleEdit = (license: License) => {
    setEditingLicense(license);
    setViewingLicense(null);
    setShowForm(true);
  };

  const handleView = async (license: License) => {
    // Fetch full detail with renewals
    const res = await fetch(`/api/licenses/${license.id}`);
    if (res.ok) setViewingLicense(await res.json());
  };

  const handleFormSuccess = () => {
    fetchLicenses();
    fetchStats();
    setShowForm(false);
    setEditingLicense(null);
  };

  const handleRefreshDetail = async () => {
    if (!viewingLicense) return;
    const res = await fetch(`/api/licenses/${viewingLicense.id}`);
    if (res.ok) setViewingLicense(await res.json());
    fetchLicenses();
    fetchStats();
  };

  const activeCount = stats.total - stats.expired - stats.expiringSoon;

  return (
    <div>
      {/* Header */}
      <PageHeader
        icon={ShieldCheck}
        title="Quản lý Giấy phép"
        description="Giấy phép hoạt động, thiết bị, phương tiện của bệnh viện"
        className="mb-6"
        actions={
          <button
            onClick={() => { setEditingLicense(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-600 text-white text-sm font-medium rounded-xl hover:bg-cyan-700 transition-all shadow-sm shadow-cyan-500/20"
          >
            + Thêm giấy phép
          </button>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 sm:gap-4">
        <button
          type="button"
          onClick={() => setFilterStatus('')}
          className={cn(
            'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 sm:p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md bg-gradient-to-br border-sky-200/80 from-sky-50/60 via-white to-white',
            filterStatus === '' && 'ring-2 ring-sky-500'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-800">Tổng giấy phép</p>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-slate-900">{stats.total}</span>
                <span className="text-xs font-semibold text-sky-700">hồ sơ</span>
              </div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 shadow-sm shadow-sky-200/50 transition-transform group-hover:scale-105">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 border-t border-sky-100/80 pt-2.5 text-xs text-slate-500">
            Tất cả giấy phép đang quản lý
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'ACTIVE' ? '' : 'ACTIVE')}
          className={cn(
            'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 sm:p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md bg-gradient-to-br border-emerald-200/80 from-emerald-50/60 via-white to-white',
            filterStatus === 'ACTIVE' && 'ring-2 ring-emerald-500'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Còn hiệu lực</p>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-slate-900">{activeCount}</span>
                <span className="text-xs font-semibold text-emerald-700">hợp lệ</span>
              </div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-sm shadow-emerald-200/50 transition-transform group-hover:scale-105">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 border-t border-emerald-100/80 pt-2.5 text-xs text-slate-500">
            Bấm để lọc giấy phép còn hạn
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'EXPIRING_SOON' ? '' : 'EXPIRING_SOON')}
          className={cn(
            'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 sm:p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md bg-gradient-to-br border-amber-200/80 from-amber-50/60 via-white to-white',
            filterStatus === 'EXPIRING_SOON' && 'ring-2 ring-amber-500'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Sắp hết hạn</p>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-slate-900">{stats.expiringSoon}</span>
                <span className="text-xs font-semibold text-amber-700">&lt;90 ngày</span>
              </div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shadow-sm shadow-amber-200/50 transition-transform group-hover:scale-105">
              <Clock className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 border-t border-amber-100/80 pt-2.5 text-xs text-slate-500">
            Cần lên kế hoạch gia hạn sớm
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'EXPIRED' ? '' : 'EXPIRED')}
          className={cn(
            'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 sm:p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md bg-gradient-to-br border-rose-200/80 from-rose-50/60 via-white to-white',
            filterStatus === 'EXPIRED' && 'ring-2 ring-rose-500'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-800">Đã hết hạn</p>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-slate-900">{stats.expired}</span>
                <span className="text-xs font-semibold text-rose-700">cần xử lý</span>
              </div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 shadow-sm shadow-rose-200/50 transition-transform group-hover:scale-105">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 border-t border-rose-100/80 pt-2.5 text-xs text-slate-500">
            Giấy phép quá hạn chưa gia hạn
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200/80">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text" placeholder="Tìm tên, số giấy phép..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          />
          <Select
            value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          >
            <option value="">Tất cả loại</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select
            value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          >
            <option value="">Tất cả khoa/phòng</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          <Select
            value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Còn hiệu lực</option>
            <option value="EXPIRING_SOON">Sắp hết hạn</option>
            <option value="EXPIRED">Đã hết hạn</option>
          </Select>
        </div>
      </div>

      {/* View switcher */}
      <div className="mb-4 flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {([
          { mode: 'table' as const, icon: Table2, label: 'Bảng' },
          { mode: 'kanban' as const, icon: LayoutGrid, label: 'Kanban' },
          { mode: 'timeline' as const, icon: GanttChart, label: 'Timeline' },
        ]).map(({ mode, icon: Icon, label }) => (
          <button
            key={mode}
            onClick={() => changeView(mode)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all ${
              viewMode === mode
                ? 'bg-white text-cyan-600 shadow-sm font-medium'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-12 text-center">
          <p className="text-slate-500">Đang tải...</p>
        </div>
      ) : viewMode === 'kanban' ? (
        <LicenseKanban
          licenses={licenses}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ) : viewMode === 'timeline' ? (
        <LicenseTimeline
          licenses={licenses}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ) : (
        <LicenseList
          licenses={licenses}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Modals */}
      {showForm && (
        <LicenseForm
          initialData={editingLicense ? {
            id: editingLicense.id,
            name: editingLicense.name,
            licenseNumber: editingLicense.licenseNumber || '',
            category: editingLicense.category,
            issuedBy: editingLicense.issuedBy || '',
            issuedDate: editingLicense.issuedDate ? editingLicense.issuedDate.split('T')[0] : '',
            expiryDate: editingLicense.expiryDate ? editingLicense.expiryDate.split('T')[0] : '',
            scope: editingLicense.scope || '',
            fileUrl: editingLicense.fileUrl || '',
            notes: editingLicense.notes || '',
            departmentId: editingLicense.department?.id || '',
          } : undefined}
          departments={departments}
          onSuccess={handleFormSuccess}
          onClose={() => { setShowForm(false); setEditingLicense(null); }}
        />
      )}

      {viewingLicense && (
        <LicenseDetail
          license={viewingLicense}
          onClose={() => setViewingLicense(null)}
          onEdit={() => handleEdit(viewingLicense)}
          onRefresh={handleRefreshDetail}
        />
      )}
    </div>
  );
}
