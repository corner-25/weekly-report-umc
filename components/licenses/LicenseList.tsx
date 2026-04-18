'use client';

import { FileText, Eye, Edit2, Trash2, Paperclip, Calendar, Building2, Hash, RefreshCw } from 'lucide-react';
import { getLicenseStatus, getDaysUntilExpiry, CATEGORY_LABELS, CATEGORY_COLORS } from './LicenseUtils';

interface Department { id: string; name: string; }
interface License {
  id: string;
  name: string;
  licenseNumber: string | null;
  category: string;
  issuedBy: string | null;
  issuedDate: string | null;
  expiryDate: string | null;
  scope: string | null;
  fileUrl: string | null;
  notes: string | null;
  department: Department | null;
  renewals: any[];
  _count: { renewals: number };
}

interface Props {
  licenses: License[];
  onView: (license: License) => void;
  onEdit: (license: License) => void;
  onDelete: (id: string) => void;
}

function StatusPill({ expiryDate }: { expiryDate: string | null }) {
  const status = getLicenseStatus(expiryDate);

  if (status === 'NO_EXPIRY') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-600 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Không hết hạn
      </div>
    );
  }

  if (status === 'EXPIRED') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Đã hết hạn
      </div>
    );
  }

  if (status === 'EXPIRING_SOON') {
    const days = getDaysUntilExpiry(expiryDate!);
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
        Còn {days} ngày
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Còn hiệu lực
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-md whitespace-nowrap ${CATEGORY_COLORS[category] || 'bg-slate-100 text-slate-700'}`}>
      {CATEGORY_LABELS[category] || category}
    </span>
  );
}

export default function LicenseList({ licenses, onView, onEdit, onDelete }: Props) {
  if (licenses.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-12 text-center">
        <FileText className="mx-auto w-12 h-12 text-slate-300 mb-3" />
        <h3 className="text-base font-medium text-slate-900 mb-1">Chưa có giấy phép nào</h3>
        <p className="text-sm text-slate-500">Nhấn &quot;+ Thêm giấy phép&quot; để bắt đầu</p>
      </div>
    );
  }

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('vi-VN') : null;

  return (
    <div className="space-y-2">
      {licenses.map((license) => {
        const status = getLicenseStatus(license.expiryDate);
        const accentColor =
          status === 'EXPIRED' ? 'border-l-red-400' :
          status === 'EXPIRING_SOON' ? 'border-l-orange-400' :
          status === 'NO_EXPIRY' ? 'border-l-slate-300' :
          'border-l-emerald-400';

        return (
          <div
            key={license.id}
            className={`group bg-white rounded-xl shadow-sm border border-slate-200/80 border-l-4 ${accentColor} hover:shadow-md hover:border-slate-300 transition-all`}
          >
            <div className="p-4 flex items-start gap-4">
              {/* Left: Main content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
                      {license.name}
                    </h3>
                    {license.scope && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{license.scope}</p>
                    )}
                  </div>
                  <StatusPill expiryDate={license.expiryDate} />
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 mt-2">
                  <CategoryBadge category={license.category} />

                  {license.licenseNumber && (
                    <span className="inline-flex items-center gap-1">
                      <Hash className="w-3 h-3 text-slate-400" />
                      <span className="font-medium">{license.licenseNumber}</span>
                    </span>
                  )}

                  {license.department && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      {license.department.name}
                    </span>
                  )}

                  {fmt(license.issuedDate) && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Cấp: <span className="font-medium text-slate-700">{fmt(license.issuedDate)}</span>
                    </span>
                  )}

                  {fmt(license.expiryDate) && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Hết hạn: <span className="font-medium text-slate-700">{fmt(license.expiryDate)}</span>
                    </span>
                  )}

                  {license._count.renewals > 0 && (
                    <span className="inline-flex items-center gap-1 text-blue-600">
                      <RefreshCw className="w-3 h-3" />
                      {license._count.renewals} lần gia hạn
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                {license.fileUrl && (
                  <a
                    href={license.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                    title="Mở file"
                  >
                    <Paperclip className="w-4 h-4" />
                  </a>
                )}
                <button
                  onClick={() => onView(license)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Xem chi tiết"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onEdit(license)}
                  className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                  title="Chỉnh sửa"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(license.id)}
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
