import { describe, expect, it } from 'vitest';
import { hostCandidates, organizationType, parseStartTime, toDelegation, toOrganization, unitKey } from './delegation-import';

describe('parseStartTime', () => {
  it.each([
    ['09g15-09g30', [9, 15]],
    ['10h30', [10, 30]],
    ['14:30 - 15:30', [14, 30]],
    ['15:00:00', [15, 0]],
    ['11h', [11, 0]],
    [null, null],
    ['sáng', null],
  ])('%s', (raw, expected) => expect(parseStartTime(raw as string | null)).toEqual(expected));
});

describe('unitKey / hostCandidates', () => {
  it('khớp tên viết khác nhau của cùng khoa/phòng', () => {
    expect(unitKey('Phòng Kế hoạch tổng hợp')).toBe(unitKey('Phòng Kế hoạch Tổng hợp'));
    expect(unitKey('Khoa Dinh dưỡng - Tiết chế')).toBe(unitKey('Dinh dưỡng, Tiết chế'));
    expect(unitKey('Khoa Ngoại Gan - Mật - Tụy')).toBe(unitKey('Khoa Ngoại Gan - Mật - Tuỵ'));
  });
  it('tách nhiều đơn vị và quy tên kèm chú thích', () => {
    expect(hostCandidates('Phòng Kế hoạch tổng hợp; Phòng Công nghệ thông tin')).toEqual(['Phòng Kế hoạch tổng hợp', 'Phòng Công nghệ thông tin']);
    expect(hostCandidates('TTTT (Trung tâm Truyền thông – cần xác nhận tên đầy đủ)')).toEqual(['Trung tâm Truyền thông']);
  });
});

describe('toOrganization', () => {
  it('lấy loại gộp theo loại chi tiết, bỏ tên trùng tên chuẩn khỏi tên khác', () => {
    const org = toOrganization({ 'Mã tổ chức': 'TC-0003', 'Tên tổ chức (chuẩn hoá)': 'Bệnh viện 30-4', 'Loại tổ chức': 'Bệnh viện - Cơ sở y tế', 'Phạm vi': 'Trong nước', 'Các tên đã ghi nhận trong file gốc': 'Bệnh viện 30-4 | Bệnh viện 30/4' });
    expect(org).toMatchObject({ externalCode: 'TC-0003', type: 'HOSPITAL', aliases: ['Bệnh viện 30/4'] });
    expect(organizationType('Doanh nghiệp', 'Tổ chức quốc tế')).toBe('INTERNATIONAL');
    expect(organizationType('Ngân hàng - Bảo hiểm', 'Trong nước')).toBe('COMPANY');
  });
});

describe('toDelegation', () => {
  const base = { 'Mã đoàn': 'TD-2025-014', 'Năm': '2025', 'Ngày bắt đầu': '2025-03-10', 'Ngày kết thúc': '2025-03-12', 'Giờ': '09g00-09g30', 'Tên đoàn (như ghi nhận)': 'Đoàn Sở Y tế', 'Mã tổ chức': 'TC-0100', 'Hình thức tiếp': 'Làm việc', 'Nguồn hình thức': 'Suy luận từ nội dung', 'Chủ đề (tự gắn)': 'Quản lý chất lượng; CNTT - Chuyển đổi số', 'Nội dung làm việc': 'Kiểm tra', 'Tiền mặt khách tặng (VNĐ)': '5000000', 'Trạng thái': 'Đã thực hiện', 'Cần kiểm tra': 'Có', 'Nội dung cần kiểm tra': 'Ngày lệch', 'Nguồn dữ liệu': '2025.xlsx | NĂM 2025 | dòng 9', 'Ngày ghi trong file gốc': '10/03/2025' };
  it('ngày giờ theo giờ Việt Nam, ngày kết thúc, chủ đề, tiền, cần xác minh', () => {
    const d = toDelegation(base)!;
    expect(d.occurredAt.toISOString()).toBe('2025-03-10T02:00:00.000Z');
    expect(d.endAt?.toISOString()).toBe('2025-03-11T17:00:00.000Z');
    expect(d).toMatchObject({ status: 'DONE', purposeInferred: true, topics: ['Quản lý chất lượng', 'CNTT - Chuyển đổi số'], cashReceived: 5_000_000, needsReview: true, dateUnknown: false });
    expect(d.sourceRef).toContain('ngày ghi gốc 10/03/2025');
  });
  it('không có ngày: đầu năm, đánh dấu chưa rõ ngày; hoãn → POSTPONED', () => {
    const d = toDelegation({ ...base, 'Ngày bắt đầu': null, 'Ngày kết thúc': null, 'Trạng thái': 'Hoãn' })!;
    expect(d).toMatchObject({ status: 'POSTPONED', dateUnknown: true, endAt: null });
    expect(d.occurredAt.toISOString()).toBe('2024-12-31T17:00:00.000Z');
  });
  it('cùng ngày bắt đầu và kết thúc thì không ghi ngày kết thúc', () => {
    expect(toDelegation({ ...base, 'Ngày kết thúc': '2025-03-10' })!.endAt).toBeNull();
  });
});
