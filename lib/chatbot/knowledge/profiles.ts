/**
 * "Hồ sơ" gom nhiều phân hệ về một đầu mối — để chatbot liên kết được thay vì
 * thấy từng mảnh rời:
 *  - Hồ sơ phòng ban: MOU làm đầu mối, việc BGĐ giao còn mở, đoàn đã chủ trì tiếp,
 *    nhiệm vụ báo cáo tuần gần nhất.
 *  - Hồ sơ đối tác (tổ chức CRM): tên khác, người liên hệ/người ký, lượt tiếp đón, MOU đã ký.
 * Không đưa số điện thoại, email vào (chatbot không cần, giảm lộ thông tin cá nhân).
 */
import type { PrismaClient } from '@prisma/client';
import type { KnowledgeDoc } from './collect';

const DAY_MS = 86_400_000;
const vnDate = (d: Date) => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10).split('-').reverse().join('/');
const LIFECYCLE = (status: string, expiry: Date | null, now: Date) =>
  status === 'DRAFT' ? 'chờ ký'
  : status === 'TERMINATED' ? 'đã kết thúc'
  : status === 'EXPIRED' || (expiry && expiry < now) ? 'hết hạn'
  : expiry && expiry.getTime() - now.getTime() <= 90 * DAY_MS ? 'sắp hết hạn'
  : 'còn hiệu lực';
const VERDICT: Record<string, string> = { SUCCESS: 'thành công', ON_TRACK: 'đang tiến triển', AT_RISK: 'có nguy cơ', FAILED: 'không hiệu quả', TOO_EARLY: 'mới ký' };
/** Hồ sơ dài thì cắt danh sách — chatbot cần bức tranh, chi tiết đã có ở từng đoạn riêng. */
const MAX_LIST = 15;

const list = <T>(items: T[], fmt: (x: T) => string) =>
  items.slice(0, MAX_LIST).map((x) => `- ${fmt(x)}`).join('\n') + (items.length > MAX_LIST ? `\n- … và ${items.length - MAX_LIST} mục khác` : '');

export async function departmentProfiles(db: PrismaClient, now = new Date()): Promise<KnowledgeDoc[]> {
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const [departments, mous, work, delegations, latestWeeks] = await Promise.all([
    db.department.findMany({ where: { deletedAt: null }, select: { id: true, name: true } }),
    db.mOU.findMany({
      where: { deletedAt: null, departmentId: { not: null } },
      select: { departmentId: true, partnerName: true, status: true, expiryDate: true, signedDate: true, evaluation: true, assessment: true },
      orderBy: { signedDate: 'desc' },
    }),
    db.workItem.findMany({
      where: { departmentId: { not: null }, status: { notIn: ['DONE', 'CANCELLED'] } },
      select: { departmentId: true, title: true, dueDate: true, progressPercent: true, directedBy: true },
      orderBy: { dueDate: 'asc' },
    }),
    db.crmInteraction.findMany({
      where: { hostDepartmentId: { not: null }, type: 'DELEGATION', occurredAt: { gte: yearStart } },
      select: { hostDepartmentId: true, occurredAt: true, title: true, organization: { select: { name: true } } },
      orderBy: { occurredAt: 'desc' },
    }),
    db.taskThreadEntry.findMany({
      where: { year: now.getUTCFullYear() },
      select: { departmentId: true, week: true, rawName: true, parentGroup: true, resultText: true },
      orderBy: { week: 'desc' },
    }),
  ]);

  return departments.flatMap((d) => {
    const ms = mous.filter((m) => m.departmentId === d.id);
    const ws = work.filter((w) => w.departmentId === d.id);
    const dl = delegations.filter((x) => x.hostDepartmentId === d.id);
    const entries = latestWeeks.filter((e) => e.departmentId === d.id);
    const lastWeek = entries[0]?.week;
    const recent = entries.filter((e) => e.week === lastWeek);
    if (!ms.length && !ws.length && !dl.length && !recent.length) return [];
    const overdue = ws.filter((w) => w.dueDate && w.dueDate < now).length;
    const live = ms.filter((m) => ['còn hiệu lực', 'sắp hết hạn'].includes(LIFECYCLE(m.status, m.expiryDate, now)));
    const body = [
      `Hồ sơ ${d.name} — tổng hợp từ các phân hệ (cập nhật ${vnDate(now)}).`,
      ms.length > 0 &&
        `MOU làm đầu mối: ${ms.length} MOU (${live.length} còn hiệu lực)\n${list(ms, (m) => {
          const v = m.evaluation ?? (m.assessment as { verdict?: string } | null)?.verdict;
          return `${m.partnerName} — ${LIFECYCLE(m.status, m.expiryDate, now)}${m.signedDate ? `, ký ${vnDate(m.signedDate)}` : ''}${v ? `, đánh giá: ${VERDICT[v] ?? v}` : ''}`;
        })}`,
      ws.length > 0 &&
        `Việc Ban Giám đốc giao đang thực hiện: ${ws.length} việc${overdue ? ` (${overdue} quá hạn)` : ''}\n${list(ws, (w) => `${w.title}${w.dueDate ? ` — hạn ${vnDate(w.dueDate)}${w.dueDate < now ? ' (quá hạn)' : ''}` : ''}${w.progressPercent !== null ? `, ${w.progressPercent}%` : ''}`)}`,
      dl.length > 0 &&
        `Chủ trì tiếp đoàn năm ${now.getUTCFullYear()}: ${dl.length} đoàn\n${list(dl, (x) => `${vnDate(x.occurredAt)} — ${x.organization?.name ?? x.title ?? 'đoàn khách'}`)}`,
      recent.length > 0 &&
        `Báo cáo tuần gần nhất (tuần ${lastWeek}/${now.getUTCFullYear()}): ${recent.length} nhiệm vụ\n${list(recent, (e) => {
          const name = (e.rawName || e.parentGroup || '').trim() || 'Nhiệm vụ';
          const result = (e.resultText ?? '').replace(/\s+/g, ' ').trim();
          return `${name}${result ? `: ${result.slice(0, 160)}` : ''}`;
        })}`,
    ].filter(Boolean).join('\n\n');
    return [{
      id: `department_profile:${d.id}`,
      source: 'department_profile' as const,
      refId: d.id,
      title: `Hồ sơ phòng ban — ${d.name}`,
      body,
      department: d.name,
      occurredOn: now,
      year: now.getUTCFullYear(),
      href: `/dashboard/departments/${d.id}`,
    }];
  });
}

export async function organizationProfiles(db: PrismaClient, now = new Date()): Promise<KnowledgeDoc[]> {
  const orgs = await db.crmOrganization.findMany({
    where: { OR: [{ interactions: { some: {} } }, { mous: { some: { deletedAt: null } } }, { positions: { some: {} } }] },
    select: {
      id: true, name: true, aliases: true, category: true, scope: true,
      positions: { where: { isCurrent: true }, select: { title: true, isFocalPoint: true, contact: { select: { fullName: true, academicTitle: true } } } },
      interactions: { where: { status: 'DONE' }, select: { occurredAt: true, purpose: true }, orderBy: { occurredAt: 'desc' } },
      mous: {
        where: { deletedAt: null },
        select: { title: true, status: true, expiryDate: true, signedDate: true, evaluation: true, assessment: true, department: { select: { name: true } } },
      },
    },
  });
  return orgs.map((o) => {
    const person = (p: (typeof o.positions)[number]) => `${[p.contact.academicTitle, p.contact.fullName].filter(Boolean).join(' ')} — ${p.title}`;
    const focal = o.positions.filter((p) => p.isFocalPoint);
    const others = o.positions.filter((p) => !p.isFocalPoint);
    const dept = o.mous.find((m) => m.department)?.department?.name ?? null;
    const body = [
      `Hồ sơ đối tác: ${o.name}${o.aliases.length ? ` (tên khác: ${o.aliases.slice(0, 6).join('; ')})` : ''}`,
      [o.category, o.scope].filter(Boolean).join(' · ') || null,
      focal.length > 0 && `Đầu mối liên hệ phía đối tác:\n${list(focal, person)}`,
      others.length > 0 && `Người liên hệ khác / người ký:\n${list(others, person)}`,
      o.interactions.length > 0 &&
        `Đã tiếp đón/làm việc ${o.interactions.length} lượt, gần nhất ${vnDate(o.interactions[0].occurredAt)}${o.interactions[0].purpose ? ` (${o.interactions[0].purpose})` : ''}`,
      o.mous.length > 0 &&
        `MOU đã ký với bệnh viện:\n${list(o.mous, (m) => {
          const v = m.evaluation ?? (m.assessment as { verdict?: string } | null)?.verdict;
          return `${m.title} — ${LIFECYCLE(m.status, m.expiryDate, now)}${m.signedDate ? `, ký ${vnDate(m.signedDate)}` : ''}${m.department ? `, phòng đầu mối ${m.department.name}` : ''}${v ? `, đánh giá: ${VERDICT[v] ?? v}` : ''}`;
        })}`,
    ].filter(Boolean).join('\n');
    return {
      id: `crm_org:${o.id}`,
      source: 'crm_org' as const,
      refId: o.id,
      title: `Hồ sơ đối tác — ${o.name}`,
      body,
      department: dept,
      organization: o.name,
      occurredOn: o.interactions[0]?.occurredAt ?? null,
      href: `/dashboard/crm/organizations/${o.id}`,
    };
  });
}
