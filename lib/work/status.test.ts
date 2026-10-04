import { describe, expect, it } from 'vitest';
import { mapExternalStatus, updateHash, workHealth } from './status';
import { workImportItemSchema } from './schemas';

describe('mapExternalStatus', () => {
  it.each([
    ['Đang thực hiện', 'IN_PROGRESS'],
    ['Chưa hoàn thành', 'IN_PROGRESS'],
    ['Trễ hạn', 'IN_PROGRESS'],
    ['Hoàn thành', 'DONE'],
    ['Hoàn thành đúng hạn', 'DONE'],
    ['Chưa thực hiện', 'NOT_STARTED'],
    ['Mới giao', 'NOT_STARTED'],
    ['Tạm dừng', 'PAUSED'],
    ['Đã hủy', 'CANCELLED'],
  ])('"%s" → %s', (raw, expected) => {
    expect(mapExternalStatus(raw)).toBe(expected);
  });

  it('không có chữ thì dựa vào % tiến độ', () => {
    expect(mapExternalStatus(undefined, 100)).toBe('DONE');
    expect(mapExternalStatus('', 0)).toBe('NOT_STARTED');
    expect(mapExternalStatus('???', 40)).toBe('IN_PROGRESS');
  });
});

describe('workHealth', () => {
  const now = new Date('2026-10-04T03:00:00Z'); // 10:00 giờ Việt Nam
  const base = { status: 'IN_PROGRESS' as const, createdAt: new Date('2026-09-01T00:00:00Z'), lastActivityAt: null, dueDate: null };

  it('quá hạn tính theo ngày Việt Nam', () => {
    const h = workHealth({ ...base, dueDate: new Date('2026-10-03T00:00:00Z') }, now);
    expect(h).toMatchObject({ isOverdue: true, daysToDue: -1, isDueSoon: false });
  });

  it('đến hạn hôm nay là sắp đến hạn, chưa quá hạn', () => {
    expect(workHealth({ ...base, dueDate: new Date('2026-10-04T00:00:00Z') }, now)).toMatchObject({ isOverdue: false, isDueSoon: true, daysToDue: 0 });
  });

  it('lâu chưa cập nhật: tính từ lần cập nhật, chưa có thì từ ngày chỉ đạo', () => {
    expect(workHealth({ ...base, lastActivityAt: new Date('2026-09-25T00:00:00Z') }, now).isStale).toBe(false);
    expect(workHealth({ ...base, lastActivityAt: new Date('2026-09-10T00:00:00Z') }, now)).toMatchObject({ isStale: true, daysSinceActivity: 24 });
    expect(workHealth({ ...base, directedAt: new Date('2026-08-01T00:00:00Z'), createdAt: now }, now).isStale).toBe(true);
  });

  it('việc đã xong thì không nhắc gì', () => {
    const h = workHealth({ ...base, status: 'DONE', dueDate: new Date('2026-09-01T00:00:00Z') }, now);
    expect(h).toMatchObject({ isClosed: true, isOverdue: false, isStale: false });
  });
});

describe('updateHash', () => {
  it('bỏ qua khác biệt khoảng trắng, phân biệt nội dung', () => {
    const at = new Date('2026-09-20T03:00:00Z');
    expect(updateHash({ occurredAt: at, author: 'A', content: 'Đã trình  dự thảo' })).toBe(updateHash({ occurredAt: at, author: 'A ', content: 'Đã trình dự thảo ' }));
    expect(updateHash({ occurredAt: at, author: 'A', content: 'x' })).not.toBe(updateHash({ occurredAt: at, author: 'A', content: 'y' }));
  });
});

describe('workImportItemSchema', () => {
  it('đọc ngày kiểu Việt và thời điểm không múi giờ theo giờ Việt Nam', () => {
    const item = workImportItemSchema.parse({
      externalId: 'CV-1', title: 'Rà soát quy trình', dueDate: '15/10/2026',
      updates: [{ at: '20/09/2026 08:30', content: 'Đã họp' }],
    });
    expect(item.dueDate).toBe('2026-10-15');
    expect(item.updates[0].at.toISOString()).toBe('2026-09-20T01:30:00.000Z');
  });

  it('báo lỗi ngày sai', () => {
    expect(workImportItemSchema.safeParse({ externalId: 'x', title: 'y', dueDate: '31/02/abc' }).success).toBe(false);
  });
});
