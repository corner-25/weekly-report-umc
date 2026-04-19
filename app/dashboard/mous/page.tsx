'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { MOUList, type MOUItem } from '@/components/mous/MOUList';
import { MOUForm } from '@/components/mous/MOUForm';
import { MOUDetail } from '@/components/mous/MOUDetail';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/components/mous/MOUUtils';
import { useMOUStats, useMOUList, useMOUDetail, useDepartments } from '@/lib/swr';
import { PageHeader } from '@/components/ui/PageHeader';
import { CompactStatCard } from '@/components/ui/StatCard';
import { Handshake, Plus, Search, X, FileDown, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';

type SortKey = 'updatedAt' | 'expiryDate' | 'signedDate' | 'title';

export default function MOUsPage() {
  const searchParams = useSearchParams();
  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState(() => searchParams.get('status') || '');
  const [filterDept, setFilterDept] = useState('');

  useEffect(() => {
    const s = searchParams.get('status');
    if (s) setFilterStatus(s);
  }, [searchParams]);
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MOUItem | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // SWR hooks — auto-cache, auto-revalidate
  const { data: stats } = useMOUStats();
  const { data: departments = [] } = useDepartments() as { data: { id: string; name: string }[] | undefined };
  const listParams = useMemo(() => ({
    search,
    category: filterCategory,
    status: filterStatus,
    departmentId: filterDept,
    sort: sortKey,
    dir: sortDir,
    page: String(page),
    pageSize: String(pageSize),
  }), [search, filterCategory, filterStatus, filterDept, sortKey, sortDir, page]);
  const { data: listData, isLoading: loading, mutate: mutateItems } = useMOUList(listParams) as {
    data: { items: MOUItem[]; total: number; page: number; totalPages: number } | undefined;
    isLoading: boolean;
    mutate: () => void;
  };
  const items = listData?.items ?? [];
  const total = listData?.total ?? 0;
  const totalPages = listData?.totalPages ?? 0;
  const { data: viewingItem, mutate: mutateDetail } = useMOUDetail(viewingId);

  const hasFilters = !!(search || filterCategory || filterStatus || filterDept);

  const clearFilters = () => {
    setSearch('');
    setFilterCategory('');
    setFilterStatus('');
    setFilterDept('');
    setPage(1);
  };

  const handleView = (id: string) => setViewingId(id);
  const handleEdit = (item: MOUItem) => { setEditingItem(item); setShowForm(true); };

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

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterCategory) params.set('category', filterCategory);
      if (filterStatus) params.set('status', filterStatus);
      if (filterDept) params.set('departmentId', filterDept);
      params.set('sort', sortKey);
      params.set('dir', sortDir);

      const res = await fetch(`/api/mous/export?${params.toString()}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `MOU_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      alert('Không thể xuất file. Thử lại sau.');
    } finally {
      setExporting(false);
    }
  };

  const inputClass = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white transition-colors';

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
    setPage(1);
  };

  const sortLabels: Record<SortKey, string> = {
    updatedAt: 'Cập nhật gần nhất',
    expiryDate: 'Ngày hết hạn',
    signedDate: 'Ngày ký',
    title: 'Tên MOU',
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader
        icon={Handshake}
        title="Quản lý MOU"
        description="Biên bản ghi nhớ & Thỏa thuận hợp tác"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting || total === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown className="w-4 h-4" />
              {exporting ? 'Đang xuất...' : 'Xuất Excel'}
            </button>
            <button
              onClick={() => { setEditingItem(null); setShowForm(true); }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl hover:from-cyan-600 hover:to-blue-700 shadow-sm shadow-cyan-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              Thêm MOU
            </button>
          </div>
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
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className={`${inputClass} pl-9`}
            />
          </div>
          <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }} className={inputClass}>
            <option value="">Tất cả loại</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className={inputClass}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={filterDept} onChange={(e) => { setFilterDept(e.target.value); setPage(1); }} className={inputClass}>
            <option value="">Tất cả phòng</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1 text-xs text-slate-500">
              <ArrowUpDown className="w-3.5 h-3.5" />
              Sắp xếp:
            </div>
            {(Object.keys(sortLabels) as SortKey[]).map((k) => (
              <button
                key={k}
                onClick={() => toggleSort(k)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg ring-1 ring-inset transition-colors whitespace-nowrap ${
                  sortKey === k
                    ? 'bg-slate-800 text-white ring-slate-800'
                    : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {sortLabels[k]}
                {sortKey === k && (sortDir === 'desc' ? ' ↓' : ' ↑')}
              </button>
            ))}
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Xóa bộ lọc
            </button>
          )}
        </div>

        {(hasFilters || total > 0) && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            Hiển thị <span className="font-medium text-slate-700">{items.length}</span>
            {' / '}
            <span className="font-medium text-slate-700">{total}</span> MOU
            {hasFilters && ' (đã lọc)'}
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <MOUList items={items} onView={handleView} onEdit={handleEdit} onDelete={handleDelete} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200/80 p-3 shadow-sm">
              <div className="text-xs text-slate-500">
                Trang <span className="font-medium text-slate-700">{page}</span> / {totalPages}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Trước
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Sau
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
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
          onRefresh={() => mutateDetail()}
        />
      )}
    </div>
  );
}
