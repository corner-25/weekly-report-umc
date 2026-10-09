/**
 * B3: nhắc việc qua email cho thư ký của đơn vị chủ trì.
 *
 * Mỗi thư ký nhận MỘT email gom mọi việc của đơn vị mình đang quá hạn, sắp đến
 * hạn hoặc lâu chưa cập nhật. Việc đã nhắc trong REMIND_COOLDOWN_DAYS ngày thì
 * không nhắc lại. Luôn xem trước được (dryRun) — gửi thật chỉ khi có SMTP.
 */
import nodemailer from 'nodemailer';
import type { PrismaClient } from '@prisma/client';
import { NON_SECRETARY_TYPE } from '@/lib/birthday';
import { CLOSED_STATUSES, WORK_STATUS_LABELS } from './constants';
import { workHealth, type WorkHealth } from './status';

const REMIND_COOLDOWN_DAYS = 7;
const MS_PER_DAY = 86_400_000;

export type ReminderReason = 'overdue' | 'due_soon' | 'stale';

export interface ReminderItem {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  reason: ReminderReason;
  health: WorkHealth;
}

export interface ReminderRecipient {
  secretaryId: string;
  name: string;
  email: string;
  department: string;
  items: ReminderItem[];
}

export interface ReminderPlan {
  recipients: ReminderRecipient[];
  /** Đơn vị có việc cần nhắc nhưng chưa có thư ký nào có email. */
  departmentsWithoutEmail: Array<{ department: string; itemCount: number }>;
  /** Việc chưa khớp được đơn vị chủ trì — cần gán tay. */
  unassignedCount: number;
}

function reasonOf(health: WorkHealth): ReminderReason | null {
  if (health.isOverdue) return 'overdue';
  if (health.isDueSoon) return 'due_soon';
  if (health.isStale) return 'stale';
  return null;
}

export async function buildWorkReminders(db: PrismaClient, now: Date = new Date()): Promise<ReminderPlan> {
  const cooldown = new Date(now.getTime() - REMIND_COOLDOWN_DAYS * MS_PER_DAY);
  const items = await db.workItem.findMany({
    where: {
      status: { notIn: [...CLOSED_STATUSES] },
      OR: [{ lastRemindedAt: null }, { lastRemindedAt: { lt: cooldown } }],
    },
    select: {
      id: true, title: true, status: true, dueDate: true, lastActivityAt: true, directedAt: true, createdAt: true, departmentId: true,
      department: { select: { name: true } },
    },
  });

  const due = items
    .map((item) => {
      const health = workHealth(item, now);
      const reason = reasonOf(health);
      return reason ? { item, health, reason } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const departmentIds = [...new Set(due.map((d) => d.item.departmentId).filter((id): id is string => Boolean(id)))];
  const secretaries = await db.secretary.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      email: { not: null },
      currentDepartmentId: { in: departmentIds },
      secretaryType: { is: { name: { not: NON_SECRETARY_TYPE } } },
    },
    select: { id: true, fullName: true, email: true, currentDepartmentId: true },
  });

  const recipients: ReminderRecipient[] = [];
  const departmentsWithoutEmail: ReminderPlan['departmentsWithoutEmail'] = [];
  for (const departmentId of departmentIds) {
    const forDept = due.filter((d) => d.item.departmentId === departmentId);
    const department = forDept[0].item.department?.name ?? '';
    const reminderItems = forDept.map(({ item, health, reason }) => ({
      id: item.id,
      title: item.title,
      status: WORK_STATUS_LABELS[item.status],
      dueDate: item.dueDate?.toISOString().slice(0, 10) ?? null,
      reason,
      health,
    }));
    const people = secretaries.filter((s) => s.currentDepartmentId === departmentId && s.email);
    if (people.length === 0) {
      departmentsWithoutEmail.push({ department, itemCount: forDept.length });
      continue;
    }
    for (const s of people) {
      recipients.push({ secretaryId: s.id, name: s.fullName, email: s.email as string, department, items: reminderItems });
    }
  }

  return { recipients, departmentsWithoutEmail, unassignedCount: due.filter((d) => !d.item.departmentId).length };
}

const REASON_TEXT: Record<ReminderReason, (h: WorkHealth) => string> = {
  overdue: (h) => `Đã quá hạn ${-(h.daysToDue ?? 0)} ngày`,
  due_soon: (h) => (h.daysToDue === 0 ? 'Đến hạn hôm nay' : `Còn ${h.daysToDue} ngày đến hạn`),
  stale: (h) => (h.daysSinceActivity === null ? 'Chưa có cập nhật nào' : `${h.daysSinceActivity} ngày chưa cập nhật`),
};

import { renderWorkReminderHtml } from '@/lib/email/templates/work-reminder';
import { getSmtpConfig, createSmtpTransporter } from '@/lib/email/smtp';

export function reminderEmail(recipient: ReminderRecipient, appUrl: string): { subject: string; html: string } {
  return renderWorkReminderHtml({
    recipientName: recipient.name,
    department: recipient.department,
    items: recipient.items.map((i) => ({
      id: i.id,
      title: i.title,
      status: i.status,
      dueDate: i.dueDate,
      reasonText: REASON_TEXT[i.reason](i.health),
      isOverdue: i.health.isOverdue,
    })),
    appUrl,
  });
}

export function canSendReminders(): boolean {
  return getSmtpConfig() !== null;
}

/** Gửi email nhắc; ghi lastRemindedAt cho việc đã nhắc được ít nhất một người. */
export async function sendWorkReminders(
  db: PrismaClient,
  appUrl: string,
  options: { now?: Date; selectedItemIds?: string[] } = {}
) {
  const smtp = getSmtpConfig();
  if (!smtp) throw new Error('Chưa cấu hình SMTP (SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM) nên chưa gửi được email');
  
  const now = options.now ?? new Date();
  const plan = await buildWorkReminders(db, now);
  const transporter = createSmtpTransporter();

  const targetIdSet = options.selectedItemIds && options.selectedItemIds.length > 0 ? new Set(options.selectedItemIds) : null;
  const targetRecipients = targetIdSet
    ? plan.recipients
        .map((r) => ({
          ...r,
          items: r.items.filter((i) => targetIdSet.has(i.id)),
        }))
        .filter((r) => r.items.length > 0)
    : plan.recipients;

  const sentItemIds = new Set<string>();
  const failures: Array<{ email: string; error: string }> = [];

  for (const recipient of targetRecipients) {
    const { subject, html } = reminderEmail(recipient, appUrl);
    try {
      await transporter.sendMail({ from: smtp.from, to: recipient.email, subject, html });
      recipient.items.forEach((i) => sentItemIds.add(i.id));
    } catch (error) {
      failures.push({ email: recipient.email, error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (sentItemIds.size > 0) {
    await db.workItem.updateMany({ where: { id: { in: [...sentItemIds] } }, data: { lastRemindedAt: now } });
  }

  return { sent: targetRecipients.length - failures.length, failures, itemsReminded: sentItemIds.size };
}

