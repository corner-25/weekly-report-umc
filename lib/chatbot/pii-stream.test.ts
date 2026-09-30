import { describe, expect, it } from 'vitest';
import { StreamingPiiScrubber, scrubPii } from './pii-filter';

function streamScrub(text: string, cuts: number[]): string {
  const s = new StreamingPiiScrubber();
  let out = '';
  let prev = 0;
  for (const c of [...cuts, text.length]) {
    out += s.push(text.slice(prev, c));
    prev = c;
  }
  return out + s.flush();
}

const SAMPLE =
  'Liên hệ anh A qua 0901234567 hoặc a.nguyen@umc.edu.vn, CCCD 079123456789,\n' +
  'ngày sinh: 12/05/1990. Số liệu tính đến ngày 25/09/2026, doanh thu 6.261.187.500 đ, mã 123456789.';

describe('StreamingPiiScrubber', () => {
  it('cho kết quả giống hệt lọc cả khối khi cắt ở MỌI vị trí', () => {
    const expected = scrubPii(SAMPLE);
    for (let i = 1; i < SAMPLE.length; i++) {
      expect(streamScrub(SAMPLE, [i])).toBe(expected);
    }
  });

  it('không lộ số điện thoại bị cắt đôi giữa hai mảnh', () => {
    const out = streamScrub('Gọi 0901234567 ngay', [6, 9]);
    expect(out).not.toMatch(/0901/);
    expect(out).toContain('[số ĐT đã ẩn]');
  });

  it('cắt thành từng ký tự vẫn đúng', () => {
    const cuts = Array.from({ length: SAMPLE.length - 1 }, (_, i) => i + 1);
    expect(streamScrub(SAMPLE, cuts)).toBe(scrubPii(SAMPLE));
  });

  it('đẩy chữ ra dần, chỉ giữ lại vài từ cuối', () => {
    const s = new StreamingPiiScrubber();
    expect(s.push('một hai ba bốn năm sáu bảy')).toBe('một hai ba ');
    expect(s.push(' tám')).toBe('bốn ');
    expect(s.flush()).toBe('năm sáu bảy tám');
  });

  it('che ngày sinh nhưng GIỮ ngày thường', () => {
    const out = scrubPii('Ngày sinh: 12/05/1990. Số liệu tính đến ngày 25/09/2026.');
    expect(out).toContain('Ngày sinh: [đã ẩn]');
    expect(out).toContain('25/09/2026');
    expect(out).not.toContain('1990');
  });

  it('che ngày sinh kể cả khi ngữ cảnh và ngày rơi vào hai mảnh stream', () => {
    const text = 'Anh B, ngày sinh 12/05/1990, phòng KHTH.';
    for (let i = 1; i < text.length; i++) {
      expect(streamScrub(text, [i])).not.toContain('1990');
    }
  });
});
