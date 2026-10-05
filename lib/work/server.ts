import type { Prisma } from '@prisma/client';
import { workHealth } from './status';

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
