import { describe, expect, it } from 'vitest';
import { distinctiveTokens, nameScore, rankCandidates } from './crm-match';

const org = (id: string, name: string, aliases: string[] = []) => ({ id, name, aliases, category: null, scope: null });

describe('nameScore', () => {
  it('bỏ chữ chung chung, giữ từ phân biệt', () => {
    expect(distinctiveTokens('Công ty TNHH Bệnh viện Đa khoa Thiện Hạnh')).toEqual(['thien', 'hanh']);
    expect(nameScore('Công ty TNHH Bệnh viện Đa khoa Thiện Hạnh', 'BV Thiện Hạnh')).toBe(1);
  });

  it('lệch số hiệu là khác đơn vị', () => {
    expect(nameScore('Bệnh viện Nhi đồng 1', 'Bệnh viện Nhi Đồng 2')).toBe(0);
    expect(nameScore('Bệnh viện Nhi đồng 1', 'BV Nhi đồng 1')).toBe(1);
  });
});

describe('rankCandidates', () => {
  it('xếp ứng viên khớp nhất lên đầu, bỏ ứng viên không liên quan', () => {
    const orgs = [org('a', 'Bệnh viện Nhi Đồng 2'), org('b', 'Bệnh viện Nhi Đồng 1'), org('c', 'Công ty Pfizer'), org('d', 'Sở Y tế Ninh Bình')];
    expect(rankCandidates('Bệnh viện Nhi đồng 1', orgs).map((o) => o.id)).toEqual(['b']);
    expect(rankCandidates('Công ty TNHH Pfizer Việt Nam', orgs).map((o) => o.id)).toEqual(['c']);
  });

  it('khớp cả theo tên khác của tổ chức', () => {
    const orgs = [org('x', 'Đại học Kinh tế - Luật', ['UEL'])];
    expect(rankCandidates('Trường Đại học Kinh tế - Luật, Đại học Quốc gia Thành phố Hồ Chí Minh (UEL)', orgs)[0]?.id).toBe('x');
  });
});
