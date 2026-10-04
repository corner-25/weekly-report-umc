/**
 * Nạp file cào từ phân hệ Quản lý công việc vào Postgres.
 *
 * Chạy lại bao nhiêu lần cũng được: việc khớp theo mã nguồn (externalId), cập
 * nhật khớp theo hash nội dung. Phần Phòng HC tự ghi (tính chất, lưu ý, ưu tiên,
 * gợi ý AI) không bao giờ bị file cào ghi đè.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { matchDepartment } from '@/lib/ingestion/parsers/department-matcher';
import { workImportItemSchema, workImportSchema, type WorkImportItem } from './schemas';
import { mapExternalStatus, updateHash } from './status';

export interface WorkImportSummary {
  runId: string;
  itemsSeen: number;
  itemsCreated: number;
  itemsChanged: number;
  updatesAdded: number;
  problems: Array<{ index: number; externalId?: string; message: string }>;
}

const TRANSACTION = { maxWait: 10_000, timeout: 60_000 };
/** Số việc ghi trong một transaction — file vài nghìn việc vẫn không giữ khoá quá lâu. */
const CHUNK = 100;

const dateOrNull = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`) : null);

/** Trường lấy từ nguồn — mỗi lần cào đều ghi lại theo nguồn. */
function sourceFields(item: WorkImportItem, departmentId: string | null) {
  return {
    externalUrl: item.url ?? null,
    kind: item.kind,
    title: item.title,
    description: item.description ?? null,
    directedBy: item.directedBy ?? null,
    directedAt: dateOrNull(item.directedAt),
    leadUnit: item.leadUnit ?? null,
    departmentId,
    coordinatingUnits: item.coordinatingUnits,
    assignees: item.assignees,
    dueDate: dateOrNull(item.dueDate),
    status: mapExternalStatus(item.status, item.progressPercent),
    externalStatus: item.status ?? null,
    progressPercent: item.progressPercent ?? null,
  } satisfies Prisma.WorkItemUncheckedUpdateInput;
}

/** Có trường nào của nguồn đổi so với bản đã lưu không (để đếm "việc thay đổi"). */
function changedFrom(existing: Record<string, unknown>, next: Record<string, unknown>): boolean {
  return Object.entries(next).some(([key, value]) => {
    const old = existing[key];
    if (value instanceof Date || old instanceof Date) {
      return (value as Date | null)?.getTime() !== (old as Date | null)?.getTime();
    }
    return JSON.stringify(old ?? null) !== JSON.stringify(value ?? null);
  });
}

function latest(dates: Array<Date | null | undefined>): Date | null {
  const valid = dates.filter((d): d is Date => d instanceof Date);
  return valid.length ? new Date(Math.max(...valid.map((d) => d.getTime()))) : null;
}

export async function importWorkPayload(
  db: PrismaClient,
  raw: unknown,
  options: { triggeredBy?: string; now?: Date } = {},
): Promise<WorkImportSummary> {
  const payload = workImportSchema.parse(raw);
  const now = options.now ?? new Date();
  const problems: WorkImportSummary['problems'] = [];

  const items: WorkImportItem[] = [];
  const seenIds = new Set<string>();
  payload.items.forEach((rawItem, index) => {
    const parsed = workImportItemSchema.safeParse(rawItem);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const externalId = (rawItem as { externalId?: unknown })?.externalId;
      problems.push({
        index,
        externalId: typeof externalId === 'string' ? externalId : undefined,
        message: `${issue.path.join('.') || 'việc'}: ${issue.message}`,
      });
      return;
    }
    if (seenIds.has(parsed.data.externalId)) {
      problems.push({ index, externalId: parsed.data.externalId, message: 'Trùng mã công việc trong file, bỏ bản sau' });
      return;
    }
    seenIds.add(parsed.data.externalId);
    items.push(parsed.data);
  });

  const departments = await db.department.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
  const departmentOf = (unit?: string) => (unit ? matchDepartment(unit, departments).departmentId ?? null : null);

  let itemsCreated = 0;
  let itemsChanged = 0;
  let updatesAdded = 0;

  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    await db.$transaction(async (tx) => {
      const existing = await tx.workItem.findMany({
        where: { source: 'QLCV', externalId: { in: chunk.map((c) => c.externalId) } },
      });
      const byExternal = new Map(existing.map((e) => [e.externalId, e]));

      for (const item of chunk) {
        const fields = sourceFields(item, departmentOf(item.leadUnit));
        const updates = item.updates.map((u) => ({
          source: 'QLCV' as const,
          occurredAt: u.at,
          author: u.author ?? null,
          content: u.content,
          progressPercent: u.progressPercent ?? null,
          contentHash: updateHash({ occurredAt: u.at, author: u.author, content: u.content }),
        }));
        const activity = latest([item.lastUpdatedAt, ...item.updates.map((u) => u.at)]);
        const old = byExternal.get(item.externalId);

        let workItemId: string;
        if (!old) {
          const created = await tx.workItem.create({
            data: { ...fields, source: 'QLCV', externalId: item.externalId, lastActivityAt: activity, lastSeenAt: now },
            select: { id: true },
          });
          workItemId = created.id;
          itemsCreated += 1;
        } else {
          // Phòng ban đã gán tay thì giữ, chỉ điền khi còn trống.
          const next = { ...fields, departmentId: old.departmentId ?? fields.departmentId };
          if (changedFrom(old, next)) itemsChanged += 1;
          await tx.workItem.update({
            where: { id: old.id },
            data: { ...next, lastActivityAt: latest([old.lastActivityAt, activity]), lastSeenAt: now },
          });
          workItemId = old.id;
        }

        if (updates.length > 0) {
          const { count } = await tx.workUpdate.createMany({
            data: updates.map((u) => ({ ...u, workItemId })),
            skipDuplicates: true,
          });
          updatesAdded += count;
        }
      }
    }, TRANSACTION);
  }

  const run = await db.workImportRun.create({
    data: {
      scrapedAt: payload.scrapedAt ?? null,
      triggeredBy: options.triggeredBy ?? null,
      itemsSeen: payload.items.length,
      itemsCreated,
      itemsChanged,
      updatesAdded,
      problems: problems.length ? problems : undefined,
    },
    select: { id: true },
  });

  return { runId: run.id, itemsSeen: payload.items.length, itemsCreated, itemsChanged, updatesAdded, problems };
}
