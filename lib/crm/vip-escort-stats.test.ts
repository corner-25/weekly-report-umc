import { describe, expect, it } from 'vitest';
import { computeVipEscortStats, type RawVipVisitStat } from './vip-escort-stats';

const contact = (id: string, fullName: string) => ({ id, fullName });
const item = (o: Partial<RawVipVisitStat>): RawVipVisitStat => ({
  id: 'test-id',
  status: 'DONE',
  occurredAt: new Date('2025-05-15T08:00:00Z'),
  visitKind: 'Khám mới',
  services: ['Dẫn khám'],
  visitItems: [{ specialty: 'Tim mạch', doctor: 'Nguyễn Văn A' }],
  contactId: 'ct-1',
  referrerContactId: 'ref-1',
  referrerContact: contact('ref-1', 'PGS.TS.BS. Nguyễn Hoàng Bắc'),
  doctors: [{ contact: contact('doc-1', 'Nguyễn Văn A') }],
  ...o,
});

describe('computeVipEscortStats', () => {
  const stats = computeVipEscortStats([
    item({ id: '1', visitKind: 'Khám mới' }),
    item({ id: '2', visitKind: 'Khám mới', services: ['Dẫn khám', 'Lấy máu tại phòng VIP'] }),
    item({
      id: '3',
      occurredAt: new Date('2024-12-31T18:00:00Z'), // VN time 01/01/2025
      visitKind: 'Tái khám',
      visitItems: [{ specialty: 'Tiêu hóa', doctor: 'Trần Văn B' }],
      referrerContactId: 'ref-2',
      referrerContact: contact('ref-2', 'GS.TS.BS. Trần Diệp Tuấn'),
      doctors: [{ contact: contact('doc-2', 'Trần Văn B') }],
    }),
    item({ id: '4', status: 'CANCELLED', visitKind: 'Khám mới' }),
    item({ id: '5', status: 'PLANNED', occurredAt: new Date('2026-06-01T00:00:00Z') }),
  ]);

  it('phân loại theo năm x hình thức chính xác theo giờ VN', () => {
    const y2025 = stats.byYear.find((y) => y.year === 2025)!;
    expect(y2025).toBeDefined();
    expect(y2025.done).toBe(3);
    expect(y2025.newVisit).toBe(2);
    expect(y2025.revisit).toBe(1);
    expect(y2025.postponedOrCancelled).toBe(1);
  });

  it('tính tổng quát và top thống kê', () => {
    expect(stats.totals.done).toBe(3);
    expect(stats.totals.patients).toBe(1);
    expect(stats.totals.referrers).toBe(2);
    expect(stats.topReferrers[0]).toMatchObject({
      name: 'PGS.TS.BS. Nguyễn Hoàng Bắc',
      count: 2,
    });
    expect(stats.topReferrers[1]).toMatchObject({
      name: 'GS.TS.BS. Trần Diệp Tuấn',
      count: 1,
    });
    expect(stats.topSpecialties).toContainEqual({ name: 'Tim mạch', count: 2 });
    expect(stats.topSpecialties).toContainEqual({ name: 'Tiêu hóa', count: 1 });
    expect(stats.topDoctors).toContainEqual(expect.objectContaining({ name: 'Nguyễn Văn A', count: 2 }));
    expect(stats.topDoctors).toContainEqual(expect.objectContaining({ name: 'Trần Văn B', count: 1 }));
    expect(stats.topServices[0]).toMatchObject({ name: 'Dẫn khám', count: 3 });
  });
});

