/**
 * Màu ngữ nghĩa của bảng điều hành công việc — cùng một nghĩa thì cùng một màu
 * ở mọi biểu đồ: xanh lá = xong, xanh thương hiệu = đang làm bình thường,
 * hổ phách = lâu chưa cập nhật, hồng đỏ = quá hạn, xám = chưa bắt đầu/huỷ.
 */
import { WORK_STATUS_LABELS, type WorkStatusKey } from '@/lib/work/constants';
import { createElement } from 'react';
import type { Segment } from './charts';
import { InfoTip, type TermKey } from './Glossary';

export const TONE = {
  done: { stroke: 'stroke-emerald-500', swatch: 'bg-emerald-500' },
  active: { stroke: 'stroke-brand-500', swatch: 'bg-brand-500' },
  stale: { stroke: 'stroke-amber-400', swatch: 'bg-amber-400' },
  overdue: { stroke: 'stroke-rose-500', swatch: 'bg-rose-500' },
  notStarted: { stroke: 'stroke-slate-300', swatch: 'bg-slate-300' },
  paused: { stroke: 'stroke-orange-300', swatch: 'bg-orange-300' },
  cancelled: { stroke: 'stroke-slate-200', swatch: 'bg-slate-200' },
} as const;

const STATUS_TONE: Record<WorkStatusKey, keyof typeof TONE> = {
  DONE: 'done',
  IN_PROGRESS: 'active',
  NOT_STARTED: 'notStarted',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
};
const STATUS_TERM: Record<WorkStatusKey, TermKey> = {
  DONE: 'done',
  IN_PROGRESS: 'inProgress',
  NOT_STARTED: 'notStarted',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
};
const STATUS_ORDER: WorkStatusKey[] = ['DONE', 'IN_PROGRESS', 'NOT_STARTED', 'PAUSED', 'CANCELLED'];

export function statusSegments(counts: Array<{ status: WorkStatusKey; count: number }>): Segment[] {
  const byStatus = new Map(counts.map((c) => [c.status, c.count]));
  return STATUS_ORDER.filter((s) => byStatus.get(s)).map((s) => ({
    key: s,
    label: WORK_STATUS_LABELS[s],
    value: byStatus.get(s) ?? 0,
    ...TONE[STATUS_TONE[s]],
    info: createElement(InfoTip, { term: STATUS_TERM[s], align: 'right' }),
  }));
}

/** Hoàn thành / đang làm bình thường / lâu chưa cập nhật / quá hạn — cho thanh chồng của một nhóm. */
export function healthSegments(row: { done: number; open: number; overdue: number; staleOnly: number }): Segment[] {
  const { staleOnly } = row;
  return [
    { key: 'done', label: 'Hoàn thành', value: row.done, ...TONE.done },
    { key: 'active', label: 'Bình thường', value: Math.max(0, row.open - row.overdue - staleOnly), ...TONE.active },
    { key: 'stale', label: 'Lâu chưa cập nhật', value: staleOnly, ...TONE.stale },
    { key: 'overdue', label: 'Quá hạn', value: row.overdue, ...TONE.overdue },
  ];
}
