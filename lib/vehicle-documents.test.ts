import { describe, expect, it } from 'vitest';
import { contentDisposition, sniffMimeType } from './vehicle-documents';

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);

describe('sniffMimeType', () => {
  it('nhận JPEG, PNG, WEBP, PDF theo chữ ký đầu file', () => {
    expect(sniffMimeType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffMimeType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffMimeType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe('image/webp');
    expect(sniffMimeType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))).toBe('application/pdf');
  });

  it('từ chối file khác dù đặt đuôi .jpg (vd file HTML đổi tên)', () => {
    expect(sniffMimeType(new TextEncoder().encode('<html><script>alert(1)</script></html>'))).toBeNull();
  });
});

describe('contentDisposition', () => {
  it('giữ tên tiếng Việt qua filename* và có bản ASCII dự phòng', () => {
    const header = contentDisposition('Hồ sơ xe 50M-002.00.pdf');
    expect(header).toContain('filename="Ho so xe 50M-002.00.pdf"');
    expect(header).toContain("filename*=UTF-8''H%E1%BB%93%20s%C6%A1");
  });

  it('không để dấu nháy làm vỡ header', () => {
    expect(contentDisposition('a"b.jpg')).toContain('filename="a_b.jpg"');
  });
});
