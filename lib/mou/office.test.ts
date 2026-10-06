import { describe, expect, it } from 'vitest';
import { categoryOf, countryOf, documentTypeOf, htmlToText, partnerOf, personName, statusOf, toMouRecord, toProgressRecords } from './office';

const NOW = new Date('2026-10-06T03:00:00Z');

describe('partnerOf', () => {
  it('bỏ tiền tố "MOU với"', () => {
    expect(partnerOf('MOU với Bệnh viện Nhi đồng 1')).toBe('Bệnh viện Nhi đồng 1');
    expect(partnerOf('NovaGroup')).toBe('NovaGroup');
  });
});

describe('countryOf / categoryOf', () => {
  it('nhận đối tác nước ngoài từ tên', () => {
    expect(countryOf('Bệnh viện Asan (Hàn Quốc)')).toBe('Hàn Quốc');
    expect(countryOf('Đại học Monash (Úc)')).toBe('Úc');
    expect(countryOf('Bệnh viện Nhi đồng 2')).toBe('Việt Nam');
    expect(categoryOf('Bệnh viện Đại học Thành phố Nagoya', 'Hỗ trợ chuyên môn')).toBe('INTERNATIONAL');
  });

  it('đối tác trong nước xếp theo lĩnh vực', () => {
    expect(categoryOf('Trường Đại học Kinh Tế', 'Đào tạo, NCKH, Hợp tác quốc tế')).toBe('ACADEMIC');
    expect(categoryOf('Bệnh viện Nhi đồng 1', 'Hỗ trợ chuyên môn')).toBe('CLINICAL');
    expect(categoryOf('Bệnh viện Đa khoa Đồng Tháp', 'Toàn diện')).toBe('DOMESTIC');
    expect(categoryOf('Quỹ Chạm Yêu Thương', 'CTXH')).toBe('OTHER');
  });
});

describe('statusOf', () => {
  it('ánh xạ trạng thái office', () => {
    expect(statusOf('Mới', null, NOW)).toBe('DRAFT');
    expect(statusOf('Hoàn thành', null, NOW)).toBe('TERMINATED');
    expect(statusOf('Đang xử lý', new Date('2027-01-01'), NOW)).toBe('ACTIVE');
  });

  it('đang xử lý mà đã quá ngày hết hạn là hết hạn', () => {
    expect(statusOf('Đang xử lý', new Date('2026-01-01'), NOW)).toBe('EXPIRED');
  });
});

describe('htmlToText', () => {
  it('giữ xuống dòng, bỏ thẻ và định dạng', () => {
    const html = '<p><strong><span style="font-size: 11pt;">Nội dung:</span></strong></p><p>1. Truyền thông&nbsp;y tế</p>';
    expect(htmlToText(html)).toBe('Nội dung:\n1. Truyền thông y tế');
    expect(htmlToText('- Tài trợ;\r<br/>- Xây dựng kênh')).toBe('- Tài trợ;\n- Xây dựng kênh');
    expect(htmlToText('  ')).toBeNull();
  });
});

describe('personName / documentTypeOf', () => {
  it('bỏ mã nhân viên và đơn vị', () => {
    expect(personName('N11-131 Nguyễn Mai Thy (Trung tâm TT)')).toBe('Nguyễn Mai Thy');
    expect(personName(null)).toBeNull();
  });

  it('đoán loại văn bản từ tên file', () => {
    expect(documentTypeOf('To trinh MOU voi RedComms (Da duoc phe duyet).pdf')).toBe('Tờ trình');
    expect(documentTypeOf('TTr 740-MOU - BV 304.pdf')).toBe('Tờ trình');
    expect(documentTypeOf('Cong van gui Servier - Lan 1.pdf')).toBe('Công văn');
    expect(documentTypeOf('HD 2930-PK DAI DONG.pdf')).toBe('Hợp đồng');
    expect(documentTypeOf('20260928- P.HC - TONG HOP BAO CAO cập nhật tiến độ MOU.xlsx')).toBe('Báo cáo');
    expect(documentTypeOf('MOU - BV NINH BINH.pdf')).toBe('Biên bản ghi nhớ');
  });
});

describe('toMouRecord', () => {
  it('gộp dòng danh sách với chi tiết', () => {
    const rec = toMouRecord(
      {
        taskID: 35341,
        taskTitle: 'MOU với Công ty cổ phần tập đoàn MCV',
        assigneeDeptName: 'Trung tâm TT',
        startDate: '2024-08-01T00:00:00',
        deadline: '2027-08-01T00:00:00',
        percentDone: 50,
        fN264: 'Hỗ trợ chuyên môn\nHành chính',
        statusName: 'Đang xử lý',
      },
      { r: [{ description: 'Hợp tác<br/>truyền thông', assigneeName: 'N11-131 Nguyễn Mai Thy (Trung tâm TT)' }] },
      NOW,
    );
    expect(rec).toMatchObject({
      externalCode: '35341',
      partnerName: 'Công ty cổ phần tập đoàn MCV',
      category: 'CLINICAL',
      status: 'ACTIVE',
      cooperationField: 'Hỗ trợ chuyên môn; Hành chính',
      progressPercent: 50,
      purpose: 'Hợp tác\ntruyền thông',
      contactPerson: 'Nguyễn Mai Thy',
      leadUnit: 'Trung tâm TT',
    });
    expect(rec.signedDate?.toISOString()).toBe('2024-08-01T00:00:00.000Z');
  });
});

describe('toProgressRecords', () => {
  it('bỏ dòng rỗng, khoá theo mã dòng office', () => {
    const recs = toProgressRecords('7', {
      logTimes: [
        { logTimeID: 11, entryDate: '2026-07-11 08:42:59', notes: '\r\nChưa triển khai hợp tác', empName: 'J25-170 Huỳnh Ngọc Thùy Trinh (Phòng HC)' },
        { logTimeID: 12, entryDate: '2026-07-12 08:00:00', notes: '   ' },
      ],
    });
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({ externalKey: '7:11', content: 'Chưa triển khai hợp tác', updatedBy: 'Huỳnh Ngọc Thùy Trinh' });
    expect(recs[0].date.toISOString()).toBe('2026-07-11T01:42:59.000Z');
  });
});
