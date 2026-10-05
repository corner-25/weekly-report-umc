import { describe, expect, it } from 'vitest';
import { computeDelegationStats, type StatsDelegation } from './delegation-stats';

const org = (id: string, category: string | null = 'Bệnh viện - Cơ sở y tế') => ({ id, name: `Tổ chức ${id}`, category });
const row = (o: Partial<StatsDelegation>): StatsDelegation => ({
  status: 'DONE', occurredAt: new Date('2025-03-10T02:00:00Z'), dateUnknown: false, purpose: 'Làm việc', topics: [], hostUnit: null,
  guestCount: null, cashReceived: null, needsReview: false, organization: org('a'), ...o,
});

describe('computeDelegationStats', () => {
  const stats = computeDelegationStats([
    row({ guestCount: 5, cashReceived: 5_000_000, topics: ['CNTT - Chuyển đổi số'], hostUnit: 'Phòng Hành chính' }),
    row({ purpose: 'Tham quan - Học tập', organization: org('b', 'Doanh nghiệp'), topics: ['CNTT - Chuyển đổi số'] }),
    row({ purpose: 'Mục đích lạ', occurredAt: new Date('2024-12-31T18:00:00Z') }), // 01/01/2025 giờ VN
    row({ status: 'POSTPONED', needsReview: true }),
    row({ status: 'PLANNED', occurredAt: new Date('2026-10-14T00:00:00Z') }),
  ]);

  it('theo năm × hình thức chỉ đếm lượt đã thực hiện; năm theo giờ Việt Nam', () => {
    const y2025 = stats.byYear.find((y) => y.year === 2025)!;
    expect(y2025).toMatchObject({ done: 3, postponedOrCancelled: 1, guests: 5 });
    expect(y2025.byPurpose).toMatchObject({ 'Làm việc': 1, 'Tham quan - Học tập': 1, Khác: 1 });
    expect(stats.byYear.find((y) => y.year === 2026)).toMatchObject({ done: 0, other: 1 });
  });

  it('tổng, loại tổ chức, đơn vị tiếp nhiều nhất, chủ đề', () => {
    expect(stats.totals).toMatchObject({ done: 3, organizations: 2, cashReceived: 5_000_000, needsReview: 1 });
    expect(stats.categories[0]).toEqual({ name: 'Bệnh viện - Cơ sở y tế', count: 2 });
    expect(stats.topOrganizations[0]).toMatchObject({ id: 'a', count: 2 });
    expect(stats.topics).toEqual([{ name: 'CNTT - Chuyển đổi số', count: 2 }]);
    expect(stats.hosts).toEqual([{ name: 'Phòng Hành chính', count: 1 }]);
  });
});
