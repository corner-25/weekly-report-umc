import { describe, expect, it } from 'vitest';
import { normalizeCrmPerson } from './people-normalization';
import { crmPage } from './pagination';

describe('chuẩn hoá người trong sổ khám', () => {
  it('nhận lại tên khác học hàm, khoảng trắng và dấu', () => {
    expect(normalizeCrmPerson(' PGS.TS.  Nguyễn Minh Anh ')?.key).toBe(normalizeCrmPerson('Nguyen Minh Anh')?.key);
    expect(normalizeCrmPerson('GS Trương Quang Bình')?.key).toBe(normalizeCrmPerson('Trương Quang Binh')?.key);
  });
  it('không biến tổ chức, dịch vụ hay dấu chấm thành một người', () => {
    for (const v of ['Kiểm toán nhà nước', 'Niệu học chức năng', '.', '', null]) expect(normalizeCrmPerson(v)).toBeNull();
  });
  it('không đoán tên viết thiếu hay hai người có tên gần giống', () => {
    expect(normalizeCrmPerson('Nguyễn Mih Kha')?.key).not.toBe(normalizeCrmPerson('Nguyễn Minh Kha')?.key);
    expect(normalizeCrmPerson('Diệp Thế Bảo Trân')?.key).not.toBe(normalizeCrmPerson('Diệp Thế Bảo Trâm')?.key);
  });
});

describe('phân trang CRM', () => {
  it('chấp nhận số trang nguyên dương, mặc định trang đầu với giá trị không hợp lệ', () => {
    expect(crmPage(new URLSearchParams('page=3'))).toBe(3);
    for (const v of ['0', '-2', 'NaN', '2.5', 'Infinity', '1e30', '']) expect(crmPage(new URLSearchParams({ page: v }))).toBe(1);
  });
});
