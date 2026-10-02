/**
 * Test dấu vân tay nội dung phòng.
 *
 * Ca test dựng theo lỗi thật: sheet tuần 40 chép từ tuần 39, Phòng Hành chính
 * chưa sửa nên vẫn ghi "Doanh thu: 49,004,000 đồng" của tuần 39.
 */
import { describe, expect, it } from 'vitest';
import { departmentContentHash, isUneditedCopy } from './department-snapshot';

const task = (rawName: string, resultText: string, sourceRow = 10, progress: number | null = 1) => ({
  rawName,
  resultText,
  parentGroup: null,
  progress,
  sourceRow,
});

const week39 = [task('Quản lý các dịch vụ tiện ích', 'Doanh thu: 49,004,000 đồng.')];

describe('departmentContentHash', () => {
  it('cho cùng hash khi nội dung giống nhau dù số dòng gốc khác', () => {
    const shifted = [task('Quản lý các dịch vụ tiện ích', 'Doanh thu: 49,004,000 đồng.', 25)];
    expect(departmentContentHash(shifted)).toBe(departmentContentHash(week39));
  });

  it('bỏ qua khác biệt khoảng trắng và xuống dòng', () => {
    const reformatted = [task('Quản lý các  dịch vụ tiện ích ', 'Doanh thu:\n49,004,000 đồng.')];
    expect(departmentContentHash(reformatted)).toBe(departmentContentHash(week39));
  });

  it('đổi hash khi số liệu thay đổi', () => {
    const week40 = [task('Quản lý các dịch vụ tiện ích', 'Doanh thu: 51,200,000 đồng.')];
    expect(departmentContentHash(week40)).not.toBe(departmentContentHash(week39));
  });

  it('đổi hash khi tiến độ thay đổi', () => {
    const progressed = [task('Quản lý các dịch vụ tiện ích', 'Doanh thu: 49,004,000 đồng.', 10, 0.5)];
    expect(departmentContentHash(progressed)).not.toBe(departmentContentHash(week39));
  });
});

describe('isUneditedCopy', () => {
  const hash39 = departmentContentHash(week39);

  it('nhận ra sheet tuần mới còn y hệt tuần trước', () => {
    expect(isUneditedCopy(hash39, hash39, week39.length)).toBe(true);
  });

  it('không coi là bản chép khi phòng đã sửa nội dung', () => {
    const hash40 = departmentContentHash([task('Quản lý các dịch vụ tiện ích', 'Doanh thu: 51,200,000 đồng.')]);
    expect(isUneditedCopy(hash40, hash39, 1)).toBe(false);
  });

  it('không coi là bản chép khi không có tuần trước để so (tuần 1)', () => {
    expect(isUneditedCopy(hash39, undefined, 1)).toBe(false);
  });

  it('không coi là bản chép khi phòng không có dòng nào', () => {
    const empty = departmentContentHash([]);
    expect(isUneditedCopy(empty, empty, 0)).toBe(false);
  });
});
