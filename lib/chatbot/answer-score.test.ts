import { describe, expect, it } from 'vitest';
import { answerHas, numbersIn } from './answer-score';

describe('numbersIn', () => {
  it.each([
    ['**49.004.000** VND', 49004000],
    ['5.988,0 km', 5988],
    ['1.351 km', 1351],
    ['136 ca', 136],
    ['188,6 triệu đồng', 188600000],
    ['1,120.5 lít', 1120.5],
    ['khoảng 13,6 tỷ', 13600000000],
  ])('%s → %d', (text, value) => {
    expect(numbersIn(text)).toContain(value);
  });

  it('không nuốt dấu chấm cuối câu', () => {
    expect(numbersIn('Tổng cộng 290.')).toEqual([290]);
  });
});

describe('answerHas', () => {
  it('chấp nhận số làm tròn trong 0,5%', () => {
    expect(answerHas(13639578407, 'Xuất kho khoảng 13,64 tỷ đồng')).toBe(true);
  });
  it('không nhận nhầm số khác', () => {
    expect(answerHas(1245, 'Có 1.861 lượt giám sát')).toBe(false);
  });
  it('so chữ không phân biệt hoa thường', () => {
    expect(answerHas('50A-007.20', 'Xe 50a-007.20 chạy nhiều nhất')).toBe(true);
  });
});
