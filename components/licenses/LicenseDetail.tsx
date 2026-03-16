'use client';

import { useState } from 'react';
import { getLicenseStatus, getDaysUntilExpiry, CATEGORY_LABELS, CATEGORY_COLORS } from './LicenseUtils';
import RenewalForm from './RenewalForm';

interface Department { id: string; name: string; }
interface Renewal {
  id: string;
  renewedDate: string;
  newExpiryDate: string | null;
  previousExpiry: string | null;
  renewedBy: string | null;
  decisionNumber: string | null;
  fileUrl: string | null;
  notes: string | null;
  createdAt: string;
}
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
  renewals: Renewal[];
}

interface Props {
  license: License;
  onClose: () => void;
  onEdit: () => void;
  onRefresh: () => void;
}

export default function LicenseDetail({ license, onClose, onEdit, onRefresh }: Props) {
  const [tab, setTab] = useState<'info' | 'file' | 'history'>('info');
  const [showRenewal, setShowRenewal] = useState(false);
  const status = getLicenseStatus(license.expiryDate);

  const statusBadge = () => {
    if (status === 'NO_EXPIRY') return <span className="px-3 py-1 text-sm font-medium rounded-full bg-gray-100 text-gray-600">Không hết hạn</span>;
    if (status === 'EXPIRED') return <span className="px-3 py-1 text-sm font-medium rounded-full bg-red-100 text-red-700">Đã hết hạn</span>;
    if (status === 'EXPIRING_SOON') {
      const days = getDaysUntilExpiry(license.expiryDate!);
      return <span className="px-3 py-1 text-sm font-medium rounded-full bg-orange-100 text-orange-700">Sắp hết hạn — còn {days} ngày</span>;
    }
    return <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-700">Còn hiệu lực</span>;
  };

  const Field = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value || '—'}</dd>
    </div>
  );

  const isImage = (url: string) => /\.(jpg|jpeg|png|webp)$/i.test(url);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900">{license.name}</h2>
              {statusBadge()}
            </div>
            {license.licenseNumber && (
              <p className="text-sm text-gray-500 mt-1">Số GP: {license.licenseNumber}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          {(['info', 'file', 'history'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'info' ? 'Thông tin' : t === 'file' ? 'Tệp đính kèm' : `Gia hạn (${license.renewals.length})`}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'info' && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Loại giấy phép" value={CATEGORY_LABELS[license.category]} />
              <Field label="Khoa/Phòng" value={license.department?.name} />
              <Field label="Cơ quan cấp" value={license.issuedBy} />
              <Field label="Ngày cấp" value={license.issuedDate ? new Date(license.issuedDate).toLocaleDateString('vi-VN') : null} />
              <Field label="Ngày hết hạn" value={license.expiryDate ? new Date(license.expiryDate).toLocaleDateString('vi-VN') : 'Không hết hạn'} />
              <Field label="Phạm vi áp dụng" value={license.scope} />
              {license.notes && (
                <div className="col-span-2">
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ghi chú</dt>
                  <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{license.notes}</dd>
                </div>
              )}
            </dl>
          )}

          {tab === 'file' && (
            <div>
              {license.fileUrl ? (
                <div>
                  {isImage(license.fileUrl) ? (
                    <img src={license.fileUrl} alt="Giấy phép" className="max-w-full rounded-lg border" />
                  ) : (
                    <iframe src={license.fileUrl} className="w-full h-96 rounded-lg border" title="Giấy phép PDF" />
                  )}
                  <a href={license.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Tải xuống
                  </a>
                </div>
              ) : (
                <div className="text-center py-10 text-gray-400">
                  <svg className="mx-auto w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm">Chưa có file đính kèm</p>
                </div>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-4">
              <button
                onClick={() => setShowRenewal(true)}
                className="w-full py-2 border-2 border-dashed border-green-300 text-green-600 rounded-lg text-sm hover:bg-green-50"
              >
                + Gia hạn mới
              </button>
              {license.renewals.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">Chưa có lịch sử gia hạn</p>
              ) : (
                license.renewals.map((r) => (
                  <div key={r.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        Gia hạn ngày {new Date(r.renewedDate).toLocaleDateString('vi-VN')}
                      </span>
                      {r.newExpiryDate && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                          Hết hạn mới: {new Date(r.newExpiryDate).toLocaleDateString('vi-VN')}
                        </span>
                      )}
                    </div>
                    {r.previousExpiry && (
                      <p className="text-xs text-gray-500">Hết hạn cũ: {new Date(r.previousExpiry).toLocaleDateString('vi-VN')}</p>
                    )}
                    {r.renewedBy && <p className="text-xs text-gray-600">Người thực hiện: {r.renewedBy}</p>}
                    {r.decisionNumber && <p className="text-xs text-gray-600">Số QĐ: {r.decisionNumber}</p>}
                    {r.notes && <p className="text-xs text-gray-600 italic">{r.notes}</p>}
                    {r.fileUrl && (
                      <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">Xem file gia hạn</a>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-end gap-3">
          <button onClick={onEdit} className="px-4 py-2 text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 text-sm">Chỉnh sửa</button>
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">Đóng</button>
        </div>
      </div>

      {showRenewal && (
        <RenewalForm
          licenseId={license.id}
          currentExpiry={license.expiryDate}
          onSuccess={onRefresh}
          onClose={() => setShowRenewal(false)}
        />
      )}
    </div>
  );
}
