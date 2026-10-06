import { describe, expect, it } from 'vitest';
import { detectDepartments, detectSources } from './intent';

const DEPTS = ['Phòng Kế hoạch Tổng hợp', 'Phòng Khoa học và Đào tạo', 'Phòng Công tác Xã hội', 'Phòng Hành chính', 'Trung tâm Truyền thông'];

describe('detectDepartments', () => {
  it('nhận tên đầy đủ, không dấu, viết tắt', () => {
    expect(detectDepartments('Phòng Kế hoạch Tổng hợp tuần này làm gì?', DEPTS)).toEqual(['Phòng Kế hoạch Tổng hợp']);
    expect(detectDepartments('phong cong tac xa hoi phu trach mou nao', DEPTS)).toEqual(['Phòng Công tác Xã hội']);
    expect(detectDepartments('MOU của KHĐT và CTXH', DEPTS).sort()).toEqual(['Phòng Công tác Xã hội', 'Phòng Khoa học và Đào tạo']);
    expect(detectDepartments('Phòng HC có việc gì quá hạn?', DEPTS)).toEqual(['Phòng Hành chính']);
  });

  it('không nhận mã viết thường lẫn trong chữ', () => {
    expect(detectDepartments('ghép tim cho bệnh nhi', DEPTS)).toEqual([]);
    expect(detectDepartments('BGĐ chỉ đạo gì tuần này', DEPTS)).toEqual([]);
  });
});

describe('detectSources', () => {
  it('nhận nguồn nói rõ', () => {
    expect(detectSources('Theo báo cáo tuần, phòng CTXH làm gì?')).toEqual(['weekly_report', 'weekly_summary']);
    expect(detectSources('Sổ tiếp đoàn ghi Nhi Đồng 1 đến mấy lần?')).toEqual(['crm', 'crm_org']);
    expect(detectSources('MOU với Quỹ Chạm Yêu Thương ký những gì?')).toEqual(['mou', 'crm_org']);
  });

  it('câu tổng hợp hoặc nhiều nguồn thì không lọc', () => {
    expect(detectSources('Nhi đồng 1 có những hoạt động gì với bệnh viện mình?')).toBeNull();
    expect(detectSources('Phòng KHTH theo dõi MOU nào và chủ trì tiếp đoàn nào?')).toBeNull();
  });
});
