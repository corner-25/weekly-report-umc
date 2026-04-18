'use client';

import { getLicenseStatus, getDaysUntilExpiry, CATEGORY_LABELS, CATEGORY_COLORS, LicenseStatus } from './LicenseUtils';
import { Calendar, Building2, Paperclip, Eye, Pencil, Trash2 } from 'lucide-react';

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

const COLUMNS: { key: LicenseStatus; title: string; headerClass: string; accentClass: string }[] = [
  { key: 'ACTIVE', title: 'Còn hiệu lực', headerClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', accentClass: 'border-l-emerald-500' },
  { key: 'EXPIRING_SOON', title: 'Sắp hết hạn', headerClass: 'bg-orange-50 text-orange-700 border-orange-200', accentClass: 'border-l-orange-500' },
  { key: 'EXPIRED', title: 'Đã hết hạn', headerClass: 'bg-red-50 text-red-700 border-red-200', accentClass: 'border-l-red-500' },
  { key: 'NO_EXPIRY', title: 'Không hết hạn', headerClass: 'bg-slate-100 text-slate-700 border-slate-200', accentClass: 'border-l-slate-400' },
];

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

function LicenseCard({ license, onView, onEdit, onDelete, accentClass }: {
  license: License;
  onView: (l: License) => void;
  onEdit: (l: License) => void;
  onDelete: (id: string) => void;
  accentClass: string;
}) {
  const days = license.expiryDate ? getDaysUntilExpiry(license.expiryDate) : null;
  const showThumb = license.fileUrl && isImageUrl(license.fileUrl);

  return (
    <div
      onClick={() => onView(license)}
      className={`group bg-white rounded-lg border border-slate-200 border-l-4 ${accentClass} p-3 shadow-sm hover:shadow-md transition-all cursor-pointer`}
    >
      {showThumb && (
        <div className="mb-2 -mx-3 -mt-3">
          <img
            src={license.fileUrl!}
            alt={license.name}
            className="w-full h-24 object-cover rounded-t-md"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h4 className="font-medium text-slate-900 text-sm leading-tight line-clamp-2 flex-1">{license.name}</h4>
      </div>

      {license.licenseNumber && (
        <p className="text-xs text-slate-500 mb-1.5">Số: {license.licenseNumber}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full ${CATEGORY_COLORS[license.category] || 'bg-slate-100 text-slate-700'}`}>
          {CATEGORY_LABELS[license.category] || license.category}
        </span>
        {license._count.renewals > 0 && (
          <span className="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-600">
            {license._count.renewals}× gia hạn
          </span>
        )}
      </div>

      <div className="space-y-1 text-xs text-slate-600">
        {license.department && (
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3 h-3 flex-shrink-0 text-slate-400" />
            <span className="truncate">{license.department.name}</span>
          </div>
        )}
        {license.expiryDate && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 flex-shrink-0 text-slate-400" />
            <span>
              {new Date(license.expiryDate).toLocaleDateString('vi-VN')}
              {days !== null && (
                <span className={`ml-1 font-medium ${days < 0 ? 'text-red-600' : days <= 90 ? 'text-orange-600' : 'text-emerald-600'}`}>
                  ({days < 0 ? `quá ${Math.abs(days)}d` : `còn ${days}d`})
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1">
          {license.fileUrl && (
            <a
              href={license.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 text-slate-400 hover:text-blue-600 rounded"
              title="Mở file"
            >
              <Paperclip className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onView(license); }}
            className="p-1 text-slate-400 hover:text-blue-600 rounded"
            title="Xem"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(license); }}
            className="p-1 text-slate-400 hover:text-yellow-600 rounded"
            title="Sửa"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(license.id); }}
            className="p-1 text-slate-400 hover:text-red-600 rounded"
            title="Xóa"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LicenseKanban({ licenses, onView, onEdit, onDelete }: Props) {
  const grouped: Record<LicenseStatus, License[]> = {
    ACTIVE: [], EXPIRING_SOON: [], EXPIRED: [], NO_EXPIRY: [],
  };

  for (const l of licenses) {
    const status = getLicenseStatus(l.expiryDate);
    grouped[status].push(l);
  }

  for (const key of Object.keys(grouped) as LicenseStatus[]) {
    grouped[key].sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
    });
  }

  if (licenses.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-12 text-center">
        <p className="text-slate-500">Chưa có giấy phép nào</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {COLUMNS.map((col) => (
        <div key={col.key} className="flex flex-col bg-slate-50 rounded-xl border border-slate-200/80 min-h-[200px]">
          <div className={`flex items-center justify-between px-4 py-3 border-b ${col.headerClass} rounded-t-xl`}>
            <h3 className="text-sm font-semibold">{col.title}</h3>
            <span className="text-xs font-medium px-2 py-0.5 bg-white/60 rounded-full">
              {grouped[col.key].length}
            </span>
          </div>
          <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[calc(100vh-360px)]">
            {grouped[col.key].length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-6">Trống</div>
            ) : (
              grouped[col.key].map((license) => (
                <LicenseCard
                  key={license.id}
                  license={license}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  accentClass={col.accentClass}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
