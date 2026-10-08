import type { Prisma } from '@prisma/client';
import { toSearchKey } from './constants';
import { careOccasionKey } from './care';
import { HttpError } from './server';

type Tx = Prisma.TransactionClient;

const TIER_RANK = { VIP: 0, A: 1, B: 2, C: 3 } as const;

/** Trường chữ: hồ sơ giữ lại còn trống thì lấy của hồ sơ trùng. */
const FILL_FIELDS = ['academicTitle', 'salutation', 'gender', 'phone', 'email', 'giftAddress', 'ownerName', 'source'] as const;

function joinText(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b || a.includes(b)) return a;
  return `${a}\n${b}`;
}

/**
 * Gộp hồ sơ `sourceId` (bản trùng) vào `targetId` (bản giữ lại), không mất lịch sử:
 * lượt tương tác, lượt đi đoàn, chức vụ, người thân, ngày quan trọng đều chuyển sang;
 * thông tin còn trống được bổ sung; ghi chú nối lại. Bản trùng bị xoá.
 */
export async function mergeContacts(tx: Tx, targetId: string, sourceId: string): Promise<void> {
  if (targetId === sourceId) throw new HttpError(400, 'Không thể gộp một hồ sơ với chính nó');
  const [target, source] = await Promise.all([
    tx.crmContact.findUnique({ where: { id: targetId } }),
    tx.crmContact.findUnique({ where: { id: sourceId } }),
  ]);
  if (!target || !source) throw new HttpError(404, 'Không tìm thấy một trong hai hồ sơ');

  await tx.crmInteraction.updateMany({ where: { contactId: sourceId }, data: { contactId: targetId } });
  await tx.crmInteraction.updateMany({ where: { referrerContactId: sourceId }, data: { referrerContactId: targetId } });
  await tx.crmInteraction.updateMany({ where: { relatedVipContactId: sourceId }, data: { relatedVipContactId: targetId } });
  const doctors = await tx.crmVisitDoctor.findMany({ where: { contactId: sourceId } });
  await tx.crmVisitDoctor.createMany({ data: doctors.map(d => ({ interactionId: d.interactionId, contactId: targetId })), skipDuplicates: true });
  await tx.crmVisitDoctor.deleteMany({ where: { contactId: sourceId } });
  await tx.crmContact.updateMany({ where: { referrerContactId: sourceId }, data: { referrerContactId: targetId } });
  await tx.crmContact.updateMany({ where: { relatedVipContactId: sourceId }, data: { relatedVipContactId: targetId } });
  await tx.crmContact.update({ where: { id: targetId }, data: {
    referrerContactId: [sourceId, targetId].includes(target.referrerContactId ?? source.referrerContactId ?? '') ? null : target.referrerContactId ?? source.referrerContactId,
    relatedVipContactId: [sourceId, targetId].includes(target.relatedVipContactId ?? source.relatedVipContactId ?? '') ? null : target.relatedVipContactId ?? source.relatedVipContactId,
    vipRelationship: target.vipRelationship ?? source.vipRelationship,
  } });
  // Lượt đi đoàn: chuyển sang người giữ lại, bỏ dòng trùng và dòng mà người đó đã là trưởng đoàn.
  await tx.$executeRaw`
    INSERT INTO crm_interaction_participants ("interactionId", "contactId")
    SELECT p."interactionId", ${targetId} FROM crm_interaction_participants p
    JOIN crm_interactions i ON i.id = p."interactionId"
    WHERE p."contactId" = ${sourceId} AND i."contactId" IS DISTINCT FROM ${targetId}
    ON CONFLICT DO NOTHING`;
  await tx.$executeRaw`
    DELETE FROM crm_interaction_participants p USING crm_interactions i
    WHERE p."interactionId" = i.id AND p."contactId" = ${targetId} AND i."contactId" = ${targetId}`;

  // Chức vụ, ngày quan trọng: bỏ bản trùng y hệt đã có ở hồ sơ giữ lại.
  const [targetPositions, targetDates] = await Promise.all([
    tx.crmPosition.findMany({ where: { contactId: targetId }, select: { title: true, organizationId: true } }),
    tx.crmImportantDate.findMany({ where: { contactId: targetId }, select: { kind: true, day: true, month: true, isLunar: true } }),
  ]);
  const positionKey = (p: { title: string; organizationId: string | null }) => `${toSearchKey(p.title)}|${p.organizationId}`;
  const dateKey = (d: { kind: string; day: number; month: number; isLunar: boolean }) => `${d.kind}|${d.day}|${d.month}|${d.isLunar}`;
  const hasPosition = new Set(targetPositions.map(positionKey));
  const hasDate = new Set(targetDates.map(dateKey));
  const [sourcePositions, sourceDates] = await Promise.all([
    tx.crmPosition.findMany({ where: { contactId: sourceId }, select: { id: true, title: true, organizationId: true } }),
    tx.crmImportantDate.findMany({ where: { contactId: sourceId }, select: { id: true, kind: true, day: true, month: true, isLunar: true } }),
  ]);
  await tx.crmPosition.updateMany({
    where: { id: { in: sourcePositions.filter((p) => !hasPosition.has(positionKey(p))).map((p) => p.id) } },
    data: { contactId: targetId },
  });
  await tx.crmImportantDate.updateMany({
    where: { id: { in: sourceDates.filter((d) => !hasDate.has(dateKey(d))).map((d) => d.id) } },
    data: { contactId: targetId },
  });

  // Việc quà/hoa: chuyển sang người giữ lại, tính lại khoá chống trùng. Trùng dịp với
  // việc đã có thì giữ khoá cũ (vẫn duy nhất) — không xoá lịch sử quà đã tặng.
  const [targetCare, sourceCare] = await Promise.all([
    tx.crmCareTask.findMany({ where: { contactId: targetId }, select: { occasionKey: true } }),
    tx.crmCareTask.findMany({ where: { contactId: sourceId } }),
  ]);
  const careKeys = new Set(targetCare.map((t) => t.occasionKey));
  for (const t of sourceCare) {
    const key = careOccasionKey({ ...t, contactId: targetId, occasionDate: t.occasionDate.toISOString() });
    const free = !careKeys.has(key);
    if (free) careKeys.add(key);
    await tx.crmCareTask.update({ where: { id: t.id }, data: { contactId: targetId, ...(free && { occasionKey: key }) } });
  }

  await tx.crmRelation.updateMany({ where: { fromContactId: sourceId }, data: { fromContactId: targetId } });
  await tx.crmRelation.updateMany({ where: { toContactId: sourceId }, data: { toContactId: targetId } });
  await tx.crmRelation.deleteMany({ where: { fromContactId: targetId, toContactId: targetId } });

  const filled = Object.fromEntries(FILL_FIELDS.map((f) => [f, target[f] ?? source[f]]));
  const hasTargetBirth = target.birthDay !== null && target.birthMonth !== null;
  const birth = hasTargetBirth ? target : source;
  const phone = (filled.phone as string | null) ?? null;
  await tx.crmContact.update({
    where: { id: targetId },
    data: {
      ...filled,
      birthDay: birth.birthDay,
      birthMonth: birth.birthMonth,
      birthYear: target.birthYear ?? (hasTargetBirth ? null : source.birthYear),
      birthIsLunar: birth.birthIsLunar,
      tier: TIER_RANK[source.tier] < TIER_RANK[target.tier] ? source.tier : target.tier,
      tags: [...new Set([...target.tags, ...source.tags])],
      note: joinText(target.note, source.note),
      sensitiveNote: joinText(target.sensitiveNote, source.sensitiveNote),
      preferences: (target.preferences ?? source.preferences ?? undefined) as Prisma.InputJsonValue | undefined,
      searchKey: toSearchKey(target.fullName, phone),
    },
  });
  await tx.crmContact.delete({ where: { id: sourceId } });
}
