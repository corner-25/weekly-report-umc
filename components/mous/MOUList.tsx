'use client';

import { Handshake, Eye, Pencil, Trash2, Hash, Building2, MapPin, Calendar, AlertTriangle } from 'lucide-react';
import {
  CATEGORY_LABELS, CATEGORY_COLORS, STATUS_COLORS, getMOUDisplayStatus, STATUS_LABELS,
  getDaysUntilExpiry, formatDate, getOverallProgress,
} from './MOUUtils';

export interface MOUItem {
  id: string;
  title: string;
  mouNumber: string | null;
  category: string;
  status: string;
  partnerName: string;
  partnerCountry: string | null;
  signedDate: string | null;
  expiryDate: string | null;
  contactPerson: string | null;
  department: { id: string; name: string } | null;
  _count: { clauses: number; progressLogs: number };
  clauses?: { progress: number }[];
}

interface Props {
  items: MOUItem[];
  onView: (id: string) => void;
  onEdit: (item: MOUItem) => void;
  onDelete: (id: string) => void;
}

function StatusPill({ status }: { status: string }) {
  const displayStatus = status;
  const classes: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    EXPIRING: 'bg-orange-50 text-orange-700 ring-orange-200',
    EXPIRED: 'bg-red-50 text-red-700 ring-red-200',
    DRAFT: 'bg-slate-100 text-slate-600 ring-slate-200',
    TERMINATED: 'bg-slate-100 text-slate-500 ring-slate-200',
  };
  const dots: Record<string, string> = {
    ACTIVE: 'bg-emerald-500',
    EXPIRING: 'bg-orange-500',
    EXPIRED: 'bg-red-500',
    DRAFT: 'bg-slate-400',
    TERMINATED: 'bg-slate-400',
  };
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md ring-1 ring-inset whitespace-nowrap ${classes[displayStatus] || classes.DRAFT}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[displayStatus] || dots.DRAFT}`} />
      {STATUS_LABELS[displayStatus] || displayStatus}
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_COLORS[category] || CATEGORY_COLORS.OTHER;
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md whitespace-nowrap ${cls}`}>
      {CATEGORY_LABELS[category] || category}
    </span>
  );
}

export function MOUList({ items, onView, onEdit, onDelete }: Props) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-12 text-center">
        <Handshake className="mx-auto w-12 h-12 text-slate-300 mb-3" />
        <h3 className="text-base font-medium text-slate-900 mb-1">Chưa có MOU nào</h3>
        <p className="text-sm text-slate-500">Thêm MOU mới để bắt đầu quản lý</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const displayStatus = getMOUDisplayStatus(item);
        const daysLeft = getDaysUntilExpiry(item.expiryDate);
        const progress = item.clauses ? getOverallProgress(item.clauses) : null;

        const accent =
          displayStatus === 'ACTIVE' ? 'border-l-emerald-400' :
          displayStatus === 'EXPIRING' ? 'border-l-orange-400' :
          displayStatus === 'EXPIRED' ? 'border-l-red-400' :
          'border-l-slate-300';

        return (
          <div
            key={item.id}
            className={`group bg-white rounded-xl shadow-sm border border-slate-200/80 border-l-4 ${accent} hover:shadow-md hover:border-slate-300 transition-all`}
          >
            <div className="p-3.5 flex items-start gap-3">
              <button
                onClick={() => onView(item.id)}
                className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center text-cyan-600 hover:from-cyan-100 hover:to-blue-100 transition-colors"
                title="Xem chi tiết"
              >
                <Handshake className="w-5 h-5" />
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => onView(item.id)}
                      className="text-left w-full"
                    >
                      <h3 className="text-sm font-semibold text-slate-900 leading-tight hover:text-cyan-600 line-clamp-2">
                        {item.title}
                      </h3>
                    </button>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {item.mouNumber && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-slate-500 font-mono">
                          <Hash className="w-3 h-3" />{item.mouNumber}
                        </span>
                      )}
                      <CategoryBadge category={item.category} />
                    </div>
                  </div>
                  <StatusPill status={displayStatus} />
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1.5">
                  <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                    {item.partnerName}
                    {item.partnerCountry && (
                      <span className="inline-flex items-center gap-0.5 text-slate-500 font-normal">
                        <MapPin className="w-3 h-3 text-slate-400" /> {item.partnerCountry}
                      </span>
                    )}
                  </span>

                  {item.department && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      {item.department.name}
                    </span>
                  )}

                  {item.expiryDate && (
                    <span className={`inline-flex items-center gap-1 ${
                      daysLeft !== null && daysLeft <= 0 ? 'text-red-600 font-medium' :
                      daysLeft !== null && daysLeft <= 90 ? 'text-orange-600 font-medium' :
                      ''
                    }`}>
                      {daysLeft !== null && daysLeft <= 90 ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : (
                        <Calendar className="w-3 h-3 text-slate-400" />
                      )}
                      {daysLeft !== null && daysLeft <= 0
                        ? `Đã hết hạn ${Math.abs(daysLeft)} ngày`
                        : daysLeft !== null && daysLeft <= 90
                        ? `Còn ${daysLeft} ngày (${formatDate(item.expiryDate)})`
                        : formatDate(item.expiryDate)}
                    </span>
                  )}

                  {progress !== null ? (
                    <span className="inline-flex items-center gap-1.5 min-w-[120px]">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-cyan-500 to-blue-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className={progress === 100 ? 'text-emerald-600 font-medium' : 'text-slate-600'}>
                        {progress}%
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">
                      {item._count.clauses} hạng mục
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={() => onView(item.id)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Xem chi tiết"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onEdit(item)}
                  className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                  title="Chỉnh sửa"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Xác nhận xóa MOU này?')) onDelete(item.id);
                  }}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Xóa"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
