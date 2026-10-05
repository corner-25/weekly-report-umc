/**
 * Thống kê sổ tiếp đoàn — tính thuần trên danh sách lượt tiếp đoàn, để đối chiếu
 * với bảng ThongKe của sổ chuẩn hoá: theo năm × hình thức (chỉ lượt đã thực hiện),
 * theo loại tổ chức, đơn vị tiếp nhiều nhất, khoa/phòng chủ trì, chủ đề.
 */
import type { CrmInteractionStatus } from '@prisma/client';
import { DELEGATION_PURPOSES } from './constants';

export interface StatsDelegation {
  status: CrmInteractionStatus;
  occurredAt: Date;
  dateUnknown: boolean;
  purpose: string | null;
  topics: string[];
  hostUnit: string | null;
  guestCount: number | null;
  cashReceived: number | null;
  needsReview: boolean;
  organization: { id: string; name: string; category: string | null } | null;
}

const vnYear = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).getUTCFullYear();
const OTHER_PURPOSE = 'Khác';

function countBy<T>(items: T[], keyOf: (t: T) => string | null): Array<{ name: string; count: number }> {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = keyOf(it);
    if (k) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'));
}

export function computeDelegationStats(items: StatsDelegation[]) {
  const done = items.filter((i) => i.status === 'DONE');
  const purposes = [...DELEGATION_PURPOSES, OTHER_PURPOSE];
  const purposeOf = (i: StatsDelegation) => (i.purpose && (DELEGATION_PURPOSES as readonly string[]).includes(i.purpose) ? i.purpose : OTHER_PURPOSE);
  const years = [...new Set(items.map((i) => vnYear(i.occurredAt)))].sort((a, b) => a - b);

  const byYear = years.map((year) => {
    const ofYear = items.filter((i) => vnYear(i.occurredAt) === year);
    const doneOfYear = ofYear.filter((i) => i.status === 'DONE');
    return {
      year,
      byPurpose: Object.fromEntries(purposes.map((p) => [p, doneOfYear.filter((i) => purposeOf(i) === p).length])) as Record<string, number>,
      done: doneOfYear.length,
      postponedOrCancelled: ofYear.filter((i) => i.status === 'POSTPONED' || i.status === 'CANCELLED').length,
      other: ofYear.filter((i) => i.status === 'PLANNED').length,
      guests: doneOfYear.reduce((s, i) => s + (i.guestCount ?? 0), 0),
    };
  });

  const orgs = new Map<string, { id: string; name: string; count: number; last: Date }>();
  for (const i of done) {
    if (!i.organization) continue;
    const o = orgs.get(i.organization.id) ?? { id: i.organization.id, name: i.organization.name, count: 0, last: i.occurredAt };
    orgs.set(i.organization.id, { ...o, count: o.count + 1, last: i.occurredAt > o.last ? i.occurredAt : o.last });
  }

  return {
    purposes,
    byYear,
    totals: {
      done: done.length,
      organizations: new Set(done.map((i) => i.organization?.id).filter(Boolean)).size,
      cashReceived: done.reduce((s, i) => s + (i.cashReceived ?? 0), 0),
      needsReview: items.filter((i) => i.needsReview).length,
      undated: items.filter((i) => i.dateUnknown).length,
    },
    categories: countBy(done, (i) => i.organization?.category ?? null),
    topOrganizations: [...orgs.values()].sort((a, b) => b.count - a.count || b.last.getTime() - a.last.getTime()).slice(0, 10).map((o) => ({ ...o, last: o.last.toISOString() })),
    hosts: countBy(done, (i) => i.hostUnit).slice(0, 12),
    topics: done.flatMap((i) => i.topics).reduce<Array<{ name: string; count: number }>>((acc, t) => {
      const row = acc.find((r) => r.name === t);
      if (row) row.count += 1;
      else acc.push({ name: t, count: 1 });
      return acc;
    }, []).sort((a, b) => b.count - a.count),
  };
}

export type DelegationStats = ReturnType<typeof computeDelegationStats>;
