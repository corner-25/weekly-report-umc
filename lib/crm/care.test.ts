import { describe, expect, it } from 'vitest';
import { budgetPeriods, careOccasionKey, careTransitionError, remindDaysFor } from './care';

describe('careOccasionKey', () => {
  it('sinh nhật dùng cùng khoá với dịp sắp tới của tổng quan', () => {
    expect(careOccasionKey({ contactId: 'c1', occasionKind: 'BIRTHDAY', occasionDate: '2026-10-05' })).toBe('birthday:c1@2026-10-05');
  });

  it('ngày quan trọng theo id ngày, không theo hồ sơ', () => {
    expect(
      careOccasionKey({ organizationId: 'o1', occasionKind: 'FOUNDING', importantDateId: 'd1', occasionDate: '2026-10-05T00:00:00.000Z' }),
    ).toBe('date:d1@2026-10-05');
  });

  it('dịp gõ tay phân biệt theo loại và theo đối tác', () => {
    const a = careOccasionKey({ contactId: 'c1', occasionKind: 'OTHER', occasionDate: '2026-10-05' });
    const b = careOccasionKey({ organizationId: 'c1', occasionKind: 'OTHER', occasionDate: '2026-10-05' });
    expect(a).toBe('other:contact:c1@2026-10-05');
    expect(a).not.toBe(b);
  });

  it('cùng dịp khác năm là hai việc', () => {
    const base = { contactId: 'c1', occasionKind: 'BIRTHDAY' as const };
    expect(careOccasionKey({ ...base, occasionDate: '2026-10-05' })).not.toBe(careOccasionKey({ ...base, occasionDate: '2027-10-05' }));
  });
});

describe('remindDaysFor', () => {
  it('theo hạng khi ngày không tự đặt', () => {
    expect(remindDaysFor('VIP')).toBe(7);
    expect(remindDaysFor('C', null)).toBe(0);
  });

  it('ngày tự đặt thắng hạng, kể cả đặt 0', () => {
    expect(remindDaysFor('VIP', 0)).toBe(0);
    expect(remindDaysFor('C', 10)).toBe(10);
  });
});

describe('careTransitionError', () => {
  it('cho chuyển giữa chưa chuẩn bị, đã đặt, đã trao, huỷ và mở lại', () => {
    expect(careTransitionError('TODO', 'ORDERED')).toBeNull();
    expect(careTransitionError('ORDERED', 'DELIVERED')).toBeNull();
    expect(careTransitionError('TODO', 'CANCELLED')).toBeNull();
    expect(careTransitionError('CANCELLED', 'TODO')).toBeNull();
  });

  it('chặn huỷ hoặc lùi lại sau khi đã trao, và chặn chuyển sang chính nó', () => {
    expect(careTransitionError('DELIVERED', 'CANCELLED')).toMatch(/không huỷ/);
    expect(careTransitionError('DELIVERED', 'TODO')).not.toBeNull();
    expect(careTransitionError('ORDERED', 'ORDERED')).not.toBeNull();
  });
});

describe('budgetPeriods', () => {
  it('tháng 12 sang tháng 1 năm sau', () => {
    const p = budgetPeriods('2026-12-31');
    expect(p.month.from.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(p.month.to.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(p.year.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(p.year.to.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});
