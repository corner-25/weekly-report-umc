/**
 * Gom mọi đoạn văn tự do trong hệ thống thành "đoạn tri thức" cho chatbot. Mỗi
 * đoạn mang theo phòng ban, đơn vị/tổ chức, ngày, tuần và đường dẫn — để câu trả
 * lời nối được các phân hệ với nhau (vd đoàn khách → tổ chức → báo cáo tuần cùng tuần).
 */
import type { PrismaClient } from '@prisma/client';
import { INTERACTION_STATUS_LABELS, INTERACTION_TYPE_LABELS } from '@/lib/crm/constants';
import { WORK_STATUS_LABELS } from '@/lib/work/constants';
import { summaryContentSchema } from '@/lib/weekly-summary/types';
import { departmentProfiles, organizationProfiles } from './profiles';

export interface KnowledgeDoc {
  id: string;
  source: KnowledgeSource;
  refId: string;
  title: string;
  body: string;
  department?: string | null;
  organization?: string | null;
  occurredOn?: Date | null;
  year?: number | null;
  week?: number | null;
  href?: string | null;
}

export const KNOWLEDGE_SOURCES = {
  weekly_report: 'Báo cáo tuần các phòng',
  weekly_summary: 'Báo cáo tóm tắt tuần',
  crm: 'Tiếp đón, tiếp đoàn (CRM)',
  work_item: 'Công việc chỉ đạo của BGĐ',
  work_update: 'Cập nhật tiến độ công việc',
  event: 'Sự kiện bệnh viện',
  mou: 'Hợp tác, ký kết MOU',
  crm_org: 'Hồ sơ đối tác (CRM)',
  department_profile: 'Hồ sơ phòng ban',
} as const;
export type KnowledgeSource = keyof typeof KNOWLEDGE_SOURCES;

/** Báo cáo tuần dài: cắt đoạn để một đoạn không vượt quá ngần này ký tự. */
const MAX_BODY = 1800;
const clean = (s: string | null | undefined) => (s ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
const vnDate = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10).split('-').reverse().join('/');

function split(body: string): string[] {
  if (body.length <= MAX_BODY) return [body];
  const parts: string[] = [];
  let rest = body;
  while (rest.length > MAX_BODY) {
    const cut = Math.max(rest.lastIndexOf('\n', MAX_BODY), rest.lastIndexOf('. ', MAX_BODY), MAX_BODY / 2);
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

function withParts(doc: KnowledgeDoc): KnowledgeDoc[] {
  const parts = split(doc.body);
  return parts.map((body, i) => ({ ...doc, id: parts.length > 1 ? `${doc.id}:${i + 1}` : doc.id, body }));
}

async function weeklyReports(db: PrismaClient): Promise<KnowledgeDoc[]> {
  const [entries, departments, weeks] = await Promise.all([
    db.taskThreadEntry.findMany({ select: { id: true, departmentId: true, year: true, week: true, rawName: true, parentGroup: true, resultText: true, nextWeekPlan: true, progress: true } }),
    db.department.findMany({ select: { id: true, name: true } }),
    db.week.findMany({ select: { id: true, year: true, weekNumber: true, endDate: true } }),
  ]);
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const weekOf = new Map(weeks.map((w) => [`${w.year}-${w.weekNumber}`, w]));
  return entries.flatMap((e) => {
    const result = clean(e.resultText);
    const plan = clean(e.nextWeekPlan);
    if (!result && !plan) return [];
    const w = weekOf.get(`${e.year}-${e.week}`);
    const dept = deptName.get(e.departmentId) ?? null;
    return withParts({
      id: `weekly_report:${e.id}`,
      source: 'weekly_report',
      refId: e.id,
      title: `Báo cáo tuần ${e.week}/${e.year} — ${dept ?? 'Không rõ phòng'} — ${(clean(e.rawName) || clean(e.parentGroup) || 'Nhiệm vụ').slice(0, 160)}`,
      body: [
        e.parentGroup && `Nhóm: ${clean(e.parentGroup)}`,
        `${dept ?? 'Phòng'} — nhiệm vụ: ${clean(e.rawName) || clean(e.parentGroup) || 'không ghi tên'}${e.progress !== null ? ` (${e.progress}%)` : ''}`,
        result && `Kết quả: ${result}`,
        plan && `Kế hoạch tuần sau: ${plan}`,
      ].filter(Boolean).join('\n'),
      department: dept,
      occurredOn: w?.endDate ?? null,
      year: e.year,
      week: e.week,
      href: w ? `/dashboard/weeks/${w.id}` : '/dashboard/weeks',
    });
  });
}

async function weeklySummaries(db: PrismaClient): Promise<KnowledgeDoc[]> {
  const rows = await db.weeklySummary.findMany({ select: { id: true, weekId: true, content: true, week: { select: { year: true, weekNumber: true, endDate: true } } } });
  return rows.flatMap((r) => {
    const parsed = summaryContentSchema.safeParse(r.content);
    if (!parsed.success) return [];
    const c = parsed.data;
    const docs: KnowledgeDoc[] = [];
    c.sections.forEach((s) =>
      s.items.forEach((item, i) => {
        if (item.type !== 'text') return;
        const body = [item.text, ...item.subItems].filter(Boolean).join('\n');
        if (!body) return;
        docs.push({
          id: `weekly_summary:${r.id}:${s.key}:${i}`,
          source: 'weekly_summary',
          refId: r.id,
          title: `Tóm tắt hoạt động BV tuần ${c.week}/${c.year} — ${item.label ?? s.heading}`,
          body,
          occurredOn: r.week.endDate,
          year: r.week.year,
          week: r.week.weekNumber,
          href: `/dashboard/weeks/${r.weekId}/summary`,
        });
      }),
    );
    if (c.plan.length) {
      docs.push({
        id: `weekly_summary:${r.id}:plan`,
        source: 'weekly_summary',
        refId: r.id,
        title: `Kế hoạch tuần ${c.week + 1}/${c.year} (báo cáo tóm tắt tuần ${c.week})`,
        body: c.plan.join('\n'),
        occurredOn: r.week.endDate,
        year: r.week.year,
        week: r.week.weekNumber,
        href: `/dashboard/weeks/${r.weekId}/summary`,
      });
    }
    return docs;
  });
}

async function crm(db: PrismaClient): Promise<KnowledgeDoc[]> {
  const rows = await db.crmInteraction.findMany({
    // Dẫn khách khám là thông tin sức khoẻ của người bệnh — chatbot chỉ thống kê qua v_chatbot_vip_escorts, không đọc từng lượt.
    where: { type: { not: 'VIP_ESCORT' } },
    include: {
      contact: { select: { fullName: true, academicTitle: true } },
      organization: { select: { id: true, name: true, aliases: true } },
      participants: { select: { contact: { select: { fullName: true } } } },
      hostDepartment: { select: { name: true } },
    },
  });
  return rows.flatMap((i) => {
    const when = i.dateUnknown ? 'chưa rõ ngày' : `${vnDate(i.occurredAt)}${i.endAt ? ` đến ${vnDate(i.endAt)}` : ''}`;
    const org = i.organization?.name ?? null;
    const body = [
      `${INTERACTION_TYPE_LABELS[i.type]} · ${INTERACTION_STATUS_LABELS[i.status]} · ${when}`,
      org && `Đơn vị: ${org}${i.organization?.aliases.length ? ` (tên khác: ${i.organization.aliases.join('; ')})` : ''}`,
      i.title && `Tên đoàn: ${clean(i.title)}`,
      i.purpose && `Hình thức: ${i.purpose}`,
      i.contact && `Khách chính: ${[i.contact.academicTitle, i.contact.fullName].filter(Boolean).join(' ')}`,
      i.participants.length > 0 && `Thành viên: ${i.participants.map((p) => p.contact.fullName).join(', ')}`,
      i.guestMembers && `Thành phần đoàn: ${clean(i.guestMembers)}`,
      i.hospitalAttendees && `Bệnh viện tiếp: ${clean(i.hospitalAttendees)}`,
      (i.hostDepartment?.name ?? i.hostUnit) && `Khoa/phòng chủ trì: ${i.hostDepartment?.name ?? i.hostUnit}`,
      `Nội dung: ${clean(i.content)}`,
      i.topics.length > 0 && `Chủ đề: ${i.topics.join('; ')}`,
      i.destination && `Địa điểm: ${clean(i.destination)}`,
      i.giftsGiven && `Quà Bệnh viện tặng: ${clean(i.giftsGiven)}`,
      i.giftsReceived && `Quà khách tặng: ${clean(i.giftsReceived)}`,
      i.note && `Ghi chú: ${clean(i.note)}`,
    ].filter(Boolean).join('\n');
    return withParts({
      id: `crm:${i.id}`,
      source: 'crm',
      refId: i.id,
      title: `${INTERACTION_TYPE_LABELS[i.type]} ${when}${org ? ` — ${org}` : ''}${i.title ? ` — ${clean(i.title).slice(0, 120)}` : ''}`,
      body,
      department: i.hostDepartment?.name ?? i.hostUnit,
      organization: org,
      occurredOn: i.dateUnknown ? null : i.occurredAt,
      year: new Date(i.occurredAt.getTime() + 7 * 3_600_000).getUTCFullYear(),
      href: i.organization ? `/dashboard/crm/organizations/${i.organization.id}` : '/dashboard/crm/interactions',
    });
  });
}

async function work(db: PrismaClient): Promise<KnowledgeDoc[]> {
  const items = await db.workItem.findMany({
    include: { department: { select: { name: true } }, updates: { orderBy: { occurredAt: 'asc' } } },
  });
  return items.flatMap((w) => {
    const unit = w.department?.name ?? w.leadUnit;
    const head: KnowledgeDoc = {
      id: `work_item:${w.id}`,
      source: 'work_item',
      refId: w.id,
      title: `Việc chỉ đạo: ${clean(w.title).slice(0, 200)}`,
      body: [
        `Công việc chỉ đạo của Ban Giám đốc · ${WORK_STATUS_LABELS[w.status]}${w.progressPercent !== null ? ` · ${w.progressPercent}%` : ''}`,
        `Tên việc: ${clean(w.title)}`,
        unit && `Đơn vị chủ trì: ${unit}`,
        w.directedBy && `Người chỉ đạo: ${w.directedBy}`,
        w.directedAt && `Ngày chỉ đạo: ${vnDate(w.directedAt)}`,
        w.dueDate && `Hạn: ${vnDate(w.dueDate)}`,
        w.completedAt && `Hoàn thành: ${vnDate(w.completedAt)}`,
        w.assignees.length > 0 && `Người thực hiện: ${w.assignees.join(', ')}`,
        w.description && `Mô tả: ${clean(w.description)}`,
      ].filter(Boolean).join('\n'),
      department: unit,
      occurredOn: w.directedAt,
      href: `/dashboard/work/items/${w.id}`,
    };
    const updates = w.updates.flatMap((u) =>
      withParts({
        id: `work_update:${u.id}`,
        source: 'work_update',
        refId: u.id,
        title: `Cập nhật ${vnDate(u.occurredAt)} — ${clean(w.title).slice(0, 160)}`,
        body: `Việc: ${clean(w.title)}\n${u.author ? `Người cập nhật: ${u.author}\n` : ''}${u.progressPercent !== null ? `Tiến độ: ${u.progressPercent}%\n` : ''}${clean(u.content)}`,
        department: unit,
        occurredOn: u.occurredAt,
        href: `/dashboard/work/items/${w.id}`,
      }),
    );
    return [...withParts(head), ...updates];
  });
}

async function events(db: PrismaClient): Promise<KnowledgeDoc[]> {
  const rows = await db.hospitalEvent.findMany({ where: { deletedAt: null }, include: { meetingRoom: { select: { name: true } } } });
  return rows.flatMap((e) =>
    withParts({
      id: `event:${e.id}`,
      source: 'event',
      refId: e.id,
      title: `Sự kiện ${vnDate(e.date)} — ${clean(e.name).slice(0, 200)}`,
      body: [
        `Sự kiện: ${clean(e.name)}`,
        `Ngày: ${vnDate(e.date)}${e.time ? ` lúc ${e.time}` : ''}`,
        e.meetingRoom && `Phòng: ${e.meetingRoom.name}`,
        e.chair && `Chủ trì: ${clean(e.chair)}`,
        e.participants && `Thành phần: ${clean(e.participants)}`,
        e.description && `Nội dung: ${clean(e.description)}`,
        e.note && `Ghi chú: ${clean(e.note)}`,
      ].filter(Boolean).join('\n'),
      occurredOn: e.date,
      href: `/dashboard/hospital-events/${e.id}`,
    }),
  );
}

async function mous(db: PrismaClient): Promise<KnowledgeDoc[]> {
  const rows = await db.mOU.findMany({
    where: { deletedAt: null },
    include: {
      department: { select: { name: true } },
      progressLogs: { orderBy: { date: 'asc' } },
      documents: { select: { title: true, documentType: true } },
      clauses: { orderBy: { orderNumber: 'asc' }, select: { title: true, clauseStatus: true, progress: true } },
    },
  });
  const CLAUSE_STATUS: Record<string, string> = { NOT_STARTED: 'chưa triển khai', IN_PROGRESS: 'đang triển khai', COMPLETED: 'đạt cam kết', ON_HOLD: 'tạm dừng', CANCELLED: 'đã huỷ' };
  const VERDICT: Record<string, string> = { SUCCESS: 'thành công', ON_TRACK: 'đang tiến triển', AT_RISK: 'có nguy cơ', FAILED: 'không hiệu quả', TOO_EARLY: 'mới ký, chưa đánh giá' };
  return rows.flatMap((m) =>
    withParts({
      id: `mou:${m.id}`,
      source: 'mou',
      refId: m.id,
      title: `Hợp tác: ${clean(m.title).slice(0, 200)}`,
      body: [
        `Thỏa thuận hợp tác (MOU) với ${clean(m.partnerName)}${m.partnerCountry ? ` (${m.partnerCountry})` : ''}${m.externalStatus ? ` · ${m.externalStatus}` : ''}${m.progressPercent !== null ? ` · ${m.progressPercent}%` : ''}`,
        m.cooperationField && `Lĩnh vực: ${m.cooperationField}`,
        m.signedDate && `Ngày ký: ${vnDate(m.signedDate)}`,
        m.expiryDate && `Hết hạn: ${vnDate(m.expiryDate)}`,
        m.department && `Phòng đầu mối: ${m.department.name}`,
        m.contactPerson && `Người phụ trách: ${m.contactPerson}`,
        m.purpose && `Nội dung hợp tác: ${clean(m.purpose)}`,
        m.notes && `Ghi chú: ${clean(m.notes)}`,
        ...m.clauses.map((c) => `Khía cạnh đã ký: ${c.title} — ${CLAUSE_STATUS[c.clauseStatus] ?? c.clauseStatus} (${c.progress}%)`),
        ...m.progressLogs.map((p) => `Tiến độ ${vnDate(p.date)}: ${clean(p.content)}`),
        m.evaluation && `Lãnh đạo đánh giá: ${VERDICT[m.evaluation] ?? m.evaluation}${m.evaluationNote ? ` — ${clean(m.evaluationNote)}` : ''}`,
        !m.evaluation && (m.assessment as { verdict?: string; rationale?: string } | null)?.verdict && `AI gợi ý đánh giá: ${VERDICT[(m.assessment as { verdict: string }).verdict] ?? ''} — ${(m.assessment as { rationale?: string }).rationale ?? ''}`,
        m.documents.length > 0 && `Văn bản: ${m.documents.map((d) => d.title).join('; ')}`,
      ].filter(Boolean).join('\n'),
      department: m.department?.name ?? null,
      organization: m.partnerName,
      occurredOn: m.signedDate,
      href: `/dashboard/mous?id=${m.id}`,
    }),
  );
}

/** Nguồn gom: đoạn tri thức của nguồn nào thì id bắt đầu bằng tiền tố nguồn đó. */
const COLLECTORS: Record<'weekly' | 'crm' | 'work' | 'event' | 'mou' | 'profile', (db: PrismaClient) => Promise<KnowledgeDoc[]>> = {
  weekly: async (db) => [...(await weeklyReports(db)), ...(await weeklySummaries(db))],
  crm,
  work,
  event: events,
  mou: mous,
  profile: async (db) => [...(await departmentProfiles(db)), ...(await organizationProfiles(db))],
};
export type KnowledgeGroup = keyof typeof COLLECTORS;
/** Tiền tố id của từng nhóm — để chỉ xoá đoạn cũ của đúng nhóm khi đồng bộ một phần. */
export const GROUP_SOURCES: Record<KnowledgeGroup, KnowledgeSource[]> = {
  weekly: ['weekly_report', 'weekly_summary'],
  crm: ['crm'],
  work: ['work_item', 'work_update'],
  event: ['event'],
  mou: ['mou'],
  profile: ['department_profile', 'crm_org'],
};

export async function collectKnowledge(db: PrismaClient, groups?: KnowledgeGroup[]): Promise<KnowledgeDoc[]> {
  const keys = groups ?? (Object.keys(COLLECTORS) as KnowledgeGroup[]);
  return (await Promise.all(keys.map((k) => COLLECTORS[k](db)))).flat();
}
