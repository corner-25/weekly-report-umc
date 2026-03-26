'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import LicenseList from '@/components/licenses/LicenseList';
import LicenseForm from '@/components/licenses/LicenseForm';
import LicenseDetail from '@/components/licenses/LicenseDetail';
import { CATEGORY_LABELS } from '@/components/licenses/LicenseUtils';

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

  useEffect(() => {
    fetchDepartments();
    fetchStats();
  }, []);

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
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all shadow-sm shadow-cyan-500/20"
          >
            + Thêm giấy phép
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4">
          <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          <div className="text-sm text-slate-500 mt-1">Tổng giấy phép</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 border-l-4 border-green-500">
          <div className="text-2xl font-bold text-emerald-600">{activeCount}</div>
          <div className="text-sm text-slate-500 mt-1">Còn hiệu lực</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 border-l-4 border-orange-500">
          <div className="text-2xl font-bold text-orange-600">{stats.expiringSoon}</div>
          <div className="text-sm text-slate-500 mt-1">Sắp hết hạn (&lt;90 ngày)</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 border-l-4 border-red-500">
          <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
          <div className="text-sm text-slate-500 mt-1">Đã hết hạn</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-slate-200/80">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text" placeholder="Tìm tên, số giấy phép..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          />
          <select
            value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          >
            <option value="">Tất cả loại</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select
            value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          >
            <option value="">Tất cả khoa/phòng</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select
            value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Còn hiệu lực</option>
            <option value="EXPIRING_SOON">Sắp hết hạn</option>
            <option value="EXPIRED">Đã hết hạn</option>
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-12 text-center">
          <p className="text-slate-500">Đang tải...</p>
        </div>
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
