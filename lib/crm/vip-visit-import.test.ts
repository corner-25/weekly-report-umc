import { describe, expect, it } from 'vitest';
import {
  buildVisits, normalizeFollowUp, normalizeRecordNo, normalizeReferrer, normalizeSession, normalizeSpecialty,
  parseBirth, parseDate, splitServices, type RawVisitRow,
} from './vip-visit-import';

const row = (o: Partial<RawVisitRow>): RawVisitRow => ({
  row: 1, stt: '1', date: '2026-01-05', fullName: 'Ngô Thị Dỡn', birthDate: '1958-04-22', address: 'Q. Bình Tân', phone: '0909261895',
  referrer: 'GS Trần Diệp Tuấn', position: null, workplace: null, recordNo: 'B11-0013256', specialty: 'Tiêu hóa gan mật',
  doctor: 'Bùi Hữu Hoàng', diagnosis: 'Viêm dạ dày', services: null, newVisit: null, revisit: 'x', followUp: '2026-03-30',
  note: null, session: 'Sáng', extraNote: null, ...o,
});

describe('ngày', () => {
  it('đọc các cách ghi ngày lỗi', () => {
    expect(parseDate('22/012026')).toBe('2026-01-22');
    expect(parseDate(' 11/03/2026')).toBe('2026-03-11');
    expect(parseDate('11/04//2026')).toBe('2026-04-11');
    expect(parseDate('2207/2026')).toBe('2026-07-22');
    expect(parseDate('Nhập viện')).toBeNull();
  });

  it('ngày sinh thiếu năm vẫn giữ ngày, tháng', () => {
    expect(parseBirth('22/12/198')).toEqual({ day: 22, month: 12, year: null, incomplete: true });
    expect(parseBirth('1958-04-22')).toEqual({ day: 22, month: 4, year: 1958, incomplete: false });
  });
});

describe('chuẩn hoá', () => {
  it('mã hồ sơ, người giới thiệu, chuyên khoa', () => {
    expect(normalizeRecordNo('N220087844')).toBe('N22-0087844');
    expect(normalizeRecordNo('N14-')).toBeNull();
    expect(normalizeReferrer('Ths Nguyễn Thị Ngọc Diệu').name).toBe('ThS Nguyễn Thị Ngọc Diệu');
    expect(normalizeReferrer('TS BS Phạm Văn Tấn').name).toBe('TS Phạm Văn Tấn');
    expect(normalizeReferrer('PGS Nguyễn Hoàng BẮc').name).toBe('PGS Nguyễn Hoàng Bắc');
    expect(normalizeReferrer('38 Hưng Thái, Phường Tân Hưng, HCM')).toEqual({ name: null, suspicious: true });
    expect(normalizeReferrer('Nội cơ xương khớp', ['Nội cơ xương khớp'])).toEqual({ name: null, suspicious: true });
    expect(normalizeReferrer('Kiểm toán nhà nước').name).toBe('Kiểm toán nhà nước');
    expect(normalizeSpecialty('Tai mũi hòng')).toBe('Tai mũi họng');
    expect(normalizeSpecialty('Nôị tiết')).toBe('Nội tiết');
    expect(normalizeSpecialty('Pakinson & RLVĐ')).toBe('Parkinson & RLVĐ');
    expect(normalizeSpecialty('UBTGMGG')).toBe('Ung bướu gan mật - Ghép gan');
    expect(normalizeSpecialty('PhỤc hồi chức năng')).toBe('Phục hồi chức năng');
    expect(normalizeSpecialty('Tim mạch')).toBe('Tim mạch');
  });

  it('hẹn tái khám, dịch vụ, buổi', () => {
    expect(normalizeFollowUp('Toa ko thuốc')).toEqual({ date: null, text: 'Toa không thuốc' });
    expect(normalizeFollowUp('nhập viện')).toEqual({ date: null, text: 'Nhập viện' });
    expect(normalizeFollowUp('Nhập Cấp cứu')).toEqual({ date: null, text: 'Nhập cấp cứu' });
    expect(normalizeFollowUp('Toa ko huốc').text).toBe('Toa không thuốc');
    expect(normalizeFollowUp('06 tháng -1 năm').text).toBe('Tái khám sau 6 tháng - 1 năm');
    expect(normalizeFollowUp('sau 06 tháng').text).toBe('Tái khám sau 6 tháng');
    expect(normalizeFollowUp('2026-03-30')).toEqual({ date: '2026-03-30', text: null });
    expect(splitServices('Xét nghiệm máu/ Siêu âm tim/ ECG')).toEqual(['Xét nghiệm máu', 'Siêu âm tim', 'ECG']);
    expect(splitServices('- Xét nghiệm máu\n- CT ngực/bụng')).toEqual(['Xét nghiệm máu', 'CT ngực/bụng']);
    expect(normalizeSession('Sâng')).toBe('Sáng');
    expect(normalizeSession('Sáng/chiều')).toBe('Sáng - chiều');
  });
});

describe('buildVisits', () => {
  it('gộp người theo mã hồ sơ dù tên ghi thiếu dấu, gộp chuyên khoa cùng ngày', () => {
    const { patients, visits } = buildVisits([
      row({ row: 2, fullName: 'Dương Thị Mỹ Huệ', recordNo: 'N15-0182753', specialty: 'Thần kinh' }),
      row({ row: 3, stt: null, date: null, fullName: 'Dương Thi Mỹ Huệ', recordNo: 'N15-0182753', specialty: 'Xương khớp', referrer: null }),
      row({ row: 4, date: '2026-02-01', fullName: 'Dương Thị Mỹ Huệ', recordNo: 'N150182753', specialty: 'Thần kinh' }),
    ]);
    expect(patients).toHaveLength(1);
    expect(patients[0].fullName).toBe('Dương Thị Mỹ Huệ');
    expect(visits).toHaveLength(2);
    expect(visits[0].items.map((i) => i.specialty)).toEqual(['Thần kinh', 'Xương khớp']);
    expect(visits[0].referrer).toBe('GS Trần Diệp Tuấn');
  });

  it('gộp theo tên + ngày sinh khi mã hồ sơ gõ sai số', () => {
    const { patients } = buildVisits([
      row({ row: 2, fullName: 'Nguyễn Dy', birthDate: '1944-05-10', recordNo: 'N26-0094583' }),
      row({ row: 3, fullName: 'Nguyễn Dy', birthDate: '1944-05-10', recordNo: 'N26-004583' }),
    ]);
    expect(patients).toHaveLength(1);
    expect(patients[0].recordNo).toBe('N26-0094583');
    expect(patients[0].variants).toContain('N26-004583');
  });

  it('đánh dấu cần xem khi người giới thiệu lệch cột', () => {
    const { visits } = buildVisits([row({ referrer: '38 Hưng Thái, Phường Tân Hưng, HCM' })]);
    expect(visits[0].needsReview).toBe(true);
    expect(visits[0].referrer).toBeNull();
  });
});
