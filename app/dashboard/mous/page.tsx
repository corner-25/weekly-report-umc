'use client';

import { useState } from 'react';
import { MOUList, type MOUItem } from '@/components/mous/MOUList';
import { MOUForm } from '@/components/mous/MOUForm';
import { MOUDetail } from '@/components/mous/MOUDetail';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/components/mous/MOUUtils';
import { useMOUStats, useMOUList, useMOUDetail, useDepartments } from '@/lib/swr';
import { PageHeader } from '@/components/ui/PageHeader';
import { CompactStatCard } from '@/components/ui/StatCard';
import { Handshake, Plus, Search } from 'lucide-react';

export default function MOUsPage() {
  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDept, setFilterDept] = useState('');

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MOUItem | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  // SWR hooks — auto-cache, auto-revalidate
  const { data: stats } = useMOUStats();
  const { data: departments = [] } = useDepartments() as { data: { id: string; name: string }[] | undefined };
  const { data: items = [], isLoading: loading, mutate: mutateItems } = useMOUList({
    search,
    category: filterCategory,
    status: filterStatus,
    departmentId: filterDept,
  });
  const { data: viewingItem, mutate: mutateDetail } = useMOUDetail(viewingId);

  const handleView = (id: string) => {
    setViewingId(id);
  };

  const handleEdit = (item: MOUItem) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/mous/${id}`, { method: 'DELETE' });
      mutateItems();
    } catch (err) {
      console.error('Error deleting MOU:', err);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingItem(null);
    mutateItems();
  };

  const handleRefreshDetail = () => {
    mutateDetail();
  };

  const inputClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white transition-colors';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader
        icon={Handshake}
        title="Quản lý MOU"
        description="Biên bản ghi nhớ & Thỏa thuận hợp tác"
        actions={
          <button
            onClick={() => { setEditingItem(null); setShowForm(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl hover:from-cyan-600 hover:to-blue-700 shadow-sm shadow-cyan-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Thêm MOU
          </button>
        }
      />

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <CompactStatCard label="Tổng MOU" value={stats.total} color="gray" />
          <CompactStatCard label="Đang hiệu lực" value={stats.active} color="green" />
          <CompactStatCard label="Sắp hết hạn" value={stats.expiringSoon} color="orange" />
          <CompactStatCard label="Đã hết hạn" value={stats.expired} color="red" />
          <CompactStatCard label="Bản nháp" value={stats.draft} color="blue" />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm MOU, đối tác..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`${inputClass} pl-9`}
            />
          </div>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className={inputClass}>
            <option value="">Tất cả loại</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputClass}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className={inputClass}>
            <option value="">Tất cả phòng</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <MOUList items={items} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} />
      )}

      {/* Form Modal */}
      {showForm && (
        <MOUForm
          initialData={editingItem ? {
            id: editingItem.id,
            title: editingItem.title,
            mouNumber: editingItem.mouNumber || '',
            category: editingItem.category,
            status: editingItem.status,
            partnerName: editingItem.partnerName,
            partnerCountry: editingItem.partnerCountry || '',
            signedDate: editingItem.signedDate || '',
            expiryDate: editingItem.expiryDate || '',
            departmentId: editingItem.department?.id || '',
            contactPerson: editingItem.contactPerson || '',
          } : undefined}
          departments={departments}
          onSuccess={handleFormSuccess}
          onClose={() => { setShowForm(false); setEditingItem(null); }}
        />
      )}

      {/* Detail Modal */}
      {viewingItem && (
        <MOUDetail
          mou={viewingItem as Parameters<typeof MOUDetail>[0]['mou']}
          onClose={() => setViewingId(null)}
          onEdit={() => {
            setViewingId(null);
            handleEdit(viewingItem as MOUItem);
          }}
          onRefresh={handleRefreshDetail}
        />
      )}
    </div>
  );
}

