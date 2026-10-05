/**
 * Rà soát danh sách tuần báo cáo của một năm: tuần thiếu, tuần lệch ngày,
 * trùng ngày, rỗng, thiếu đơn vị thường lệ… Thuần, không gọi DB — trang danh
 * sách và test đều dùng chung.
 */
import { formatRange, hospitalWeekOf, hospitalWeekRange, storedDateKey, weeksInYear } from './hospital-week';

export type WeekStatus = 'DRAFT' | 'COMPLETED';
export type IssueSeverity = 'danger' | 'warning' | 'info';
export type IssueCode =
  | 'DUPLICATE_RANGE'
  | 'DATE_MISMATCH'
  | 'EMPTY'
  | 'MISSING_DEPTS'
  | 'EMPTY_RESULTS'
  | 'NO_METRICS';

export interface WeekIssue {
  code: IssueCode;
  severity: IssueSeverity;
  /** Nhãn ngắn trên chip. */
  label: string;
  /** Giải thích đầy đủ, hiện ở title và bảng rà soát. */
  detail: string;
}

export interface AuditWeekInput {
  id: string;
  weekNumber: number;
  year: number;
  startDate: string;
  endDate: string;
  status: WeekStatus;
  taskCount: number;
  departmentCount: number;
  departmentNames?: string[];
  emptyResultCount?: number;
  metricValueCount?: number;
  extractedMetricCount?: number;
}

export interface MissingWeek {
  weekNumber: number;
  startKey: string;
  endKey: string;
}

export interface CurrentWeekInfo {
  weekNumber: number;
  startKey: string;
  endKey: string;
  /** id báo cáo của tuần hiện tại nếu đã tạo. */
  weekId: string | null;
  status: WeekStatus | null;
}

export interface YearAudit {
  issuesByWeek: Record<string, WeekIssue[]>;
  missingWeeks: MissingWeek[];
  /** Số tuần đã kết thúc tính tới hôm nay (mẫu số của "đã báo cáo"). */
  closedWeekCount: number;
  /** Số tuần đã kết thúc có báo cáo. */
  reportedClosedCount: number;
  currentWeek: CurrentWeekInfo | null;
  /** Đơn vị có mặt ở phần lớn các tuần trong năm — dùng để phát hiện tuần thiếu đơn vị. */
  coreDepartments: string[];
}

/** Hai tuần đầu năm lệch nhịp theo lịch bệnh viện (xem lib/report-week.ts) — không bắt lỗi ngày. */
const IRREGULAR_WEEKS = new Set([1, 2]);
/** Đơn vị xuất hiện ở ≥ 75% số tuần thì coi là "thường lệ". */
const CORE_DEPT_RATIO = 0.75;
/** Cần ít nhất ngần này tuần mới đủ dữ liệu để xác định đơn vị thường lệ. */
const CORE_DEPT_MIN_WEEKS = 4;

export const SEVERITY_RANK: Record<IssueSeverity, number> = { danger: 0, warning: 1, info: 2 };

function findCoreDepartments(weeks: readonly AuditWeekInput[]): string[] {
  const withNames = weeks.filter((w) => w.departmentNames && w.departmentNames.length > 0);
  if (withNames.length < CORE_DEPT_MIN_WEEKS) return [];
  const counts = new Map<string, number>();
  for (const w of withNames) {
    for (const name of new Set(w.departmentNames)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const threshold = Math.ceil(withNames.length * CORE_DEPT_RATIO);
  return [...counts.entries()]
    .filter(([, n]) => n >= threshold)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b, 'vi'));
}

function issuesForWeek(
  week: AuditWeekInput,
  startKeyOwners: Map<string, number[]>,
  coreDepartments: readonly string[],
): WeekIssue[] {
  const issues: WeekIssue[] = [];
  const startKey = storedDateKey(week.startDate);
  const endKey = storedDateKey(week.endDate);

  const expected = hospitalWeekRange(week.weekNumber, week.year);
  const isIrregular = IRREGULAR_WEEKS.has(week.weekNumber);
  const matchesRule = isIrregular || (expected.startKey === startKey && expected.endKey === endKey);

  // Trùng ngày chỉ gắn vào tuần đang lưu sai: tuần đúng quy tắc không bị kéo theo.
  const sameStart = (startKeyOwners.get(startKey) ?? []).filter((n) => n !== week.weekNumber);
  if (sameStart.length > 0 && !matchesRule) {
    issues.push({
      code: 'DUPLICATE_RANGE',
      severity: 'danger',
      label: `Trùng ngày tuần ${sameStart.join(', ')}`,
      detail: `Đang lưu ${formatRange(startKey, endKey)} — trùng ngày với tuần ${sameStart.join(', ')}.`,
    });
  }

  if (!matchesRule) {
    issues.push({
      code: 'DATE_MISMATCH',
      severity: 'warning',
      label: 'Lệch ngày',
      detail: `Đang lưu ${formatRange(startKey, endKey)}; theo quy tắc Thứ Bảy → Thứ Sáu, tuần ${week.weekNumber} là ${formatRange(expected.startKey, expected.endKey)}.`,
    });
  }

  if (week.taskCount === 0) {
    issues.push({
      code: 'EMPTY',
      severity: 'danger',
      label: 'Báo cáo rỗng',
      detail: 'Tuần này chưa có nhiệm vụ nào.',
    });
  } else if (week.departmentNames && coreDepartments.length > 0) {
    const present = new Set(week.departmentNames);
    const missing = coreDepartments.filter((d) => !present.has(d));
    if (missing.length > 0) {
      issues.push({
        code: 'MISSING_DEPTS',
        severity: 'warning',
        label: `Thiếu ${missing.length} đơn vị`,
        detail: `Tuần này thiếu đơn vị thường nộp: ${missing.join('; ')}.`,
      });
    }
  }

  if ((week.emptyResultCount ?? 0) > 0) {
    issues.push({
      code: 'EMPTY_RESULTS',
      severity: 'info',
      label: `${week.emptyResultCount} việc trống kết quả`,
      detail: `${week.emptyResultCount} nhiệm vụ chưa ghi "Kết quả thực hiện".`,
    });
  }

  const hasMetricInfo = week.metricValueCount !== undefined || week.extractedMetricCount !== undefined;
  if (hasMetricInfo && week.taskCount > 0 && (week.metricValueCount ?? 0) + (week.extractedMetricCount ?? 0) === 0) {
    issues.push({
      code: 'NO_METRICS',
      severity: 'info',
      label: 'Chưa có số liệu',
      detail: 'Tuần này chưa có số liệu định lượng (nhập tay hoặc AI trích).',
    });
  }

  return issues.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/**
 * Rà soát các tuần của `year`. `weeks` có thể lẫn năm khác — sẽ được lọc.
 * `todayKey` là hôm nay theo giờ Việt Nam (YYYY-MM-DD).
 */
export function auditYear(weeks: readonly AuditWeekInput[], year: number, todayKey: string): YearAudit {
  const inYear = weeks.filter((w) => w.year === year);
  const coreDepartments = findCoreDepartments(inYear);

  const startKeyOwners = new Map<string, number[]>();
  for (const w of inYear) {
    const key = storedDateKey(w.startDate);
    startKeyOwners.set(key, [...(startKeyOwners.get(key) ?? []), w.weekNumber]);
  }

  const issuesByWeek: Record<string, WeekIssue[]> = {};
  for (const w of inYear) issuesByWeek[w.id] = issuesForWeek(w, startKeyOwners, coreDepartments);

  const today = hospitalWeekOf(todayKey);
  const total = weeksInYear(year);
  let closedWeekCount: number;
  if (year < today.year) closedWeekCount = total;
  else if (year > today.year) closedWeekCount = 0;
  else closedWeekCount = today.weekNumber - 1;

  const byNumber = new Map(inYear.map((w) => [w.weekNumber, w]));
  const missingWeeks: MissingWeek[] = [];
  for (let n = 1; n <= closedWeekCount; n += 1) {
    if (!byNumber.has(n)) {
      const r = hospitalWeekRange(n, year);
      missingWeeks.push({ weekNumber: n, startKey: r.startKey, endKey: r.endKey });
    }
  }

  let currentWeek: CurrentWeekInfo | null = null;
  if (year === today.year) {
    const existing = byNumber.get(today.weekNumber);
    currentWeek = {
      weekNumber: today.weekNumber,
      startKey: today.startKey,
      endKey: today.endKey,
      weekId: existing?.id ?? null,
      status: existing?.status ?? null,
    };
  }

  return {
    issuesByWeek,
    missingWeeks,
    closedWeekCount,
    reportedClosedCount: closedWeekCount - missingWeeks.length,
    currentWeek,
    coreDepartments,
  };
}

/** Mức nghiêm trọng cao nhất của một tuần, null nếu không có vấn đề. */
export function worstSeverity(issues: readonly WeekIssue[] | undefined): IssueSeverity | null {
  if (!issues || issues.length === 0) return null;
  return issues.reduce<IssueSeverity>(
    (worst, i) => (SEVERITY_RANK[i.severity] < SEVERITY_RANK[worst] ? i.severity : worst),
    'info',
  );
}

/** Tuần cần xử lý = có vấn đề mức danger hoặc warning (info chỉ để tham khảo). */
export function needsAttention(issues: readonly WeekIssue[] | undefined): boolean {
  const worst = worstSeverity(issues);
  return worst === 'danger' || worst === 'warning';
}
