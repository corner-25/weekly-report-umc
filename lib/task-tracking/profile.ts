/**
 * Cách báo cáo của một phòng, tính từ các việc đã nối qua nhiều tuần. Đưa vào
 * prompt để AI hiểu con số % của phòng đó nghĩa là gì.
 */
export interface ThreadSample {
  progresses: Array<number | null>;
}

export type ReportStyle = 'NO_PERCENT' | 'ALWAYS_100' | 'PROGRESSIVE' | 'MIXED';

export interface ProfileStats {
  rows: number;
  /** Tỷ lệ dòng có ghi %. */
  withPercent: number;
  /** Trong các dòng có %, tỷ lệ ghi đúng 100. */
  hundred: number;
  /** Trong các việc ≥ 2 tuần có %, tỷ lệ việc có % thay đổi. */
  changing: number;
  /** Trong các việc ≥ 3 tuần có %, tỷ lệ việc đứng yên một mức dưới 100. */
  stuck: number;
  style: ReportStyle;
}

const share = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100) / 100);

export function computeProfile(threads: ThreadSample[]): ProfileStats {
  const all = threads.flatMap((t) => t.progresses);
  const withPct = all.filter((p): p is number => p !== null);
  const multi = threads.map((t) => t.progresses.filter((p): p is number => p !== null)).filter((p) => p.length >= 2);
  const changing = multi.filter((p) => new Set(p).size > 1).length;
  const long = multi.filter((p) => p.length >= 3);
  const stuck = long.filter((p) => new Set(p).size === 1 && p[0] < 100).length;

  const stats = {
    rows: all.length,
    withPercent: share(withPct.length, all.length),
    hundred: share(withPct.filter((p) => p === 100).length, withPct.length),
    changing: share(changing, multi.length),
    stuck: share(stuck, long.length),
  };
  const style: ReportStyle =
    stats.withPercent < 0.2 ? 'NO_PERCENT' : stats.hundred >= 0.8 ? 'ALWAYS_100' : stats.changing >= 0.25 ? 'PROGRESSIVE' : 'MIXED';
  return { ...stats, style };
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Mô tả bằng lời cho AI. */
export function describeProfile(departmentName: string, s: ProfileStats): string {
  const lines = [`${departmentName}: ${s.rows} dòng báo cáo trong năm, ${pct(s.withPercent)} dòng có ghi tiến độ %.`];
  if (s.style === 'NO_PERCENT') lines.push('Phòng gần như KHÔNG ghi % — phải đọc câu chữ (đã hoàn thành / đang / chuẩn bị / dự kiến) để biết tình trạng.');
  if (s.style === 'ALWAYS_100') lines.push(`${pct(s.hundred)} dòng có % ghi 100 — với phòng này 100% thường nghĩa là "xong phần việc tuần này", KHÔNG phải xong hẳn. Việc lặp lại hằng tuần là thường kỳ.`);
  if (s.style === 'PROGRESSIVE') lines.push(`${pct(s.changing)} việc nhiều tuần có % thay đổi qua các tuần — % của phòng này là tiến độ thật, 100% là xong.`);
  if (s.style === 'MIXED') lines.push(`Phòng ghi lẫn lộn: ${pct(s.hundred)} dòng có % là 100, ${pct(s.changing)} việc có % thay đổi — xét từng việc.`);
  if (s.stuck >= 0.2) lines.push(`${pct(s.stuck)} việc dài có % đứng yên một mức dưới 100 suốt nhiều tuần — phòng hay ghi % ước lượng/kế hoạch năm, không cập nhật đều.`);
  return lines.join(' ');
}
