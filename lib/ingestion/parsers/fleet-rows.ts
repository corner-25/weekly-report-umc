import { createHash } from 'crypto';
import {
  classifyWorkCategory,
  computeDrivingHoursDetailed,
  fixDistanceOutliers,
  fixDriverName,
  inferAreaType,
  normalizeDestination,
  parseFuelLiters,
  parseClockToMinutes,
  parseOdometer,
  checkOdometerSequence,
  toNumber,
  type DistanceFixInput,
  type DrivingHoursResult,
  type OdometerCheckInput,
  type OdometerStatus,
} from '@/lib/fleet/cleaning';
import { ADMIN_VEHICLES, SUSPICIOUS_TRIP_HOURS, UNKNOWN_DRIVER } from '@/lib/fleet/cleaning-rules';
import type { SheetData } from '../fetchers/google-sheets';

/**
 * Chuyển dữ liệu thô Google Sheets thành các chuyến xe đã làm sạch.
 *
 * Port từ manual_fleet_sync.read_all_sheets() + fleet_cleaning.clean_fleet_dataframe()
 * của repo UMC-APP/PHONGHC/umc-dashboard. Mỗi sheet là một xe, tên sheet là biển số.
 */

/**
 * Tên cột trong Google Form, theo đúng dữ liệu thật (kiểm chứng 2026-08-20).
 *
 * Spreadsheet có BA biến thể header với thứ tự cột khác nhau:
 *   - 2 xe mới: không có "Chi tiết chuyến xe", "Doanh thu"
 *   - 5 xe hành chính: thêm "Ngày ghi nhận" ở vị trí khác
 *   - 8 xe cứu thương: đủ cột, có "Doanh thu"
 * Parser ghép theo TÊN cột nên thứ tự không ảnh hưởng; cột thiếu trả về rỗng.
 *
 * Mỗi tên cột khai báo nhiều biến thể vì Form đổi nhãn qua các phiên bản
 * (vd "Đổ nhiên liệu" → "Đổ nhiên liệu (Số lít)") và có khác biệt hoa/thường.
 */
const COL = {
  timestamp: ['Timestamp'],
  email: ['Email Address'],
  startTime: ['start_time'],
  endTime: ['end_time'],
  destination: ['Điểm đến'],
  workCategory: ['Phân loại công tác'],
  areaType: ['Nội thành/Ngoại thành', 'Nội thành/ngoại thành'],
  recordDate: ['Ngày ghi nhận'],
  distance: ['Quãng đường'],
  fuel: ['Đổ nhiên liệu (Số lít)', 'Đổ nhiên liệu'],
  revenue: ['Doanh thu'],
  tripDetails: ['Chi tiết chuyến xe'],
  // Form KHÔNG có cột tên tài xế; tên luôn suy từ Email Address.
  driverName: ['Tên tài xế'],
  odometer: ['Chỉ số đồng hồ sau khi kết thúc chuyến xe'],
} as const;

/** Lấy giá trị theo tên cột, thử lần lượt các biến thể tên. */
function pick(row: Record<string, string>, names: readonly string[]): string {
  for (const name of names) {
    const v = row[name];
    if (v !== undefined && v !== '') return v;
  }
  return '';
}

/**
 * Cột do tài xế nhập trực tiếp — dùng để phát hiện dòng trống.
 *
 * Google Sheets có sẵn nhiều hàng chưa ai nhập. KHÔNG dùng Quãng đường hay
 * Nội/Ngoại thành làm tín hiệu vì các dòng trống vẫn có thể chứa giá trị rác.
 */
const SIGNAL_COLUMNS = [
  COL.recordDate,
  COL.startTime,
  COL.endTime,
  COL.destination,
  COL.workCategory,
  COL.timestamp,
] as const;

/** Giá trị coi như rỗng khi kiểm tra dòng trống. */
const EMPTY_MARKERS = new Set(['', 'nan', 'none', '0:00']);

export interface FleetTripRow {
  sourceRowHash: string;
  vehicleId: string;
  driverName: string;
  vehicleType: string;
  recordDate: Date;
  startTime: string | null;
  endTime: string | null;
  durationHours: number | null;
  durationConfidence: DrivingHoursResult['confidence'];
  durationMethod: DrivingHoursResult['method'];
  durationSuspicious: boolean;
  /** Chỉ số công-tơ-mét sau chuyến, đọc từ ô tài xế nhập. */
  odometer: number | null;
  /** Kết quả đối chiếu với chuyến trước cùng xe. */
  odometerStatus: OdometerStatus;
  /** Chênh lệch odometer so với chuyến trước (km). */
  odometerDelta: number | null;
  distanceKm: number | null;
  distanceFixMethod: string;
  fuelLiters: number | null;
  revenueVnd: number | null;
  destination: string;
  workCategory: string;
  areaType: string;
  tripDetails: string | null;
}

export interface FleetParseResult {
  rows: FleetTripRow[];
  /** Dòng trống bị loại — bình thường, Sheets luôn có hàng chưa nhập. */
  emptyRowsDropped: number;
  /** Dòng có dữ liệu nhưng thiếu ngày ghi nhận nên không dùng được. */
  rejected: Array<{ vehicleId: string; rowNumber: number; reason: string }>;
  /** Dòng bị loại vì không rõ ai nhập (thiếu cả email lẫn tên tài xế). */
  noIdentityDropped: number;
  /**
   * Chuyến nghi trùng đã bỏ (giữ bản đầu). Cùng tài xế, xe, ngày, giờ và điểm đến
   * — thường do tài xế submit form hai lần. Đáng để người vận hành xem lại.
   */
  duplicatesDropped: number;
  /** Thống kê theo xe, phục vụ đối chiếu với bản Python. */
  perVehicle: Array<{ vehicleId: string; trips: number }>;
}

/** Một dòng đã ghép header, giữ số dòng gốc để truy vết. */
interface RawRow {
  values: Record<string, string>;
  vehicleId: string;
  rowNumber: number;
}

function isBlankRow(row: Record<string, string>): boolean {
  return !SIGNAL_COLUMNS.some((names) => {
    const v = pick(row, names).trim();
    return v !== '' && !EMPTY_MARKERS.has(v.toLowerCase());
  });
}

/** Giá trị coi như "không rõ người nhập". */
const NO_IDENTITY_MARKERS = new Set([
  '',
  'nan',
  'none',
  UNKNOWN_DRIVER.toLowerCase(),
  'khong xac dinh',
]);

/**
 * Dòng có dữ liệu nhưng KHÔNG rõ ai nhập → loại.
 *
 * Cả ô Email lẫn ô Tên tài xế đều rỗng thường là dữ liệu test cũ trước khi
 * triển khai Form chính thức, hoặc nhập tay thẳng trên Sheets. Chuyến không
 * có chủ thì không quy trách nhiệm được, cũng không thống kê theo tài xế được.
 *
 * Cũng coi 'Không xác định' là rỗng, để quy tắc vẫn áp dụng được trên file đã
 * qua một vòng làm sạch trước đó.
 */
function hasNoIdentity(row: Record<string, string>): boolean {
  const email = pick(row, COL.email).trim().toLowerCase();
  const driver = pick(row, COL.driverName).trim().toLowerCase();
  return NO_IDENTITY_MARKERS.has(email) && NO_IDENTITY_MARKERS.has(driver);
}

/**
 * Parse ngày ghi nhận, fallback sang Timestamp khi trống.
 *
 * Sheets trả nhiều định dạng: 'M/D/YYYY', 'YYYY-MM-DD', hoặc chuỗi có cả giờ.
 *
 * Luôn dựng mốc thời gian ở UTC. Dùng `new Date(y, m, d)` sẽ tạo nửa đêm theo
 * giờ máy chủ, và khi lưu vào Postgres (kiểu timestamptz) sẽ lùi thành 17:00
 * ngày hôm trước với TZ Asia/Saigon — làm lệch mọi báo cáo theo ngày và tuần.
 */
function parseRecordDate(dateRaw: string, timestampRaw: string): Date | null {
  for (const candidate of [dateRaw, timestampRaw]) {
    const s = (candidate ?? '').trim();
    if (!s) continue;

    const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
    if (slash) {
      const [, month, day, year] = slash;
      const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      if (!Number.isNaN(d.getTime())) return d;
    }

    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (iso) {
      const [, year, month, day] = iso;
      const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      if (!Number.isNaN(d.getTime())) return d;
    }

    // Định dạng lạ: để Date tự parse rồi lấy phần ngày theo giờ địa phương,
    // vì chuỗi gốc do người dùng nhập ở múi giờ VN.
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
    }
  }
  return null;
}

/**
 * Ghép giờ bắt đầu vào ngày ghi nhận để có mốc thời gian đầy đủ.
 *
 * Trả về chính ngày đó khi không đọc được giờ — vẫn hơn là bỏ chuyến khỏi chuỗi.
 */
function withStartTime(recordDate: Date, startTime: string): Date {
  const minutes = parseClockToMinutes(startTime);
  if (minutes === null) return recordDate;
  return new Date(recordDate.getTime() + minutes * 60_000);
}

/**
 * Khoá định danh một chuyến.
 *
 * Nguồn không có ID nên hash các trường tài xế nhập. Hai chuyến giống hệt nhau
 * ở mọi trường này sẽ cùng hash — đó cũng chính là định nghĩa "nghi trùng" của
 * bản Python. Bản sau bị bỏ khỏi danh sách ghi, giữ bản đầu.
 */
function computeRowHash(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('|'), 'utf8').digest('hex');
}

/** Đọc các sheet thành chuyến xe đã làm sạch. */
export function parseFleetSheets(sheets: readonly SheetData[]): FleetParseResult {
  const rawRows: RawRow[] = [];
  let emptyRowsDropped = 0;
  let noIdentityDropped = 0;

  for (const sheet of sheets) {
    const vehicleId = sheet.title.trim();
    const [header, ...body] = sheet.values;
    if (!header) continue;

    body.forEach((cells, i) => {
      const values: Record<string, string> = {};
      header.forEach((name, col) => {
        values[String(name).trim()] = (cells[col] ?? '').trim();
      });

      if (isBlankRow(values)) {
        emptyRowsDropped += 1;
        return;
      }
      if (hasNoIdentity(values)) {
        noIdentityDropped += 1;
        return;
      }
      rawRows.push({ values, vehicleId, rowNumber: i + 2 });
    });
  }

  const rejected: FleetParseResult['rejected'] = [];
  const staged: Array<{
    raw: RawRow;
    recordDate: Date;
    areaType: string;
    distanceKm: number | null;
    duration: DrivingHoursResult;
    odometer: number | null;
    hasOdometerText: boolean;
  }> = [];

  for (const raw of rawRows) {
    const v = raw.values;
    const recordDate = parseRecordDate(pick(v, COL.recordDate), pick(v, COL.timestamp));
    if (!recordDate) {
      rejected.push({
        vehicleId: raw.vehicleId,
        rowNumber: raw.rowNumber,
        reason: 'Không đọc được ngày ghi nhận',
      });
      continue;
    }

    const destination = normalizeDestination(pick(v, COL.destination));
    const areaType = inferAreaType(pick(v, COL.areaType), destination);
    const rawDistanceKm = toNumber(pick(v, COL.distance));

    // Giờ lái tính TRƯỚC bước sửa quãng đường, dùng km thô làm kiểm tra chéo —
    // giống thứ tự của bản Python. Hai bước phụ thuộc lẫn nhau nên phải chọn
    // một chiều: giờ dùng km thô, rồi km dùng giờ đã tính.
    const duration = computeDrivingHoursDetailed(
      pick(v, COL.startTime),
      pick(v, COL.endTime),
      rawDistanceKm,
      areaType,
    );

    staged.push({
      raw,
      recordDate,
      areaType,
      distanceKm: rawDistanceKm,
      duration,
      odometer: parseOdometer(pick(v, COL.odometer)),
      hasOdometerText: pick(v, COL.odometer).trim() !== '',
    });
  }

  // Sửa quãng đường cần nhìn toàn bộ chuyến của cùng một xe theo thứ tự thời gian.
  const distanceInputs: DistanceFixInput[] = staged.map((s) => ({
    vehicleId: s.raw.vehicleId,
    timestamp: withStartTime(s.recordDate, pick(s.raw.values, COL.startTime)),
    distanceKm: s.distanceKm,
    odometer: s.odometer,
    durationHours: s.duration.hours,
    areaType: s.areaType,
  }));
  const distanceFixes = fixDistanceOutliers(distanceInputs);

  // Công-tơ-mét chỉ tăng, nên đối chiếu từng chuyến với chuyến trước của cùng xe
  // để bắt lỗi nhập liệu. Không tự sửa — chỉ gắn nhãn cho người vận hành.
  // Dùng THỨ TỰ DÒNG trong sheet, không phải ngày ghi nhận. Google Form ghi
  // theo thứ tự submit nên đó là trình tự thực tế; sắp lại theo ngày làm tăng
  // số cảnh báo giả (1,9% → 2,1%) vì recordDate không có giờ.
  const odometerInputs: OdometerCheckInput[] = staged.map((s) => ({
    vehicleId: s.raw.vehicleId,
    sequence: s.raw.rowNumber,
    odometer: s.odometer,
    hasRawValue: s.hasOdometerText,
  }));
  const odometerChecks = checkOdometerSequence(odometerInputs);

  const seenHashes = new Set<string>();
  const rows: FleetTripRow[] = [];
  let duplicatesDropped = 0;

  staged.forEach((s, i) => {
    const v = s.raw.values;
    const destination = normalizeDestination(pick(v, COL.destination));
    const driverName = fixDriverName(pick(v, COL.driverName), pick(v, COL.email));
    const dateKey = s.recordDate.toISOString().slice(0, 10);

    const sourceRowHash = computeRowHash([
      s.raw.vehicleId,
      driverName,
      dateKey,
      pick(v, COL.startTime),
      pick(v, COL.endTime),
      destination,
    ]);

    // Cùng hash = cùng tài xế, xe, ngày, giờ, điểm đến → nghi trùng.
    //
    // Vì sourceRowHash là khoá duy nhất, ghi cả hai bản sẽ khiến bản sau đè lên
    // bản đầu. Giữ bản ĐẦU và bỏ bản sau khỏi danh sách ghi — tương đương
    // keep='first' của bản Python, nhưng đếm riêng để người vận hành biết.
    if (seenHashes.has(sourceRowHash)) {
      duplicatesDropped += 1;
      return;
    }
    seenHashes.add(sourceRowHash);

    rows.push({
      sourceRowHash,
      vehicleId: s.raw.vehicleId,
      driverName,
      vehicleType: ADMIN_VEHICLES.includes(s.raw.vehicleId) ? 'Hành chính' : 'Cứu thương',
      recordDate: s.recordDate,
      startTime: pick(v, COL.startTime) || null,
      endTime: pick(v, COL.endTime) || null,
      durationHours: s.duration.hours,
      durationConfidence: s.duration.confidence,
      durationMethod: s.duration.method,
      // Đáng ngờ khi độ tin cậy thấp HOẶC giờ lái vượt ngưỡng hợp lý.
      durationSuspicious:
        s.duration.confidence === 'low' ||
        (s.duration.hours !== null && s.duration.hours > SUSPICIOUS_TRIP_HOURS),
      odometer: s.odometer,
      odometerStatus: odometerChecks[i].status,
      odometerDelta: odometerChecks[i].delta,
      distanceKm: distanceFixes[i].distanceKm,
      distanceFixMethod: distanceFixes[i].method,
      fuelLiters: parseFuelLiters(pick(v, COL.fuel)),
      revenueVnd: toNumber(pick(v, COL.revenue)),
      destination,
      workCategory: classifyWorkCategory(pick(v, COL.workCategory)),
      areaType: s.areaType,
      tripDetails: pick(v, COL.tripDetails) || null,
    });
  });

  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.vehicleId, (counts.get(r.vehicleId) ?? 0) + 1);

  return {
    rows,
    emptyRowsDropped,
    rejected,
    noIdentityDropped,
    duplicatesDropped,
    perVehicle: [...counts].map(([vehicleId, trips]) => ({ vehicleId, trips })),
  };
}
