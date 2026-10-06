/** Xuất danh sách MOU đang lọc ra CSV mở bằng Excel (có BOM cho tiếng Việt). */
import { LIFECYCLE_LABELS, PARTNER_TYPE_LABELS, STAGE_LABELS, type MouView } from '@/lib/mou/portfolio';

const cell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const vnDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '');

export function toMouCsv(views: MouView[]): string {
  const header = ['Đối tác', 'Quốc gia', 'Loại đối tác', 'Lĩnh vực', 'Phòng đầu mối', 'Người phụ trách', 'Ngày ký', 'Ngày hết hạn', 'Còn (ngày)', 'Vòng đời', 'Triển khai', 'Tiến độ %', 'Số văn bản', 'Hồ sơ thiếu'];
  const rows = views.map((v) => [
    v.partnerName,
    v.partnerCountry,
    PARTNER_TYPE_LABELS[v.partnerType],
    v.fields.join('; '),
    v.departmentName,
    v.contactPerson,
    vnDate(v.signedDate),
    vnDate(v.expiryDate),
    v.daysToExpiry,
    LIFECYCLE_LABELS[v.lifecycle],
    STAGE_LABELS[v.stage],
    v.progress,
    v.documentCount,
    v.missing.join('; '),
  ]);
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

export function downloadMouCsv(views: MouView[], name: string) {
  const url = URL.createObjectURL(new Blob([toMouCsv(views)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
