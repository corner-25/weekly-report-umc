/**
 * Nối các dòng báo cáo tuần thành "việc" theo dõi qua nhiều tuần.
 *
 * Một dòng thuộc việc đang mở nếu cùng tên nhiệm vụ (cột B) và phần kết quả nói
 * về cùng một việc — so bằng tập từ (bỏ dấu, bỏ số vì số liệu đổi mỗi tuần).
 * Vd Bảo hiểm Y tế, nhiệm vụ "Giám định chi phí KCB": tuần 1–13 là "Thống nhất
 * biên bản quý 3" (một việc), tuần 16–20 là "Chuẩn bị hồ sơ tiếp đoàn quý 1"
 * (việc khác) — cùng tên nhiệm vụ nhưng chữ khác hẳn nên tách hai việc.
 *
 * Hàm thuần, không chạm DB.
 */
import { toSearchKey } from '@/lib/crm/constants';

export interface ReportRow {
  week: number;
  sourceRow: number;
  rawName: string;
  parentGroup: string | null;
  resultText: string;
  progress: number | null;
  timePeriod?: string | null;
  nextWeekPlan?: string | null;
}

export interface OpenThread {
  /** id trong DB, hoặc khoá tạm cho việc mới tạo trong lần chạy này. */
  key: string;
  rawName: string;
  lastWeek: number;
  lastText: string;
}

/** Việc vắng mặt quá ngần này tuần thì dòng mới không nối vào nữa. */
export const MAX_GAP_WEEKS = 4;
/** Luồng thường kỳ được nối dù vắng lâu hơn (vd chỉ báo cáo khi có phát sinh). */
export const ROUTINE_GAP_WEEKS = 13;

/** Khoá tên nhiệm vụ để nhận ra cùng một luồng. */
export const nameKeyOf = (rawName: string) => toSearchKey(rawName);
export const UNNAMED = '(không tên)';
/** Điểm giống tối thiểu để nối (0–1). */
export const LINK_THRESHOLD = 0.5;
const NAME_WEIGHT = 0.2;
/** Chỉ so phần đầu kết quả — phần sau hay là chi tiết đổi theo tuần. */
const TEXT_HEAD = 300;

const STOPWORDS = new Set(
  'va cac cua cho voi tai theo trong da dang se duoc the nay do la mot nhung de ve tu den tren khi'.split(' '),
);

/**
 * Tập từ có nghĩa: bỏ dấu, bỏ từ nối, bỏ số liệu đổi theo tuần ("Số khoa: 23").
 * Nhưng GIỮ số định danh kỳ/văn bản — "biên bản quý 3/2025" và "quý 4/2025" là
 * hai việc khác nhau: "quý 3" → "quy3", năm "2025" → "y2025", "công văn 199/..." → "so199".
 */
export function wordSet(text: string): Set<string> {
  return new Set(
    toSearchKey(text.slice(0, TEXT_HEAD))
      .replace(/\b(quy|thang|dot|lan|giai doan|khoa|tuan)\s*(\d{1,2})\b/g, (_, w: string, n: string) => ` ${w.replace(' ', '')}${n} `)
      .replace(/\b(20\d\d)\b/g, ' y$1 ')
      .replace(/\b(\d{2,5})\s*\//g, ' so$1 ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\b\d+\b/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOPWORDS.has(w)),
  );
}

export function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let common = 0;
  for (const w of a) if (b.has(w)) common += 1;
  return common / (a.size + b.size - common);
}

/** Số định danh kỳ/văn bản trong tập từ ("quy3", "so199"…). */
const IDENTIFIER = /^(quy|thang|dot|lan|giaidoan|khoa|so)\d+$/;  // "tuần N" đổi mỗi tuần ở việc thường kỳ nên không tính
const identifiers = (words: Set<string>) => new Set([...words].filter((w) => IDENTIFIER.test(w)));

export function linkScore(row: Pick<ReportRow, 'rawName' | 'resultText'>, thread: Pick<OpenThread, 'rawName' | 'lastText'>): number {
  const name = similarity(wordSet(row.rawName), wordSet(thread.rawName));
  const rowWords = wordSet(row.resultText || row.rawName);
  const threadWords = wordSet(thread.lastText || thread.rawName);
  // Cùng câu chữ nhưng khác kỳ/khác số văn bản (quý 3 ↔ quý 4) là việc khác.
  const a = identifiers(rowWords);
  const b = identifiers(threadWords);
  if (a.size > 0 && b.size > 0 && ![...a].some((w) => b.has(w))) return 0;
  const text = similarity(rowWords, threadWords);
  return NAME_WEIGHT * name + (1 - NAME_WEIGHT) * text;
}

export interface LinkResult {
  /** sourceRow → khoá việc (có sẵn hoặc mới). */
  assignments: Array<{ row: ReportRow; threadKey: string; isNew: boolean }>;
  /** Danh sách việc mở sau khi xử lý tuần này (đã cập nhật lastWeek/lastText). */
  open: OpenThread[];
}

/**
 * Nối các dòng của MỘT tuần vào danh sách việc đang mở. Ghép tham lam theo điểm
 * cao nhất trước; mỗi việc nhận tối đa một dòng mỗi tuần.
 */
export function linkWeek(
  rows: ReportRow[],
  open: OpenThread[],
  week: number,
  newKey: (row: ReportRow) => string,
  /** Tên nhiệm vụ (nameKey) đã được quyết là MỘT việc thường kỳ: nối theo tên, bỏ qua câu chữ. */
  routineNames: ReadonlySet<string> = new Set(),
): LinkResult {
  const assignments: LinkResult['assignments'] = [];
  const usedRows = new Set<number>();
  const usedThreads = new Set<string>();

  // Luồng thường kỳ: mọi dòng cùng tên trong tuần đều về việc gần nhất của luồng.
  const routineTarget = new Map<string, string>();
  for (const row of rows) {
    const key = nameKeyOf(row.rawName);
    if (row.rawName === UNNAMED || !routineNames.has(key)) continue;
    let target = routineTarget.get(key);
    if (!target) {
      const thread = open
        .filter((t) => nameKeyOf(t.rawName) === key && t.lastWeek < week && week - t.lastWeek <= ROUTINE_GAP_WEEKS)
        .sort((a, b) => b.lastWeek - a.lastWeek)[0];
      target = thread?.key ?? newKey(row);
      routineTarget.set(key, target);
      assignments.push({ row, threadKey: target, isNew: !thread });
    } else {
      assignments.push({ row, threadKey: target, isNew: false });
    }
    usedRows.add(row.sourceRow);
    usedThreads.add(target);
  }

  const live = open.filter((t) => t.lastWeek < week && week - t.lastWeek <= MAX_GAP_WEEKS && !usedThreads.has(t.key));
  const pairs: Array<{ row: ReportRow; thread: OpenThread; score: number }> = [];
  for (const row of rows) {
    if (usedRows.has(row.sourceRow)) continue;
    for (const thread of live) {
      const score = linkScore(row, thread);
      if (score >= LINK_THRESHOLD) pairs.push({ row, thread, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score || a.row.sourceRow - b.row.sourceRow);

  for (const { row, thread } of pairs) {
    if (usedRows.has(row.sourceRow) || usedThreads.has(thread.key)) continue;
    usedRows.add(row.sourceRow);
    usedThreads.add(thread.key);
    assignments.push({ row, threadKey: thread.key, isNew: false });
  }

  const created: OpenThread[] = [];
  for (const a of assignments) {
    if (a.isNew) created.push({ key: a.threadKey, rawName: a.row.rawName, lastWeek: week, lastText: a.row.resultText });
  }
  for (const row of rows) {
    if (usedRows.has(row.sourceRow)) continue;
    const key = newKey(row);
    assignments.push({ row, threadKey: key, isNew: true });
    created.push({ key, rawName: row.rawName, lastWeek: week, lastText: row.resultText });
  }

  const byKey = new Map(assignments.map((a) => [a.threadKey, a.row]));
  const updated = open.map((t) => {
    const row = byKey.get(t.key);
    return row ? { ...t, lastWeek: week, lastText: row.resultText } : t;
  });
  return { assignments, open: [...updated, ...created] };
}
