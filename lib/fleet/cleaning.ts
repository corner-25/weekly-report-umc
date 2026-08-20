/**
 * Làm sạch dữ liệu Tổ Lái Xe.
 *
 * Port từ fleet_cleaning.py (repo UMC-APP/PHONGHC/umc-dashboard). Logic nghiệp vụ
 * đã được tinh chỉnh qua nhiều vòng thực tế — giữ nguyên hành vi, kể cả các
 * trường hợp biên, để kết quả đối chiếu được với dữ liệu Python đã sinh ra.
 */
import {
  AVG_SPEED_KMH,
  EMAIL_TO_DRIVER,
  MAX_ODO_DELTA_KM,
  MAX_REASONABLE_SPEED,
  MAX_TRIP_DISTANCE_KM,
  UNKNOWN_DRIVER,
  WORK_CATEGORY_RULES,
} from './cleaning-rules';

/** Bỏ dấu tiếng Việt, viết thường — dùng để so khớp gần đúng. */
export function removeVnAccents(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export type Meridiem = 'AM' | 'PM' | null;

/**
 * Parse mốc giờ → [số phút trong ngày, cờ AM/PM].
 *
 * Cờ AM/PM cần để phân biệt hai loại lỗi khi `end < start`:
 *   - cùng AM hoặc cùng PM → tài xế gõ nhầm định dạng, KHÔNG phải qua đêm
 *   - PM→AM hoặc định dạng 24h → qua đêm thật
 *
 * `null` ở vị trí cờ nghĩa là chuỗi dùng định dạng 24h.
 */
export function parseClockWithAmpm(input: unknown): [number | null, Meridiem] {
  if (input === null || input === undefined) return [null, null];
  let s = String(input).trim();
  if (s === '') return [null, null];

  let meridiem: Meridiem = null;
  if (/AM/i.test(s)) {
    meridiem = 'AM';
    s = s.replace(/\s*am/gi, '');
  } else if (/PM/i.test(s)) {
    meridiem = 'PM';
    s = s.replace(/\s*pm/gi, '');
  }

  const m = /^(\d+):(\d{1,2})/.exec(s.trim());
  if (!m) return [null, null];

  let hour = Number(m[1]);
  const minute = Number(m[2]);

  if (meridiem === 'PM' && hour !== 12) hour += 12;
  else if (meridiem === 'AM' && hour === 12) hour = 0;

  if (hour > 23 || minute > 59) return [null, null];
  return [hour * 60 + minute, meridiem];
}

/** Chỉ lấy số phút, bỏ cờ AM/PM. Giữ cho tương thích ngược. */
export function parseClockToMinutes(input: unknown): number | null {
  return parseClockWithAmpm(input)[0];
}

/** Vận tốc trung bình để ƯỚC LƯỢNG giờ từ km, đã tính cả thời gian chờ. */
const ESTIMATE_SPEED_KMH = { inner: 25, outer: 45 } as const;

/** Quãng đường vượt ngưỡng này là rác, không dùng để ước lượng. */
const MAX_ESTIMATE_KM = 5000;

/** Ước giờ lái từ quãng đường khi không có giờ bắt đầu/kết thúc. */
function estimateHoursFromKm(km: number | null, areaType: string | null): number | null {
  if (km === null || !Number.isFinite(km) || km <= 0 || km > MAX_ESTIMATE_KM) return null;
  const speed = areaType === 'Nội thành' ? ESTIMATE_SPEED_KMH.inner : ESTIMATE_SPEED_KMH.outer;
  return Math.round((km / speed) * 100) / 100;
}

export type DurationConfidence = 'high' | 'medium' | 'low';

export type DurationMethod =
  | 'normal'
  | 'fixed_ampm'
  | 'fixed_ampm_km_capped'
  | 'overnight'
  | 'overnight_long'
  | 'overnight_suspicious'
  | 'estimated_no_time'
  | 'estimated_zero_diff'
  | 'estimated_invalid_clock';

/** Vận tốc suy ra nằm trong khoảng thực tế → tin cậy cao. */
function confidenceFromSpeed(hours: number, km: number | null): DurationConfidence {
  if (km === null || km <= 0 || hours <= 0) return 'medium';
  const speed = km / hours;
  return speed >= 5 && speed <= 100 ? 'high' : 'medium';
}

export interface DrivingHoursResult {
  hours: number | null;
  confidence: DurationConfidence;
  method: DurationMethod;
}

/** Giờ lái tối đa còn coi là hợp lý cho một chuyến. */
const MAX_PLAUSIBLE_TRIP_HOURS = 16;

/** Quãng đường dưới ngưỡng này mà giờ lái lớn → nghi gõ nhầm. */
const SHORT_TRIP_KM = 30;

/** Quãng đường trên ngưỡng này thì chuyến dài qua đêm là hợp lý. */
const LONG_TRIP_KM = 100;

/**
 * Giờ lái, tự phát hiện và sửa các kiểu nhập sai.
 *
 * Giờ đồng hồ là nguồn chính, quãng đường dùng kiểm tra chéo:
 *   1. end > start                        → 'normal'
 *   2. end < start, cùng AM hoặc cùng PM  → 'fixed_ampm' (+12h, KHÔNG +24h)
 *      km nhỏ mà giờ vẫn lớn              → 'fixed_ampm_km_capped'
 *   3. end < start, PM→AM hoặc 24h        → 'overnight' (+24h)
 *      > 16h: km lớn → 'overnight_long', km nhỏ → 'overnight_suspicious'
 *   4. end == start hoặc thiếu giờ        → ước từ km
 *
 * Không dùng cột 'Thời gian' của Sheets vì cột đó format sai (12:40 AM = 40 phút
 * bị đọc nhầm thành 12 giờ 40).
 */
export function computeDrivingHoursDetailed(
  startRaw: unknown,
  endRaw: unknown,
  distanceKm?: unknown,
  areaType?: string | null,
): DrivingHoursResult {
  const [startMin, startAmpm] = parseClockWithAmpm(startRaw);
  const [endMin, endAmpm] = parseClockWithAmpm(endRaw);

  let km = toNumber(distanceKm);
  if (km !== null && (km < 0 || km > MAX_ESTIMATE_KM)) km = null;

  const area = areaType ?? null;
  const round3 = (h: number | null) => (h === null ? null : Math.round(h * 1000) / 1000);

  // Thiếu giờ → ước từ km
  if (startMin === null || endMin === null) {
    return { hours: round3(estimateHoursFromKm(km, area)), confidence: 'low', method: 'estimated_no_time' };
  }

  const diffMinutes = endMin - startMin;

  if (diffMinutes === 0) {
    return { hours: round3(estimateHoursFromKm(km, area)), confidence: 'low', method: 'estimated_zero_diff' };
  }

  if (diffMinutes > 0) {
    const hours = diffMinutes / 60;
    return { hours: round3(hours), confidence: confidenceFromSpeed(hours, km), method: 'normal' };
  }

  // end < start
  const samePeriod = startAmpm !== null && endAmpm !== null && startAmpm === endAmpm;

  if (samePeriod) {
    // Cùng buổi thì chắc chắn không qua đêm — tài xế gõ nhầm, cộng 12h.
    const flipped = (diffMinutes + 12 * 60) / 60;

    if (flipped > 0 && flipped <= MAX_PLAUSIBLE_TRIP_HOURS) {
      // Chuyến rất ngắn mà giờ vẫn lớn → giới hạn theo km, tối thiểu 5 km/h.
      if (km !== null && km < SHORT_TRIP_KM && flipped > 2) {
        const cap = Math.max(km / 5, 0.5);
        if (cap < flipped) {
          return {
            hours: round3(Math.min(flipped, cap + 1)),
            confidence: 'medium',
            method: 'fixed_ampm_km_capped',
          };
        }
      }
      return { hours: round3(flipped), confidence: 'medium', method: 'fixed_ampm' };
    }

    return {
      hours: round3(estimateHoursFromKm(km, area)),
      confidence: 'low',
      method: 'estimated_invalid_clock',
    };
  }

  // Khác buổi hoặc định dạng 24h → qua đêm thật
  const overnight = (diffMinutes + 24 * 60) / 60;

  if (overnight <= MAX_PLAUSIBLE_TRIP_HOURS) {
    return { hours: round3(overnight), confidence: confidenceFromSpeed(overnight, km), method: 'overnight' };
  }

  if (km !== null && km > LONG_TRIP_KM) {
    return { hours: round3(overnight), confidence: 'medium', method: 'overnight_long' };
  }
  return { hours: round3(overnight), confidence: 'low', method: 'overnight_suspicious' };
}

/** Chỉ lấy số giờ. Giữ cho tương thích ngược. */
export function computeDrivingHours(
  startRaw: unknown,
  endRaw: unknown,
  distanceKm?: unknown,
  areaType?: string | null,
): number | null {
  return computeDrivingHoursDetailed(startRaw, endRaw, distanceKm, areaType).hours;
}

/** Dung tích bình lớn nhất của xe trong đội; vượt ngưỡng là nhập nhầm cột. */
const MAX_FUEL_LITERS = 100;

/**
 * Số lít nhiên liệu từ ô nhập tự do của tài xế.
 *
 * Các kiểu đã gặp trong dữ liệu thật:
 *   "50" · "50,5" · "25lit" · "60 Lit 01" · "50 lít xăng"
 *   "50lx-km 520121" (lít rồi đến odo) · "60/20500" · "50/E10"
 *   "K" / "Không" / "Cb ccuu" (rác nhập sai cột) · "520121" (chỉ có odo)
 *
 * Quy tắc: lấy SỐ ĐẦU TIÊN; nằm trong [0, 100] thì là lít, ngoài ra coi như 0.
 */
export function parseFuelLiters(value: unknown): number {
  if (value === null || value === undefined) return 0;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0;
    return value >= 0 && value <= MAX_FUEL_LITERS ? value : 0;
  }

  const s = String(value).trim();
  if (s === '') return 0;

  const m = /(-?\d+(?:[.,]\d+)?)/.exec(s);
  if (!m) return 0; // "K", "Không", "Cb ccuu"…

  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n)) return 0;

  // Số lớn hơn dung tích bình = odo hoặc rác, không phải lít.
  return n >= 0 && n <= MAX_FUEL_LITERS ? Math.round(n * 100) / 100 : 0;
}

/** Gom cách viết tự do của phân loại công tác về nhóm chuẩn. */
export function classifyWorkCategory(raw: unknown): string {
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return 'Không xác định';
  }
  const cleaned = removeVnAccents(raw);
  for (const [group, keywords] of WORK_CATEGORY_RULES) {
    for (const kw of keywords) {
      if (cleaned.includes(removeVnAccents(kw))) return group;
    }
  }
  return 'Khác';
}

/** Các từ viết tắt giữ nguyên chữ hoa khi title-case điểm đến. */
const UPPERCASE_TOKENS = new Set(['bv', 'tmhh', 'bgd', 'bgđ', 'pgđ', 'pgd', 'umc', 'q']);

/** Chuẩn hoá điểm đến: TPHCM → TP. HCM, q5/quận 5 → Q.5, title-case. */
export function normalizeDestination(input: unknown): string {
  if (input === null || input === undefined) return '';
  let s = String(input).trim();
  if (s === '') return '';

  s = s.replace(/\s+/g, ' ');

  // Chuẩn hoá Quận TRƯỚC, để 'q5' không bị quy tắc TPHCM nuốt mất.
  s = s.replace(/quận\s*(\d{1,2})/gi, (_, d) => ` Q.${d} `);
  s = s.replace(/quan\s*(\d{1,2})/gi, (_, d) => ` Q.${d} `);
  s = s.replace(/q[.\s]*(\d{1,2})(?![\w])/gi, (_, d) => ` Q.${d} `);

  s = s.replace(/\btphcm\s*/gi, 'TP. HCM ');
  s = s.replace(/\btp\.?\s*hcm\s*/gi, 'TP. HCM ');
  s = s.replace(/\bt\.?p\.?\s*hồ\s*chí\s*minh\s*/gi, 'TP. HCM ');
  s = s.replace(/\bho\s*chi\s*minh\s*/gi, 'TP. HCM ');

  s = s.replace(/TP\.\s*HCM\s*[-\s]+\s*Q\./g, 'TP. HCM-Q.');
  s = s.replace(/\s*-\s*/g, '-');
  s = s.replace(/\s+/g, ' ').trim();

  s = s
    .split('-')
    .map((part) =>
      part
        .split(' ')
        .map((word) => {
          if (!word) return word;
          const lower = word.toLowerCase();
          if (UPPERCASE_TOKENS.has(lower)) return word.toUpperCase();
          if (word.startsWith('Q.')) return word;
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' '),
    )
    .join('-');

  return s.replace(/\btp\. hcm\b/gi, 'TP. HCM');
}

/** Tên tài xế: rỗng, dạng email, hoặc 'nan'/'none' → tra từ Email Address. */
export function fixDriverName(
  driverRaw: unknown,
  emailRaw: unknown,
  emailMap: Readonly<Record<string, string>> = EMAIL_TO_DRIVER,
): string {
  const raw = driverRaw === null || driverRaw === undefined ? '' : String(driverRaw).trim();
  const email = emailRaw === null || emailRaw === undefined ? '' : String(emailRaw).trim().toLowerCase();

  const isUsableName = raw !== '' && !raw.includes('@') && !['nan', 'none'].includes(raw.toLowerCase());
  if (isUsableName) return raw;

  if (email in emailMap) return emailMap[email];
  if (raw.includes('@') && raw.toLowerCase() in emailMap) return emailMap[raw.toLowerCase()];
  return UNKNOWN_DRIVER;
}

/** Suy Nội/Ngoại thành từ điểm đến khi trường này bỏ trống. */
export function inferAreaType(currentArea: unknown, destination: unknown): string {
  if (currentArea !== null && currentArea !== undefined && String(currentArea).trim() !== '') {
    return String(currentArea);
  }
  const dest = removeVnAccents(destination);
  const isInnerCity = dest.includes('tp. hcm') || dest.includes('tphcm') || dest.includes('q.');
  return isInnerCity ? 'Nội thành' : 'Ngoại thành';
}

/** Một chuyến ở dạng tối thiểu cần cho bước sửa quãng đường. */
export interface DistanceFixInput {
  vehicleId: string;
  timestamp: Date | null;
  distanceKm: number | null;
  odometer: number | null;
  durationHours: number | null;
  areaType: string;
}

export interface DistanceFixOutput {
  distanceKm: number | null;
  /** Cách sửa đã áp dụng, phục vụ ghi log và rà soát. */
  method: 'NONE' | 'ODO_DELTA' | 'ESTIMATED_FROM_HOURS' | 'UNFIXABLE';
}

/**
 * Sửa quãng đường lỗi (âm, > 1000km, hoặc vận tốc > 120 km/h).
 *
 * Thứ tự ưu tiên:
 *   1. Delta odometer so với chuyến trước cùng xe, nếu vận tốc suy ra hợp lý
 *   2. Suy từ giờ lái × vận tốc trung bình theo khu vực
 *   3. Bó tay → giữ null để người rà soát
 *
 * Mảng đầu vào được sắp theo (xe, thời gian) bên trong hàm; thứ tự đầu ra
 * khớp thứ tự đầu vào.
 */
export function fixDistanceOutliers(rows: readonly DistanceFixInput[]): DistanceFixOutput[] {
  const order = rows.map((_, i) => i);
  order.sort((a, b) => {
    const rowA = rows[a];
    const rowB = rows[b];
    if (rowA.vehicleId !== rowB.vehicleId) return rowA.vehicleId < rowB.vehicleId ? -1 : 1;
    const timeA = rowA.timestamp?.getTime() ?? Number.POSITIVE_INFINITY;
    const timeB = rowB.timestamp?.getTime() ?? Number.POSITIVE_INFINITY;
    return timeA - timeB;
  });

  const results: DistanceFixOutput[] = rows.map((r) => ({ distanceKm: r.distanceKm, method: 'NONE' }));
  const prevOdoByVehicle = new Map<string, number>();

  for (const idx of order) {
    const row = rows[idx];
    const prevOdo = prevOdoByVehicle.get(row.vehicleId);
    const delta = row.odometer !== null && prevOdo !== undefined ? row.odometer - prevOdo : null;

    if (row.odometer !== null) prevOdoByVehicle.set(row.vehicleId, row.odometer);

    const km = row.distanceKm;
    const hours = row.durationHours;

    let isBad = km === null || km < 0 || km > MAX_TRIP_DISTANCE_KM;
    if (!isBad && km !== null && hours !== null && hours > 0 && km / hours > MAX_REASONABLE_SPEED) {
      isBad = true;
    }
    if (!isBad) continue;

    // Cách 1: delta odometer, nếu vận tốc suy ra không vô lý
    const deltaSpeedOk = delta !== null && hours !== null && hours > 0 ? delta / hours <= MAX_REASONABLE_SPEED : true;
    if (delta !== null && delta >= 0 && delta <= MAX_ODO_DELTA_KM && deltaSpeedOk) {
      results[idx] = { distanceKm: delta, method: 'ODO_DELTA' };
      continue;
    }

    // Cách 2: giờ lái × vận tốc trung bình theo khu vực
    if (hours !== null && hours > 0) {
      const speed = AVG_SPEED_KMH[row.areaType] ?? AVG_SPEED_KMH['Nội thành'];
      results[idx] = { distanceKm: Math.round(hours * speed * 10) / 10, method: 'ESTIMATED_FROM_HOURS' };
      continue;
    }

    results[idx] = { distanceKm: null, method: 'UNFIXABLE' };
  }

  return results;
}

/** Chuyển giá trị ô Sheets sang số; trả null nếu không phải số hợp lệ. */
export function toNumber(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim();
  if (s === '' || ['nan', 'none', 'null'].includes(s.toLowerCase())) return null;
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}
