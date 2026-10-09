/**
 * Danh sách công việc: lọc, đếm theo tab và sắp xếp — thuần, chạy được ở cả
 * máy chủ lẫn trình duyệt. Trang tải toàn bộ danh sách gọn một lần rồi lọc tại
 * chỗ, nên đổi tab/bộ lọc là có ngay, không chờ mạng.
 */
import { toSearchKey } from '@/lib/crm/constants';
import type { WorkKindKey, WorkPriorityKey, WorkStatusKey } from './constants';

export interface WorkListItem {
  id: string;
  source: 'QLCV' | 'MANUAL';
  externalId: string | null;
  externalUrl: string | null;
  kind: WorkKindKey;
  title: string;
  status: WorkStatusKey;
  externalStatus: string | null;
  priority: WorkPriorityKey;
  department: { id: string; name: string } | null;
  leadUnit: string | null;
  /** Tên lãnh đạo chỉ đạo đã bỏ mã nhân viên. */
  leader: string | null;
  directedAt: string | null;
  dueDate: string | null;
  completedAt: string | null;
  progressPercent: number | null;
  tags: string[];
  assignees: string[];
  updateCount: number;
  lastUpdate: { at: string; author: string | null; content: string; progressPercent: number | null } | null;
  /** Số ngày từ ngày chỉ đạo (hoặc ngày tạo) đến hôm nay. */
  ageDays: number;
  /** Số ngày im lặng: từ lần cập nhật cuối, chưa có thì từ ngày chỉ đạo. */
  silentDays: number;
  /** Số ngày đến hạn (âm là đã quá); null nếu không có hạn. */
  daysToDue: number | null;
  isOpen: boolean;
  isOverdue: boolean;
  isDueSoon: boolean;
  isStale: boolean;
  /** Việc đã xong có hạn: số ngày trễ (0 = đúng hạn); null nếu không xét được. */
  lateDays: number | null;
  /** Lần gần nhất đã gửi email đôn đốc cho thư ký/đầu mối. */
  lastRemindedAt?: string | null;
}

export const LIST_VIEWS = [
  { key: 'open', label: 'Đang thực hiện' },
  { key: 'overdue', label: 'Quá hạn' },
  { key: 'dueSoon', label: 'Sắp đến hạn' },
  { key: 'stale', label: 'Lâu chưa cập nhật' },
  { key: 'noUpdate', label: 'Chưa từng cập nhật' },
  { key: 'done', label: 'Hoàn thành' },
  { key: 'all', label: 'Tất cả' },
] as const;
export type ListView = (typeof LIST_VIEWS)[number]['key'];

export const LIST_SORTS = [
  { key: 'smart', label: 'Cần chú ý trước' },
  { key: 'due', label: 'Hạn gần nhất' },
  { key: 'silent', label: 'Im lặng lâu nhất' },
  { key: 'newest', label: 'Giao mới nhất' },
  { key: 'oldest', label: 'Giao lâu nhất' },
  { key: 'progressAsc', label: 'Tiến độ thấp nhất' },
  { key: 'progressDesc', label: 'Tiến độ cao nhất' },
  { key: 'completed', label: 'Hoàn thành gần nhất' },
] as const;
export type ListSort = (typeof LIST_SORTS)[number]['key'];

export interface ListFilters {
  view: ListView;
  year?: string;
  departmentId?: string;
  leader?: string;
  category?: string;
  priority?: string;
  q?: string;
}

const matchesView = (i: WorkListItem, view: ListView): boolean => {
  switch (view) {
    case 'open': return i.isOpen;
    case 'overdue': return i.isOverdue;
    case 'dueSoon': return i.isDueSoon;
    case 'stale': return i.isStale;
    case 'noUpdate': return i.isOpen && i.updateCount === 0;
    case 'done': return i.status === 'DONE';
    case 'all': return true;
  }
};

/** Lọc theo mọi thứ trừ tab — để đếm số việc của từng tab với cùng bộ lọc. */
function matchesOthers(i: WorkListItem, f: ListFilters, q: string): boolean {
  if (f.year && (i.directedAt ?? '').slice(0, 4) !== f.year) return false;
  if (f.departmentId === 'none' ? i.department !== null : f.departmentId && i.department?.id !== f.departmentId) return false;
  if (f.leader && i.leader !== f.leader) return false;
  if (f.category && i.tags[0] !== f.category) return false;
  if (f.priority && i.priority !== f.priority) return false;
  if (q && !toSearchKey(i.title, i.department?.name, i.leadUnit, i.leader, i.externalId, ...i.assignees).includes(q)) return false;
  return true;
}

export function filterItems(items: WorkListItem[], f: ListFilters) {
  const q = toSearchKey(f.q);
  const base = items.filter((i) => matchesOthers(i, f, q));
  const counts = Object.fromEntries(LIST_VIEWS.map((v) => [v.key, base.filter((i) => matchesView(i, v.key)).length])) as Record<ListView, number>;
  return { items: base.filter((i) => matchesView(i, f.view)), counts };
}

/** Điểm "cần chú ý": quá hạn lâu nhất lên đầu, rồi sắp đến hạn, rồi im lặng lâu. */
function attention(i: WorkListItem): number {
  if (!i.isOpen) return -1;
  if (i.isOverdue) return 3_000_000 + -(i.daysToDue ?? 0) * 1000 + i.silentDays;
  if (i.isDueSoon) return 2_000_000 - (i.daysToDue ?? 0) * 1000 + i.silentDays;
  if (i.isStale) return 1_000_000 + i.silentDays;
  return i.silentDays;
}

const byDate = (a: string | null, b: string | null, desc: boolean) => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return desc ? b.localeCompare(a) : a.localeCompare(b);
};
const byNumber = (a: number | null, b: number | null, desc: boolean) => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return desc ? b - a : a - b;
};

export function sortItems(items: WorkListItem[], sort: ListSort): WorkListItem[] {
  const compare: Record<ListSort, (a: WorkListItem, b: WorkListItem) => number> = {
    smart: (a, b) => attention(b) - attention(a) || byDate(a.directedAt, b.directedAt, true),
    due: (a, b) => byDate(a.dueDate, b.dueDate, false),
    silent: (a, b) => Number(b.isOpen) - Number(a.isOpen) || b.silentDays - a.silentDays,
    newest: (a, b) => byDate(a.directedAt, b.directedAt, true),
    oldest: (a, b) => byDate(a.directedAt, b.directedAt, false),
    progressAsc: (a, b) => byNumber(a.progressPercent, b.progressPercent, false),
    progressDesc: (a, b) => byNumber(a.progressPercent, b.progressPercent, true),
    completed: (a, b) => byDate(a.completedAt, b.completedAt, true),
  };
  return [...items].sort((a, b) => compare[sort](a, b) || a.title.localeCompare(b.title, 'vi'));
}

/** Nhóm theo đơn vị chủ trì, đơn vị nhiều việc quá hạn lên trước. */
export function groupByUnit(items: WorkListItem[]) {
  const groups = new Map<string, { key: string; unit: string; departmentId: string | null; items: WorkListItem[]; overdue: number; stale: number }>();
  for (const i of items) {
    const unit = i.department?.name ?? i.leadUnit ?? 'Chưa rõ đơn vị';
    const key = i.department?.id ?? `raw:${unit}`;
    const g = groups.get(key) ?? { key, unit, departmentId: i.department?.id ?? null, items: [], overdue: 0, stale: 0 };
    g.items.push(i);
    if (i.isOverdue) g.overdue += 1;
    if (i.isStale) g.stale += 1;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.overdue - a.overdue || b.items.length - a.items.length || a.unit.localeCompare(b.unit, 'vi'));
}

