'use client';

import { Select } from '@/components/ui/Select';
import { useState, useEffect } from 'react';
import { Plus, Search, UserCheck, UserMinus, Users, UserX } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/lib/utils';
import { SecretaryList } from '@/components/secretaries/SecretaryList';
import { SecretaryForm } from '@/components/secretaries/SecretaryForm';
import { SecretaryDetail } from '@/components/secretaries/SecretaryDetail';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface Secretary {
  id: string;
  fullName: string;
  dateOfBirth: string | null;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  status: string;
  startDate: string | null;
  notes: string | null;
  secretaryType: { id: string; name: string; color: string | null } | null;
  currentDepartment: { id: string; name: string } | null;
  certificates: any[];
  _count: { transferLogs: number };
}

interface SecretaryType {
  id: string;
  name: string;
  color: string | null;
}

interface Department {
  id: string;
  name: string;
}

export default function SecretariesPage() {
  const [secretaries, setSecretaries] = useState<Secretary[]>([]);
  const [types, setTypes] = useState<SecretaryType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSecretary, setEditingSecretary] = useState<Secretary | null>(null);
  const [selectedSecretary, setSelectedSecretary] = useState<Secretary | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    departmentId: '',
    typeId: '',
    status: '',
  });
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const fetchSecretaries = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.departmentId) params.append('departmentId', filters.departmentId);
      if (filters.typeId) params.append('typeId', filters.typeId);
      if (filters.status) params.append('status', filters.status);

      const res = await fetch(`/api/secretaries?${params}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setSecretaries(data);
      } else {
        setSecretaries([]);
      }
    } catch (error) {
      console.error('Error fetching secretaries:', error);
      setSecretaries([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTypes = async () => {
    try {
      const res = await fetch('/api/secretary-types');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setTypes(data);
      } else {
        setTypes([]);
      }
    } catch (error) {
      console.error('Error fetching types:', error);
      setTypes([]);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments');
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setDepartments(data);
      } else {
        setDepartments([]);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      setDepartments([]);
    }
  };

  useEffect(() => {
    fetchTypes();
    fetchDepartments();
  }, []);

  useEffect(() => {
    fetchSecretaries();
  }, [filters]);

  const handleCreate = () => {
    setEditingSecretary(null);
    setShowForm(true);
  };

  const handleEdit = (secretary: Secretary) => {
    setEditingSecretary(secretary);
    setShowForm(true);
  };

  const handleView = (secretary: Secretary) => {
    setSelectedSecretary(secretary);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const res = await fetch(`/api/secretaries/${deleteTargetId}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteTargetId(null);
        fetchSecretaries();
      }
    } catch {
      setDeleteTargetId(null);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingSecretary(null);
    fetchSecretaries();
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      <ConfirmDialog
        open={!!deleteTargetId}
        title="Xóa thư ký"
        message="Bạn có chắc muốn xóa thư ký này?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetId(null)}
      />

      <PageHeader
        icon={Users}
        title="Danh sách thư ký"
        description="Tra cứu, phân công và cập nhật hồ sơ nhân sự"
        className="mb-6"
        actions={
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Thêm thư ký
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, email, SĐT..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-slate-400"
            />
          </div>
          <div>
            <Select
              value={filters.departmentId}
              onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="">Tất cả khoa/phòng</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Select
              value={filters.typeId}
              onChange={(e) => setFilters({ ...filters, typeId: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="">Tất cả loại</option>
              {types.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Nghỉ việc</option>
              <option value="ON_LEAVE">Nghỉ phép</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        <button
          type="button"
          onClick={() => setFilters({ ...filters, status: '' })}
          className={cn(
            'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 sm:p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md bg-gradient-to-br border-sky-200/80 from-sky-50/60 via-white to-white',
            filters.status === '' && 'ring-2 ring-sky-500'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-800">Tổng thư ký</p>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-slate-900">{secretaries.length}</span>
                <span className="text-xs font-semibold text-sky-700">nhân sự</span>
              </div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 shadow-sm shadow-sky-200/50 transition-transform group-hover:scale-105">
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 border-t border-sky-100/80 pt-2.5 text-xs text-slate-500">
            Toàn bộ danh sách thư ký
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilters({ ...filters, status: filters.status === 'ACTIVE' ? '' : 'ACTIVE' })}
          className={cn(
            'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 sm:p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md bg-gradient-to-br border-emerald-200/80 from-emerald-50/60 via-white to-white',
            filters.status === 'ACTIVE' && 'ring-2 ring-emerald-500'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Đang hoạt động</p>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-slate-900">
                  {secretaries.filter(s => s.status === 'ACTIVE').length}
                </span>
                <span className="text-xs font-semibold text-emerald-700">đang làm</span>
              </div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-sm shadow-emerald-200/50 transition-transform group-hover:scale-105">
              <UserCheck className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 border-t border-emerald-100/80 pt-2.5 text-xs text-slate-500">
            Đang công tác tại khoa/phòng
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilters({ ...filters, status: filters.status === 'ON_LEAVE' ? '' : 'ON_LEAVE' })}
          className={cn(
            'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 sm:p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md bg-gradient-to-br border-amber-200/80 from-amber-50/60 via-white to-white',
            filters.status === 'ON_LEAVE' && 'ring-2 ring-amber-500'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Đang nghỉ phép</p>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-slate-900">
                  {secretaries.filter(s => s.status === 'ON_LEAVE').length}
                </span>
                <span className="text-xs font-semibold text-amber-700">tạm nghỉ</span>
              </div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shadow-sm shadow-amber-200/50 transition-transform group-hover:scale-105">
              <UserMinus className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 border-t border-amber-100/80 pt-2.5 text-xs text-slate-500">
            Nghỉ thai sản / tạm hoãn
          </div>
        </button>

        <button
          type="button"
          onClick={() => setFilters({ ...filters, status: filters.status === 'INACTIVE' ? '' : 'INACTIVE' })}
          className={cn(
            'group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 sm:p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md bg-gradient-to-br border-rose-200/80 from-rose-50/60 via-white to-white',
            filters.status === 'INACTIVE' && 'ring-2 ring-rose-500'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-rose-800">Không hoạt động</p>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-slate-900">
                  {secretaries.filter(s => s.status === 'INACTIVE').length}
                </span>
                <span className="text-xs font-semibold text-rose-700">nghỉ việc</span>
              </div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 shadow-sm shadow-rose-200/50 transition-transform group-hover:scale-105">
              <UserX className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 border-t border-rose-100/80 pt-2.5 text-xs text-slate-500">
            Đã chuyển công tác hoặc nghỉ việc
          </div>
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-10">Đang tải...</div>
      ) : (
        <SecretaryList
          secretaries={secretaries}
          onEdit={handleEdit}
          onView={handleView}
          onDelete={(id: string) => setDeleteTargetId(id)}
        />
      )}

      {/* Form Modal */}
      {showForm && (
        <SecretaryForm
          secretary={editingSecretary}
          types={types}
          departments={departments}
          onClose={() => setShowForm(false)}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Detail Modal */}
      {selectedSecretary && (
        <SecretaryDetail
          secretaryId={selectedSecretary.id}
          onClose={() => setSelectedSecretary(null)}
          onEdit={() => {
            setEditingSecretary(selectedSecretary);
            setSelectedSecretary(null);
            setShowForm(true);
          }}
        />
      )}
    </div>
  );
}
