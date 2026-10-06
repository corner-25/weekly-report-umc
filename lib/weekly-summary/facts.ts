/**
 * Phần số liệu của báo cáo tóm tắt — tính thẳng từ chỉ số đã trích, không qua AI
 * (AI dễ chép sai số). Thiếu chỉ số nào thì bỏ dòng đó, không đoán.
 */
import type { SummaryItem } from './types';

export interface MetricRow {
  code: string | null;
  name: string;
  value: number;
  unit: string | null;
  period: 'WEEK' | 'CUMULATIVE' | string;
}

const vi = (n: number, digits = 0) => n.toLocaleString('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

function find(rows: MetricRow[], code: string | null, namePattern: RegExp): MetricRow | undefined {
  return rows.find((r) => (code && r.code === code)) ?? rows.find((r) => namePattern.test(r.name));
}

/** "giảm 7% so với tuần 39" / "tăng 9%…" / "không đổi so với tuần 39". */
/** Chênh quá mức này giữa hai tuần liền nhau gần như chắc là số tuần trước trích sai (lệch hàng chục lần). */
export const SUSPICIOUS_CHANGE_PCT = 60;

export function changeText(current: number, previous: number | undefined, prevWeek: number): string | null {
  if (previous === undefined || previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (Math.abs(pct) > SUSPICIOUS_CHANGE_PCT) return null;
  if (pct === 0) return `không đổi so với tuần ${prevWeek}`;
  return `${pct > 0 ? 'tăng' : 'giảm'} ${Math.abs(pct)}% so với tuần ${prevWeek}`;
}

function withChange(label: string, current: MetricRow | undefined, previous: MetricRow | undefined, prevWeek: number, unit: string): string | null {
  if (!current) return null;
  const change = changeText(current.value, previous?.value, prevWeek);
  return `${label}${vi(current.value)} ${unit}${change ? ` (${change})` : ''}`;
}

/** Khám, chữa bệnh BHYT: lượt và chi phí ngoại trú, nội trú so với tuần trước. */
export function bhytItem(cur: MetricRow[], prev: MetricRow[], prevWeek: number): SummaryItem | null {
  const parts = (['ngoại trú', 'nội trú'] as const).map((kind) => {
    const count = new RegExp(`^Số lượt KCB BHYT ${kind}$`, 'i');
    const cost = new RegExp(`^Chi phí KCB BHYT thanh toán ${kind}$`, 'i');
    const visits = withChange('', find(cur, null, count), find(prev, null, count), prevWeek, 'lượt');
    const money = withChange('Chi phí KCB BHYT thanh toán là ', find(cur, null, cost), find(prev, null, cost), prevWeek, 'đồng');
    if (!visits && !money) return null;
    return `${kind === 'ngoại trú' ? 'Ngoại trú' : 'Nội trú'}: ${[visits, money].filter(Boolean).join(', ')}`;
  });
  const subItems = parts.filter((p): p is string => p !== null);
  return subItems.length ? { type: 'text', label: 'Khám, chữa bệnh BHYT', text: '', subItems, origin: 'facts' } : null;
}

/** Ghép tạng: số ca trong tuần (chênh luỹ kế với tuần trước) và tổng từ khi triển khai. */
export function transplantTable(cur: MetricRow[], prev: MetricRow[], week: number, asOf: string): SummaryItem | null {
  const organs = [
    ['Ghép gan', /^Ca ghép gan$/i],
    ['Ghép thận', /^Ca ghép thận$/i],
    ['Ghép tim', /^Ca ghép tim$/i],
    ['Ghép phổi', /^Ca ghép phổi$/i],
  ] as const;
  const rows = organs.flatMap(([label, re]) => {
    const now = find(cur, null, re);
    if (!now) return [];
    const before = find(prev, null, re);
    const inWeek = before ? Math.max(0, now.value - before.value) : null;
    return [[label, inWeek === null ? '—' : vi(inWeek), vi(now.value)]];
  });
  if (!rows.length) return null;
  return { type: 'table', title: 'Ghép tạng (ca)', columns: ['Nội dung', `Tuần ${week}`, `Tổng số (từ khi triển khai đến ${asOf})`], rows, boldRows: [], origin: 'facts' };
}

/** Khám sức khỏe toàn dân: luỹ kế lượt khám và tỷ lệ đạt kế hoạch. */
export function healthCheckItem(cur: MetricRow[]): SummaryItem | null {
  const total = find(cur, null, /^Lũy kế số lượt người khám sức khỏe toàn dân$/i);
  const rate = find(cur, null, /^Tỷ lệ đạt chỉ tiêu kế hoạch khám sức khỏe toàn dân$/i);
  if (!total) return null;
  return {
    type: 'text',
    label: 'Khám sức khỏe toàn dân',
    text: `${vi(total.value)} lượt người khám${rate ? `, đạt ${vi(rate.value, 1)}% kế hoạch` : ''}.`,
    subItems: [],
    origin: 'facts',
  };
}

const TRAINING_ROWS: Array<[string, RegExp, boolean]> = [
  ['Tiếp nhận đào tạo (đang học)', /^Sinh viên, học viên đang thực tập tại bệnh viện$/i, true],
  ['Sinh viên, học viên Đại học Y Dược TP. Hồ Chí Minh', /^Sinh viên, học viên Đại học Y Dược TP\.?HCM thực tập$/i, false],
  ['Sinh viên, học viên từ các cơ sở y tế, trường Đại học khác (trong nước)', /^Sinh viên, học viên từ các cơ sở y tế, trường Đại học khác \(trong nước\) thực tập$/i, false],
  ['Sinh viên từ các trường đại học nước ngoài', /^Sinh viên từ các trường Đại học nước ngoài thực tập$/i, false],
  ['Học viên đang thực hành để đủ điều kiện xin cấp giấy phép hành nghề khám bệnh, chữa bệnh', /^Học viên đang thực hành để đủ điều kiện xin cấp giấy phép hành nghề/i, false],
  ['Gửi đi đào tạo (đang học)', /^Gửi đi đào tạo \(đang học\)$/i, true],
  ['Đào tạo trong nước (chuyên môn, nghiệp vụ)', /^Đi đào tạo trong nước/i, false],
  ['Đào tạo nước ngoài <10 ngày', /^Đi đào tạo nước ngoài \(< 10 ngày\)$/i, false],
  ['Đào tạo nước ngoài ≥10 ngày', /^Đi đào tạo nước ngoài \(>= 10 ngày\)$/i, false],
  ['Lớp đào tạo tại Bệnh viện (đang tổ chức) — số lớp', /^Các lớp học đang được tổ chức tại bệnh viện$/i, true],
  ['Học viên các lớp tại Bệnh viện', /^Học viên các lớp học đang được tổ chức tại bệnh viện$/i, false],
  ['Đề tài NCKH cấp tỉnh (đang thực hiện)', /^Đề tài NCKH đang thực hiện cấp tỉnh/i, false],
  ['Đề tài NCKH cấp cơ sở (đang thực hiện)', /^Đề tài NCKH đang thực hiện cấp cơ sở$/i, false],
  ['Đề tài thử thuốc trên lâm sàng (đang thực hiện)', /^Đề tài NCKH đang thực hiện thử thuốc trên lâm sàng$/i, false],
];

/** Bảng đào tạo, NCKH theo mẫu báo cáo. */
export function trainingTable(cur: MetricRow[], week: number): SummaryItem | null {
  const rows: string[][] = [];
  const boldRows: number[] = [];
  for (const [label, re, bold] of TRAINING_ROWS) {
    const m = find(cur, null, re);
    if (!m) continue;
    if (bold) boldRows.push(rows.length);
    rows.push([label, m.unit ?? '', vi(m.value)]);
  }
  if (rows.length < 3) return null;
  return { type: 'table', title: 'Đào tạo, nghiên cứu khoa học', columns: ['Nội dung', 'ĐVT', `Tuần ${week}`], rows, boldRows, origin: 'facts' };
}
