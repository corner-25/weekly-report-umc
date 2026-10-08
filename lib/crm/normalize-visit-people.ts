import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { normalizeCrmPerson } from './people-normalization';
import { toSearchKey } from './constants';

/** Bổ sung liên kết, giữ nguồn gốc. Lập kế hoạch trước rồi ghi theo nhóm trong một giao dịch. */
export async function normalizeVisitPeople(db: PrismaClient, dryRun = true) {
  const [visits, contacts] = await Promise.all([
    db.crmInteraction.findMany({ where: { type: 'VIP_ESCORT' }, select: { id: true, contactId: true, referrer: true, referrerContactId: true, visitItems: true } }),
    db.crmContact.findMany({ select: { id: true, fullName: true, tags: true, patientCode: true } }),
  ]);
  const stats = { visits: visits.length, created: 0, referralLinks: 0, doctorLinks: 0, profileLinks: 0, unresolved: [] as string[] };
  const resolved = new Map<string, string>();
  const creates: Array<{ id: string; fullName: string; searchKey: string; tags: string[]; source: string }> = [];
  const referralGroups = new Map<string, string[]>();
  const doctorLinks: Array<{ interactionId: string; contactId: string }> = [];
  const profileRefs = new Map<string, Set<string>>();
  function person(raw: string, role: string) {
    const normalized = normalizeCrmPerson(raw);
    if (!normalized) { stats.unresolved.push(`${role}: ${raw}`); return null; }
    const { name, key } = normalized;
    const cached = resolved.get(key);
    if (cached) {
      const created = creates.find(c => c.id === cached);
      if (created && !created.tags.includes(role)) created.tags.push(role);
      return cached;
    }
    // Ưu tiên hồ sơ nhân sự, lãnh đạo, bác sĩ hoặc người giới thiệu đã có trong danh bạ
    const staffMatches = contacts.filter(c =>
      normalizeCrmPerson(c.fullName)?.key === key &&
      c.tags.some(t => ['Ban Giám đốc', 'Lãnh đạo Bệnh viện', 'Bác sĩ', 'Người giới thiệu'].includes(t))
    );
    const matches = staffMatches.length > 0
      ? staffMatches
      : contacts.filter(c => normalizeCrmPerson(c.fullName)?.key === key && !c.patientCode && !c.tags.includes('Khách khám bệnh'));
    if (matches.length > 1) { stats.unresolved.push(`${role}: ${raw} (nhiều hồ sơ cùng tên)`); return null; }
    const id = matches[0]?.id ?? randomUUID();
    if (!matches.length) {
      creates.push({ id, fullName: name, searchKey: toSearchKey(name), tags: [role], source: 'Chuẩn hoá danh sách khách KCB' });
    } else if (!matches[0].tags.includes(role)) {
      matches[0].tags.push(role);
    }
    resolved.set(key, id);
    return id;
  }
  for (const visit of visits) {
    const refId = visit.referrerContactId ?? (visit.referrer ? person(visit.referrer, 'Người giới thiệu') : null);
    if (refId) {
      if (!visit.referrerContactId) {
        const group = referralGroups.get(refId) ?? []; group.push(visit.id); referralGroups.set(refId, group);
      }
      if (visit.contactId && refId !== visit.contactId) {
        const refs = profileRefs.get(visit.contactId) ?? new Set<string>(); refs.add(refId); profileRefs.set(visit.contactId, refs);
      }
    }
    const ids = new Set<string>();
    for (const item of Array.isArray(visit.visitItems) ? visit.visitItems : []) {
      if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.doctor !== 'string') continue;
      const id = person(item.doctor, 'Bác sĩ');
      if (id) ids.add(id);
    }
    doctorLinks.push(...[...ids].map(contactId => ({ interactionId: visit.id, contactId })));
  }
  const profileGroups = new Map<string, string[]>();
  for (const [contactId, refs] of profileRefs) {
    if (refs.size !== 1) continue;
    const refId = [...refs][0], group = profileGroups.get(refId) ?? [];
    group.push(contactId); profileGroups.set(refId, group);
  }
  stats.unresolved = [...new Set(stats.unresolved)];
  if (dryRun) {
    stats.created = creates.length;
    stats.referralLinks = [...referralGroups.values()].reduce((sum, ids) => sum + ids.length, 0);
    stats.doctorLinks = doctorLinks.length;
    stats.profileLinks = [...profileGroups.values()].reduce((sum, ids) => sum + ids.length, 0);
    return stats;
  }
  await db.$transaction(async tx => {
    if (creates.length) stats.created = (await tx.crmContact.createMany({ data: creates })).count;
    for (const [referrerContactId, ids] of referralGroups) stats.referralLinks += (await tx.crmInteraction.updateMany({ where: { id: { in: ids }, referrerContactId: null }, data: { referrerContactId } })).count;
    if (doctorLinks.length) stats.doctorLinks = (await tx.crmVisitDoctor.createMany({ data: doctorLinks, skipDuplicates: true })).count;
    for (const [referrerContactId, ids] of profileGroups) stats.profileLinks += (await tx.crmContact.updateMany({ where: { id: { in: ids }, referrerContactId: null }, data: { referrerContactId } })).count;
  }, { timeout: 120_000, maxWait: 15_000 });
  return stats;
}
