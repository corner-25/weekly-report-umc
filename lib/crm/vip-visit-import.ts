/**
 * Chuẩn hoá danh sách khách khám chữa bệnh (khách VIP Phòng HC dẫn khám) trước
 * khi nạp vào CRM: một người một hồ sơ (gộp theo mã hồ sơ bệnh án và tên + ngày
 * sinh, chịu được lỗi gõ), một buổi dẫn khám một lượt (gộp các chuyên khoa cùng
 * ngày), tên người giới thiệu, chuyên khoa, hẹn tái khám về một cách viết.
 * Hàm thuần — ghi DB ở prisma/import-crm-khach-kcb.ts.
 */
import { toSearchKey } from './constants';

export interface RawVisitRow {
  row: number;
  stt: string | null;
  date: string | null;
  fullName: string | null;
  birthDate: string | null;
  address: string | null;
  phone: string | null;
  referrer: string | null;
  position: string | null;
  workplace: string | null;
  recordNo: string | null;
  specialty: string | null;
  doctor: string | null;
  diagnosis: string | null;
  services: string | null;
  newVisit: string | null;
  revisit: string | null;
  followUp: string | null;
  note: string | null;
  session: string | null;
  extraNote: string | null;
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

// ── Ngày ──

/** "2026-01-05", "22/012026", " 11/03/2026", "11/04//2026", "2207/2026" → YYYY-MM-DD. */
export function parseDate(value: string | null): string | null {
  const v = clean(value);
  if (!v) return null;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const digits = v.replace(/[^\d]/g, '');
  const dmy = v.match(/^(\d{1,2})\s*\/+\s*(\d{1,2})\s*\/+\s*(\d{4})$/);
  const [d, m, y] = dmy ? [dmy[1], dmy[2], dmy[3]] : digits.length === 8 ? [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)] : [];
  if (!d) return null;
  const day = Number(d);
  const month = Number(m);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Ngày sinh; ghi thiếu năm ("22/12/198") vẫn giữ ngày/tháng để chúc mừng sinh nhật. */
export function parseBirth(value: string | null): { day: number | null; month: number | null; year: number | null; incomplete: boolean } {
  const full = parseDate(value);
  if (full) {
    const [y, m, d] = full.split('-').map(Number);
    return { day: d, month: m, year: y, incomplete: false };
  }
  const part = clean(value).match(/^(\d{1,2})\/(\d{1,2})\//);
  if (part) return { day: Number(part[1]), month: Number(part[2]), year: null, incomplete: true };
  return { day: null, month: null, year: null, incomplete: Boolean(clean(value)) };
}

// ── Mã hồ sơ, điện thoại ──

/** "N220087844" → "N22-0087844"; mã viết hoa, bỏ khoảng trắng. */
export function normalizeRecordNo(value: string | null): string | null {
  const v = clean(value).toUpperCase().replace(/\s/g, '');
  if (!v || /^[A-Z]\d{2}-?$/.test(v)) return null;
  const m = v.match(/^([A-Z])(\d{2})-?(\d+)$/);
  return m ? `${m[1]}${m[2]}-${m[3]}` : v;
}

const RECORD_FORMAT = /^[A-Z]\d{2}-\d{7}$/;

export function normalizePhone(value: string | null): string | null {
  const digits = clean(value).replace(/[^\d+]/g, '');
  return /^(\+?84|0)\d{8,10}$/.test(digits) ? digits : null;
}

// ── Người giới thiệu, chuyên khoa, hẹn tái khám ──

/** Học hàm, học vị đứng trước tên. */
const TITLE = /^((GS|PGS|TS|ThS|Ths|BS|BSCKI{1,2}|CKI{1,2}|ThS\.|TS\.|BS\.)\.?\s+)+/i;
/** Danh xưng chuẩn cho người giới thiệu thường gặp (chọn theo cách ghi phổ biến nhất trong file). */
const REFERRER_TITLES: Record<string, string> = {
  'nguyen hoang bac': 'PGS Nguyễn Hoàng Bắc',
  'nguyen thi ngoc dieu': 'ThS Nguyễn Thị Ngọc Diệu',
  'tran diep tuan': 'GS Trần Diệp Tuấn',
  'nguyen minh anh': 'PGS Nguyễn Minh Anh',
  'nguyen hoang dinh': 'GS Nguyễn Hoàng Định',
  'truong quang binh': 'GS Trương Quang Bình',
  'vo tan son': 'PGS Võ Tấn Sơn',
  'pham van tan': 'TS Phạm Văn Tấn',
  'nguyen quang duy': 'ThS Nguyễn Quang Duy',
  'tran thanh hung': 'BSCKII Trần Thanh Hưng',
  'le khac bao': 'PGS Lê Khắc Bảo',
  'dang van phuoc': 'GS Đặng Vạn Phước',
  'nguyen thi hong tuoi': 'TS Nguyễn Thị Hồng Tươi',
  'nguyen thi nhu mai': 'Nguyễn Thị Như Mai',
};

/**
 * Người giới thiệu về một cách viết. Ô ghi nhầm địa chỉ, số điện thoại hay tên
 * chuyên khoa (dòng lệch cột) thì trả null và đánh dấu cần xem.
 */
export function normalizeReferrer(value: string | null, specialties: readonly string[] = []): { name: string | null; suspicious: boolean } {
  const v = clean(value);
  if (!v) return { name: null, suspicious: false };
  const looksWrong = /\d{3,}|phường|đường|p\.\s|quận/i.test(v) || specialties.some((s) => toSearchKey(s) === toSearchKey(v));
  if (looksWrong) return { name: null, suspicious: true };
  const bare = v.replace(TITLE, '').trim();
  const known = REFERRER_TITLES[toSearchKey(bare)];
  return { name: known ?? v.replace(/^Ths\b/, 'ThS').replace(/^ThS\.\s*/, 'ThS '), suspicious: false };
}

/** Chuyên khoa: sửa lỗi gõ, gộp cách viết tắt về tên đầy đủ. */
const SPECIALTY_MAP: Array<[RegExp, string]> = [
  [/^tim mach$/, 'Tim mạch'],
  [/^ngoai than kinh$/, 'Ngoại thần kinh'],
  [/^hen( ?-? ?copd)?$/, 'Hen - COPD'],
  [/^pa?r?kinson( (&|va) rlvd)?$/, 'Parkinson & RLVĐ'],
  [/^ung buou$/, 'Ung bướu'],
  [/^(pt ?-? ?rhm|pthm ?- ?rhm|phau thuat ham mat ?- ?rhm)$/, 'Phẫu thuật hàm mặt - RHM'],
  [/^(ubgmgg|ubtgmgg|ung buou gan mat( ghep gan)?)$/, 'Ung bướu gan mật - Ghép gan'],
  [/^(lnmm|long nguc mach mau)$/, 'Lồng ngực - Mạch máu'],
  [/^(phcn|phuc hoi chuc nang)$/, 'Phục hồi chức năng'],
  [/^san ?-? ?phu khoa$/, 'Sản phụ khoa'],
  [/^(tai mui (hong)|tmh)$/, 'Tai mũi họng'],
  [/^n[oô]i? ?ti[eé]t$|^noi tiet$/, 'Nội tiết'],
  [/^th[aâ]m my da$/, 'Thẩm mỹ da'],
  [/^(vu|tuyen vu)$/, 'Tuyến vú'],
  [/^hinh anh hoc can thiep$/, 'Hình ảnh học can thiệp'],
  [/^(tiem chung|tiem ngua)$/, 'Tiêm chủng'],
  [/^(hau mon hoc|hau mon truc trang)$/, 'Hậu môn - Trực tràng'],
  [/^(chuyen gia - )?tieu hoa gan mat$/, 'Tiêu hóa gan mật'],
  [/^than kinh chuyen (sau|gia)$/, 'Thần kinh chuyên sâu'],
];

export function normalizeSpecialty(value: string | null): string | null {
  const v = clean(value);
  if (!v) return null;
  const key = toSearchKey(v).replace(/\s+/g, ' ');
  const hit = SPECIALTY_MAP.find(([re]) => re.test(key));
  if (hit) return hit[1];
  // Chữ hoa lẫn giữa từ ("PhỤc hồi") thì viết lại thường; còn lại giữ nguyên cách ghi.
  const fixed = /\p{Ll}\p{Lu}/u.test(v) ? v.toLowerCase() : v;
  return fixed.charAt(0).toUpperCase() + fixed.slice(1);
}

export interface FollowUp {
  date: string | null;
  text: string | null;
}

/** Hẹn tái khám: ngày cụ thể, hoặc ghi chú chuẩn (Toa không thuốc, Nhập viện, Không tái khám…). */
export function normalizeFollowUp(value: string | null): FollowUp {
  const v = clean(value);
  if (!v) return { date: null, text: null };
  const date = parseDate(v);
  if (date) return { date, text: null };
  const k = toSearchKey(v);
  const text =
    /toa (khong|ko) t?h?uoc/.test(k) ? 'Toa không thuốc'
    : /cap cuu/.test(k) ? 'Nhập cấp cứu'
    : /tu van nhap vien/.test(k) ? 'Tư vấn nhập viện'
    : /nhap vien/.test(k) ? 'Nhập viện'
    : /(khong|ko) tai kham/.test(k) ? 'Không tái khám'
    : /phau thuat/.test(k) ? 'Phẫu thuật'
    : /6 thang ?- ?1 nam/.test(k) ? 'Tái khám sau 6 tháng - 1 năm'
    : /6 thang/.test(k) ? 'Tái khám sau 6 tháng'
    : /sau 1 nam/.test(k) ? 'Tái khám sau 1 năm'
    : v.charAt(0).toUpperCase() + v.slice(1);
  return { date: null, text };
}

/**
 * "Xét nghiệm máu/ Siêu âm bụng\n- CT ngực/bụng" → ["Xét nghiệm máu", "Siêu âm bụng", "CT ngực/bụng"].
 * Gạch chéo có khoảng trắng là ngăn dịch vụ; dính liền ("ngực/bụng") là một dịch vụ nhiều vùng.
 */
export function splitServices(value: string | null): string[] {
  const parts = (value ?? '')
    .split(/[\n;,]|\s\/|\/\s|(?:^|\s)-\s/)
    .map((s) => s.replace(/^[-•+\s]+/, '').trim())
    .filter((s) => s.length > 1);
  const seen = new Set<string>();
  return parts
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .filter((s) => {
      const k = toSearchKey(s);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

export function normalizeSession(value: string | null): string | null {
  const k = toSearchKey(clean(value));
  if (!k) return null;
  if (/sang.*chieu|sang\/chieu/.test(k)) return 'Sáng - chiều';
  if (/^s[aâ]ng$|^sang$/.test(k)) return 'Sáng';
  if (/chieu/.test(k)) return 'Chiều';
  return clean(value);
}

// ── Gộp người và buổi khám ──

export interface Patient {
  key: string;
  fullName: string;
  birth: ReturnType<typeof parseBirth>;
  phone: string | null;
  address: string | null;
  recordNo: string | null;
  notes: string[];
  rows: number[];
  /** Mã hồ sơ, tên có nhiều cách ghi — đã chọn một, cần người xem lại. */
  variants: string[];
}

export interface VisitItem {
  specialty: string | null;
  doctor: string | null;
  diagnosis: string | null;
  services: string[];
  followUp: FollowUp;
}

export interface Visit {
  externalCode: string;
  patientKey: string;
  date: string;
  session: string | null;
  referrer: string | null;
  visitKind: 'Khám mới' | 'Tái khám' | null;
  items: VisitItem[];
  note: string | null;
  needsReview: boolean;
  reviewNotes: string[];
  rows: number[];
}

/** Số dấu tiếng Việt trong tên — giữa hai cách ghi, chọn cách có dấu đầy đủ hơn. */
const accentScore = (s: string) => s.normalize('NFD').replace(/[^̀-ͯ]/g, '').length;

function pickName(names: string[]): string {
  const count = new Map<string, number>();
  for (const n of names) count.set(n, (count.get(n) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => accentScore(b[0]) - accentScore(a[0]) || b[1] - a[1])[0][0];
}

function pickRecord(records: string[]): string | null {
  if (!records.length) return null;
  const count = new Map<string, number>();
  for (const r of records) count.set(r, (count.get(r) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => Number(RECORD_FORMAT.test(b[0])) - Number(RECORD_FORMAT.test(a[0])) || b[1] - a[1])[0][0];
}

/**
 * Gộp dòng thành người (cùng mã hồ sơ, hoặc cùng tên không dấu + ngày sinh) và buổi
 * khám (cùng người, cùng ngày). Dòng thiếu ngày lấy ngày của dòng phía trên (file ghi
 * dòng tiếp theo của cùng buổi khám không lặp ngày).
 */
export function buildVisits(rows: RawVisitRow[]): { patients: Patient[]; visits: Visit[]; skipped: Array<{ row: number; reason: string }> } {
  const skipped: Array<{ row: number; reason: string }> = [];
  const specialties = rows.map((r) => r.specialty ?? '').filter(Boolean);

  // Union-find gộp dòng cùng một người.
  const parent = rows.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => { parent[find(a)] = find(b); };
  const byRecord = new Map<string, number>();
  const byNameDob = new Map<string, number>();
  rows.forEach((r, i) => {
    const rec = normalizeRecordNo(r.recordNo);
    const nameKey = `${toSearchKey(clean(r.fullName))}|${clean(r.birthDate)}`;
    if (rec) {
      if (byRecord.has(rec)) union(i, byRecord.get(rec)!);
      else byRecord.set(rec, i);
    }
    if (clean(r.fullName) && clean(r.birthDate)) {
      if (byNameDob.has(nameKey)) union(i, byNameDob.get(nameKey)!);
      else byNameDob.set(nameKey, i);
    }
  });

  const groups = new Map<number, number[]>();
  rows.forEach((r, i) => {
    if (!clean(r.fullName)) {
      skipped.push({ row: r.row, reason: 'Không có tên khách' });
      return;
    }
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), i]);
  });

  const patients: Patient[] = [];
  const patientOf = new Map<number, Patient>();
  for (const idx of groups.values()) {
    const rs = idx.map((i) => rows[i]);
    const names = rs.map((r) => clean(r.fullName));
    const records = rs.map((r) => normalizeRecordNo(r.recordNo)).filter((x): x is string => Boolean(x));
    const recordNo = pickRecord(records);
    const fullName = pickName(names);
    const births = rs.map((r) => parseBirth(r.birthDate));
    const birth = births.find((b) => !b.incomplete && b.year) ?? births.find((b) => b.day) ?? births[0];
    const notes = [...new Set(rs.flatMap((r) => [clean(r.extraNote)]).filter(Boolean))];
    const variants = [
      ...new Set(names.filter((n) => n !== fullName)).values(),
      ...new Set(records.filter((r) => r !== recordNo)).values(),
    ];
    const p: Patient = {
      key: recordNo ?? `${toSearchKey(fullName)}|${birth.year ?? ''}-${birth.month ?? ''}-${birth.day ?? ''}`,
      fullName,
      birth,
      phone: rs.map((r) => normalizePhone(r.phone)).find(Boolean) ?? null,
      address: rs.map((r) => clean(r.address)).find((a) => a && !/^\d+$/.test(a)) ?? null,
      recordNo,
      notes,
      rows: rs.map((r) => r.row),
      variants: [...new Set(variants)],
    };
    patients.push(p);
    for (const i of idx) patientOf.set(i, p);
  }

  // Buổi khám: ngày lấy theo dòng, thiếu thì kế thừa dòng trên.
  const visitMap = new Map<string, Visit>();
  let lastDate: string | null = null;
  rows.forEach((r, i) => {
    const own = parseDate(r.date);
    const date = own ?? lastDate;
    if (own) lastDate = own;
    const p = patientOf.get(i);
    if (!p) return;
    if (!date) {
      skipped.push({ row: r.row, reason: 'Không xác định được ngày khám' });
      return;
    }
    const key = `${p.key}|${date}`;
    const ref = normalizeReferrer(r.referrer, specialties);
    const v: Visit =
      visitMap.get(key) ?? {
        externalCode: `KCB:${p.key}:${date}`,
        patientKey: p.key,
        date,
        session: null,
        referrer: null,
        visitKind: null,
        items: [],
        note: null,
        needsReview: false,
        reviewNotes: [],
        rows: [],
      };
    v.rows.push(r.row);
    v.session ??= normalizeSession(r.session);
    v.referrer ??= ref.name;
    v.visitKind ??= r.newVisit ? 'Khám mới' : r.revisit ? 'Tái khám' : null;
    if (ref.suspicious) {
      v.needsReview = true;
      v.reviewNotes.push(`Dòng ${r.row}: cột người giới thiệu ghi "${clean(r.referrer)}" (lệch cột?)`);
    }
    if (!own && clean(r.date)) {
      v.needsReview = true;
      v.reviewNotes.push(`Dòng ${r.row}: ngày "${clean(r.date)}" không đọc được`);
    }
    const note = clean(r.note);
    if (note && !parseDate(note)) v.note = [v.note, note].filter(Boolean).join('; ');
    const item: VisitItem = {
      specialty: normalizeSpecialty(r.specialty),
      doctor: clean(r.doctor) || null,
      diagnosis: clean(r.diagnosis) || null,
      services: splitServices(r.services),
      followUp: normalizeFollowUp(r.followUp),
    };
    if (item.specialty || item.doctor || item.diagnosis || item.services.length) v.items.push(item);
    visitMap.set(key, v);
  });

  for (const p of patients) {
    if (p.birth.incomplete) {
      const v = [...visitMap.values()].find((x) => x.patientKey === p.key);
      if (v) {
        v.needsReview = true;
        v.reviewNotes.push(`Ngày sinh của ${p.fullName} ghi thiếu năm`);
      }
    }
  }
  return { patients, visits: [...visitMap.values()].sort((a, b) => a.date.localeCompare(b.date)), skipped };
}
