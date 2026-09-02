'use client';

import { Select } from '@/components/ui/Select';
import { useState, useEffect } from 'react';
import { Plus, Search, UserCheck, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Kết quả</span><Users className="w-4 h-4 text-slate-400" /></div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{secretaries.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Đang hoạt động</span><UserCheck className="w-4 h-4 text-emerald-600" /></div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {secretaries.filter(s => s.status === 'ACTIVE').length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Đang nghỉ phép</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {secretaries.filter(s => s.status === 'ON_LEAVE').length}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Không hoạt động</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {secretaries.filter(s => s.status === 'INACTIVE').length}
          </div>
        </div>
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
