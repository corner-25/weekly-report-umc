/**
 * Đổi lịch âm ↔ dương lịch Việt Nam.
 *
 * Thuật toán của Hồ Ngọc Đức (bản công bố tự do), tính theo múi giờ +7 — lịch
 * âm Việt Nam khác lịch Trung Quốc ở một số năm vì múi giờ, nên không dùng thư
 * viện Trung Quốc được. Nhiều đối tác lớn tuổi mừng sinh nhật theo âm lịch; CRM
 * cần biết ngày dương tương ứng của từng năm để nhắc đúng hạn.
 */

const TIME_ZONE = 7;
const INT = Math.floor;

export interface SolarDate {
  day: number;
  month: number;
  year: number;
}

export interface LunarDate extends SolarDate {
  leap: boolean;
}

function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}

function jdToDate(jd: number): SolarDate {
  let b: number;
  let c: number;
  if (jd > 2299160) {
    const a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  return {
    day: e - INT((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * INT(m / 10),
    year: b * 100 + d - 4800 + INT(m / 10),
  };
}

/** Thời điểm sóc (trăng mới) thứ k tính từ 1/1/1900. */
function newMoon(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 -= 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltaT = T < -11
    ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return jd1 + C1 - deltaT;
}

function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L -= Math.PI * 2 * INT(L / (Math.PI * 2));
  return L;
}

const sunSector = (dayNumber: number): number => INT((sunLongitude(dayNumber - 0.5 - TIME_ZONE / 24) / Math.PI) * 6);
const newMoonDay = (k: number): number => INT(newMoon(k) + 0.5 + TIME_ZONE / 24);

/** Ngày bắt đầu tháng 11 âm lịch của năm yy (tháng chứa đông chí). */
function lunarMonth11(yy: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  const nm = newMoonDay(k);
  return sunSector(nm) >= 9 ? newMoonDay(k - 1) : nm;
}

function leapMonthOffset(a11: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let i = 1;
  let arc = sunSector(newMoonDay(k + i));
  let last: number;
  do {
    last = arc;
    i += 1;
    arc = sunSector(newMoonDay(k + i));
  } while (arc !== last && i < 14);
  return i - 1;
}

/** Ngày dương của mùng 1 tháng âm (month, year, leap); null nếu tháng nhuận không tồn tại. */
function lunarMonthStart(month: number, year: number, leap: boolean): number | null {
  const [a11, b11] = month < 11
    ? [lunarMonth11(year - 1), lunarMonth11(year)]
    : [lunarMonth11(year), lunarMonth11(year + 1)];
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  let off = month - 11;
  if (off < 0) off += 12;
  if (b11 - a11 > 365) {
    const leapOff = leapMonthOffset(a11);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) leapMonth += 12;
    if (leap && month !== leapMonth) return null;
    if (leap || off >= leapOff) off += 1;
  } else if (leap) {
    return null;
  }
  return newMoonDay(k + off);
}

/**
 * Ngày dương lịch của một ngày âm lịch.
 *
 * Ngày 30 ở tháng thiếu (29 ngày) lùi về ngày 29 — "30 Tết" năm tháng Chạp
 * thiếu là ngày 29, không phải mùng 1 tháng sau.
 */
export function lunarToSolar(day: number, month: number, year: number, leap = false): SolarDate | null {
  const start = lunarMonthStart(month, year, leap);
  if (start === null) return null;
  const nextStart = newMoonDay(INT(0.5 + (start - 2415021.076998695) / 29.530588853) + 1);
  const monthLength = nextStart - start;
  return jdToDate(start + Math.min(day, monthLength) - 1);
}

/** Ngày âm lịch của một ngày dương lịch. */
export function solarToLunar(day: number, month: number, year: number): LunarDate {
  const dayNumber = jdFromDate(day, month, year);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = newMoonDay(k + 1);
  if (monthStart > dayNumber) monthStart = newMoonDay(k);
  let a11 = lunarMonth11(year);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = year;
    a11 = lunarMonth11(year - 1);
  } else {
    lunarYear = year + 1;
    b11 = lunarMonth11(year + 1);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let leap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapDiff = leapMonthOffset(a11);
    if (diff >= leapDiff) {
      lunarMonth = diff + 10;
      if (diff === leapDiff) leap = true;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap };
}
