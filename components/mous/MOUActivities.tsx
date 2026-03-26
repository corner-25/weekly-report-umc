'use client';

import { useState } from 'react';
import { formatDate } from './MOUUtils';
import {
  CalendarDays,
  MapPin,
  Users,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Activity,
} from 'lucide-react';

const ACTIVITY_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'Kế hoạch',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

const ACTIVITY_STATUS_COLORS: Record<string, string> = {
  PLANNED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

const ACTIVITY_TYPES = [
  'Đào tạo',
  'Nghiên cứu',
  'Trao đổi chuyên gia',
  'Hội thảo / Hội nghị',
  'Chuyển giao công nghệ',
  'Tham quan học tập',
  'Khác',
];

interface MOUActivity {
  id: string;
  title: string;
  description: string | null;
  activityType: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  participants: string | null;
  responsible: string | null;
  budget: string | null;
  result: string | null;
  notes: string | null;
}

interface Props {
  mouId: string;
  activities: MOUActivity[];
  onRefresh: () => void;
}

export function MOUActivities({ mouId, activities, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    form.forEach((v, k) => { if (v) data[k] = v.toString(); });

    try {
      const res = await fetch(`/api/mous/${mouId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setShowForm(false);
        onRefresh();
      }
    } catch (err) {
      console.error('Error creating activity:', err);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-600" />
          Hoạt động ({activities.length})
        </h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-700 bg-cyan-50 rounded-lg hover:bg-cyan-100 transition-colors"
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showForm ? 'Đóng' : 'Thêm hoạt động'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <input name="title" required placeholder="Tên hoạt động *" className={inputClass} />
            </div>
            <select name="activityType" className={inputClass}>
              <option value="">Loại hoạt động</option>
              {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select name="status" className={inputClass} defaultValue="PLANNED">
              {Object.entries(ACTIVITY_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input name="startDate" type="date" className={inputClass} placeholder="Ngày bắt đầu" />
            <input name="endDate" type="date" className={inputClass} placeholder="Ngày kết thúc" />
            <input name="location" placeholder="Địa điểm" className={inputClass} />
            <input name="responsible" placeholder="Người phụ trách" className={inputClass} />
            <div className="col-span-2">
              <textarea name="description" rows={2} placeholder="Mô tả chi tiết" className={inputClass} />
            </div>
            <input name="participants" placeholder="Người tham gia" className={inputClass} />
            <input name="budget" placeholder="Ngân sách" className={inputClass} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Hủy
            </button>
            <button type="submit" disabled={saving} className="px-4 py-1.5 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 disabled:opacity-50">
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      )}

      {/* Activity List */}
      {activities.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          Chưa có hoạt động nào
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map(activity => {
            const isExpanded = expandedId === activity.id;
            return (
              <div key={activity.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : activity.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-slate-900 truncate">{activity.title}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${ACTIVITY_STATUS_COLORS[activity.status] || 'bg-slate-100 text-slate-500'}`}>
                        {ACTIVITY_STATUS_LABELS[activity.status] || activity.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {activity.activityType && <span>{activity.activityType}</span>}
                      {activity.startDate && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {formatDate(activity.startDate)}
                          {activity.endDate && ` - ${formatDate(activity.endDate)}`}
                        </span>
                      )}
                      {activity.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {activity.location}
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-slate-100 pt-3 space-y-2 text-sm">
                    {activity.description && <div><span className="text-slate-500">Mô tả:</span> <span className="text-slate-800">{activity.description}</span></div>}
                    {activity.responsible && (
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-500">Phụ trách:</span> <span className="text-slate-800">{activity.responsible}</span>
                      </div>
                    )}
                    {activity.participants && <div><span className="text-slate-500">Tham gia:</span> <span className="text-slate-800">{activity.participants}</span></div>}
                    {activity.budget && <div><span className="text-slate-500">Ngân sách:</span> <span className="text-slate-800">{activity.budget}</span></div>}
                    {activity.result && <div><span className="text-slate-500">Kết quả:</span> <span className="text-slate-800">{activity.result}</span></div>}
                    {activity.notes && <div><span className="text-slate-500">Ghi chú:</span> <span className="text-slate-800">{activity.notes}</span></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
