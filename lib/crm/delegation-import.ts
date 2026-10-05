/**
 * Quy đổi một dòng sổ tiếp đoàn đã chuẩn hoá (TiepDoan_ChuanHoa_*.xlsx, qua
 * tools/crm-import/tiepdoan_to_json.py) sang dữ liệu CRM. Thuần — không chạm DB,
 * để kiểm thử được; prisma/import-crm-tiep-doan.ts lo ghi.
 */
import type { CrmInteractionStatus, CrmOrganizationType } from '@prisma/client';
import { ORGANIZATION_CATEGORIES, toSearchKey } from './constants';

export type SheetRow = Record<string, string | number | null>;

const str = (row: SheetRow, key: string): string | null => {
  const v = row[key];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
};
const int = (row: SheetRow, key: string): number | null => {
  const s = str(row, key);
  if (!s) return null;
  const n = Number(s.replace(/[.\s,]/g, ''));
  return Number.isInteger(n) && n >= 0 && n <= 2_000_000_000 ? n : null;
};
const list = (value: string | null, separator: RegExp) => (value ? value.split(separator).map((s) => s.trim()).filter(Boolean) : []);

export const STATUS_FROM_SHEET: Record<string, CrmInteractionStatus> = {
  'Đã thực hiện': 'DONE',
  // Đoàn làm việc kéo dài chưa xong: để là lịch hẹn, kết thúc thì bấm "Đã xong" —
  // khớp bảng thống kê của sổ (chỉ đếm lượt đã thực hiện).
  'Đang diễn ra': 'PLANNED',
  'Dự kiến': 'PLANNED',
  'Chưa xác định ngày': 'PLANNED',
  Hoãn: 'POSTPONED',
  'Hủy': 'CANCELLED',
  'Huỷ': 'CANCELLED',
};

export function organizationType(category: string | null, scope: string | null): CrmOrganizationType {
  if (scope === 'Tổ chức quốc tế') return 'INTERNATIONAL';
  return (category && ORGANIZATION_CATEGORIES[category]) || 'OTHER';
}

export interface OrganizationRecord {
  externalCode: string;
  name: string;
  category: string | null;
  scope: string | null;
  type: CrmOrganizationType;
  aliases: string[];
  mergeNote: string | null;
}

export function toOrganization(row: SheetRow): OrganizationRecord | null {
  const externalCode = str(row, 'Mã tổ chức');
  const name = str(row, 'Tên tổ chức (chuẩn hoá)');
  if (!externalCode || !name) return null;
  const category = str(row, 'Loại tổ chức');
  const scope = str(row, 'Phạm vi');
  const aliases = [...new Set(list(str(row, 'Các tên đã ghi nhận trong file gốc'), /\s*\|\s*/))].filter((a) => a !== name);
  return { externalCode, name, category, scope, type: organizationType(category, scope), aliases, mergeNote: str(row, 'Ghi chú gộp tên') };
}

/** "09g15-09g30", "10h30", "14:30 - 15:30", "15:00:00" → giờ bắt đầu [giờ, phút]; không đọc được thì null. */
export function parseStartTime(raw: string | null): [number, number] | null {
  const m = raw?.match(/(\d{1,2})\s*[:hg]\s*(\d{2})?/i);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  return h <= 23 && min <= 59 ? [h, min] : null;
}

/** Ngày (YYYY-MM-DD) và giờ theo giờ Việt Nam → thời điểm UTC. */
export function vnDateTime(day: string, time: [number, number] | null): Date {
  const [h, min] = time ?? [0, 0];
  return new Date(`${day}T${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00+07:00`);
}

/** Khoá so tên khoa/phòng: bỏ dấu, bỏ ký tự nối, bỏ tiền tố Khoa/Phòng/Đơn vị. */
export function unitKey(name: string): string {
  return toSearchKey(name)
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/^(khoa|phong|don vi|trung tam)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tên chủ trì trong sổ còn ghi kèm chú thích — quy về tên khoa/phòng để khớp danh mục. */
const HOST_ALIASES: Array<[RegExp, string]> = [[/^TTTT\b/, 'Trung tâm Truyền thông']];

export function hostCandidates(raw: string | null): string[] {
  return list(raw, /\s*;\s*/).map((name) => HOST_ALIASES.find(([re]) => re.test(name))?.[1] ?? name);
}

export interface DelegationRecord {
  externalCode: string;
  organizationCode: string | null;
  status: CrmInteractionStatus;
  occurredAt: Date;
  endAt: Date | null;
  dateUnknown: boolean;
  timeText: string | null;
  title: string | null;
  content: string;
  destination: string | null;
  guestCount: number | null;
  purpose: string | null;
  purposeInferred: boolean;
  topics: string[];
  hostUnit: string | null;
  hostCandidates: string[];
  incomingDocNo: string | null;
  hospitalAttendees: string | null;
  guestMembers: string | null;
  coOrganizations: string[];
  giftsGiven: string | null;
  giftsReceived: string | null;
  cashReceived: number | null;
  giftBudget: number | null;
  giftActualCost: number | null;
  note: string | null;
  needsReview: boolean;
  reviewNote: string | null;
  sourceRef: string | null;
}

export function toDelegation(row: SheetRow): DelegationRecord | null {
  const externalCode = str(row, 'Mã đoàn');
  if (!externalCode) return null;
  const start = str(row, 'Ngày bắt đầu');
  const end = str(row, 'Ngày kết thúc');
  const year = str(row, 'Năm') ?? externalCode.slice(3, 7);
  const timeText = str(row, 'Giờ');
  const title = str(row, 'Tên đoàn (như ghi nhận)');
  const rawStatus = str(row, 'Trạng thái') ?? 'Đã thực hiện';
  const originalNote = str(row, 'Ghi chú (gốc)');
  const processingNote = str(row, 'Ghi chú xử lý');
  const originalDate = str(row, 'Ngày ghi trong file gốc');
  const source = str(row, 'Nguồn dữ liệu');
  const hostUnit = str(row, 'Đơn vị chủ trì');
  return {
    externalCode,
    organizationCode: str(row, 'Mã tổ chức'),
    status: STATUS_FROM_SHEET[rawStatus] ?? 'DONE',
    // Không có ngày: xếp vào đầu năm, đánh dấu để giao diện ghi "chưa rõ ngày".
    occurredAt: start ? vnDateTime(start, parseStartTime(timeText)) : vnDateTime(`${year}-01-01`, null),
    endAt: start && end && end !== start ? vnDateTime(end, null) : null,
    dateUnknown: !start,
    timeText,
    title,
    content: str(row, 'Nội dung làm việc') ?? title ?? externalCode,
    destination: str(row, 'Địa điểm'),
    guestCount: int(row, 'Số lượng khách'),
    purpose: str(row, 'Hình thức tiếp'),
    purposeInferred: str(row, 'Nguồn hình thức') === 'Suy luận từ nội dung',
    topics: list(str(row, 'Chủ đề (tự gắn)'), /\s*;\s*/),
    hostUnit,
    hostCandidates: hostCandidates(hostUnit),
    incomingDocNo: str(row, 'Số văn bản đến'),
    hospitalAttendees: str(row, 'Thành phần tiếp (Bệnh viện)'),
    guestMembers: str(row, 'Thành phần đoàn khách'),
    coOrganizations: list(str(row, 'Tổ chức đi cùng'), /\s*;\s*/),
    giftsGiven: str(row, 'Quà Bệnh viện tặng'),
    giftsReceived: str(row, 'Quà khách tặng'),
    cashReceived: int(row, 'Tiền mặt khách tặng (VNĐ)'),
    giftBudget: int(row, 'Dự trù kinh phí quà (VNĐ)'),
    giftActualCost: int(row, 'Chi phí quà thực tế (VNĐ)'),
    note:
      [
        originalNote,
        processingNote && `Xử lý khi chuẩn hoá: ${processingNote}`,
        rawStatus === 'Đang diễn ra' && 'Đoàn đang làm việc (tại ngày chuẩn hoá 05/10/2026).',
        rawStatus === 'Chưa xác định ngày' && 'Sổ gốc không ghi ngày tiếp.',
      ]
        .filter(Boolean)
        .join('\n') || null,
    needsReview: str(row, 'Cần kiểm tra') === 'Có',
    reviewNote: str(row, 'Nội dung cần kiểm tra'),
    sourceRef: [source, originalDate && `ngày ghi gốc ${originalDate}`].filter(Boolean).join(' · ') || null,
  };
}
