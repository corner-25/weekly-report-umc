/**
 * Xuất danh sách đang lọc ra file CSV mở được bằng Excel (có BOM để Excel nhận
 * đúng tiếng Việt).
 */
import { WORK_STATUS_LABELS } from '@/lib/work/constants';
import type { WorkListItem } from '@/lib/work/list';

const cell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const vnDate = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

function attention(i: WorkListItem): string {
  return [
    i.isOverdue && `Quá hạn ${-(i.daysToDue ?? 0)} ngày`,
    i.isDueSoon && `Còn ${i.daysToDue} ngày đến hạn`,
    i.isStale && (i.updateCount === 0 ? `Chưa từng cập nhật (${i.silentDays} ngày)` : `${i.silentDays} ngày chưa cập nhật`),
    i.status === 'DONE' && i.lateDays !== null && (i.lateDays === 0 ? 'Xong đúng hạn' : `Xong trễ ${i.lateDays} ngày`),
  ]
    .filter(Boolean)
    .join('; ');
}

export function toCsv(items: WorkListItem[]): string {
  const header = ['Mã', 'Tên công việc', 'Đơn vị chủ trì', 'Lãnh đạo chỉ đạo', 'Hình thức', 'Ngày chỉ đạo', 'Hạn chót', 'Trạng thái', 'Tiến độ %', 'Cần chú ý', 'Ngày hoàn thành', 'Số lần cập nhật', 'Cập nhật gần nhất', 'Nội dung cập nhật gần nhất', 'Người thực hiện'];
  const rows = items.map((i) => [
    i.externalId,
    i.title,
    i.department?.name ?? i.leadUnit,
    i.leader,
    i.tags[0],
    vnDate(i.directedAt),
    vnDate(i.dueDate),
    WORK_STATUS_LABELS[i.status],
    i.status === 'DONE' ? 100 : i.progressPercent,
    attention(i),
    vnDate(i.completedAt),
    i.updateCount,
    vnDate(i.lastUpdate?.at ?? null),
    i.lastUpdate?.content,
    i.assignees.join(', '),
  ]);
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

export function downloadCsv(items: WorkListItem[], name: string) {
  const blob = new Blob([toCsv(items)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
