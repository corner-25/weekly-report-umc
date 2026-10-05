/**
 * Luật cứng áp sau khi AI trả lời — những điều chắc chắn thì không để AI nói khác.
 */
import type { Judgement, JudgeEntry } from './judge';
import type { ReportStyle } from './profile';

/** % đứng yên từng ấy lần báo cáo liên tiếp thì coi là đứng yên. */
export const STALL_ENTRIES = 6;
/** Dưới ngưỡng này cần người xác nhận. */
export const REVIEW_CONFIDENCE = 0.6;
/**
 * Chỉ nhờ người xác nhận việc còn "nóng" (báo cáo trong ngần này tuần gần đây).
 * Việc ngừng từ lâu là lịch sử — hiện ở mục Ngừng báo cáo, không dồn vào hàng chờ.
 */
export const REVIEW_RECENT_WEEKS = 8;

export interface FinalJudgement {
  title: string;
  kind: Judgement['loai'];
  status: Judgement['tinh_trang'];
  progress: number | null;
  completedWeek: number | null;
  evidence: string | null;
  reasoning: string | null;
  confidence: number;
  needsReview: boolean;
}

export function applyRules(j: Judgement, entries: JudgeEntry[], style: ReportStyle, latestWeek: number): FinalJudgement {
  const last = entries[entries.length - 1];
  const stillReported = last.week >= latestWeek;
  let kind = j.loai;
  let status = j.tinh_trang;
  let progress = j.tien_do == null ? null : Math.round(Math.min(100, Math.max(0, j.tien_do)));
  let completedWeek = j.tuan_hoan_thanh ?? null;
  const notes: string[] = [];

  // Phòng ghi % thật mà tuần mới nhất của việc là 100 → xong.
  if (kind === 'PROJECT' && style !== 'ALWAYS_100' && last.progress === 100 && status !== 'DONE') {
    status = 'DONE';
    notes.push('Phòng ghi 100% ở lần báo cáo cuối.');
  }

  // Còn báo cáo mà % đứng yên quá lâu → đứng yên.
  const tail = entries.slice(-STALL_ENTRIES).map((e) => e.progress);
  const frozen = tail.length === STALL_ENTRIES && tail.every((p) => p !== null && p === tail[0] && p < 100);
  if (kind === 'PROJECT' && stillReported && frozen && status === 'IN_PROGRESS') {
    status = 'STALLED';
    notes.push(`% đứng ở ${tail[0]} suốt ${STALL_ENTRIES} lần báo cáo.`);
  }

  // Còn báo cáo tuần mới nhất thì chưa thể "ngừng báo cáo".
  if (status === 'STOPPED' && stillReported) status = 'IN_PROGRESS';

  if (kind === 'ROUTINE') progress = null;
  if (status === 'DONE') {
    if (kind === 'PROJECT') progress = 100;
    completedWeek = completedWeek ?? last.week;
  } else {
    completedWeek = null;
  }
  if (kind === 'PROJECT' && progress === null) {
    // Không có % thì vẫn vẽ được thanh tiến độ từ % phòng ghi gần nhất.
    progress = last.progress ?? null;
  }

  const confidence = Math.round(j.do_tin_cay * 100) / 100;
  return {
    title: j.ten_ngan.trim(),
    kind,
    status,
    progress,
    completedWeek,
    evidence: j.can_cu?.trim() || null,
    reasoning: [j.ly_do?.trim(), ...notes].filter(Boolean).join(' ') || null,
    confidence,
    // Việc cụ thể vừa ngừng báo cáo mà chưa xong cần người xem — có thể đã xong nhưng phòng không ghi.
    // Việc thường kỳ ngừng thì thường chỉ là đổi tên/gộp mục, không cần hỏi.
    needsReview:
      latestWeek - last.week <= REVIEW_RECENT_WEEKS &&
      (confidence < REVIEW_CONFIDENCE || (status === 'STOPPED' && kind !== 'ROUTINE')),
  };
}
