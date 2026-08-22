/**
 * Prompt cho pipeline trích xuất báo cáo tuần bệnh viện.
 *
 * Mỗi prompt có PROMPT_VERSION riêng, ghi vào AiExtractionRun để so sánh chất
 * lượng khi sửa prompt. Đổi nội dung prompt thì tăng version.
 */

export const PROMPT_VERSION = 'v3';

/** Một nhiệm vụ kèm ngữ cảnh, dùng làm đầu vào cho AI. */
export interface TaskContext {
  name: string;
  weekCount: number;
  totalWeeks: number;
  /** Mục cha trong file Excel — tín hiệu mạnh mà tên riêng lẻ không cho biết. */
  parentGroup?: string | null;
  sampleResults?: string[];
  /** Chuỗi tiến độ qua các tuần, dùng để phân loại. */
  progressSeries?: number[];
}

export interface BusinessArea {
  ten: string;
  mo_ta: string;
  dau_hieu: string;
}

/** Cắt văn bản dài, giữ prompt trong tầm kiểm soát. */
function clip(text: string, max: number): string {
  const s = text.replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function describeTask(task: TaskContext, index?: number): string {
  const parts = [
    index === undefined ? `- ${task.name}` : `[${index}] TÊN: ${task.name}`,
    `    Xuất hiện: ${task.weekCount}/${task.totalWeeks} tuần`,
  ];
  if (task.parentGroup) parts.push(`    Mục cha trong Excel: ${task.parentGroup}`);
  for (const [i, r] of (task.sampleResults ?? []).slice(0, 2).entries()) {
    parts.push(`    Kết quả thực tế ${i + 1}: ${clip(r, 200)}`);
  }
  if (task.progressSeries?.length) {
    const seq = task.progressSeries.slice(0, 14).map((p) => String(p)).join(', ');
    const more = task.progressSeries.length > 14 ? '…' : '';
    parts.push(`    Chuỗi tiến độ: ${seq}${more}`);
  }
  return parts.join('\n');
}

// ═══════════════════════════════════════════════════════════════════
// GIAI ĐOẠN 1 — dựng danh mục nghiệp vụ của một phòng
// ═══════════════════════════════════════════════════════════════════

export function buildGroupingPrompt(deptName: string, frequentTasks: TaskContext[]): string {
  return `Bạn phân tích báo cáo tuần của ${deptName}, Bệnh viện Đại học Y Dược TP.HCM.

Đây là các nhiệm vụ XUẤT HIỆN THƯỜNG XUYÊN, kèm mục cha trong file Excel và ví dụ kết quả:

${frequentTasks.map((t) => describeTask(t)).join('\n')}

Hãy đề xuất danh mục NGHIỆP VỤ THƯỜNG QUY của phòng — mỗi nghiệp vụ là một mảng công việc
phòng làm đều đặn hàng tuần.

Trả JSON:
{"nghiep_vu": [{"ten": "...", "mo_ta": "một câu mô tả phạm vi", "dau_hieu": "dấu hiệu nhận biết"}]}

Quy tắc:
- 6-9 nghiệp vụ
- Gom theo BẢN CHẤT công việc, không theo từ ngữ giống nhau
- Tên nghiệp vụ ngắn gọn, dùng thuật ngữ bệnh viện
- CHỈ trả JSON`;
}

// ═══════════════════════════════════════════════════════════════════
// GIAI ĐOẠN 2 — xếp từng nhiệm vụ vào nghiệp vụ
// ═══════════════════════════════════════════════════════════════════

export function buildAssignPrompt(
  deptName: string,
  areas: BusinessArea[],
  batch: TaskContext[],
): string {
  const catalog = areas
    .map((a, i) => `${i}. ${a.ten}\n   phạm vi: ${a.mo_ta}\n   dấu hiệu: ${a.dau_hieu}`)
    .join('\n');

  return `Danh mục nghiệp vụ thường quy của ${deptName}:

${catalog}

Với MỖI nhiệm vụ dưới đây, đọc kỹ tên + mục cha + kết quả thực tế, rồi suy luận nó thuộc
nghiệp vụ nào.

${batch.map((t, i) => describeTask(t, i)).join('\n')}

Lưu ý quan trọng:
- Nhiệm vụ chỉ xuất hiện 1-2 tuần KHÔNG có nghĩa là việc phát sinh. Thường đó vẫn là nghiệp
  vụ thường quy, chỉ khác đối tượng cụ thể. Ví dụ "Phần mềm Chỉ định CLS" thuộc nghiệp vụ vận
  hành phần mềm — tuần đó tình cờ làm với module CLS.
- Dựa vào KẾT QUẢ THỰC TẾ để hiểu bản chất công việc, đừng chỉ đoán từ tên.
- "doi_tuong" là đối tượng cụ thể (tên module, tên hệ thống), để giữ chi tiết.

Trả JSON:
{"ket_qua": [{"stt": <số trong []>, "nghiep_vu": <số thứ tự>, "doi_tuong": "<hoặc null>",
  "do_tin_cay": <0.0-1.0>, "ly_do": "<ngắn gọn>"}]}

PHẢI trả đủ ${batch.length} phần tử. CHỈ trả JSON.`;
}

// ═══════════════════════════════════════════════════════════════════
// GIAI ĐOẠN 3 — phân loại nhiệm vụ và ý nghĩa tiến độ
// ═══════════════════════════════════════════════════════════════════

const TASK_TYPE_RULES = `Phân loại nhiệm vụ trong báo cáo tuần bệnh viện thành 5 loại:

RECURRING — Nghiệp vụ thường quy, làm đi làm lại mỗi tuần.
  Ví dụ: "Tổng đài", "Quản lý thanh toán bảo hiểm", "Hỗ trợ máy in".
  Tiến độ 100% mỗi tuần nghĩa là "xong phần việc của tuần này", KHÔNG phải xong hẳn.

CUMULATIVE — Dự án có điểm kết thúc, tiến độ tích luỹ dần tới 100%.
  Ví dụ: "Triển khai dự án Core Switch" với chuỗi tiến độ 20, 45, 70, 100.
  Đây là loại DUY NHẤT mà con số tiến độ phản ánh mức hoàn thành thật.
  ĐIỀU KIỆN BẮT BUỘC: chuỗi tiến độ phải có ít nhất 3 giá trị KHÁC NHAU và
  xu hướng tăng. Tên nghe như dự án nhưng chuỗi chỉ có một giá trị, hoặc cố
  định suốt nhiều tuần, thì KHÔNG phải CUMULATIVE.

MILESTONE — Việc xảy ra một lần, có mốc thời gian cụ thể.
  Ví dụ: "Họp HĐKH thẩm định đề án ngày 12/3", "Tiếp đoàn BV Đồng Nai".
  Chỉ có xong/chưa xong, không có % ở giữa.

MONITORING — Theo dõi chỉ số, báo cáo số liệu định kỳ.
  Ví dụ: "Quản lý văn bản đi, đến" với kết quả "278 văn bản, đúng hạn 99,6%".
  Giá trị nằm ở CON SỐ trong kết quả, không phải ở cột tiến độ.

UNRELIABLE — Con số tiến độ không phản ánh gì.
  Dấu hiệu: cố định suốt nhiều tuần (5,5,5,5 hoặc 90,90,90), hoặc tăng đều một
  lượng cố định mỗi tuần (2,4,6,8 = % thời gian trôi qua trong năm).

QUY TẮC QUYẾT ĐỊNH — xét chuỗi tiến độ TRƯỚC, tên nhiệm vụ sau:
  - Chuỗi rỗng (không có số nào)                → MILESTONE hoặc MONITORING hoặc RECURRING
  - Chuỗi chỉ có 1 giá trị duy nhất             → KHÔNG được chọn CUMULATIVE
  - Chuỗi cố định suốt ≥5 tuần (5,5,5 / 90,90)  → UNRELIABLE
  - Chuỗi tăng đều một lượng cố định (2,4,6,8)  → UNRELIABLE (là % thời gian trôi qua)
  - Chuỗi toàn 100 suốt nhiều tuần               → RECURRING (xong việc mỗi tuần)
  - Chuỗi ≥3 giá trị khác nhau và tăng dần       → CUMULATIVE
  - Chuỗi dao động lên xuống thất thường         → RECURRING hoặc UNRELIABLE, KHÔNG phải CUMULATIVE

Tên nhiệm vụ chỉ dùng để phân biệt giữa các loại còn lại sau khi đã áp quy tắc trên.

Đồng thời cho biết con số tiến độ NGHĨA LÀ GÌ:
  COMPLETION  — % hoàn thành thật của toàn bộ công việc
  WEEKLY_DONE — "đã xong phần việc tuần này"
  TIME_RATIO  — % thời gian đã trôi qua, không liên quan công việc
  MEANINGLESS — điền cho có`;

export function buildClassifyPrompt(batch: TaskContext[]): string {
  return `${TASK_TYPE_RULES}

Phân loại các nhiệm vụ sau:

${batch.map((t, i) => describeTask(t, i)).join('\n')}

Trả JSON:
{"ket_qua": [{"stt": <số>, "loai": "RECURRING|CUMULATIVE|MILESTONE|MONITORING|UNRELIABLE",
  "y_nghia_tien_do": "COMPLETION|WEEKLY_DONE|TIME_RATIO|MEANINGLESS",
  "do_tin_cay": <0-1>, "ly_do": "<ngắn gọn>"}]}

PHẢI trả đủ ${batch.length} phần tử. CHỈ trả JSON.`;
}

// ═══════════════════════════════════════════════════════════════════
// GIAI ĐOẠN 4 — phân xử các cặp tên gần giống bị xếp khác nghiệp vụ
// ═══════════════════════════════════════════════════════════════════

export function buildReconcilePrompt(
  deptName: string,
  areas: BusinessArea[],
  conflicts: Array<{ a: TaskContext; b: TaskContext }>,
): string {
  const catalog = areas.map((a, i) => `${i}. ${a.ten} — ${a.mo_ta}`).join('\n');
  const pairs = conflicts
    .flatMap(({ a, b }) => [a, b])
    .map(
      (t) =>
        `• ${t.name}\n  mục cha: ${t.parentGroup ?? '—'}\n  kết quả: ${clip(t.sampleResults?.[0] ?? '—', 180)}`,
    )
    .join('\n');

  return `Danh mục nghiệp vụ của ${deptName}:

${catalog}

Các nhiệm vụ sau có tên gần giống nhau nhưng đang bị xếp vào hai nghiệp vụ khác nhau.
Hãy xem KẾT QUẢ THỰC TẾ rồi quyết định mỗi cái thuộc nghiệp vụ nào.

Lưu ý: tên gần giống KHÔNG chắc là cùng nghiệp vụ. Ví dụ "Hỗ trợ lắp đặt thiết bị" có thể
là lắp thiết bị mạng nội bộ, cũng có thể là hỗ trợ sự kiện bên ngoài — hai nghiệp vụ khác nhau.

${pairs}

Trả JSON:
{"quyet_dinh": [{"ten": "<tên nhiệm vụ>", "nghiep_vu": <số>, "do_tin_cay": <0-1>, "ly_do": "<ngắn>"}]}

CHỈ trả JSON.`;
}

// ═══════════════════════════════════════════════════════════════════
// GIAI ĐOẠN 5 — trích số liệu định lượng từ văn bản
// ═══════════════════════════════════════════════════════════════════

export function buildMetricPrompt(
  deptName: string,
  items: Array<{ taskName: string; resultText: string }>,
): string {
  return `Trích số liệu định lượng từ báo cáo tuần của ${deptName}, Bệnh viện Đại học Y Dược TP.HCM.

${items.map((it, i) => `[${i}] NHIỆM VỤ: ${it.taskName}\n    KẾT QUẢ: ${clip(it.resultText, 700)}`).join('\n\n')}

Với mỗi mục, trích TẤT CẢ số liệu định lượng có trong văn bản.

Quy tắc bắt buộc:
1. Phân biệt kỳ của số liệu:
   - WEEK: số của riêng tuần này ("65 văn bản", "tiếp nhận 278 văn bản đến")
   - CUMULATIVE: luỹ kế từ đầu ("Tính đến ngày 18/4/2026 đã triển khai 09 ca ghép tim")
     → khi là CUMULATIVE, ghi "tinh_den_ngay" theo định dạng YYYY-MM-DD nếu văn bản có nêu
2. Giữ nguyên đơn vị tiếng Việt trong văn bản (HSBA, ca, văn bản, lượt, người, %)
3. Tên số liệu phải rõ nghĩa khi đứng một mình — "Hồ sơ bệnh án tiếp nhận", không phải "Tiếp nhận"
4. TUYỆT ĐỐI KHÔNG suy diễn hay ước lượng. Không có số thì trả mảng rỗng.
5. Một mục có thể có nhiều số liệu; trích hết.
6. Bỏ qua số thứ tự, số ngày tháng, số hiệu văn bản — chỉ lấy số ĐO LƯỜNG công việc.
7. Bỏ qua số MÔ TẢ QUY MÔ của một văn bản. Đây là lỗi hay gặp nhất, xem ví dụ:

   "QĐ 1599/QĐ-BVĐHYD (11/6/2025 - 10/6/2026): MSRR lần 2/2025 (gồm 606 phần): 30%"
     ✓ TRÍCH: {"ten": "Tỷ lệ sử dụng QĐ 1599/QĐ-BVĐHYD", "gia_tri": 30, "don_vi": "%"}
     ✗ BỎ QUA: "606 phần" — đó là quy mô của quyết định, không phải kết quả tuần này

   Nguyên tắc: hỏi "con số này có thay đổi theo tuần không?"
     - Thay đổi (tỷ lệ sử dụng, số hồ sơ xử lý, số lượt giám sát) → TRÍCH
     - Cố định (gồm N phần, N gói thầu trong hợp đồng, N điều khoản) → BỎ QUA

8. TIỀN TỆ: luôn quy về VND, và đọc dấu chấm theo quy ước tiếng Việt.

   Dấu chấm trong tiếng Việt ngăn hàng NGHÌN, không phải dấu thập phân:
     "tổng giá trị hơn 2.633 tỉ"
       ✓ {"gia_tri": 2633000000000, "don_vi": "VND"}   (hai nghìn sáu trăm ba ba tỷ)
       ✗ {"gia_tri": 2.633, "don_vi": "tỉ đồng"}       (đọc nhầm thành 2 phẩy 633)

     "Tiếp nhận tài trợ 500 triệu đồng"
       ✓ {"gia_tri": 500000000, "don_vi": "VND"}
       ✗ {"gia_tri": 500, "don_vi": "triệu đồng"}

   don_vi của mọi số tiền PHẢI là "VND" — không dùng "đồng", "triệu đồng",
   "tỷ đồng". Nhân hệ số trước khi trả: triệu ×1.000.000, tỷ ×1.000.000.000.
   Lý do: các tuần lưu khác thang thì không thể cộng gộp hay so sánh được.

9. Số liệu LUỸ KẾ mà văn bản không nêu mốc thời gian thì lấy ngày cuối tuần báo
   cáo làm "tinh_den_ngay", đừng để null — nếu không sẽ không biết luỹ kế đến đâu.

Trả JSON:
{"ket_qua": [{"stt": <số trong []>, "so_lieu": [
  {"ten": "...", "gia_tri": <số>, "don_vi": "...", "ky": "WEEK|CUMULATIVE|MONTH|QUARTER|YEAR",
   "tinh_den_ngay": "YYYY-MM-DD hoặc null", "trich_tu": "<đoạn văn gốc>", "do_tin_cay": <0-1>}
]}]}

PHẢI trả đủ ${items.length} phần tử (kể cả khi so_lieu rỗng). CHỈ trả JSON.`;
}
