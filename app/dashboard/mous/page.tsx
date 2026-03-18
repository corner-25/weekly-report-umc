'use client';

import { useState, useEffect, useCallback } from 'react';
import { MOUList, type MOUItem } from '@/components/mous/MOUList';
import { MOUForm } from '@/components/mous/MOUForm';
import { MOUDetail } from '@/components/mous/MOUDetail';
import { CATEGORY_LABELS, STATUS_LABELS } from '@/components/mous/MOUUtils';

interface Stats {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  draft: number;
  byCategory: { category: string; count: number }[];
}

export default function MOUsPage() {
  const [items, setItems] = useState<MOUItem[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDept, setFilterDept] = useState('');

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MOUItem | null>(null);
  const [viewingItem, setViewingItem] = useState<ReturnType<typeof Object> | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterCategory) params.set('category', filterCategory);
      if (filterStatus) params.set('status', filterStatus);
      if (filterDept) params.set('departmentId', filterDept);

      const res = await fetch(`/api/mous?${params}`);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error('Error fetching MOUs:', err);
    } finally {
      setLoading(false);
    }
  }, [search, filterCategory, filterStatus, filterDept]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/mous/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments');
      const data = await res.json();
      setDepartments(data);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleView = async (id: string) => {
    try {
      const res = await fetch(`/api/mous/${id}`);
      const data = await res.json();
      setViewingItem(data);
    } catch (err) {
      console.error('Error fetching MOU detail:', err);
    }
  };

  const handleEdit = (item: MOUItem) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/mous/${id}`, { method: 'DELETE' });
      fetchItems();
      fetchStats();
    } catch (err) {
      console.error('Error deleting MOU:', err);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingItem(null);
    fetchItems();
    fetchStats();
  };

  const handleRefreshDetail = async () => {
    if (viewingItem?.id) {
      const res = await fetch(`/api/mous/${viewingItem.id}`);
      const data = await res.json();
      setViewingItem(data);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý MOU</h1>
          <p className="text-sm text-gray-500 mt-1">Biên bản ghi nhớ & Thỏa thuận hợp tác</p>
        </div>
        <button
          onClick={() => { setEditingItem(null); setShowForm(true); }}
          className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg hover:from-cyan-600 hover:to-blue-600 shadow-sm"
        >
          + Thêm MOU
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="Tổng MOU" value={stats.total} color="gray" />
          <StatCard label="Đang hiệu lực" value={stats.active} color="green" />
          <StatCard label="Sắp hết hạn" value={stats.expiringSoon} color="orange" />
          <StatCard label="Đã hết hạn" value={stats.expired} color="red" />
          <StatCard label="Bản nháp" value={stats.draft} color="blue" />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <input
              type="text"
              placeholder="Tìm kiếm MOU, đối tác..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>
          <div>
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
            >
              <option value="">Tất cả loại</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
            >
              <option value="">Tất cả trạng thái</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-cyan-500 focus:border-cyan-500"
            >
              <option value="">Tất cả phòng</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
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
          onClose={() => setViewingItem(null)}
          onEdit={() => {
            setViewingItem(null);
            handleEdit(viewingItem as MOUItem);
          }}
          onRefresh={handleRefreshDetail}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-50 text-gray-700',
    green: 'bg-green-50 text-green-700',
    orange: 'bg-orange-50 text-orange-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
  };
  return (
    <div className={`rounded-xl p-3 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
