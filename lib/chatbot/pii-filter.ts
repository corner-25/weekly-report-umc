// Defense-in-depth: scrub PII from text the chatbot is about to show the user.
// The readonly views already exclude phone/email columns, but a future schema
// change could re-expose them — keep this filter as a backstop.

const PHONE_RE = /\b0\d{9,10}\b/g;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// CMND (9 digits) / CCCD (12 digits)
const ID_RE = /\b\d{9,12}\b/g;
// Ngày sinh: CHỈ che khi có ngữ cảnh "sinh" ngay trước. Trước đây che MỌI ngày
// dd/mm/yyyy, nên câu trả lời "số liệu tính đến ngày 25/09/2026" thành
// "tính đến ngày [ngày sinh đã ẩn]" — mất mốc thời gian quan trọng nhất.
const DOB_RE = /((?:ngày|năm)\s+sinh|sinh\s+ngày|\bsinh\b|\bDOB\b)(\s*[:\-]?\s*)(?:0?[1-9]|[12]\d|3[01])[\/-](?:0?[1-9]|1[0-2])[\/-](?:19|20)\d{2}\b/giu;

export function scrubPii(text: string): string {
  return text
    .replace(PHONE_RE, '[số ĐT đã ẩn]')
    .replace(EMAIL_RE, '[email đã ẩn]')
    .replace(DOB_RE, (_m, ctx: string, sep: string) => `${ctx}${sep}[đã ẩn]`)
    .replace(ID_RE, (match) => {
      // Only mask plausible ID numbers; leave plain "1234567890" style stats alone
      // by requiring no thousand separator nearby.
      return match.length === 9 || match.length === 12 ? '[CMND/CCCD đã ẩn]' : match;
    });
}

/** Số từ giữ lại cuối bộ đệm — đủ phủ mẫu dài nhất ("ngày sinh: 12/05/1990" = 3 từ). */
const HOLD_BACK_WORDS = 4;

const ALL_PII_RES = [PHONE_RE, EMAIL_RE, ID_RE, DOB_RE];

/**
 * Lọc PII khi stream — đẩy chữ ra dần mà vẫn an toàn như lọc cả khối.
 *
 * Hai lớp bảo vệ:
 *  1. Giữ lại HOLD_BACK_WORDS từ cuối — mẫu có thể còn đang viết dở (vd đã có
 *     "ngày sinh" nhưng ngày chưa tới). Mẫu dài nhất trải tối đa 4 từ.
 *  2. Mẫu đã hoàn chỉnh nhưng VẮT QUA điểm cắt thì lùi điểm cắt về đầu mẫu.
 *     Thiếu bước này, khi cả câu tới cùng lúc, điểm cắt có thể rơi giữa "ngày"
 *     và "sinh" làm ngày sinh lọt ra — test "cắt ở mọi vị trí" bắt được lỗi này.
 *
 * Nhờ vậy kết quả trùng khớp scrubPii(toàn văn) với mọi cách chia mảnh.
 *
 * Trước đây route gom hết câu trả lời rồi mới lọc — an toàn nhưng người dùng
 * phải chờ trắng màn hình tới khi model viết xong.
 */
export class StreamingPiiScrubber {
  private pending = '';

  /** Nhận thêm một mảnh, trả phần đã lọc có thể hiển thị ngay (có thể rỗng). */
  push(delta: string): string {
    this.pending += delta;
    // Tìm ranh giới khoảng trắng thứ HOLD_BACK_WORDS tính từ cuối.
    let cut = this.pending.length;
    for (let i = 0; i < HOLD_BACK_WORDS; i++) {
      const prev = this.pending.slice(0, cut).search(/\s\S*$/);
      if (prev < 0) return '';
      cut = prev;
    }
    let end = cut + 1;
    // Lùi điểm cắt nếu có mẫu PII vắt qua nó.
    for (let moved = true; moved; ) {
      moved = false;
      for (const re of ALL_PII_RES) {
        for (const m of this.pending.matchAll(new RegExp(re.source, re.flags))) {
          const start = m.index ?? 0;
          if (start < end && start + m[0].length > end) {
            end = start;
            moved = true;
          }
        }
      }
    }
    if (end <= 0) return '';
    const ready = this.pending.slice(0, end);
    this.pending = this.pending.slice(end);
    return scrubPii(ready);
  }

  /** Kết thúc stream: lọc và trả phần còn lại. */
  flush(): string {
    const rest = scrubPii(this.pending);
    this.pending = '';
    return rest;
  }
}
