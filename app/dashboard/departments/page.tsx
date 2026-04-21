'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Building2, Plus, Search, BarChart3, Pencil, Trash2, X,
  ClipboardList, Users, Handshake, ShieldCheck, LineChart, ChevronRight, LayoutGrid, List as ListIcon,
} from 'lucide-react';

interface DeptCounts {
  masterTasks: number;
  metricDefinitions: number;
  secretaries: number;
  mous: number;
  licenses: number;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
  _count?: Partial<DeptCounts>;
}

const GRADIENTS = [
  'from-cyan-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-indigo-500 to-sky-600',
  'from-lime-500 to-emerald-600',
  'from-fuchsia-500 to-purple-600',
];

function hashGradient(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('departments-view') as 'grid' | 'list') || 'grid';
    }
    return 'grid';
  });

  useEffect(() => { fetchDepartments(); }, []);

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      if (response.ok) setDepartments(await response.json());
    } catch (error) {
      console.error('Error fetching departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingDept(null);
    setFormData({ name: '', description: '' });
    setError('');
    setShowModal(true);
  };

  const handleEdit = (dept: Department) => {
    setEditingDept(dept);
    setFormData({ name: dept.name, description: dept.description || '' });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const url = editingDept ? `/api/departments/${editingDept.id}` : '/api/departments';
      const method = editingDept ? 'PUT' : 'POST';
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Có lỗi xảy ra'); }
      else { setShowModal(false); fetchDepartments(); }
    } catch { setError('Có lỗi xảy ra'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const response = await fetch(`/api/departments/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Có lỗi xảy ra'); }
      else { setDeleteTarget(null); fetchDepartments(); }
    } catch { setError('Có lỗi xảy ra khi xóa phòng.'); setDeleteTarget(null); }
  };

  const filtered = useMemo(
    () =>
      departments
        .filter((d) => d.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
          const diff = (b._count?.masterTasks ?? 0) - (a._count?.masterTasks ?? 0);
          if (diff !== 0) return diff;
          return a.name.localeCompare(b.name, 'vi');
        }),
    [departments, searchTerm]
  );

  const totals = useMemo(() => {
    return departments.reduce(
      (acc, d) => {
        const c = d._count ?? {};
        acc.tasks += c.masterTasks ?? 0;
        acc.metrics += c.metricDefinitions ?? 0;
        acc.secretaries += c.secretaries ?? 0;
        acc.mous += c.mous ?? 0;
        acc.licenses += c.licenses ?? 0;
        return acc;
      },
      { tasks: 0, metrics: 0, secretaries: 0, mous: 0, licenses: 0 },
    );
  }, [departments]);

  const inputClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white transition-colors';

  const setView = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') localStorage.setItem('departments-view', mode);
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={!!deleteTarget}
        title="Xóa phòng ban"
        message={`Bạn có chắc muốn xóa phòng "${deleteTarget?.name}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <PageHeader
        icon={Building2}
        title="Phòng ban"
        actions={
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all shadow-sm shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            Thêm phòng
          </button>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryTile label="Phòng ban" value={departments.length} icon={Building2} accent="from-cyan-500 to-blue-600" />
        <SummaryTile label="Nhiệm vụ" value={totals.tasks} icon={ClipboardList} accent="from-violet-500 to-purple-600" />
        <SummaryTile label="Thư ký" value={totals.secretaries} icon={Users} accent="from-emerald-500 to-teal-600" />
        <SummaryTile label="MOU" value={totals.mous} icon={Handshake} accent="from-amber-500 to-orange-600" />
        <SummaryTile label="Giấy phép" value={totals.licenses} icon={ShieldCheck} accent="from-rose-500 to-pink-600" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm phòng ban..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${inputClass} pl-9`}
          />
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 self-start sm:self-auto">
          <button
            onClick={() => setView('grid')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
            title="Dạng thẻ"
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Thẻ
          </button>
          <button
            onClick={() => setView('list')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}
            title="Dạng danh sách"
          >
            <ListIcon className="w-3.5 h-3.5" /> Danh sách
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Đang tải...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Building2 className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">Không có phòng ban nào</p>
          <p className="text-sm text-slate-400 mt-1">{searchTerm ? 'Thử từ khóa khác' : 'Thêm phòng ban đầu tiên'}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((dept) => (
            <DeptCard
              key={dept.id}
              dept={dept}
              onEdit={() => handleEdit(dept)}
              onDelete={() => setDeleteTarget(dept)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {filtered.map((dept) => (
            <DeptRow
              key={dept.id}
              dept={dept}
              onEdit={() => handleEdit(dept)}
              onDelete={() => setDeleteTarget(dept)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                {editingDept ? 'Sửa phòng ban' : 'Thêm phòng ban'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5">
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tên phòng *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className={inputClass}
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors">
                  Hủy
                </button>
                <button type="submit" className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 text-sm font-medium transition-all">
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  label, value, icon: Icon, accent,
}: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accent} text-white flex items-center justify-center shadow-sm`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-xl font-semibold text-slate-900 leading-tight">{value.toLocaleString('vi-VN')}</div>
      </div>
    </div>
  );
}

function DeptCard({
  dept, onEdit, onDelete,
}: { dept: Department; onEdit: () => void; onDelete: () => void }) {
  const grad = hashGradient(dept.id);
  const c = dept._count ?? {};
  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden">
      <div className={`h-1 bg-gradient-to-r ${grad}`} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br ${grad} text-white flex items-center justify-center font-semibold text-sm shadow-sm`}>
            {initials(dept.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">{dept.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 min-h-[2rem]">
              {dept.description || 'Chưa có mô tả'}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <StatChip icon={ClipboardList} label="NV" value={c.masterTasks ?? 0} color="text-violet-600 bg-violet-50" />
          <StatChip icon={Users} label="Thư ký" value={c.secretaries ?? 0} color="text-emerald-600 bg-emerald-50" />
          <StatChip icon={Handshake} label="MOU" value={c.mous ?? 0} color="text-amber-600 bg-amber-50" />
          <StatChip icon={ShieldCheck} label="GP" value={c.licenses ?? 0} color="text-rose-600 bg-rose-50" />
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1">
          <Link
            href={`/dashboard/departments/${dept.id}/metrics`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
            title="Chỉ số"
          >
            <LineChart className="w-3.5 h-3.5 text-purple-500" />
            <span>Chỉ số</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
          </Link>
          <button
            onClick={onEdit}
            className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
            title="Sửa"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Xóa"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatChip({
  icon: Icon, label, value, color,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; color: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      <span className="text-[11px] font-medium">{label}</span>
      <span className="ml-auto text-xs font-semibold">{value}</span>
    </div>
  );
}

function DeptRow({
  dept, onEdit, onDelete,
}: { dept: Department; onEdit: () => void; onDelete: () => void }) {
  const grad = hashGradient(dept.id);
  const c = dept._count ?? {};
  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
      <div className={`shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${grad} text-white flex items-center justify-center font-semibold text-xs shadow-sm`}>
        {initials(dept.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-slate-900 truncate">{dept.name}</div>
        <div className="text-xs text-slate-500 truncate">{dept.description || '—'}</div>
      </div>
      <div className="hidden md:flex items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5 text-violet-500" />{c.masterTasks ?? 0}</span>
        <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5 text-emerald-500" />{c.secretaries ?? 0}</span>
        <span className="inline-flex items-center gap-1"><Handshake className="w-3.5 h-3.5 text-amber-500" />{c.mous ?? 0}</span>
        <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-rose-500" />{c.licenses ?? 0}</span>
      </div>
      <div className="flex items-center gap-0.5">
        <Link
          href={`/dashboard/departments/${dept.id}/metrics`}
          className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
          title="Chỉ số"
        >
          <BarChart3 className="w-3.5 h-3.5" />
        </Link>
        <button
          onClick={onEdit}
          className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
          title="Sửa"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          title="Xóa"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
