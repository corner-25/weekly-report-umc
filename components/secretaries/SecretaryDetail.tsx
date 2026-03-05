'use client';

import { useState, useEffect } from 'react';

interface Props {
  secretaryId: string;
  onClose: () => void;
  onEdit: () => void;
}

export function SecretaryDetail({ secretaryId, onClose, onEdit }: Props) {
  const [secretary, setSecretary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'certificates' | 'transfers'>('info');

  useEffect(() => {
    fetchSecretary();
  }, [secretaryId]);

  const fetchSecretary = async () => {
    try {
      const res = await fetch(`/api/secretaries/${secretaryId}`);
      const data = await res.json();
      setSecretary(data);
    } catch (error) {
      console.error('Error fetching secretary:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">Đang tải...</div>
      </div>
    );
  }

  if (!secretary) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">Không tìm thấy thư ký</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 font-bold text-xl">
              {secretary.avatar ? (
                <img src={secretary.avatar} alt="" className="w-14 h-14 rounded-full object-cover" />
              ) : (
                secretary.fullName.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{secretary.fullName}</h2>
              <div className="flex items-center gap-2 mt-1">
                {secretary.secretaryType && (
                  <span
                    className="px-2 py-0.5 text-xs rounded-full"
                    style={{
                      backgroundColor: secretary.secretaryType.color ? `${secretary.secretaryType.color}20` : '#e5e7eb',
                      color: secretary.secretaryType.color || '#374151'
                    }}
                  >
                    {secretary.secretaryType.name}
                  </span>
                )}
                {getStatusBadge(secretary.status)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="px-3 py-1.5 text-sm text-cyan-600 border border-cyan-600 rounded-lg hover:bg-cyan-50"
            >
              Chỉnh sửa
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex px-6">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'info'
                  ? 'border-cyan-600 text-cyan-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Thông tin
            </button>
            <button
              onClick={() => setActiveTab('certificates')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'certificates'
                  ? 'border-cyan-600 text-cyan-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Bằng cấp ({secretary.certificates?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('transfers')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'transfers'
                  ? 'border-cyan-600 text-cyan-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Lịch sử luân chuyển ({secretary.transferLogs?.length || 0})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'info' && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Ngày sinh</label>
                <div className="text-gray-900">{formatDate(secretary.dateOfBirth)}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Số điện thoại</label>
                <div className="text-gray-900">{secretary.phone || '-'}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Email</label>
                <div className="text-gray-900">{secretary.email || '-'}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Ngày bắt đầu</label>
                <div className="text-gray-900">{formatDate(secretary.startDate)}</div>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Khoa/Phòng hiện tại</label>
                <div className="text-gray-900">{secretary.currentDepartment?.name || 'Chưa phân công'}</div>
              </div>
              {secretary.notes && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Ghi chú</label>
                  <div className="text-gray-900 whitespace-pre-wrap">{secretary.notes}</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'certificates' && (
            <div className="space-y-4">
              {secretary.certificates?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Chưa có bằng cấp nào</div>
              ) : (
                secretary.certificates?.map((cert: any) => (
                  <div key={cert.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="font-medium text-gray-900">{cert.name}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {cert.issuedYear && <span>Năm cấp: {cert.issuedYear}</span>}
                      {cert.issuedBy && <span className="ml-4">Nơi cấp: {cert.issuedBy}</span>}
                    </div>
                    {cert.notes && (
                      <div className="text-sm text-gray-500 mt-1">{cert.notes}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'transfers' && (
            <div className="space-y-4">
              {secretary.transferLogs?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Chưa có lịch sử luân chuyển</div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  {secretary.transferLogs?.map((log: any, index: number) => (
                    <div key={log.id} className="relative pl-10 pb-6">
                      <div className="absolute left-2.5 w-3 h-3 rounded-full bg-cyan-500 border-2 border-white"></div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-500">{formatDate(log.transferDate)}</div>
                        <div className="font-medium text-gray-900 mt-1">
                          {log.fromDepartment ? (
                            <>
                              {log.fromDepartment.name}
                              <span className="mx-2 text-gray-400">→</span>
                              {log.toDepartment.name}
                            </>
                          ) : (
                            <>Phân công vào: {log.toDepartment.name}</>
                          )}
                        </div>
                        {log.decisionNumber && (
                          <div className="text-sm text-gray-500 mt-1">Số QĐ: {log.decisionNumber}</div>
                        )}
                        {log.reason && (
                          <div className="text-sm text-gray-500 mt-1">Lý do: {log.reason}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
