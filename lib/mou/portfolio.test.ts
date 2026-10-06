import { describe, expect, it } from 'vitest';
import { computePortfolio, filterMous, lifecycleOf, partnerTypeOf, sortMous, stageOf, toView, type MouRow } from './portfolio';

const NOW = new Date('2026-10-06T03:00:00Z');
let seq = 0;
function row(o: Partial<MouRow> = {}): MouRow {
  seq += 1;
  return {
    id: `m${seq}`,
    title: `MOU ${seq}`,
    partnerName: `Bệnh viện ${seq}`,
    partnerCountry: 'Việt Nam',
    category: 'CLINICAL',
    status: 'ACTIVE',
    externalStatus: 'Đang xử lý',
    cooperationField: 'Hỗ trợ chuyên môn',
    departmentId: 'd1',
    departmentName: 'Phòng KHTH',
    contactPerson: 'An',
    signedDate: '2025-01-01T00:00:00.000Z',
    expiryDate: '2028-01-01T00:00:00.000Z',
    progress: 30,
    clauseCount: 0,
    documentCount: 1,
    activityCount: 0,
    lastActivityAt: null,
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...o,
  };
}
const view = (o: Partial<MouRow> = {}) => toView(row(o), NOW);

describe('lifecycleOf', () => {
  it('tính theo ngày hết hạn, không tin trạng thái lưu', () => {
    expect(lifecycleOf({ status: 'ACTIVE', expiryDate: '2026-12-01T00:00:00Z' }, NOW)).toBe('EXPIRING');
    expect(lifecycleOf({ status: 'ACTIVE', expiryDate: '2026-09-01T00:00:00Z' }, NOW)).toBe('EXPIRED');
    expect(lifecycleOf({ status: 'ACTIVE', expiryDate: null }, NOW)).toBe('ACTIVE');
    expect(lifecycleOf({ status: 'DRAFT', expiryDate: null }, NOW)).toBe('PENDING');
    expect(lifecycleOf({ status: 'TERMINATED', expiryDate: '2030-01-01T00:00:00Z' }, NOW)).toBe('ENDED');
  });
});

describe('stageOf / dormant', () => {
  it('0% và không hoạt động là chưa triển khai', () => {
    expect(stageOf({ progress: 0, activityCount: 0, lastActivityAt: null })).toBe('NONE');
    expect(stageOf({ progress: null, activityCount: 2, lastActivityAt: null })).toBe('STARTED');
    expect(stageOf({ progress: 100, activityCount: 0, lastActivityAt: null })).toBe('DONE');
  });

  it('ký quá 6 tháng mà chưa triển khai là để đó; mới ký thì chưa tính', () => {
    expect(view({ progress: 0, signedDate: '2025-01-01T00:00:00Z' }).dormant).toBe(true);
    expect(view({ progress: 0, signedDate: '2026-08-01T00:00:00Z' }).dormant).toBe(false);
    expect(view({ progress: 0, status: 'DRAFT' }).dormant).toBe(false);
  });
});

describe('missing', () => {
  it('liệt kê hồ sơ thiếu cho MOU còn hiệu lực', () => {
    expect(view({ expiryDate: null, documentCount: 0, departmentId: null, contactPerson: null }).missing).toHaveLength(4);
    expect(view({ status: 'DRAFT', expiryDate: null, documentCount: 0 }).missing).toEqual([]);
  });
});

describe('partnerTypeOf', () => {
  it('phân loại đối tác từ tên', () => {
    expect(partnerTypeOf('Công ty TNHH Bệnh viện Đa khoa Thiện Hạnh')).toBe('HOSPITAL');
    expect(partnerTypeOf('Trường Đại học Kinh Tế')).toBe('ACADEMIC');
    expect(partnerTypeOf('Công ty TNHH Pfizer Việt Nam')).toBe('COMPANY');
    expect(partnerTypeOf('Quỹ Chạm Yêu Thương')).toBe('NONPROFIT');
    expect(partnerTypeOf('Cục Quản lý khám bệnh, chữa bệnh và Công ty TNHH Servier')).toBe('GOVERNMENT');
    expect(partnerTypeOf('NovaGroup')).toBe('COMPANY');
  });
});

describe('filterMous / sortMous', () => {
  it('lọc theo góc nhìn, phòng, lĩnh vực, từ khoá không dấu', () => {
    const views = [
      view({ progress: 0 }),
      view({ expiryDate: '2026-11-01T00:00:00Z', partnerName: 'Bệnh viện Nhi đồng 1' }),
      view({ status: 'DRAFT', departmentId: 'd2', cooperationField: 'Đào tạo, NCKH, Hợp tác quốc tế; Hành chính' }),
    ];
    expect(filterMous(views, { view: 'dormant' })).toHaveLength(1);
    expect(filterMous(views, { view: 'decide' })).toHaveLength(1);
    expect(filterMous(views, { view: 'all', departmentId: 'd2' })).toHaveLength(1);
    expect(filterMous(views, { view: 'all', field: 'Hành chính' })).toHaveLength(1);
    expect(filterMous(views, { view: 'all', field: 'Đào tạo, NCKH, Hợp tác quốc tế' })).toHaveLength(1);
    expect(filterMous(views, { view: 'all', q: 'nhi dong' })).toHaveLength(1);
  });

  it('xếp việc cần quyết định lên đầu', () => {
    const a = view({ progress: 50 });
    const b = view({ expiryDate: '2026-11-01T00:00:00Z' });
    const c = view({ progress: 0 });
    expect(sortMous([a, c, b], 'attention').map((v) => v.id)).toEqual([b.id, c.id, a.id]);
  });
});

describe('computePortfolio', () => {
  it('đếm hiệu lực, tỷ lệ triển khai, phòng đầu mối, hết hạn theo năm', () => {
    const views = [
      view({ progress: 50 }),
      view({ progress: 0 }),
      view({ progress: 0, expiryDate: '2026-12-01T00:00:00Z' }),
      view({ status: 'DRAFT', signedDate: '2026-06-01T00:00:00Z', departmentId: null, departmentName: null }),
      view({ status: 'TERMINATED' }),
      view({ category: 'INTERNATIONAL', partnerCountry: 'Nhật Bản', expiryDate: null, signedDate: '2026-03-01T00:00:00Z' }),
    ];
    const p = computePortfolio(views, NOW);
    expect(p.kpi).toMatchObject({ total: 6, live: 4, started: 2, implementationRate: 50, dormant: 2, decide: 1, expiring: 1, pending: 1, pendingSlow: 1, ended: 1, international: 1, countries: 1, noTerm: 1 });
    expect(p.kpi.signedThisYear).toBe(1);
    expect(p.departments[0]).toMatchObject({ id: 'd1', live: 4, started: 2, dormant: 2, decide: 1 });
    expect(p.departments.find((d) => d.id === null)?.pending).toBe(1);
    expect(p.expiryByYear.find((e) => e.label === '2026')?.count).toBe(1);
    expect(p.expiryByYear.find((e) => e.label === 'Không thời hạn')?.count).toBe(1);
    expect(p.lists.decide).toHaveLength(1);
    expect(p.countries).toEqual([{ name: 'Nhật Bản', count: 1 }]);
  });
});

describe('hiệu quả', () => {
  it('ưu tiên đánh giá người chốt, đếm khía cạnh theo loại', () => {
    const views = [
      view({ aiVerdict: 'AT_RISK', evaluation: 'FAILED', aspects: [{ type: 'TRAINING', status: 'NOT_STARTED' }] }),
      view({ aiVerdict: 'SUCCESS', aspects: [{ type: 'TRAINING', status: 'COMPLETED' }, { type: 'RESEARCH', status: 'IN_PROGRESS' }] }),
      view({ status: 'DRAFT', aiVerdict: 'TOO_EARLY', aspects: [{ type: 'TRAINING', status: 'NOT_STARTED' }] }),
    ];
    const p = computePortfolio(views, NOW);
    expect(p.verdicts.find((v) => v.key === 'FAILED')).toEqual({ key: 'FAILED', total: 1, byPeople: 1 });
    expect(p.verdicts.find((v) => v.key === 'SUCCESS')?.total).toBe(1);
    expect(p.verdicts.find((v) => v.key === 'TOO_EARLY')?.total).toBe(0);
    expect(p.evaluatedCount).toBe(1);
    expect(p.aspectTypes[0]).toEqual({ type: 'TRAINING', total: 2, completed: 1, inProgress: 0, mous: 2 });
    expect(p.aspectTotals).toEqual({ total: 3, completed: 1, inProgress: 1, mousWithAspects: 2 });
    expect(filterMous(views, { view: 'all', verdict: 'FAILED' })).toHaveLength(1);
  });
});
