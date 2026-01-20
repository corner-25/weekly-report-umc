'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface ChecklistItem {
  id: string;
  title: string;
  description?: string | null;
  orderNumber: number;
  isCompleted: boolean;
  completedAt?: string | null;
}

interface ChecklistManagerProps {
  eventId: string;
  items: ChecklistItem[];
  onUpdate: () => void;
}

export function ChecklistManager({ eventId, items, onUpdate }: ChecklistManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [formData, setFormData] = useState({ title: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleToggleComplete = async (itemId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/hospital-events/${eventId}/checklist/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: !currentStatus }),
      });

      if (res.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error toggling completion:', error);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(`/api/hospital-events/${eventId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setFormData({ title: '', description: '' });
        setShowAddForm(false);
        onUpdate();
      }
    } catch (error) {
      console.error('Error adding item:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSubmitting(true);

    try {
      const res = await fetch(`/api/hospital-events/${eventId}/checklist/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setEditingItem(null);
        setFormData({ title: '', description: '' });
        onUpdate();
      }
    } catch (error) {
      console.error('Error updating item:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Bạn có chắc muốn xóa công việc này?')) return;

    try {
      const res = await fetch(`/api/hospital-events/${eventId}/checklist/${itemId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const startEdit = (item: ChecklistItem) => {
    setEditingItem(item);
    setFormData({ title: item.title, description: item.description || '' });
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setFormData({ title: '', description: '' });
  };

  const sortedItems = [...items].sort((a, b) => a.orderNumber - b.orderNumber);

  return (
    <div className="space-y-4">
      {/* Add Button */}
      {!showAddForm && !editingItem && (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
        >
          + Thêm công việc mới
        </button>
      )}

      {/* Add Form */}
      {showAddForm && (
        <form onSubmit={handleAddItem} className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 space-y-3">
          <div>
            <input
              type="text"
              required
              placeholder="Tiêu đề công việc"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <textarea
              rows={2}
              placeholder="Mô tả (tùy chọn)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setFormData({ title: '', description: '' });
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Đang thêm...' : 'Thêm'}
            </button>
          </div>
        </form>
      )}

      {/* Checklist Items */}
      <div className="space-y-2">
        {sortedItems.map((item) => (
          <div key={item.id}>
            {editingItem?.id === item.id ? (
              // Edit Form
              <form onSubmit={handleUpdateItem} className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 space-y-3">
                <div>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Đang lưu...' : 'Lưu'}
                  </button>
                </div>
              </form>
            ) : (
              // Display Item
              <div
                className={`group flex items-start gap-3 p-4 rounded-lg border-2 transition-all ${
                  item.isCompleted
                    ? 'bg-green-50 border-green-200'
                    : 'bg-white border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.isCompleted}
                  onChange={() => handleToggleComplete(item.id, item.isCompleted)}
                  className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                />

                <div className="flex-1">
                  <div className={`font-medium ${item.isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                    {item.title}
                  </div>
                  {item.description && (
                    <div className={`text-sm mt-1 ${item.isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>
                      {item.description}
                    </div>
                  )}
                  {item.isCompleted && item.completedAt && (
                    <div className="text-xs text-green-600 mt-2">
                      ✓ Hoàn thành: {format(new Date(item.completedAt), 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(item)}
                    className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                    title="Sửa"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                    title="Xóa"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {items.length === 0 && !showAddForm && (
        <div className="text-center py-12 text-gray-500">
          Chưa có công việc nào. Nhấn nút bên trên để thêm.
        </div>
      )}
    </div>
  );
}
