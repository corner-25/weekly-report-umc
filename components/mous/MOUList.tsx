'use client';

import { CATEGORY_LABELS, CATEGORY_COLORS, STATUS_COLORS, getMOUDisplayStatus, STATUS_LABELS, getDaysUntilExpiry, formatDate, getOverallProgress } from './MOUUtils';

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

export function MOUList({ items, onView, onEdit, onDelete }: Props) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-gray-500 text-sm">Chưa có MOU nào</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3 text-left">MOU</th>
              <th className="px-4 py-3 text-left">Đối tác</th>
              <th className="px-4 py-3 text-left">Loại</th>
              <th className="px-4 py-3 text-left">Phòng đầu mối</th>
              <th className="px-4 py-3 text-center">Trạng thái</th>
              <th className="px-4 py-3 text-center">Tiến độ</th>
              <th className="px-4 py-3 text-left">Hết hạn</th>
              <th className="px-4 py-3 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => {
              const displayStatus = getMOUDisplayStatus(item);
              const daysLeft = getDaysUntilExpiry(item.expiryDate);
              const progress = item.clauses ? getOverallProgress(item.clauses) : null;

              return (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <button onClick={() => onView(item.id)} className="text-left">
                      <p className="text-sm font-medium text-gray-900 hover:text-cyan-600 line-clamp-1">
                        {item.title}
                      </p>
                      {item.mouNumber && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.mouNumber}</p>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-700">{item.partnerName}</p>
                    {item.partnerCountry && (
                      <p className="text-xs text-gray-400">{item.partnerCountry}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS[item.category] || CATEGORY_COLORS.OTHER}`}>
                      {CATEGORY_LABELS[item.category] || item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.department?.name || '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[displayStatus]}`}>
                      {STATUS_LABELS[displayStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {progress !== null ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-cyan-500'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{progress}%</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">{item._count.clauses} ĐK</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.expiryDate ? (
                      <div>
                        <p className="text-sm text-gray-700">{formatDate(item.expiryDate)}</p>
                        {daysLeft !== null && daysLeft > 0 && (
                          <p className={`text-xs ${daysLeft <= 90 ? 'text-orange-500' : 'text-gray-400'}`}>
                            còn {daysLeft} ngày
                          </p>
                        )}
                        {daysLeft !== null && daysLeft <= 0 && (
                          <p className="text-xs text-red-500">Đã hết hạn</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Không xác định</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center space-x-1">
                      <button onClick={() => onView(item.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50" title="Xem chi tiết">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                      <button onClick={() => onEdit(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-yellow-600 hover:bg-yellow-50" title="Chỉnh sửa">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => { if (confirm('Xác nhận xóa MOU này?')) onDelete(item.id); }} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" title="Xóa">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
