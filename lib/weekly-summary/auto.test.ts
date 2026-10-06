import { describe, expect, it } from 'vitest';
import { weekClosesAt } from './auto';

describe('weekClosesAt', () => {
  it('tuần 40/2026 (Thứ Bảy 26/09 → Thứ Sáu 02/10) xong từ 00:00 Thứ Hai 05/10 giờ Việt Nam', () => {
    // endDate lưu nửa đêm UTC hoặc nửa đêm giờ VN — cả hai đều ra cùng mốc.
    expect(weekClosesAt(new Date('2026-10-02T00:00:00Z')).toISOString()).toBe('2026-10-04T17:00:00.000Z');
    expect(weekClosesAt(new Date('2026-10-01T17:00:00Z')).toISOString()).toBe('2026-10-04T17:00:00.000Z');
  });
});
