import { describe, expect, it } from 'vitest';
import { bhytItem, changeText, healthCheckItem, trainingTable, transplantTable, type MetricRow } from './facts';

const m = (name: string, value: number, unit = 'lượt', period = 'WEEK'): MetricRow => ({ code: null, name, value, unit, period });

describe('facts', () => {
  it('so sánh với tuần trước; bỏ so sánh khi chênh bất thường (số tuần trước trích sai)', () => {
    expect(changeText(93, 100, 39)).toBe('giảm 7% so với tuần 39');
    expect(changeText(100, 100, 39)).toBe('không đổi so với tuần 39');
    expect(changeText(11_327_272_159, 131_187_430_818, 39)).toBeNull();
    expect(changeText(5, undefined, 39)).toBeNull();
  });

  it('BHYT: lượt và chi phí ngoại trú, nội trú', () => {
    const item = bhytItem(
      [m('Số lượt KCB BHYT ngoại trú', 16435), m('Chi phí KCB BHYT thanh toán ngoại trú', 11_327_272_159, 'VND')],
      [m('Số lượt KCB BHYT ngoại trú', 17673)],
      39,
    );
    expect(item).toMatchObject({ type: 'text', label: 'Khám, chữa bệnh BHYT' });
    expect(item?.type === 'text' && item.subItems[0]).toBe('Ngoại trú: 16.435 lượt (giảm 7% so với tuần 39), Chi phí KCB BHYT thanh toán là 11.327.272.159 đồng');
  });

  it('ghép tạng: số ca trong tuần là chênh luỹ kế', () => {
    const t = transplantTable([m('Ca ghép gan', 137, 'ca', 'CUMULATIVE'), m('Ca ghép tim', 15, 'ca', 'CUMULATIVE')], [m('Ca ghép gan', 136, 'ca', 'CUMULATIVE')], 40, '02/10');
    expect(t?.type === 'table' && t.rows).toEqual([['Ghép gan', '1', '137'], ['Ghép tim', '—', '15']]);
  });

  it('khám sức khỏe toàn dân và bảng đào tạo (thiếu chỉ số thì bỏ dòng)', () => {
    expect(healthCheckItem([m('Lũy kế số lượt người khám sức khỏe toàn dân', 6729), m('Tỷ lệ đạt chỉ tiêu kế hoạch khám sức khỏe toàn dân', 12.5, '%')])).toMatchObject({ text: '6.729 lượt người khám, đạt 12,5% kế hoạch.' });
    const table = trainingTable([m('Sinh viên, học viên đang thực tập tại bệnh viện', 897, 'người'), m('Gửi đi đào tạo (đang học)', 846, 'người'), m('Đề tài NCKH đang thực hiện cấp cơ sở', 199, 'đề tài')], 40);
    expect(table?.type === 'table' && table.rows.length).toBe(3);
    expect(table?.type === 'table' && table.boldRows).toEqual([0, 1]);
  });
});
