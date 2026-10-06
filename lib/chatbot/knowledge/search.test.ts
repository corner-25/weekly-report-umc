import { describe, expect, it } from 'vitest';
import { keywordTokens, properPhrases } from './search';

describe('tìm kho tri thức — tách câu hỏi', () => {
  it('nhận cụm tên riêng viết hoa (tên người, đơn vị) và cụm trong ngoặc kép', () => {
    expect(properPhrases('Đồng chí Nguyễn Phước Lộc đến thăm bệnh viện ngày nào?')).toContain('nguyen phuoc loc');
    expect(properPhrases('Giải “Trung tâm Tiệt khuẩn xuất sắc” trao khi nào')).toContain('trung tam tiet khuan xuat sac');
  });
  it('bỏ từ hỏi, từ nối; giữ số hiệu văn bản', () => {
    const tokens = keywordTokens('Công văn 5462/BVĐHYD-HC ban hành khi nào?');
    expect(tokens).toContain('5462/bvdhyd-hc');
    expect(tokens).not.toContain('khi');
    expect(tokens).not.toContain('nao');
  });
});
