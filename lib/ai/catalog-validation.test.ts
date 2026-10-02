/**
 * Test kiểm tra số liệu theo danh mục chỉ số chuẩn.
 *
 * Mọi ca dựng theo lỗi có thật trong dữ liệu tuần 36/2026 (đã đối chiếu file gốc).
 */
import { describe, expect, it } from 'vitest';
import { unitClass, validateAgainstCatalog, type CatalogNodeInfo } from './catalog-validation';

const nodes = new Map<string, CatalogNodeInfo>([
  ['tong_dai.tong', { unit: 'cuộc gọi', parentCode: null, aggregation: 'SUM' }],
  ['tong_dai.tong.nhanh_1', { unit: 'cuộc gọi', parentCode: 'tong_dai.tong', aggregation: 'SUM' }],
  ['kho.nhap.vtyt', { unit: 'VND', parentCode: 'kho.nhap', aggregation: 'SUM' }],
  ['kho.nhap.hcxn', { unit: 'VND', parentCode: 'kho.nhap', aggregation: 'SUM' }],
  ['bhyt.noi_tru.so_luot', { unit: 'lượt', parentCode: null, aggregation: 'SUM' }],
  ['dd.ty_le_nhan_dang', { unit: '%', parentCode: null, aggregation: 'AVG' }],
  ['dd.so_ton', { unit: 'phiếu', parentCode: null, aggregation: 'LAST' }],
]);

const metric = (nodeCode: string | null, value: number, unit: string | null) => ({ nodeCode, value, unit });
const flagsAt = (result: Map<number, { flag: string }[]>, i: number) => (result.get(i) ?? []).map((x) => x.flag);

describe('unitClass', () => {
  it('gom các cách viết tiền về một loại', () => {
    expect(['VND', 'đồng', 'triệu đồng', 'tỷ'].map(unitClass)).toEqual(['money', 'money', 'money', 'money']);
  });
  it('không coi "hợp đồng" là tiền dù có chữ "đồng"', () => {
    expect(unitClass('hợp đồng')).toBe('count');
  });
  it('phân biệt tỷ lệ với số đếm', () => {
    expect(unitClass('%')).toBe('percent');
    expect(unitClass('lượt')).toBe('count');
    expect(unitClass(null)).toBe('unknown');
  });
});

describe('validateAgainstCatalog — UNIT_MISMATCH', () => {
  it('bắt tỷ lệ % rơi vào chỉ số đếm', () => {
    const r = validateAgainstCatalog([metric('bhyt.noi_tru.so_luot', 6, '%')], nodes);
    expect(flagsAt(r, 0)).toContain('UNIT_MISMATCH');
  });
  it('không bắt khi chỉ khác cách viết đơn vị cùng loại (lượt / người)', () => {
    const r = validateAgainstCatalog([metric('bhyt.noi_tru.so_luot', 1640, 'người')], nodes);
    expect(flagsAt(r, 0)).not.toContain('UNIT_MISMATCH');
  });
  it('bỏ qua khi số liệu không có đơn vị', () => {
    const r = validateAgainstCatalog([metric('dd.ty_le_nhan_dang', 99.94, null)], nodes);
    expect(flagsAt(r, 0)).toEqual([]);
  });
});

describe('validateAgainstCatalog — CHILD_EXCEEDS_PARENT', () => {
  it('bắt nhánh lớn hơn tổng', () => {
    const r = validateAgainstCatalog(
      [metric('tong_dai.tong', 1504, 'cuộc gọi'), metric('tong_dai.tong.nhanh_1', 2100, 'cuộc gọi')],
      nodes,
    );
    expect(flagsAt(r, 1)).toContain('CHILD_EXCEEDS_PARENT');
    expect(flagsAt(r, 0)).not.toContain('CHILD_EXCEEDS_PARENT');
  });
  it('không bắt khi con nhỏ hơn cha', () => {
    const r = validateAgainstCatalog(
      [metric('tong_dai.tong', 1504, 'cuộc gọi'), metric('tong_dai.tong.nhanh_1', 300, 'cuộc gọi')],
      nodes,
    );
    expect(flagsAt(r, 1)).toEqual([]);
  });
});

describe('validateAgainstCatalog — COPIED_VALUE', () => {
  it('bắt hai kho khác nhau có cùng giá trị nhập kho (tuần 36, Phòng VTTB)', () => {
    const r = validateAgainstCatalog(
      [metric('kho.nhap.vtyt', 2_867_170_092, 'VND'), metric('kho.nhap.hcxn', 2_867_170_092, 'VND')],
      nodes,
    );
    expect(flagsAt(r, 0)).toContain('COPIED_VALUE');
    expect(flagsAt(r, 1)).toContain('COPIED_VALUE');
  });
  it('không bắt số nhỏ trùng nhau — 5 lượt ở hai nơi là chuyện thường', () => {
    const r = validateAgainstCatalog(
      [metric('bhyt.noi_tru.so_luot', 5, 'lượt'), metric('dd.so_ton', 5, 'phiếu')],
      nodes,
    );
    expect(flagsAt(r, 0)).toEqual([]);
  });
  it('không bắt cùng một chỉ số ghi hai lần', () => {
    const r = validateAgainstCatalog(
      [metric('kho.nhap.vtyt', 2_867_170_092, 'VND'), metric('kho.nhap.vtyt', 2_867_170_092, 'VND')],
      nodes,
    );
    expect(flagsAt(r, 0)).not.toContain('COPIED_VALUE');
  });
});

describe('validateAgainstCatalog — EXCEL_MISMATCH', () => {
  it('bắt số báo cáo khác số file Excel cùng tuần', () => {
    const excel = new Map([['tong_dai.tong', 1504]]);
    const r = validateAgainstCatalog([metric('tong_dai.tong', 1405, 'cuộc gọi')], nodes, excel);
    expect(flagsAt(r, 0)).toContain('EXCEL_MISMATCH');
  });
  it('không bắt khi khớp Excel', () => {
    const excel = new Map([['tong_dai.tong', 1504]]);
    const r = validateAgainstCatalog([metric('tong_dai.tong', 1504, 'cuộc gọi')], nodes, excel);
    expect(flagsAt(r, 0)).toEqual([]);
  });
});

describe('validateAgainstCatalog — số liệu chưa gắn vào danh mục', () => {
  it('bỏ qua, không gắn cờ gì', () => {
    const r = validateAgainstCatalog([metric(null, 123, '%')], nodes);
    expect(flagsAt(r, 0)).toEqual([]);
  });
});
