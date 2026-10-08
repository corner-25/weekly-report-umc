import { NextResponse } from 'next/server';
import type { CrmTier } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { upcomingOccurrences, todayInVietnam } from '@/lib/crm/upcoming';
import { reconcileWithExcel } from '@/lib/crm/reconcile';
import { budgetPeriods, careKey, MAX_REMIND_DAYS, remindDaysFor } from '@/lib/crm/care';
import {
  birthdaySource,
  careTaskInclude,
  handle,
  importantDateSource,
  interactionInclude,
  requireSession,
  toCareTaskDto,
  toInteractionDto,
  type DateSource, canSeeHealth
} from '@/lib/crm/server';

/** Không tương tác quá ngần này ngày thì đưa vào "Lâu chưa tương tác". */
const DORMANT_DAYS = 90;
/** Chỉ theo dõi độ "nguội" của đối tác hạng cao — hạng B, C ít liên lạc là bình thường. */
const DORMANT_TIERS: CrmTier[] = ['VIP', 'A'];
const MS_PER_DAY = 86_400_000;
/** Số tháng gần nhất đem đối chiếu với Excel báo cáo tuần. */
const RECONCILE_MONTHS = 3;

interface Target {
  type: 'contact' | 'organization';
  id: string;
  name: string;
  tier: CrmTier;
  subtitle: string | null;
}

/** Một dịp kèm hồ sơ sở hữu và số ngày nhắc chuẩn bị quà/hoa. */
type OverviewSource = DateSource & { id: string; target: Target; importantDateId: string | null; remindDays: number };

/** Tổng dự kiến và thực chi của việc quà/hoa chưa huỷ, theo ngày diễn ra của dịp. */
async function sumCare(range: { from: Date; to: Date }) {
  const { _sum } = await prisma.crmCareTask.aggregate({
    where: { status: { not: 'CANCELLED' }, occasionDate: { gte: range.from, lt: range.to } },
    _sum: { budget: true, actualCost: true },
  });
  return { budget: _sum.budget ?? 0, actualCost: _sum.actualCost ?? 0 };
}

export const GET = handle(async (request: Request) => {
  const health = canSeeHealth(await requireSession());
  const window = Math.min(Math.max(Number(new URL(request.url).searchParams.get('window') ?? 30) || 30, 1), 366);
  const today = todayInVietnam();
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00+07:00`);
  const todayStart = new Date(`${today}T00:00:00+07:00`);
  const windowEnd = new Date(todayStart.getTime() + (window + 1) * MS_PER_DAY);

  const periods = budgetPeriods(today);

  const [contacts, organizations, recent, counts, planned, overduePlanned, reconcile, careBudgetMonth, careBudgetYear, careOverdue] = await Promise.all([
    prisma.crmContact.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true, fullName: true, academicTitle: true, tier: true,
        birthDay: true, birthMonth: true, birthYear: true, birthIsLunar: true,
        importantDates: true,
        positions: {
          where: { isCurrent: true }, take: 1, orderBy: { createdAt: 'desc' },
          select: { title: true, organization: { select: { name: true } } },
        },
        interactions: { orderBy: { occurredAt: 'desc' }, take: 1, select: { occurredAt: true } },
        participations: {
          orderBy: { interaction: { occurredAt: 'desc' } }, take: 1,
          select: { interaction: { select: { occurredAt: true } } },
        },
      },
    }),
    prisma.crmOrganization.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, tier: true, importantDates: true,
        interactions: { orderBy: { occurredAt: 'desc' }, take: 1, select: { occurredAt: true } },
      },
    }),
    prisma.crmInteraction.findMany({
      where: { status: 'DONE' }, include: interactionInclude, orderBy: { occurredAt: 'desc' }, take: 10,
    }),
    Promise.all([
      prisma.crmContact.count(),
      prisma.crmOrganization.count(),
      // Chỉ tính lượt đã thực hiện: lịch hẹn và lượt huỷ chưa phải việc đã làm.
      prisma.crmInteraction.count({ where: { status: 'DONE', occurredAt: { gte: monthStart } } }),
      prisma.crmInteraction.count({ where: { status: 'DONE', occurredAt: { gte: monthStart }, type: 'VIP_ESCORT' } }),
      prisma.crmInteraction.count({ where: { status: 'DONE', occurredAt: { gte: monthStart }, type: 'DELEGATION' } }),
    ]),
    // Lịch hẹn dẫn khách/đoàn từ hôm nay trong cửa sổ.
    prisma.crmInteraction.findMany({
      where: { status: 'PLANNED', occurredAt: { gte: todayStart, lt: windowEnd } },
      include: interactionInclude,
      orderBy: { occurredAt: 'asc' },
      take: 50,
    }),
    // Lịch hẹn đã qua ngày mà chưa cập nhật kết quả — nhắc người dẫn đánh dấu xong/huỷ.
    prisma.crmInteraction.findMany({
      where: { status: 'PLANNED', occurredAt: { lt: todayStart } },
      include: interactionInclude,
      orderBy: { occurredAt: 'desc' },
      take: 50,
    }),
    reconcileWithExcel(prisma, today, RECONCILE_MONTHS),
    sumCare(periods.month),
    sumCare(periods.year),
    // Dịp đã qua mà quà/hoa còn "Cần làm"/"Đã đặt" — không còn trong danh sách tới hạn nên nhắc riêng.
    prisma.crmCareTask.findMany({
      where: { status: { in: ['TODO', 'ORDERED'] }, occasionDate: { lt: new Date(`${today}T00:00:00Z`) } },
      include: careTaskInclude,
      orderBy: { occasionDate: 'desc' },
      take: 50,
    }),
  ]);

  // Mọi dịp của mọi hồ sơ, kèm hồ sơ sở hữu để hiển thị.
  const sources: OverviewSource[] = [];
  for (const c of contacts) {
    const p = c.positions[0];
    const target: Target = {
      type: 'contact', id: c.id, tier: c.tier,
      name: [c.academicTitle, c.fullName].filter(Boolean).join(' '),
      subtitle: p ? [p.title, p.organization?.name].filter(Boolean).join(', ') || null : null,
    };
    const birthday = birthdaySource(c);
    if (birthday) {
      sources.push({ ...birthday, id: birthday.key, target, importantDateId: null, remindDays: remindDaysFor(c.tier) });
    }
    for (const d of c.importantDates) {
      const s = importantDateSource(d);
      sources.push({ ...s, id: s.key, target, importantDateId: d.id, remindDays: remindDaysFor(c.tier, d.remindDaysBefore) });
    }
  }
  for (const o of organizations) {
    const target: Target = { type: 'organization', id: o.id, name: o.name, tier: o.tier, subtitle: null };
    for (const d of o.importantDates) {
      const s = importantDateSource(d);
      sources.push({ ...s, id: s.key, target, importantDateId: d.id, remindDays: remindDaysFor(o.tier, d.remindDaysBefore) });
    }
  }

  const upcoming = upcomingOccurrences(sources, today, window).map((o) => ({
    key: o.item.key, kind: o.item.kind, label: o.item.label, date: o.date,
    daysUntil: o.daysUntil, years: o.years, isLunar: o.item.isLunar, target: o.item.target,
  }));

  // Dịp đã tới hạn chuẩn bị quà/hoa (trong số ngày nhắc trước), kèm việc đã lên kế hoạch nếu có.
  const dueOccurrences = upcomingOccurrences(sources, today, MAX_REMIND_DAYS).filter((o) => o.daysUntil <= o.item.remindDays);
  const dueTasks = dueOccurrences.length
    ? await prisma.crmCareTask.findMany({
        where: { occasionKey: { in: dueOccurrences.map((o) => careKey(o.item.key, o.date)) } },
        include: careTaskInclude,
      })
    : [];
  const taskByKey = new Map(dueTasks.map((t) => [t.occasionKey, toCareTaskDto(t)]));
  const careDue = dueOccurrences.map((o) => ({
    key: o.item.key, kind: o.item.kind, label: o.item.label, date: o.date,
    daysUntil: o.daysUntil, years: o.years, isLunar: o.item.isLunar, target: o.item.target,
    importantDateId: o.item.importantDateId, remindDays: o.item.remindDays,
    task: taskByKey.get(careKey(o.item.key, o.date)) ?? null,
  }));

  const now = Date.parse(`${today}T00:00:00+07:00`);
  const lastOf = (dates: Array<Date | undefined>) =>
    dates.filter((d): d is Date => Boolean(d)).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const dormant = [
    ...contacts.map((c) => ({
      type: 'contact' as const, id: c.id, tier: c.tier,
      name: [c.academicTitle, c.fullName].filter(Boolean).join(' '),
      last: lastOf([c.interactions[0]?.occurredAt, c.participations[0]?.interaction.occurredAt]),
    })),
    ...organizations.map((o) => ({
      type: 'organization' as const, id: o.id, tier: o.tier, name: o.name, last: o.interactions[0]?.occurredAt ?? null,
    })),
  ]
    .filter((x) => DORMANT_TIERS.includes(x.tier))
    .map((x) => ({
      type: x.type, id: x.id, name: x.name, tier: x.tier,
      lastInteractionAt: x.last?.toISOString() ?? null,
      daysSince: x.last ? Math.floor((now - x.last.getTime()) / MS_PER_DAY) : null,
    }))
    .filter((x) => x.daysSince === null || x.daysSince > DORMANT_DAYS)
    // Chưa từng tương tác lên đầu, rồi lâu nhất trước.
    .sort((a, b) => (a.daysSince === null ? -1 : 0) - (b.daysSince === null ? -1 : 0) || (b.daysSince ?? 0) - (a.daysSince ?? 0))
    .slice(0, 20);

  const [contactCount, organizationCount, interactionsThisMonth, vipEscortsThisMonth, delegationsThisMonth] = counts;
  return NextResponse.json({
    upcoming,
    recentInteractions: recent.map((i) => toInteractionDto(i, health)),
    planned: planned.map((i) => toInteractionDto(i, health)),
    overduePlanned: overduePlanned.map((i) => toInteractionDto(i, health)),
    dormant,
    reconcile,
    careDue,
    careOverdue: careOverdue.map(toCareTaskDto),
    careBudget: { month: careBudgetMonth, year: careBudgetYear },
    counts: {
      contacts: contactCount, organizations: organizationCount,
      interactionsThisMonth, vipEscortsThisMonth, delegationsThisMonth,
    },
  });
});
