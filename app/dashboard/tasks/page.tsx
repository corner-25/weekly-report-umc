'use client';

import { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  ClipboardCheck, Plus, Search, X, Pencil, Trash2, History, Building2,
  LayoutGrid, List as ListIcon, Calendar, CheckCircle2, PlayCircle, Circle,
  ArrowUpDown, ArrowUp, ArrowDown, Star,
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
}

interface MasterTask {
  id: string;
  name: string;
  description: string | null;
  estimatedDuration: number | null;
  startDate: string | null;
  endDate: string | null;
  department: Department;
  latestProgress: number;
  isCompleted: boolean;
  weekCount: number;
  createdAt: string;
}

type StatusKey = 'all' | 'inProgress' | 'completed' | 'notStarted';
type SortKey = 'recent' | 'progress' | 'name' | 'weeks';
type SortDir = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

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

function statusOf(task: MasterTask): Exclude<StatusKey, 'all'> {
  if (task.isCompleted) return 'completed';
  if (task.weekCount > 0) return 'inProgress';
  return 'notStarted';
}

const STATUS_META: Record<Exclude<StatusKey, 'all'>, { label: string; dot: string; text: string; bg: string; ring: string; accent: string }> = {
  inProgress: { label: 'Đang làm', dot: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50', ring: 'ring-blue-200', accent: 'border-l-blue-500' },
  completed: { label: 'Hoàn thành', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200', accent: 'border-l-emerald-500' },
  notStarted: { label: 'Chưa bắt đầu', dot: 'bg-slate-400', text: 'text-slate-600', bg: 'bg-slate-100', ring: 'ring-slate-200', accent: 'border-l-slate-300' },
};

function fmtDate(d: string | null | undefined) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('vi-VN');
}

export default function MasterTasksPage() {
  const [tasks, setTasks] = useState<MasterTask[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingTask, setEditingTask] = useState<MasterTask | null>(null);
  const [selectedTaskHistory, setSelectedTaskHistory] = useState<any>(null);
  const [filterDept, setFilterDept] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('tasks-view') as ViewMode) || 'grid';
    }
    return 'grid';
  });
  const [formData, setFormData] = useState({
    departmentId: '',
    name: '',
    description: '',
    startDate: '',
    endDate: '',
  });
  const [error, setError] = useState('');
  const [deleteTargetTask, setDeleteTargetTask] = useState<MasterTask | null>(null);

  useEffect(() => {
    fetchDepartments();
    fetchTasks();
  }, [filterDept]);

  const fetchDepartments = async () => {
    try {
      const response = await fetch('/api/departments');
      if (response.ok) setDepartments(await response.json());
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const params = new URLSearchParams();
      if (filterDept) params.append('departmentId', filterDept);
      const response = await fetch(`/api/master-tasks?${params}`);
      if (response.ok) setTasks(await response.json());
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingTask(null);
    setFormData({ departmentId: '', name: '', description: '', startDate: '', endDate: '' });
    setError('');
    setShowModal(true);
  };

  const handleEdit = (task: MasterTask) => {
    setEditingTask(task);
    setFormData({
      departmentId: task.department.id,
      name: task.name,
      description: task.description || '',
      startDate: task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '',
      endDate: task.endDate ? new Date(task.endDate).toISOString().split('T')[0] : '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (formData.startDate && formData.endDate) {
      if (new Date(formData.endDate) < new Date(formData.startDate)) {
        setError('Ngày kết thúc phải sau ngày bắt đầu');
        return;
      }
    }
    try {
      const url = editingTask ? `/api/master-tasks/${editingTask.id}` : '/api/master-tasks';
      const method = editingTask ? 'PUT' : 'POST';
      const body: any = {
        name: formData.name,
        description: formData.description || undefined,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
      };
      if (!editingTask) body.departmentId = formData.departmentId;
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error || 'Có lỗi xảy ra');
      else { setShowModal(false); fetchTasks(); }
    } catch {
      setError('Có lỗi xảy ra');
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetTask) return;
    try {
      const response = await fetch(`/api/master-tasks/${deleteTargetTask.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) alert(data.error || 'Có lỗi xảy ra');
      else fetchTasks();
    } catch {
      alert('Có lỗi xảy ra');
    } finally {
      setDeleteTargetTask(null);
    }
  };

  const handleViewHistory = async (task: MasterTask) => {
    try {
      const response = await fetch(`/api/master-tasks/${task.id}`);
      if (response.ok) {
        setSelectedTaskHistory(await response.json());
        setShowHistoryModal(true);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const counts = useMemo(() => {
    const c = { all: tasks.length, inProgress: 0, completed: 0, notStarted: 0 };
    for (const t of tasks) {
      const s = statusOf(t);
      c[s]++;
    }
    return c;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = tasks.filter((t) => {
      if (statusFilter !== 'all' && statusOf(t) !== statusFilter) return false;
      if (q && !t.name.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) return false;
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case 'name': return a.name.localeCompare(b.name, 'vi') * dir;
        case 'progress': return (a.latestProgress - b.latestProgress) * dir;
        case 'weeks': return (a.weekCount - b.weekCount) * dir;
        case 'recent':
        default: return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      }
    });
    return list;
  }, [tasks, searchTerm, statusFilter, sortKey, sortDir]);

  const hasFilters = statusFilter !== 'all' || !!filterDept || !!searchTerm.trim();
  const clearFilters = () => { setStatusFilter('all'); setFilterDept(''); setSearchTerm(''); };

  const setView = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') localStorage.setItem('tasks-view', mode);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'name' ? 'asc' : 'desc'); }
  };

  const inputClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white transition-colors';

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={!!deleteTargetTask}
        title="Xác nhận xóa"
        message={`Bạn có chắc muốn xóa nhiệm vụ "${deleteTargetTask?.name}"? Lưu ý: Chỉ xóa được nếu chưa có tiến độ nào.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetTask(null)}
      />

      <PageHeader
        icon={ClipboardCheck}
        title="Nhiệm vụ thường kỳ"
        description="Quản lý các nhiệm vụ định kỳ, lặp lại hàng tuần của từng phòng ban"
        actions={
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all shadow-sm shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            Thêm nhiệm vụ
          </button>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Tổng nhiệm vụ" value={counts.all} icon={ClipboardCheck}
          accent="from-cyan-500 to-blue-600" active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
        />
        <StatCard
          label="Đang làm" value={counts.inProgress} icon={PlayCircle}
          accent="from-blue-500 to-indigo-600" active={statusFilter === 'inProgress'}
          onClick={() => setStatusFilter(statusFilter === 'inProgress' ? 'all' : 'inProgress')}
        />
        <StatCard
          label="Hoàn thành" value={counts.completed} icon={CheckCircle2}
          accent="from-emerald-500 to-teal-600" active={statusFilter === 'completed'}
          onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}
        />
        <StatCard
          label="Chưa bắt đầu" value={counts.notStarted} icon={Circle}
          accent="from-slate-400 to-slate-600" active={statusFilter === 'notStarted'}
          onClick={() => setStatusFilter(statusFilter === 'notStarted' ? 'all' : 'notStarted')}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo tên hoặc mô tả..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`${inputClass} pl-9`}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className={`${inputClass} pl-9 pr-8 appearance-none min-w-[200px]`}
          >
            <option value="">Tất cả phòng ban</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 self-start lg:self-auto">
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

      {/* Sort chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 font-medium">Sắp xếp:</span>
        <SortChip label="Mới nhất" active={sortKey === 'recent'} dir={sortDir} onClick={() => toggleSort('recent')} />
        <SortChip label="Tiến độ" active={sortKey === 'progress'} dir={sortDir} onClick={() => toggleSort('progress')} />
        <SortChip label="Tên" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
        <SortChip label="Số tuần" active={sortKey === 'weeks'} dir={sortDir} onClick={() => toggleSort('weeks')} />
        <div className="flex-1" />
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-3 h-3" /> Xóa bộ lọc
          </button>
        )}
        <span className="text-xs text-slate-500">
          {filteredTasks.length}
          {hasFilters && <span className="text-slate-400"> / {tasks.length}</span>} nhiệm vụ
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Đang tải...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-16 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
            <ClipboardCheck className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-slate-600 font-medium">
            {hasFilters ? 'Không tìm thấy nhiệm vụ phù hợp' : 'Chưa có nhiệm vụ thường kỳ'}
          </p>
          <p className="text-sm text-slate-400 mt-1 mb-4">
            {hasFilters ? 'Thử bỏ bớt bộ lọc' : 'Tạo nhiệm vụ đầu tiên để bắt đầu'}
          </p>
          {!hasFilters && (
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 transition-all text-sm font-medium shadow-sm shadow-cyan-500/20"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm nhiệm vụ
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onHistory={() => handleViewHistory(task)}
              onEdit={() => handleEdit(task)}
              onDelete={() => setDeleteTargetTask(task)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {filteredTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onHistory={() => handleViewHistory(task)}
              onEdit={() => handleEdit(task)}
              onDelete={() => setDeleteTargetTask(task)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                {editingTask ? 'Sửa nhiệm vụ thường kỳ' : 'Thêm nhiệm vụ thường kỳ'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 max-h-[75vh] overflow-y-auto">
              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
              )}

              {!editingTask && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phòng ban *</label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    required
                    className={inputClass}
                  >
                    <option value="">-- Chọn phòng --</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tên nhiệm vụ *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className={inputClass}
                  placeholder="VD: Xây dựng tiêu chuẩn chất lượng lâm sàng"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className={inputClass}
                  placeholder="Mô tả chi tiết nhiệm vụ..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Ngày bắt đầu</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Ngày kết thúc</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              {formData.startDate && formData.endDate && (
                <div className="mb-4 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                  <p className="text-sm text-blue-800">
                    Số tuần dự kiến:{' '}
                    <strong>
                      {Math.ceil(
                        (new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) /
                        (7 * 24 * 60 * 60 * 1000)
                      )}
                    </strong>{' '}
                    tuần
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 text-sm font-medium transition-all"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && selectedTaskHistory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] shadow-xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-start px-6 py-4 border-b border-slate-100">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <History className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Lịch sử tiến độ</span>
                </div>
                <h2 className="text-base font-semibold text-slate-900 truncate">{selectedTaskHistory.name}</h2>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{selectedTaskHistory.department.name}</span>
                </div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto">
              {selectedTaskHistory.description && (
                <div className="mb-5 p-3 bg-slate-50 rounded-xl text-sm text-slate-700">
                  {selectedTaskHistory.description}
                </div>
              )}

              {selectedTaskHistory.weekProgress.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <History className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-slate-500 text-sm">Chưa có tiến độ nào được ghi nhận</p>
                </div>
              ) : (
                <div className="relative pl-6 before:absolute before:left-[11px] before:top-1 before:bottom-1 before:w-px before:bg-slate-200">
                  {selectedTaskHistory.weekProgress.map((p: any) => {
                    const dotColor =
                      p.completedAt ? 'bg-emerald-500 ring-emerald-100'
                      : p.progress >= 50 ? 'bg-blue-500 ring-blue-100'
                      : 'bg-amber-500 ring-amber-100';
                    return (
                      <div key={p.id} className="relative mb-4 last:mb-0">
                        <div className={`absolute -left-[22px] top-2 w-3 h-3 rounded-full ring-4 ${dotColor}`} />
                        <div className="rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition-colors p-3.5">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-slate-900">
                                  Tuần {p.week.weekNumber}/{p.week.year}
                                </span>
                                {p.isImportant && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 rounded">
                                    <Star className="w-2.5 h-2.5" /> Quan trọng
                                  </span>
                                )}
                                {p.completedAt && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-100 rounded">
                                    <CheckCircle2 className="w-2.5 h-2.5" /> Hoàn thành
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {fmtDate(p.week.startDate)} – {fmtDate(p.week.endDate)}
                              </div>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              <div className="w-20 bg-slate-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${p.progress === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-cyan-500 to-blue-500'}`}
                                  style={{ width: `${p.progress}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-slate-700 tabular-nums">{p.progress}%</span>
                            </div>
                          </div>
                          <div className="text-xs text-slate-700 space-y-1 mt-2 pt-2 border-t border-slate-100">
                            {p.result && <div><span className="font-medium text-slate-500">Kết quả:</span> {p.result}</div>}
                            {p.timePeriod && <div><span className="font-medium text-slate-500">Thời gian:</span> {p.timePeriod}</div>}
                            {p.nextWeekPlan && <div><span className="font-medium text-slate-500">Kế hoạch tuần sau:</span> {p.nextWeekPlan}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, icon: Icon, accent, active, onClick,
}: {
  label: string; value: number; icon: React.ComponentType<{ className?: string }>;
  accent: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-3 transition-all ${
        active ? 'border-cyan-400 ring-2 ring-cyan-100' : 'border-slate-200/80 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accent} text-white flex items-center justify-center shadow-sm shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-xl font-semibold text-slate-900 leading-tight tabular-nums">{value.toLocaleString('vi-VN')}</div>
      </div>
    </button>
  );
}

function SortChip({
  label, active, dir, onClick,
}: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
      {active
        ? (dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
        : <ArrowUpDown className="w-3 h-3 opacity-50" />}
    </button>
  );
}

function ProgressBar({ value, small }: { value: number; small?: boolean }) {
  const done = value === 100;
  return (
    <div className={`w-full bg-slate-200 rounded-full ${small ? 'h-1.5' : 'h-2'}`}>
      <div
        className={`rounded-full transition-all ${small ? 'h-1.5' : 'h-2'} ${done ? 'bg-emerald-500' : 'bg-gradient-to-r from-cyan-500 to-blue-500'}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function StatusPill({ status }: { status: Exclude<StatusKey, 'all'> }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-full ${meta.bg} ${meta.text} ring-1 ring-inset ${meta.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function TaskCard({
  task, onHistory, onEdit, onDelete,
}: {
  task: MasterTask; onHistory: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const status = statusOf(task);
  const meta = STATUS_META[status];
  const grad = hashGradient(task.department.id);
  const plannedWeeks = task.startDate && task.endDate
    ? Math.ceil((new Date(task.endDate).getTime() - new Date(task.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <div className={`group relative bg-white rounded-2xl border-l-4 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all overflow-hidden ${meta.accent}`}>
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className={`shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${grad} text-white flex items-center justify-center font-semibold text-xs shadow-sm`}
            title={task.department.name}>
            {initials(task.department.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">{task.name}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-slate-500 truncate max-w-[180px]">{task.department.name}</span>
              <StatusPill status={status} />
            </div>
          </div>
        </div>

        {task.description && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-3">{task.description}</p>
        )}

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Tiến độ</span>
            <span className="text-xs font-semibold text-slate-700 tabular-nums">{task.latestProgress}%</span>
          </div>
          <ProgressBar value={task.latestProgress} />
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            {task.weekCount}{plannedWeeks ? ` / ${plannedWeeks}` : ''} tuần
          </span>
          {task.startDate && task.endDate && (
            <span className="inline-flex items-center gap-1 truncate">
              {fmtDate(task.startDate)} – {fmtDate(task.endDate)}
            </span>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onHistory}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
            title="Lịch sử"
          >
            <History className="w-3.5 h-3.5" /> Lịch sử
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
            title="Sửa"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Xóa"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskRow({
  task, onHistory, onEdit, onDelete,
}: {
  task: MasterTask; onHistory: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const status = statusOf(task);
  const meta = STATUS_META[status];
  const grad = hashGradient(task.department.id);
  const plannedWeeks = task.startDate && task.endDate
    ? Math.ceil((new Date(task.endDate).getTime() - new Date(task.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <div className={`group flex items-center gap-3 px-4 py-3 border-l-4 hover:bg-slate-50/60 transition-colors ${meta.accent}`}>
      <div className={`shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${grad} text-white flex items-center justify-center font-semibold text-[11px] shadow-sm`}
        title={task.department.name}>
        {initials(task.department.name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-slate-900 truncate">{task.name}</div>
          <StatusPill status={status} />
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
          <span className="truncate max-w-[200px]">{task.department.name}</span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {task.weekCount}{plannedWeeks ? `/${plannedWeeks}` : ''} tuần
          </span>
          {task.startDate && task.endDate && (
            <span className="hidden lg:inline">{fmtDate(task.startDate)} – {fmtDate(task.endDate)}</span>
          )}
        </div>
      </div>
      <div className="hidden md:flex items-center gap-2 w-40 shrink-0">
        <ProgressBar value={task.latestProgress} small />
        <span className="text-xs font-semibold text-slate-700 tabular-nums w-9 text-right">{task.latestProgress}%</span>
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={onHistory}
          className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
          title="Lịch sử"
        >
          <History className="w-3.5 h-3.5" />
        </button>
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
