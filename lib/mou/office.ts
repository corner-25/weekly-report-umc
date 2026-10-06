/**
 * Chuyển một dòng cào từ dự án "Theo dõi ký kết hợp tác toàn viện" trên
 * office.umc.edu.vn (mỗi công việc = một MOU) sang bản ghi MOU của hệ thống.
 * Hàm thuần — phần ghi DB nằm ở prisma/import-mou-office.ts.
 */
import type { MOUCategory, MOUStatus } from '@prisma/client';

export interface OfficeMouRow {
  taskID: number | string;
  taskTitle: string;
  assigneeDeptName?: string | null;
  startDate?: string | null;
  deadline?: string | null;
  percentDone?: number | null;
  watcherName?: string | null;
  fN264?: string | null;
  statusName?: string | null;
}

export interface OfficeMouDetail {
  r?: Array<{ description?: string | null; assigneeName?: string | null }>;
  logTimes?: Array<{ logTimeID?: number; entryDate?: string | null; notes?: string | null; empName?: string | null; percentDone?: number | null }>;
  files?: Array<{ attchFileID: number; fileName: string; extension?: string | null; contentType?: string | null; createdDate?: string | null; createdBy?: string | null }>;
}

/** Đối tác nước ngoài — nhận từ tên vì office không có cột quốc gia. */
const FOREIGN_HINT =
  /Hàn Quốc|Nhật Bản|Đài Loan|Hoa Kỳ|\(Úc\)|Pháp|France|Seoul|Osaka|Nagoya|Asan|Ruijin|Thượng Hải|Monash|California|International|Inc\b|LLC|Oxford|Legacy Charities/i;

const COUNTRY_HINTS: ReadonlyArray<[RegExp, string]> = [
  [/Hàn Quốc|Seoul|Asan|Organoid/i, 'Hàn Quốc'],
  [/Nhật Bản|Osaka|Nagoya/i, 'Nhật Bản'],
  [/Đài Loan|Đài Bắc|Đài Trung/i, 'Đài Loan'],
  [/Hoa Kỳ|California|RAD-AID|FHI Clinical|PPD Investigator/i, 'Hoa Kỳ'],
  [/\(Úc\)|Monash/i, 'Úc'],
  [/Ile de France|Pháp/i, 'Pháp'],
  [/Ruijin|Thượng Hải/i, 'Trung Quốc'],
];

/** "Phân loại lĩnh vực" (FN264) → nhóm của hệ thống. */
const FIELD_CATEGORY: ReadonlyArray<[RegExp, MOUCategory]> = [
  [/Đào tạo|NCKH/i, 'ACADEMIC'],
  [/Hỗ trợ chuyên môn/i, 'CLINICAL'],
  [/Toàn diện/i, 'DOMESTIC'],
];

const DAY_MS = 86_400_000;

export function partnerOf(title: string): string {
  return title.replace(/^\s*MOU\s+(với|voi)\s+/i, '').trim() || title.trim();
}

export function countryOf(partner: string): string | null {
  return COUNTRY_HINTS.find(([re]) => re.test(partner))?.[1] ?? (FOREIGN_HINT.test(partner) ? 'Nước ngoài' : 'Việt Nam');
}

export function categoryOf(partner: string, field: string | null | undefined): MOUCategory {
  if (FOREIGN_HINT.test(partner) || countryOf(partner) !== 'Việt Nam') return 'INTERNATIONAL';
  return FIELD_CATEGORY.find(([re]) => re.test(field ?? ''))?.[1] ?? 'OTHER';
}

/**
 * Mới → đang soạn (chưa ký xong); Hoàn thành → đã kết thúc hợp tác;
 * Đang xử lý → hiệu lực, hoặc hết hạn nếu đã qua ngày hết hạn.
 */
export function statusOf(statusName: string | null | undefined, expiry: Date | null, now = new Date()): MOUStatus {
  const s = (statusName ?? '').trim();
  if (s === 'Mới') return 'DRAFT';
  if (s === 'Hoàn thành') return 'TERMINATED';
  if (expiry && expiry.getTime() < now.getTime() - DAY_MS) return 'EXPIRED';
  return 'ACTIVE';
}

/** "2024-08-01T00:00:00" / "2024-08-01 00:00:00" → ngày (UTC 0h). */
export function dateOf(value: string | null | undefined): Date | null {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
}

/** Mô tả office là HTML (đoạn, <br/>, span định dạng) → văn bản thuần giữ xuống dòng. */
export function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l, i, all) => l || (i > 0 && all[i - 1]))
    .join('\n')
    .trim();
  return text || null;
}

/** "N11-131 Nguyễn Mai Thy (Trung tâm TT)" → "Nguyễn Mai Thy". */
export function personName(value: string | null | undefined): string | null {
  const name = value?.replace(/^[A-Z]\d{2}-\d{3,}\s+/, '').replace(/\s*\([^()]*\)\s*$/, '').trim();
  return name || null;
}

export function documentTypeOf(fileName: string): string {
  const n = fileName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
  if (/to trinh|\bttr\b/.test(n)) return 'Tờ trình';
  if (/cong van|vbde/.test(n)) return 'Công văn';
  if (/\bkh\b|ke hoach/.test(n)) return 'Kế hoạch';
  if (/bao cao|\.xlsx?$/.test(n)) return 'Báo cáo';
  if (/^hd\b|hop dong/.test(n)) return 'Hợp đồng';
  return 'Biên bản ghi nhớ';
}

export interface MouRecord {
  externalCode: string;
  title: string;
  partnerName: string;
  partnerCountry: string | null;
  category: MOUCategory;
  status: MOUStatus;
  externalStatus: string | null;
  cooperationField: string | null;
  progressPercent: number | null;
  signedDate: Date | null;
  effectiveDate: Date | null;
  expiryDate: Date | null;
  purpose: string | null;
  contactPerson: string | null;
  leadUnit: string | null;
  watchers: string | null;
}

export function toMouRecord(row: OfficeMouRow, detail: OfficeMouDetail | undefined, now = new Date()): MouRecord {
  const partnerName = partnerOf(row.taskTitle);
  const field = row.fN264?.replace(/\s*\n\s*/g, '; ').trim() || null;
  const signed = dateOf(row.startDate);
  const expiry = dateOf(row.deadline);
  const info = detail?.r?.[0];
  return {
    externalCode: String(row.taskID),
    title: row.taskTitle.trim(),
    partnerName,
    partnerCountry: countryOf(partnerName),
    category: categoryOf(partnerName, field),
    status: statusOf(row.statusName, expiry, now),
    externalStatus: row.statusName?.trim() || null,
    cooperationField: field,
    progressPercent: row.percentDone == null ? null : Math.round(row.percentDone),
    signedDate: signed,
    effectiveDate: signed,
    expiryDate: expiry,
    purpose: htmlToText(info?.description),
    contactPerson: personName(info?.assigneeName),
    leadUnit: row.assigneeDeptName?.trim() || null,
    watchers: row.watcherName?.trim() || null,
  };
}

export interface MouProgressRecord {
  externalKey: string;
  date: Date;
  content: string;
  updatedBy: string | null;
}

export function toProgressRecords(taskId: string, detail: OfficeMouDetail | undefined): MouProgressRecord[] {
  return (detail?.logTimes ?? []).flatMap((log, i) => {
    const content = log.notes?.replace(/\r\n?/g, '\n').trim();
    const date = log.entryDate ? new Date(`${log.entryDate.replace(' ', 'T')}+07:00`) : null;
    if (!content || !date || Number.isNaN(date.getTime())) return [];
    return [{
      externalKey: `${taskId}:${log.logTimeID ?? `${log.entryDate}#${i}`}`,
      date,
      content,
      updatedBy: personName(log.empName),
    }];
  });
}
