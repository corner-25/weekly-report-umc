import type { Prisma } from '@prisma/client';
import { workHealth } from './status';
import { personName } from './analytics';
import type { WorkListItem } from './list';

export const workItemInclude = {
  department: { select: { id: true, name: true } },
  _count: { select: { updates: true } },
} satisfies Prisma.WorkItemInclude;

type WorkItemWithRelations = Prisma.WorkItemGetPayload<{ include: typeof workItemInclude }>;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function toWorkItemDto(item: WorkItemWithRelations, now: Date = new Date()) {
  return {
    id: item.id,
    source: item.source,
    externalId: item.externalId,
    externalUrl: item.externalUrl,
    kind: item.kind,
    title: item.title,
    description: item.description,
    directedBy: item.directedBy,
    directedAt: day(item.directedAt),
    leadUnit: item.leadUnit,
    department: item.department,
    coordinatingUnits: item.coordinatingUnits,
    assignees: item.assignees,
    watchers: item.watchers,
    dueDate: day(item.dueDate),
    status: item.status,
    externalStatus: item.externalStatus,
    progressPercent: item.progressPercent,
    completedAt: item.completedAt?.toISOString() ?? null,
    lastActivityAt: item.lastActivityAt?.toISOString() ?? null,
    lastSeenAt: item.lastSeenAt?.toISOString() ?? null,
    priority: item.priority,
    tags: item.tags,
    characteristics: item.characteristics,
    notes: item.notes,
    aiPlan: item.aiPlan,
    aiAssessment: item.aiAssessment,
    aiUpdatedAt: item.aiUpdatedAt?.toISOString() ?? null,
    lastRemindedAt: item.lastRemindedAt?.toISOString() ?? null,
    updateCount: item._count.updates,
    createdAt: item.createdAt.toISOString(),
    health: workHealth(item, now),
  };
}

export function toWorkUpdateDto(u: Prisma.WorkUpdateGetPayload<object>) {
  return {
    id: u.id,
    source: u.source,
    occurredAt: u.occurredAt.toISOString(),
    author: u.author,
    content: u.content,
    progressPercent: u.progressPercent,
  };
}

const MS_PER_DAY = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;
const vnDayNumber = (d: Date) => Math.floor((d.getTime() + VN_OFFSET_MS) / MS_PER_DAY);
const dateDayNumber = (d: Date) => Math.floor(d.getTime() / MS_PER_DAY);
const LAST_UPDATE_CHARS = 280;

type LatestUpdate = { occurredAt: Date; author: string | null; content: string; progressPercent: number | null };

/** Bản gọn cho trang danh sách: đủ để lọc, sắp xếp và hiện badge, không kèm mô tả dài hay gợi ý AI. */
export function toWorkListItem(item: WorkItemWithRelations, latest: LatestUpdate | null, now: Date = new Date()): WorkListItem {
  const health = workHealth(item, now);
  const today = vnDayNumber(now);
  const assigned = item.directedAt ?? item.createdAt;
  const lastActivity = item.lastActivityAt ?? assigned;
  const content = latest?.content.replace(/\s+/g, ' ').trim() ?? '';
  return {
    id: item.id,
    source: item.source,
    externalId: item.externalId,
    externalUrl: item.externalUrl,
    kind: item.kind,
    title: item.title,
    status: item.status,
    externalStatus: item.externalStatus,
    priority: item.priority,
    department: item.department,
    leadUnit: item.leadUnit,
    leader: personName(item.directedBy),
    directedAt: day(assigned),
    dueDate: day(item.dueDate),
    completedAt: item.completedAt?.toISOString() ?? null,
    progressPercent: item.progressPercent,
    tags: item.tags,
    assignees: item.assignees.map((a) => personName(a) ?? a),
    updateCount: item._count.updates,
    lastUpdate: latest && {
      at: latest.occurredAt.toISOString(),
      author: latest.author,
      content: content.length > LAST_UPDATE_CHARS ? `${content.slice(0, LAST_UPDATE_CHARS)}…` : content,
      progressPercent: latest.progressPercent,
    },
    ageDays: Math.max(0, today - dateDayNumber(assigned)),
    silentDays: Math.max(0, today - vnDayNumber(lastActivity)),
    daysToDue: health.daysToDue,
    isOpen: !health.isClosed,
    isOverdue: health.isOverdue,
    isDueSoon: health.isDueSoon,
    isStale: health.isStale,
    lateDays:
      item.status === 'DONE' && item.completedAt && item.dueDate ? Math.max(0, vnDayNumber(item.completedAt) - dateDayNumber(item.dueDate)) : null,
    lastRemindedAt: item.lastRemindedAt?.toISOString() ?? null,
  };
}
