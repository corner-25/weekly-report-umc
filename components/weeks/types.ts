import type { AuditWeekInput, WeekStatus } from '@/lib/weeks/audit';

/** Một dòng của GET /api/weeks (các trường bổ sung có thể thiếu nếu API cũ). */
export interface WeekListItem extends AuditWeekInput {
  status: WeekStatus;
  reportFileUrl: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName?: string | null;
}
