import { describe, expect, it } from 'vitest';
import { looksLikeAddChecklistRequest, looksLikeCreateEventRequest, looksLikeCreateWeekDraftRequest } from './actions';

describe('looksLikeCreateEventRequest', () => {
  it('detects explicit write intent', () => {
    expect(looksLikeCreateEventRequest('Tạo sự kiện họp giao ban ngày mai')).toBe(true);
    expect(looksLikeCreateEventRequest('Đặt lịch cuộc họp vào thứ hai')).toBe(true);
  });

  it('detects checklist and report-draft actions', () => {
    expect(looksLikeAddChecklistRequest('Thêm checklist chuẩn bị máy chiếu')).toBe(true);
    expect(looksLikeCreateWeekDraftRequest('Tạo báo cáo tuần 36 năm 2026 dạng nháp')).toBe(true);
  });

  it('does not treat read questions as writes', () => {
    expect(looksLikeCreateEventRequest('Có sự kiện nào ngày mai?')).toBe(false);
    expect(looksLikeCreateEventRequest('Ai đã tạo sự kiện này?')).toBe(false);
  });
});
