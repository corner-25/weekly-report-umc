/**
 * Chuẩn hoá lý lịch xe từ văn bản thô thành bản ghi bảo dưỡng tra cứu được.
 *
 * 18 xe có lý lịch chép từ file .docx vào cột `rawHistory` — tổng khoảng 150.000
 * ký tự. Dữ liệu quý (mỗi lần thay nhớt, sửa chữa, đăng kiểm suốt hơn 10 năm)
 * nhưng ở dạng văn bản tự do nên không thống kê hay cảnh báo được gì; bảng
 * `vehicle_maintenance_logs` rỗng hoàn toàn.
 *
 * Người nhập viết mỗi dòng một kiểu:
 *
 *   26/7/13: thay nhớt,v/s thắng,v/s lọc gió c/số 15.000km
 *   06/09/13 thay nhớt+lọc c/số 20,000km  (Toyota an thành)
 *   30/09/2013 thay nhớt c/số 25.000km (Toyota an thành)
 *
 * Ngày có năm 2 chữ số lẫn 4 chữ số, số km khi thì dấu chấm khi thì dấu phẩy,
 * gara nằm trong ngoặc hoặc không. Viết regex cho từng biến thể sẽ vỡ ngay khi
 * gặp cách viết mới, nên để AI đọc hiểu rồi trả về dạng có cấu trúc.
 */
import { callJson } from './zai';

/** Phiên bản prompt, ghi kèm bản ghi để biết dữ liệu do lần chạy nào tạo ra. */
export const VEHICLE_HISTORY_PROMPT_VERSION = 'v1';

/**
 * Số ký tự mỗi lần gửi cho AI.
 *
 * Lý lịch dài nhất 16.000 ký tự, vượt xa mức trả lời gọn trong một lượt. Cắt
 * theo đoạn để mỗi lượt vừa đủ ngữ cảnh mà không chạm trần token đầu ra.
 */
const CHUNK_SIZE = 6_000;

/** Loại công việc, dùng thống nhất trong cả hệ thống. */
export type MaintenanceCategory =
  | 'BAO_DUONG'
  | 'SUA_CHUA'
  | 'DANG_KIEM'
  | 'BAO_HIEM'
  | 'KHAC';

export interface MaintenanceRecord {
  /** Ngày thực hiện, YYYY-MM-DD; null khi văn bản chỉ ghi tháng hoặc không rõ. */
  date: string | null;
  odometer: number | null;
  category: MaintenanceCategory;
  description: string;
  workshop: string | null;
}

interface AiResponse {
  ban_ghi: Array<{
    ngay: string | null;
    so_km: number | null;
    loai: string;
    mo_ta: string;
    gara: string | null;
  }>;
}

/**
 * Cắt văn bản thành đoạn theo ranh giới dòng.
 *
 * Không cắt giữa dòng: một mục bảo dưỡng bị xẻ đôi thì cả hai nửa đều vô nghĩa.
 */
function splitIntoChunks(text: string): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    if (current.length + line.length > CHUNK_SIZE && current.length > 0) {
      chunks.push(current);
      current = '';
    }
    current += line + '\n';
  }
  if (current.trim().length > 0) chunks.push(current);

  return chunks;
}

function buildPrompt(plate: string, chunk: string, contextYear: number | null): string {
  return `Bạn đọc lý lịch xe ${plate} của bệnh viện và trích ra từng lần bảo dưỡng, sửa chữa.

Văn bản do nhân viên tổ xe ghi tay qua nhiều năm nên mỗi dòng một kiểu. Nhiệm vụ
của bạn là đọc hiểu rồi trả về dạng có cấu trúc.

QUY TẮC:

1. Mỗi lần làm việc trên xe là MỘT bản ghi. Một dòng có thể chứa nhiều việc
   ("thay nhớt + lọc gió + vệ sinh thắng") — đó vẫn là MỘT bản ghi, gộp vào mô tả.

2. NGÀY: trả về YYYY-MM-DD.
   - "26/7/13" → 2013-07-26 (năm 2 chữ số, thêm 20 vào đầu)
   - "06/09/13" → 2013-09-06
   - "30/09/2013" → 2013-09-30
   - Chỉ có tháng ("Tháng 05") mà không có ngày → date = null, KHÔNG đoán ngày
   ${contextYear ? `- Đoạn này đang ở khoảng năm ${contextYear}; dùng làm gợi ý khi dòng chỉ ghi ngày-tháng.` : ''}

3. SỐ KM: "c/số 15.000km", "cây số 80.000km", "20,000km" đều là số km.
   Dấu chấm và dấu phẩy đều là ngăn hàng nghìn → 15000, 80000, 20000.
   Không có thì null.

4. LOẠI — chọn đúng một:
   - BAO_DUONG: thay nhớt, thay lọc, vệ sinh thắng, bảo dưỡng định kỳ
   - SUA_CHUA: sửa hỏng hóc, tai nạn, đồng sơn, thay phụ tùng hỏng
   - DANG_KIEM: kiểm định, đăng kiểm
   - BAO_HIEM: mua bảo hiểm, bảo hiểm thanh toán
   - KHAC: dán kính, lắp thêm thiết bị, việc không thuộc nhóm trên

5. GARA: tên trong ngoặc ("Toyota an thành", "gara quốc cường"). Không có → null.

6. MÔ TẢ: giữ nguyên ý người viết, viết lại cho rõ tiếng Việt có dấu.
   Bỏ phần ngày và số km khỏi mô tả vì đã có trường riêng.

7. BỎ QUA phần đầu văn bản về thông số kỹ thuật (số máy, số khung, kích thước,
   tải trọng…) — đó là đặc điểm cố định của xe, không phải lần bảo dưỡng nào.
   Chỉ trích các DÒNG CÓ MỐC THỜI GIAN gắn với một việc đã làm.

8. Không bịa. Đoạn không có bản ghi nào thì trả mảng rỗng.

VĂN BẢN:
${chunk}

Trả JSON:
{"ban_ghi": [{"ngay": "YYYY-MM-DD hoặc null", "so_km": <số hoặc null>,
  "loai": "BAO_DUONG|SUA_CHUA|DANG_KIEM|BAO_HIEM|KHAC",
  "mo_ta": "...", "gara": "... hoặc null"}]}

CHỈ trả JSON.`;
}

const VALID_CATEGORIES = new Set<MaintenanceCategory>([
  'BAO_DUONG',
  'SUA_CHUA',
  'DANG_KIEM',
  'BAO_HIEM',
  'KHAC',
]);

/** Ngưỡng km hợp lý cho xe cơ quan; trên mức này gần như chắc là lỗi đọc số. */
const MAX_PLAUSIBLE_ODOMETER = 2_000_000;

/**
 * Kiểm tra lại kết quả AI ở tầng mã.
 *
 * AI đôi khi trả loại ngoài danh sách hoặc ngày sai định dạng. Rẻ hơn nhiều so
 * với việc phát hiện ra khi dữ liệu đã nằm trong database.
 */
function sanitize(items: AiResponse['ban_ghi']): MaintenanceRecord[] {
  const records: MaintenanceRecord[] = [];

  for (const item of items) {
    const description = (item.mo_ta ?? '').trim();
    if (!description) continue;

    let date: string | null = null;
    if (item.ngay && /^\d{4}-\d{2}-\d{2}$/.test(item.ngay)) {
      const parsed = new Date(`${item.ngay}T00:00:00.000Z`);
      // Loại ngày vô lý: xe cơ quan không có lý lịch trước 1990 hay ở tương lai.
      const year = parsed.getUTCFullYear();
      if (!Number.isNaN(parsed.getTime()) && year >= 1990 && parsed <= new Date()) {
        date = item.ngay;
      }
    }

    const odometer =
      typeof item.so_km === 'number' &&
      Number.isFinite(item.so_km) &&
      item.so_km > 0 &&
      item.so_km < MAX_PLAUSIBLE_ODOMETER
        ? Math.round(item.so_km)
        : null;

    const category = VALID_CATEGORIES.has(item.loai as MaintenanceCategory)
      ? (item.loai as MaintenanceCategory)
      : 'KHAC';

    records.push({
      date,
      odometer,
      category,
      description,
      workshop: item.gara?.trim() || null,
    });
  }

  return records;
}

export interface ParseHistoryResult {
  records: MaintenanceRecord[];
  totalTokens: number;
  chunkCount: number;
}

/**
 * Đọc toàn bộ lý lịch một xe, trả về các lần bảo dưỡng đã chuẩn hoá.
 *
 * Xử lý tuần tự từng đoạn, mang năm của đoạn trước sang làm ngữ cảnh — văn bản
 * hay ghi "NĂM 2014" một lần rồi các dòng sau chỉ có ngày-tháng.
 */
export async function parseVehicleHistory(
  plate: string,
  rawHistory: string,
): Promise<ParseHistoryResult> {
  const chunks = splitIntoChunks(rawHistory);
  const records: MaintenanceRecord[] = [];
  let totalTokens = 0;
  let contextYear: number | null = null;

  for (const chunk of chunks) {
    const { data, usage } = await callJson<AiResponse>(
      buildPrompt(plate, chunk, contextYear),
    );
    totalTokens += usage.totalTokens;

    const parsed = sanitize(data.ban_ghi ?? []);
    records.push(...parsed);

    // Năm của bản ghi cuối cùng làm ngữ cảnh cho đoạn kế tiếp.
    const lastDated = [...parsed].reverse().find((r) => r.date);
    if (lastDated?.date) contextYear = Number(lastDated.date.slice(0, 4));
  }

  return { records, totalTokens, chunkCount: chunks.length };
}
