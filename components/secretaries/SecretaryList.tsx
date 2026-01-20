'use client';

interface Secretary {
  id: string;
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

export function SecretaryList({ secretaries, onEdit, onView, onDelete }: Props) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Đang hoạt động</span>;
      case 'INACTIVE':
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">Nghỉ việc</span>;
      case 'ON_LEAVE':
        return <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700">Nghỉ phép</span>;
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  if (secretaries.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center">
        <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p className="text-gray-500">Chưa có thư ký nào</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Thư ký</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Loại</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Khoa/Phòng</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ngày sinh</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Bằng cấp</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Trạng thái</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {secretaries.map((secretary) => (
              <tr key={secretary.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 font-semibold">
                      {secretary.avatar ? (
                        <img src={secretary.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        secretary.fullName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{secretary.fullName}</div>
                      <div className="text-sm text-gray-500">
                        {secretary.phone || secretary.email || '-'}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {secretary.secretaryType ? (
                    <span
                      className="px-2 py-1 text-xs rounded-full"
                      style={{
                        backgroundColor: secretary.secretaryType.color ? `${secretary.secretaryType.color}20` : '#e5e7eb',
                        color: secretary.secretaryType.color || '#374151'
                      }}
                    >
                      {secretary.secretaryType.name}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {secretary.currentDepartment?.name || <span className="text-gray-400">Chưa phân công</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {formatDate(secretary.dateOfBirth)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {secretary.certificates.length > 0 ? (
                    <span className="text-cyan-600">{secretary.certificates.length} bằng</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {getStatusBadge(secretary.status)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onView(secretary)}
                      className="p-1.5 text-gray-500 hover:text-cyan-600 hover:bg-cyan-50 rounded"
                      title="Xem chi tiết"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onEdit(secretary)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Chỉnh sửa"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(secretary.id)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Xóa"
                    >
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
