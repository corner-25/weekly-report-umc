/**
 * Gom mọi đoạn văn tự do trong hệ thống thành "đoạn tri thức" cho chatbot. Mỗi
 * đoạn mang theo phòng ban, đơn vị/tổ chức, ngày, tuần và đường dẫn — để câu trả
 * lời nối được các phân hệ với nhau (vd đoàn khách → tổ chức → báo cáo tuần cùng tuần).
 */
import type { PrismaClient } from '@prisma/client';
import { INTERACTION_STATUS_LABELS, INTERACTION_TYPE_LABELS } from '@/lib/crm/constants';
import { WORK_STATUS_LABELS } from '@/lib/work/constants';
import { summaryContentSchema } from '@/lib/weekly-summary/types';

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
      title: `Báo cáo tuần ${e.week}/${e.year} — ${dept ?? 'Không rõ phòng'} — ${clean(e.rawName).slice(0, 160)}`,
      body: [
        e.parentGroup && `Nhóm: ${clean(e.parentGroup)}`,
        `Nhiệm vụ: ${clean(e.rawName)}${e.progress !== null ? ` (${e.progress}%)` : ''}`,
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

export async function collectKnowledge(db: PrismaClient): Promise<KnowledgeDoc[]> {
  const groups = await Promise.all([weeklyReports(db), weeklySummaries(db), crm(db), work(db), events(db)]);
  return groups.flat();
}
