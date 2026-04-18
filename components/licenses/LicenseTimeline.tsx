'use client';

import { useMemo, useState } from 'react';
import { getLicenseStatus, getDaysUntilExpiry, CATEGORY_LABELS, CATEGORY_COLORS } from './LicenseUtils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

const STATUS_BAR_COLOR: Record<string, string> = {
  ACTIVE: 'bg-emerald-500',
  EXPIRING_SOON: 'bg-orange-500',
  EXPIRED: 'bg-red-500',
  NO_EXPIRY: 'bg-slate-400',
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export default function LicenseTimeline({ licenses, onView }: Props) {
  const [yearOffset, setYearOffset] = useState(0);

  const itemsWithDates = useMemo(
    () => licenses.filter(l => l.issuedDate || l.expiryDate),
    [licenses]
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const baseYear = today.getFullYear() + yearOffset;
  const rangeStart = new Date(baseYear - 1, 0, 1);
  const rangeEnd = new Date(baseYear + 2, 11, 31);
  const totalDays = (rangeEnd.getTime() - rangeStart.getTime()) / MS_PER_DAY;

  const sorted = useMemo(() => {
    return [...itemsWithDates].sort((a, b) => {
      const aEnd = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
      const bEnd = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
      return aEnd - bEnd;
    });
  }, [itemsWithDates]);

  const todayLeftPct = ((today.getTime() - rangeStart.getTime()) / MS_PER_DAY / totalDays) * 100;

  const yearMarkers: { year: number; leftPct: number }[] = [];
  for (let y = baseYear - 1; y <= baseYear + 2; y++) {
    const d = new Date(y, 0, 1);
    const left = ((d.getTime() - rangeStart.getTime()) / MS_PER_DAY / totalDays) * 100;
    yearMarkers.push({ year: y, leftPct: left });
  }

  if (itemsWithDates.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-12 text-center">
        <p className="text-slate-500">Không có giấy phép nào có ngày để hiển thị trên timeline</p>
        <p className="text-xs text-slate-400 mt-1">Hãy thêm Ngày cấp hoặc Ngày hết hạn cho giấy phép</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYearOffset((v) => v - 1)}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
            title="Lùi 1 năm"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-slate-700">
            {baseYear - 1} – {baseYear + 2}
          </span>
          <button
            onClick={() => setYearOffset((v) => v + 1)}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
            title="Tới 1 năm"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setYearOffset(0)}
            className="ml-2 px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors"
          >
            Hôm nay
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Còn hiệu lực</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500" /> Sắp hết hạn</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /> Đã hết hạn</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header with year markers */}
          <div className="flex border-b border-slate-200 bg-slate-50/50">
            <div className="w-64 flex-shrink-0 px-4 py-2 text-xs font-medium text-slate-500 border-r border-slate-200">
              Giấy phép
            </div>
            <div className="flex-1 relative h-9">
              {yearMarkers.map((m) => (
                <div
                  key={m.year}
                  className="absolute top-0 bottom-0 border-l border-slate-200 pl-1.5 text-xs font-medium text-slate-500 flex items-center"
                  style={{ left: `${m.leftPct}%` }}
                >
                  {m.year}
                </div>
              ))}
              {todayLeftPct >= 0 && todayLeftPct <= 100 && (
                <div
                  className="absolute top-0 bottom-0 border-l-2 border-cyan-500 z-10"
                  style={{ left: `${todayLeftPct}%` }}
                >
                  <span className="absolute -top-0.5 -translate-x-1/2 px-1.5 py-0.5 text-[10px] font-medium bg-cyan-500 text-white rounded">
                    Hôm nay
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-100">
            {sorted.map((license) => {
              const status = getLicenseStatus(license.expiryDate);
              const issued = license.issuedDate ? new Date(license.issuedDate) : null;
              const expiry = license.expiryDate ? new Date(license.expiryDate) : null;

              const startDate = issued || expiry!;
              const endDate = expiry || new Date(startDate.getFullYear() + 100, 0, 1);

              const startClamped = new Date(Math.max(startDate.getTime(), rangeStart.getTime()));
              const endClamped = new Date(Math.min(endDate.getTime(), rangeEnd.getTime()));

              const visible = endClamped.getTime() > startClamped.getTime();
              const leftPct = ((startClamped.getTime() - rangeStart.getTime()) / MS_PER_DAY / totalDays) * 100;
              const widthPct = ((endClamped.getTime() - startClamped.getTime()) / MS_PER_DAY / totalDays) * 100;

              const days = expiry ? getDaysUntilExpiry(expiry.toISOString()) : null;

              return (
                <div key={license.id} className="flex hover:bg-slate-50 group">
                  <div className="w-64 flex-shrink-0 px-4 py-3 border-r border-slate-200">
                    <button
                      onClick={() => onView(license)}
                      className="text-left w-full"
                    >
                      <div className="text-sm font-medium text-slate-900 line-clamp-1 group-hover:text-cyan-600">
                        {license.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded ${CATEGORY_COLORS[license.category] || 'bg-slate-100 text-slate-700'}`}>
                          {CATEGORY_LABELS[license.category] || license.category}
                        </span>
                        {license.department && (
                          <span className="text-[10px] text-slate-500 truncate">{license.department.name}</span>
                        )}
                      </div>
                    </button>
                  </div>

                  <div className="flex-1 relative py-3 min-h-[48px]">
                    {/* Year grid lines */}
                    {yearMarkers.map((m) => (
                      <div
                        key={m.year}
                        className="absolute top-0 bottom-0 border-l border-slate-100"
                        style={{ left: `${m.leftPct}%` }}
                      />
                    ))}
                    {/* Today line */}
                    {todayLeftPct >= 0 && todayLeftPct <= 100 && (
                      <div
                        className="absolute top-0 bottom-0 border-l-2 border-cyan-500/40 z-10"
                        style={{ left: `${todayLeftPct}%` }}
                      />
                    )}
                    {/* Bar */}
                    {visible && (
                      <button
                        onClick={() => onView(license)}
                        className={`absolute top-1/2 -translate-y-1/2 h-6 ${STATUS_BAR_COLOR[status]} rounded-md hover:brightness-110 transition-all flex items-center px-2 text-[10px] font-medium text-white shadow-sm overflow-hidden whitespace-nowrap`}
                        style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 2)}%`, minWidth: '20px' }}
                        title={`${license.name}${expiry ? ` — hết hạn ${expiry.toLocaleDateString('vi-VN')}` : ''}`}
                      >
                        {widthPct > 8 && expiry && (
                          <span>
                            {expiry.toLocaleDateString('vi-VN')}
                            {days !== null && days >= 0 && days <= 90 && ` (${days}d)`}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
