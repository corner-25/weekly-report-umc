/**
 * Thống kê sổ dẫn khám VIP:
 * - Theo năm × loại khám (Khám mới, Tái khám, Khác)
 * - Người giới thiệu nhiều nhất (xếp hạng kèm ngày gần nhất)
 * - Bác sĩ khám nhiều nhất
 * - Chuyên khoa khám nhiều nhất
 * - Dịch vụ hỗ trợ nhiều nhất
 */
import type { CrmInteractionStatus } from '@prisma/client';

export interface RawVipVisitStat {
  id: string;
  status: CrmInteractionStatus;
  occurredAt: Date;
  visitKind?: string | null;
  services?: string[];
  contactId?: string | null;
  referrerContactId?: string | null;
  referrerContact?: { id: string; fullName: string } | null;
  doctors?: Array<{ contact: { id: string; fullName: string } }>;
  visitItems?: unknown;
}

const vnYear = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).getUTCFullYear();

function countBy<T>(items: T[], keyOf: (t: T) => string | null): Array<{ name: string; count: number }> {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = keyOf(it);
    if (k && k.trim()) {
      const clean = k.trim();
      map.set(clean, (map.get(clean) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'));
}

export function computeVipEscortStats(items: RawVipVisitStat[]) {
  const done = items.filter((i) => i.status === 'DONE');
  const years = [...new Set(items.map((i) => vnYear(i.occurredAt)))].sort((a, b) => a - b);

  const byYear = years.map((year) => {
    const ofYear = items.filter((i) => vnYear(i.occurredAt) === year);
    const doneOfYear = ofYear.filter((i) => i.status === 'DONE');
    const newVisit = doneOfYear.filter((i) => i.visitKind === 'Khám mới').length;
    const revisit = doneOfYear.filter((i) => i.visitKind === 'Tái khám').length;
    const otherVisit = doneOfYear.length - newVisit - revisit;
    const postponedOrCancelled = ofYear.filter((i) => i.status === 'POSTPONED' || i.status === 'CANCELLED').length;
    const planned = ofYear.filter((i) => i.status === 'PLANNED').length;

    return {
      year,
      newVisit,
      revisit,
      otherVisit,
      done: doneOfYear.length,
      postponedOrCancelled,
      planned,
    };
  });

  // Top Người giới thiệu (kèm ngày gần nhất)
  const refMap = new Map<string, { id: string; name: string; count: number; last: Date }>();
  for (const i of done) {
    if (!i.referrerContact) continue;
    const r = refMap.get(i.referrerContact.id) ?? {
      id: i.referrerContact.id,
      name: i.referrerContact.fullName,
      count: 0,
      last: i.occurredAt,
    };
    refMap.set(i.referrerContact.id, {
      ...r,
      count: r.count + 1,
      last: i.occurredAt > r.last ? i.occurredAt : r.last,
    });
  }

  // Top Bác sĩ (từ danh sách doctors liên kết hoặc trích từ visitItems)
  const docMap = new Map<string, { id?: string; name: string; count: number }>();
  for (const i of done) {
    for (const d of i.doctors ?? []) {
      const row = docMap.get(d.contact.id) ?? { id: d.contact.id, name: d.contact.fullName, count: 0 };
      row.count += 1;
      docMap.set(d.contact.id, row);
    }
    if (Array.isArray(i.visitItems)) {
      for (const item of i.visitItems) {
        if (item && typeof item === 'object' && 'doctor' in item && typeof (item as { doctor: unknown }).doctor === 'string') {
          const docName = (item as { doctor: string }).doctor.trim();
          if (docName) {
            const key = `name:${docName.toLowerCase()}`;
            const row = docMap.get(key) ?? { name: docName, count: 0 };
            row.count += 1;
            docMap.set(key, row);
          }
        }
      }
    }
  }

  // Chuyên khoa (trích từ visitItems)
  const specialties: string[] = [];
  for (const i of done) {
    if (Array.isArray(i.visitItems)) {
      for (const item of i.visitItems) {
        if (item && typeof item === 'object' && 'specialty' in item && typeof (item as { specialty: unknown }).specialty === 'string') {
          const s = (item as { specialty: string }).specialty.trim();
          if (s) specialties.push(s);
        }
      }
    }
  }

  // Dịch vụ hỗ trợ
  const allServices = done.flatMap((i) => i.services ?? []);

  return {
    byYear,
    totals: {
      done: done.length,
      patients: new Set(done.map((i) => i.contactId).filter(Boolean)).size,
      referrers: new Set(done.map((i) => i.referrerContactId).filter(Boolean)).size,
      doctors: docMap.size,
      planned: items.filter((i) => i.status === 'PLANNED').length,
      postponedOrCancelled: items.filter((i) => i.status === 'POSTPONED' || i.status === 'CANCELLED').length,
    },
    topReferrers: [...refMap.values()]
      .sort((a, b) => b.count - a.count || b.last.getTime() - a.last.getTime())
      .slice(0, 10)
      .map((r) => ({ ...r, last: r.last.toISOString() })),
    topDoctors: [...docMap.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'))
      .slice(0, 12),
    topSpecialties: countBy(specialties, (s) => s).slice(0, 12),
    topServices: countBy(allServices, (s) => s).slice(0, 12),
  };
}

export type VipEscortStats = ReturnType<typeof computeVipEscortStats>;
