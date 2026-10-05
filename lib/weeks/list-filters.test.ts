import { describe, expect, it } from 'vitest';
import {
  matchesWeekQuery,
  parseWeekListFilters,
  serializeWeekListFilters,
  weekListHref,
  withBack,
} from './list-filters';

const params = (qs: string) => new URLSearchParams(qs);

describe('parseWeekListFilters', () => {
  it('dùng mặc định khi URL trống', () => {
    expect(parseWeekListFilters(params(''), 2026)).toEqual({ year: 2026, status: 'all', q: '' });
  });

  it('đọc đúng giá trị hợp lệ', () => {
    expect(parseWeekListFilters(params('year=2025&status=issues&q=8'), 2026)).toEqual({ year: 2025, status: 'issues', q: '8' });
  });

  it('bỏ giá trị rác', () => {
    expect(parseWeekListFilters(params('year=abc&status=hack'), 2026)).toEqual({ year: 2026, status: 'all', q: '' });
    expect(parseWeekListFilters(params('year=99999'), 2026).year).toBe(2026);
  });
});

describe('serializeWeekListFilters', () => {
  it('bỏ giá trị mặc định', () => {
    expect(serializeWeekListFilters({ year: 2026, status: 'all', q: '' }, 2026)).toBe('');
    expect(serializeWeekListFilters({ year: 2025, status: 'draft', q: ' 40 ' }, 2026)).toBe('year=2025&status=draft&q=40');
  });
});

describe('weekListHref', () => {
  it('giữ bộ lọc hợp lệ', () => {
    expect(weekListHref('year=2025&status=issues')).toBe('/dashboard/weeks?year=2025&status=issues');
    expect(weekListHref('?status=draft')).toBe('/dashboard/weeks?status=draft');
  });

  it('không cho chuyển hướng ra ngoài hay nhét khoá lạ', () => {
    expect(weekListHref('https://evil.example')).toBe('/dashboard/weeks');
    expect(weekListHref('year=2025&redirect=//evil')).toBe('/dashboard/weeks?year=2025');
    expect(weekListHref(null)).toBe('/dashboard/weeks');
  });
});

describe('withBack', () => {
  it('nối tham số back đã mã hoá', () => {
    expect(withBack('/dashboard/weeks/abc', 'year=2025&status=draft')).toBe('/dashboard/weeks/abc?back=year%3D2025%26status%3Ddraft');
    expect(withBack('/dashboard/weeks/abc', '')).toBe('/dashboard/weeks/abc');
  });
});

describe('matchesWeekQuery', () => {
  it.each([
    ['', 5, true],
    ['40', 40, true],
    ['40', 4, false],
    ['38-40', 39, true],
    ['40-38', 38, true],
    ['8, 20', 20, true],
    ['8, 20', 9, false],
    ['abc', 1, false],
  ])('"%s" với tuần %i → %s', (q, n, expected) => {
    expect(matchesWeekQuery(n, q)).toBe(expected);
  });
});
