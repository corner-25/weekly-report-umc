'use client';

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

function StatusBadge({ expiryDate }: { expiryDate: string | null }) {
  const status = getLicenseStatus(expiryDate);
  if (status === 'NO_EXPIRY') return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500">Không hết hạn</span>;
  if (status === 'EXPIRED') return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Đã hết hạn</span>;
  if (status === 'EXPIRING_SOON') {
    const days = getDaysUntilExpiry(expiryDate!);
    return <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">Còn {days} ngày</span>;
  }
  return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Còn hiệu lực</span>;
}

export default function LicenseList({ licenses, onView, onEdit, onDelete }: Props) {
  if (licenses.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-1">Chưa có giấy phép nào</h3>
        <p className="text-gray-500 text-sm">Nhấn "+ Thêm giấy phép" để bắt đầu</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên giấy phép</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Số GP</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loại</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Khoa/Phòng</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày cấp</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hết hạn</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {licenses.map((license) => (
              <tr key={license.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{license.name}</div>
                  {license.scope && <div className="text-xs text-gray-500 mt-0.5">{license.scope}</div>}
                  {license._count.renewals > 0 && (
                    <div className="text-xs text-blue-500 mt-0.5">{license._count.renewals} lần gia hạn</div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700">{license.licenseNumber || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${CATEGORY_COLORS[license.category] || 'bg-gray-100 text-gray-700'}`}>
                    {CATEGORY_LABELS[license.category] || license.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700 text-xs">{license.department?.name || '—'}</td>
                <td className="px-4 py-3 text-gray-600">
                  {license.issuedDate ? new Date(license.issuedDate).toLocaleDateString('vi-VN') : '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {license.expiryDate ? new Date(license.expiryDate).toLocaleDateString('vi-VN') : '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge expiryDate={license.expiryDate} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {license.fileUrl && (
                      <a
                        href={license.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                        title="Xem file"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </a>
                    )}
                    <button onClick={() => onView(license)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Xem chi tiết">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button onClick={() => onEdit(license)} className="p-1.5 text-gray-400 hover:text-yellow-600 rounded" title="Chỉnh sửa">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => onDelete(license.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Xóa">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
