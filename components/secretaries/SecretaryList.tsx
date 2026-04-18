'use client';

import { Eye, Edit2, Trash2, Users as UsersIcon, Phone, Mail, Building2, Cake, Award, Hash } from 'lucide-react';

interface Secretary {
  id: string;
  employeeCode?: string | null;
  fullName: string;
  dateOfBirth: string | null;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  status: string;
  startDate: string | null;
  notes: string | null;
  secretaryType: { id: string; name: string; color: string | null } | null;
  currentDepartment: { id: string; name: string } | null;
  certificates: any[];
  _count: { transferLogs: number };
}

interface Props {
  secretaries: Secretary[];
  onEdit: (secretary: Secretary) => void;
  onView: (secretary: Secretary) => void;
  onDelete: (id: string) => void;
}

function StatusPill({ status }: { status: string }) {
  if (status === 'ACTIVE') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Đang hoạt động
      </div>
    );
  }
  if (status === 'ON_LEAVE') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
        Nghỉ phép
      </div>
    );
  }
  if (status === 'INACTIVE') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        Nghỉ việc
      </div>
    );
  }
  return null;
}

function TypeBadge({ type }: { type: Secretary['secretaryType'] }) {
  if (!type) return null;
  const bg = type.color ? `${type.color}15` : '#f1f5f9';
  const text = type.color || '#475569';
  return (
    <span
      className="inline-flex px-2 py-0.5 text-xs font-medium rounded-md whitespace-nowrap"
      style={{ backgroundColor: bg, color: text }}
    >
      {type.name}
    </span>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return <img src={src} alt={name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />;
  }
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
      {initials}
    </div>
  );
}

export function SecretaryList({ secretaries, onEdit, onView, onDelete }: Props) {
  if (secretaries.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-12 text-center">
        <UsersIcon className="mx-auto w-12 h-12 text-slate-300 mb-3" />
        <h3 className="text-base font-medium text-slate-900 mb-1">Chưa có thư ký nào</h3>
        <p className="text-sm text-slate-500">Thêm thư ký mới để bắt đầu quản lý</p>
      </div>
    );
  }

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('vi-VN') : null;

  return (
    <div className="space-y-2">
      {secretaries.map((s) => {
        const accent =
          s.status === 'ACTIVE' ? 'border-l-emerald-400' :
          s.status === 'ON_LEAVE' ? 'border-l-orange-400' :
          'border-l-slate-300';

        const typeColor = s.secretaryType?.color ?? '#06b6d4';

        return (
          <div
            key={s.id}
            className={`group bg-white rounded-xl shadow-sm border border-slate-200/80 border-l-4 ${accent} hover:shadow-md hover:border-slate-300 transition-all`}
          >
            <div className="p-3.5 flex items-center gap-3">
              <Avatar name={s.fullName} src={s.avatar} />

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900 leading-tight">{s.fullName}</h3>
                      {s.employeeCode && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-slate-500 font-mono">
                          <Hash className="w-3 h-3" />{s.employeeCode}
                        </span>
                      )}
                      <TypeBadge type={s.secretaryType} />
                    </div>
                  </div>
                  <StatusPill status={s.status} />
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  {s.currentDepartment ? (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      {s.currentDepartment.name}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Chưa phân công</span>
                  )}

                  {s.phone && (
                    <a
                      href={`tel:${s.phone}`}
                      className="inline-flex items-center gap-1 hover:text-cyan-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="w-3 h-3 text-slate-400" />
                      {s.phone}
                    </a>
                  )}

                  {s.email && (
                    <a
                      href={`mailto:${s.email}`}
                      className="inline-flex items-center gap-1 hover:text-cyan-600 truncate max-w-[200px]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Mail className="w-3 h-3 text-slate-400" />
                      {s.email}
                    </a>
                  )}

                  {fmtDate(s.dateOfBirth) && (
                    <span className="inline-flex items-center gap-1">
                      <Cake className="w-3 h-3 text-slate-400" />
                      {fmtDate(s.dateOfBirth)}
                    </span>
                  )}

                  {(s.certificates?.length ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 text-cyan-600">
                      <Award className="w-3 h-3" />
                      {s.certificates.length} bằng cấp
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={() => onView(s)}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Xem chi tiết"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onEdit(s)}
                  className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                  title="Chỉnh sửa"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(s.id)}
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
