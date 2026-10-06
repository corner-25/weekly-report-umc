/**
 * Danh mục hợp tác (MOU) nhìn từ góc lãnh đạo: MOU nào đang thật sự được triển
 * khai, MOU nào ký xong để đó, MOU nào sắp hết hạn cần quyết định gia hạn, MOU
 * nào đang chờ ký, hồ sơ nào còn thiếu — và mỗi phòng đầu mối đang giữ bao nhiêu.
 * Hàm thuần: API trả các dòng nhẹ, trang tính tại chỗ (vài trăm MOU là cùng).
 */

/** Còn ≤ ngần này ngày đến ngày hết hạn là "sắp hết hạn" — đủ thời gian đánh giá và làm thủ tục gia hạn. */
export const EXPIRING_DAYS = 90;
/** Ký quá ngần này tháng mà chưa có hoạt động/tiến độ nào là "ký rồi để đó". */
export const DORMANT_MONTHS = 6;
/** Chờ ký quá ngần này ngày thì đánh dấu chậm. */
export const PENDING_SLOW_DAYS = 60;

const DAY_MS = 86_400_000;

export interface MouRow {
  id: string;
  title: string;
  partnerName: string;
  partnerCountry: string | null;
  category: string;
  status: string;
  externalStatus: string | null;
  cooperationField: string | null;
  departmentId: string | null;
  departmentName: string | null;
  contactPerson: string | null;
  signedDate: string | null;
  expiryDate: string | null;
  /** % tiến độ: trung bình các hạng mục nếu có, không thì % ghi trên office. */
  progress: number | null;
  clauseCount: number;
  documentCount: number;
  activityCount: number;
  /** Lần gần nhất có tin triển khai: nhật ký tiến độ, hoạt động, tiến độ hạng mục. */
  lastActivityAt: string | null;
  updatedAt: string;
  /** Đánh giá AI gợi ý và đánh giá người chốt (SUCCESS | ON_TRACK | AT_RISK | FAILED | TOO_EARLY). */
  aiVerdict?: string | null;
  evaluation?: string | null;
  /** Khía cạnh đã ký (từ văn bản) và mức triển khai từng khía cạnh. */
  aspects?: Array<{ type: string; status: string }>;
}

/** Vòng đời theo ngày hết hạn — không tin trạng thái lưu, vì "hiệu lực" lưu từ lúc ký không tự đổi. */
export type Lifecycle = 'PENDING' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'ENDED';
/** Mức triển khai thực tế. */
export type Stage = 'NONE' | 'STARTED' | 'DONE';

export interface MouView extends MouRow {
  lifecycle: Lifecycle;
  stage: Stage;
  daysToExpiry: number | null;
  monthsSinceSigned: number | null;
  dormant: boolean;
  missing: string[];
  scope: 'INTERNATIONAL' | 'DOMESTIC';
  partnerType: PartnerType;
  fields: string[];
  /** Đánh giá hiệu lực: người chốt, chưa chốt thì AI gợi ý. */
  verdict: string | null;
  verdictByPeople: boolean;
}

export const LIFECYCLE_LABELS: Record<Lifecycle, string> = {
  PENDING: 'Chờ ký',
  ACTIVE: 'Hiệu lực',
  EXPIRING: 'Sắp hết hạn',
  EXPIRED: 'Hết hạn',
  ENDED: 'Đã kết thúc',
};

export const STAGE_LABELS: Record<Stage, string> = {
  NONE: 'Chưa triển khai',
  STARTED: 'Đang triển khai',
  DONE: 'Đạt mục tiêu',
};

export type PartnerType = 'HOSPITAL' | 'ACADEMIC' | 'COMPANY' | 'GOVERNMENT' | 'NONPROFIT' | 'OTHER';
export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  HOSPITAL: 'Bệnh viện, phòng khám',
  ACADEMIC: 'Trường, viện nghiên cứu',
  COMPANY: 'Doanh nghiệp',
  GOVERNMENT: 'Cơ quan nhà nước',
  NONPROFIT: 'Tổ chức, quỹ, hội',
  OTHER: 'Khác',
};

/** Thứ tự quan trọng: "Công ty TNHH Bệnh viện …" là bệnh viện, "Trường ĐH …" là trường. */
const PARTNER_RULES: ReadonlyArray<[RegExp, PartnerType]> = [
  [/Bệnh viện|\bBV\b|Phòng khám|Viện tim|Hospital|Medic\b/i, 'HOSPITAL'],
  [/^Cục\b|Bộ Y tế|Sở Y tế|Ủy ban|UBND/i, 'GOVERNMENT'],
  [/Trường|Đại học|\bĐH\b|Học viện|Phân hiệu|University|Viện\b|Trung tâm|Centre|Center/i, 'ACADEMIC'],
  [/Quỹ|Hội\b|Tổ chức|Charit|Foundation|RAD-AID/i, 'NONPROFIT'],
  [/Công ty|Tập đoàn|Group|\bInc\b|LLC|Ltd|Corporation|Doanh nghiệp/i, 'COMPANY'],
];

export function partnerTypeOf(name: string): PartnerType {
  return PARTNER_RULES.find(([re]) => re.test(name))?.[1] ?? 'OTHER';
}

const dayStart = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

export function daysBetween(fromIso: string, now: Date): number {
  return Math.round((dayStart(new Date(fromIso)) - dayStart(now)) / DAY_MS);
}

export function lifecycleOf(row: Pick<MouRow, 'status' | 'expiryDate'>, now: Date): Lifecycle {
  if (row.status === 'DRAFT') return 'PENDING';
  if (row.status === 'TERMINATED') return 'ENDED';
  if (row.status === 'EXPIRED') return 'EXPIRED';
  if (!row.expiryDate) return 'ACTIVE';
  const days = daysBetween(row.expiryDate, now);
  if (days < 0) return 'EXPIRED';
  return days <= EXPIRING_DAYS ? 'EXPIRING' : 'ACTIVE';
}

export function stageOf(row: Pick<MouRow, 'progress' | 'activityCount' | 'lastActivityAt'>): Stage {
  if ((row.progress ?? 0) >= 100) return 'DONE';
  if ((row.progress ?? 0) > 0 || row.activityCount > 0) return 'STARTED';
  return 'NONE';
}

/** Hồ sơ thiếu gì để lãnh đạo theo dõi được. */
export function missingOf(row: MouRow, lifecycle: Lifecycle): string[] {
  const out: string[] = [];
  if (lifecycle !== 'ACTIVE' && lifecycle !== 'EXPIRING') return out;
  if (!row.expiryDate) out.push('Chưa ghi ngày hết hạn');
  if (row.documentCount === 0) out.push('Chưa có văn bản ký');
  if (!row.departmentId) out.push('Chưa có phòng đầu mối');
  if (!row.contactPerson) out.push('Chưa có người phụ trách');
  return out;
}

export function toView(row: MouRow, now: Date): MouView {
  const lifecycle = lifecycleOf(row, now);
  const stage = stageOf(row);
  const monthsSinceSigned = row.signedDate ? Math.floor(-daysBetween(row.signedDate, now) / 30.44) : null;
  const live = lifecycle === 'ACTIVE' || lifecycle === 'EXPIRING';
  return {
    ...row,
    lifecycle,
    stage,
    daysToExpiry: row.expiryDate ? daysBetween(row.expiryDate, now) : null,
    monthsSinceSigned,
    dormant: live && stage === 'NONE' && (monthsSinceSigned ?? 0) >= DORMANT_MONTHS,
    missing: missingOf(row, lifecycle),
    scope: row.category === 'INTERNATIONAL' || (row.partnerCountry && row.partnerCountry !== 'Việt Nam') ? 'INTERNATIONAL' : 'DOMESTIC',
    partnerType: partnerTypeOf(row.partnerName),
    verdict: row.evaluation ?? row.aiVerdict ?? null,
    verdictByPeople: Boolean(row.evaluation),
    fields: (row.cooperationField ?? '').split(/\s*;\s*/).map((f) => f.trim()).filter(Boolean),
  };
}

// ── Lọc danh sách ──

export const MOU_VIEWS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'live', label: 'Còn hiệu lực' },
  { key: 'dormant', label: 'Ký rồi chưa triển khai' },
  { key: 'decide', label: 'Cần quyết định gia hạn' },
  { key: 'pending', label: 'Chờ ký' },
  { key: 'incomplete', label: 'Hồ sơ thiếu' },
  { key: 'ended', label: 'Hết hạn, kết thúc' },
] as const;
export type MouViewKey = (typeof MOU_VIEWS)[number]['key'];

export const isLive = (v: MouView) => v.lifecycle === 'ACTIVE' || v.lifecycle === 'EXPIRING';
/** Sắp hết hạn, hoặc đã quá hạn mà vẫn ghi "đang xử lý" — chưa ai quyết gia hạn hay dừng. */
export const needsDecision = (v: MouView) => v.lifecycle === 'EXPIRING' || (v.lifecycle === 'EXPIRED' && v.status !== 'EXPIRED');

export function matchesView(v: MouView, view: MouViewKey): boolean {
  switch (view) {
    case 'live': return isLive(v);
    case 'dormant': return v.dormant;
    case 'decide': return needsDecision(v);
    case 'pending': return v.lifecycle === 'PENDING';
    case 'incomplete': return v.missing.length > 0;
    case 'ended': return v.lifecycle === 'EXPIRED' || v.lifecycle === 'ENDED';
    default: return true;
  }
}

export interface MouFilter {
  view: MouViewKey;
  q?: string;
  departmentId?: string;
  field?: string;
  scope?: '' | 'INTERNATIONAL' | 'DOMESTIC';
  partnerType?: string;
  stage?: string;
  verdict?: string;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

export function filterMous(views: MouView[], f: MouFilter): MouView[] {
  const q = f.q ? fold(f.q.trim()) : '';
  return views.filter(
    (v) =>
      matchesView(v, f.view) &&
      (!f.departmentId || (f.departmentId === 'none' ? !v.departmentId : v.departmentId === f.departmentId)) &&
      (!f.field || v.fields.includes(f.field)) &&
      (!f.scope || v.scope === f.scope) &&
      (!f.partnerType || v.partnerType === f.partnerType) &&
      (!f.stage || v.stage === f.stage) &&
      (!f.verdict || (f.verdict === 'none' ? !v.verdict : v.verdict === f.verdict)) &&
      (!q || fold(`${v.title} ${v.partnerName} ${v.cooperationField ?? ''} ${v.contactPerson ?? ''} ${v.departmentName ?? ''}`).includes(q)),
  );
}

export const MOU_SORTS = [
  { key: 'attention', label: 'Cần chú ý trước' },
  { key: 'expiry', label: 'Hết hạn sớm nhất' },
  { key: 'signed', label: 'Ký gần nhất' },
  { key: 'progress', label: 'Tiến độ thấp nhất' },
  { key: 'partner', label: 'Tên đối tác' },
] as const;
export type MouSortKey = (typeof MOU_SORTS)[number]['key'];

/** Điểm cần chú ý: cần quyết định > để đó > thiếu hồ sơ > chờ ký > còn lại. */
export function attentionScore(v: MouView): number {
  if (needsDecision(v)) return 4;
  if (v.dormant) return 3;
  if (v.missing.length && isLive(v)) return 2;
  if (v.lifecycle === 'PENDING') return 1;
  return 0;
}

const time = (iso: string | null, empty: number) => (iso ? new Date(iso).getTime() : empty);

export function sortMous(views: MouView[], key: MouSortKey): MouView[] {
  const byName = (a: MouView, b: MouView) => a.partnerName.localeCompare(b.partnerName, 'vi');
  const cmp: Record<MouSortKey, (a: MouView, b: MouView) => number> = {
    attention: (a, b) => attentionScore(b) - attentionScore(a) || time(a.expiryDate, Infinity) - time(b.expiryDate, Infinity) || byName(a, b),
    expiry: (a, b) => time(a.expiryDate, Infinity) - time(b.expiryDate, Infinity) || byName(a, b),
    signed: (a, b) => time(b.signedDate, -Infinity) - time(a.signedDate, -Infinity) || byName(a, b),
    progress: (a, b) => (a.progress ?? -1) - (b.progress ?? -1) || byName(a, b),
    partner: byName,
  };
  return [...views].sort(cmp[key]);
}

// ── Bảng điều hành ──

export interface DepartmentLine {
  id: string | null;
  name: string;
  live: number;
  started: number;
  dormant: number;
  decide: number;
  pending: number;
  avgProgress: number | null;
}

export interface Portfolio {
  kpi: {
    total: number;
    live: number;
    started: number;
    implementationRate: number | null;
    dormant: number;
    decide: number;
    expiring: number;
    expiredOpen: number;
    pending: number;
    pendingSlow: number;
    ended: number;
    international: number;
    countries: number;
    noTerm: number;
    incomplete: number;
    avgProgress: number | null;
    signedThisYear: number;
  };
  lifecycle: Array<{ key: Lifecycle; count: number }>;
  stages: Array<{ key: Stage; count: number }>;
  departments: DepartmentLine[];
  fields: Array<{ name: string; live: number; started: number }>;
  partnerTypes: Array<{ key: PartnerType; live: number }>;
  countries: Array<{ name: string; count: number }>;
  signedByYear: Array<{ year: number; domestic: number; international: number }>;
  expiryByYear: Array<{ label: string; count: number }>;
  lists: { decide: MouView[]; dormant: MouView[]; pending: MouView[]; incomplete: MouView[] };
  /** Hiệu quả: phân bố đánh giá (người chốt ưu tiên, chưa chốt lấy AI) của MOU đã ký. */
  verdicts: Array<{ key: string; total: number; byPeople: number }>;
  evaluatedCount: number;
  /** Khía cạnh đã ký theo loại: bao nhiêu đạt, đang làm, chưa làm. */
  aspectTypes: Array<{ type: string; total: number; completed: number; inProgress: number; mous: number }>;
  aspectTotals: { total: number; completed: number; inProgress: number; mousWithAspects: number };
}

export const VERDICT_ORDER = ['SUCCESS', 'ON_TRACK', 'AT_RISK', 'FAILED', 'TOO_EARLY'] as const;

const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
const countBy = <K extends string>(keys: readonly K[], views: MouView[], pick: (v: MouView) => K) =>
  keys.map((key) => ({ key, count: views.filter((v) => pick(v) === key).length }));

export function computePortfolio(views: MouView[], now: Date): Portfolio {
  const live = views.filter(isLive);
  const started = live.filter((v) => v.stage !== 'NONE');
  const pending = views.filter((v) => v.lifecycle === 'PENDING');
  const decide = views.filter(needsDecision);
  const year = now.getUTCFullYear();

  const deptMap = new Map<string, DepartmentLine>();
  for (const v of views) {
    const k = v.departmentId ?? 'none';
    const line = deptMap.get(k) ?? { id: v.departmentId, name: v.departmentName ?? 'Chưa có phòng đầu mối', live: 0, started: 0, dormant: 0, decide: 0, pending: 0, avgProgress: null };
    if (isLive(v)) line.live += 1;
    if (isLive(v) && v.stage !== 'NONE') line.started += 1;
    if (v.dormant) line.dormant += 1;
    if (needsDecision(v)) line.decide += 1;
    if (v.lifecycle === 'PENDING') line.pending += 1;
    deptMap.set(k, line);
  }
  const departments = [...deptMap.entries()]
    .map(([k, line]) => ({ ...line, avgProgress: avg(live.filter((v) => (v.departmentId ?? 'none') === k && v.progress !== null).map((v) => v.progress!)) }))
    .filter((d) => d.live + d.pending + d.decide > 0)
    .sort((a, b) => b.live - a.live || b.pending - a.pending || a.name.localeCompare(b.name, 'vi'));

  const fieldMap = new Map<string, { live: number; started: number }>();
  for (const v of live) {
    for (const f of v.fields.length ? v.fields : ['Chưa phân loại']) {
      const e = fieldMap.get(f) ?? { live: 0, started: 0 };
      fieldMap.set(f, { live: e.live + 1, started: e.started + (v.stage !== 'NONE' ? 1 : 0) });
    }
  }

  const countryMap = new Map<string, number>();
  for (const v of live.filter((x) => x.scope === 'INTERNATIONAL')) {
    const c = v.partnerCountry && v.partnerCountry !== 'Việt Nam' ? v.partnerCountry : 'Nước ngoài';
    countryMap.set(c, (countryMap.get(c) ?? 0) + 1);
  }

  const signedYears = views.filter((v) => v.signedDate && v.lifecycle !== 'PENDING').map((v) => new Date(v.signedDate!).getUTCFullYear());
  const firstYear = Math.max(Math.min(year, ...signedYears), year - 7);
  const signedByYear = Array.from({ length: year - firstYear + 1 }, (_, i) => {
    const y = firstYear + i;
    const inYear = views.filter((v) => v.signedDate && v.lifecycle !== 'PENDING' && new Date(v.signedDate).getUTCFullYear() === y);
    return { year: y, domestic: inYear.filter((v) => v.scope === 'DOMESTIC').length, international: inYear.filter((v) => v.scope === 'INTERNATIONAL').length };
  });

  const expiryByYear = [
    ...Array.from({ length: 4 }, (_, i) => {
      const y = year + i;
      return { label: i === 3 ? `${y}+` : String(y), count: live.filter((v) => v.expiryDate && (i === 3 ? new Date(v.expiryDate).getUTCFullYear() >= y : new Date(v.expiryDate).getUTCFullYear() === y)).length };
    }),
    { label: 'Không thời hạn', count: live.filter((v) => !v.expiryDate).length },
  ];

  const signedViews = views.filter((v) => v.lifecycle !== 'PENDING');
  const verdicts = VERDICT_ORDER.map((key) => ({
    key,
    total: signedViews.filter((v) => v.verdict === key).length,
    byPeople: signedViews.filter((v) => v.verdict === key && v.verdictByPeople).length,
  }));
  const typeMap = new Map<string, { total: number; completed: number; inProgress: number; mous: Set<string> }>();
  for (const v of signedViews) {
    for (const a of v.aspects ?? []) {
      const e = typeMap.get(a.type) ?? { total: 0, completed: 0, inProgress: 0, mous: new Set<string>() };
      e.total += 1;
      if (a.status === 'COMPLETED') e.completed += 1;
      if (a.status === 'IN_PROGRESS') e.inProgress += 1;
      e.mous.add(v.id);
      typeMap.set(a.type, e);
    }
  }
  const aspectTypes = [...typeMap.entries()]
    .map(([type, e]) => ({ type, total: e.total, completed: e.completed, inProgress: e.inProgress, mous: e.mous.size }))
    .sort((a, b) => b.total - a.total);

  const bySigned = (a: MouView, b: MouView) => time(a.signedDate, Infinity) - time(b.signedDate, Infinity);
  return {
    kpi: {
      total: views.length,
      live: live.length,
      started: started.length,
      implementationRate: live.length ? Math.round((started.length / live.length) * 100) : null,
      dormant: views.filter((v) => v.dormant).length,
      decide: decide.length,
      expiring: views.filter((v) => v.lifecycle === 'EXPIRING').length,
      expiredOpen: decide.filter((v) => v.lifecycle === 'EXPIRED').length,
      pending: pending.length,
      pendingSlow: pending.filter((v) => v.signedDate && -daysBetween(v.signedDate, now) > PENDING_SLOW_DAYS).length,
      ended: views.filter((v) => v.lifecycle === 'EXPIRED' || v.lifecycle === 'ENDED').length,
      international: live.filter((v) => v.scope === 'INTERNATIONAL').length,
      countries: [...countryMap.keys()].filter((c) => c !== 'Nước ngoài').length,
      noTerm: live.filter((v) => !v.expiryDate).length,
      incomplete: views.filter((v) => v.missing.length > 0).length,
      avgProgress: avg(live.filter((v) => v.progress !== null).map((v) => v.progress!)),
      signedThisYear: signedByYear.at(-1) ? signedByYear.at(-1)!.domestic + signedByYear.at(-1)!.international : 0,
    },
    lifecycle: countBy(['ACTIVE', 'EXPIRING', 'PENDING', 'EXPIRED', 'ENDED'] as const, views, (v) => v.lifecycle),
    stages: countBy(['NONE', 'STARTED', 'DONE'] as const, live, (v) => v.stage),
    departments,
    fields: [...fieldMap.entries()].map(([name, e]) => ({ name, ...e })).sort((a, b) => b.live - a.live),
    partnerTypes: (Object.keys(PARTNER_TYPE_LABELS) as PartnerType[])
      .map((key) => ({ key, live: live.filter((v) => v.partnerType === key).length }))
      .filter((p) => p.live > 0)
      .sort((a, b) => b.live - a.live),
    countries: [...countryMap.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    signedByYear,
    expiryByYear,
    verdicts,
    evaluatedCount: signedViews.filter((v) => v.verdictByPeople).length,
    aspectTypes,
    aspectTotals: {
      total: aspectTypes.reduce((s, a) => s + a.total, 0),
      completed: aspectTypes.reduce((s, a) => s + a.completed, 0),
      inProgress: aspectTypes.reduce((s, a) => s + a.inProgress, 0),
      mousWithAspects: signedViews.filter((v) => (v.aspects ?? []).length > 0).length,
    },
    lists: {
      decide: [...decide].sort((a, b) => time(a.expiryDate, Infinity) - time(b.expiryDate, Infinity)),
      dormant: views.filter((v) => v.dormant).sort(bySigned),
      pending: [...pending].sort(bySigned),
      incomplete: views.filter((v) => v.missing.length > 0 && isLive(v)).sort((a, b) => b.missing.length - a.missing.length),
    },
  };
}
