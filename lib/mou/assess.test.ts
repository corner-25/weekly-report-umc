import { describe, expect, it } from 'vitest';
import { focusOn, partnerAliases } from './assess';

describe('partnerAliases', () => {
  it('rút gọn tên trường, bệnh viện, doanh nghiệp', () => {
    expect(partnerAliases('Trường Đại học Quốc tế - Đại học Quốc gia Thành phố Hồ Chí Minh')).toEqual(expect.arrayContaining(['Trường Đại học Quốc tế', 'ĐH Quốc tế']));
    expect(partnerAliases('Bệnh viện Đa khoa tỉnh Ninh Bình')).toEqual(expect.arrayContaining(['BV Ninh Bình', 'BVĐK Ninh Bình']));
    expect(partnerAliases('Công ty TNHH Thiết bị Y tế Olympus Việt Nam')).toContain('Olympus');
    expect(partnerAliases('Công ty TNHH Pfizer Việt Nam')).toContain('Pfizer');
    expect(partnerAliases('Chi nhánh Công ty CP Bệnh viện Đa khoa Tâm Anh TP. Hồ Chí Minh')).toEqual(expect.arrayContaining(['BV Tâm Anh']));
    expect(partnerAliases('Bệnh viện đa khoa Vinh Dân Đài Bắc, Đài Loan')).toContain('BV Vinh Dân Đài Bắc');
    expect(partnerAliases('Trường Đại học Kinh tế - Luật, Đại học Quốc gia Thành phố Hồ Chí Minh (UEL)')).toEqual(expect.arrayContaining(['UEL', 'ĐH Kinh tế - Luật']));
  });

  it('không lấy chữ chung chung trong ngoặc làm tên gọi', () => {
    expect(partnerAliases('Bệnh viện Nhân dân 115 (ghép tạng)')).not.toContain('ghép tạng');
    expect(partnerAliases('Bệnh viện Asan (Hàn Quốc)')).not.toContain('Hàn Quốc');
    expect(partnerAliases('Công ty TNHH doanh nghiệp xã hội Nhịp tim Việt Nam')).not.toContain('Nhịp tim');
  });
});

describe('focusOn', () => {
  it('cắt đoạn quanh chỗ nhắc tới đối tác', () => {
    const body = `${'x '.repeat(600)}Làm việc với BV Ninh Bình về nội soi ${'y '.repeat(600)}`;
    expect(focusOn(body, ['BV Ninh Bình'])).toContain('BV Ninh Bình');
    expect(focusOn('ngắn', ['a'])).toBe('ngắn');
  });
});
