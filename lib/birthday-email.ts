import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { NON_SECRETARY_TYPE, sameUtcDate, todayInAppTimeZone } from '@/lib/birthday';

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  if (!host || !user || !pass || !from) {
    throw new Error('Thiếu SMTP_HOST, SMTP_USER, SMTP_PASSWORD hoặc SMTP_FROM');
  }
  const port = Number(process.env.SMTP_PORT || 587);
  return { host, port, secure: process.env.SMTP_SECURE === 'true' || port === 465, auth: { user, pass }, from };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));
}

export function birthdayCardHtml(fullName: string) {
  const name = escapeHtml(fullName);
  return `<!doctype html><html lang="vi"><body style="margin:0;background:#f4f6f8;font-family:Arial,sans-serif;color:#172033">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;background:#f4f6f8"><tr><td align="center">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #e5e9ef;border-radius:16px;overflow:hidden">
      <tr><td style="height:8px;background:#087ea4"></td></tr>
      <tr><td style="padding:40px 44px 12px;color:#087ea4;font-size:13px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">Bệnh viện Đại học Y Dược TP.HCM</td></tr>
      <tr><td style="padding:8px 44px 0;font-size:30px;line-height:1.25;font-weight:700">Chúc mừng sinh nhật, ${name}</td></tr>
      <tr><td style="padding:20px 44px 8px;font-size:16px;line-height:1.7;color:#4b5565">Kính chúc Anh/Chị một tuổi mới nhiều sức khỏe, niềm vui và thành công. Cảm ơn những đóng góp tận tâm của Anh/Chị trong công việc và với tập thể.</td></tr>
      <tr><td style="padding:20px 44px 42px"><div style="border-top:1px solid #e5e9ef;padding-top:20px;font-size:14px;line-height:1.6;color:#697386">Trân trọng,<br><strong style="color:#172033">Phòng Hành chính</strong></div></td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export async function sendBirthdayEmails({ dryRun = false } = {}) {
  const today = todayInAppTimeZone();
  const birthdayYear = today.getUTCFullYear();
  const candidates = await prisma.secretary.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      email: { not: null },
      dateOfBirth: { not: null },
      secretaryType: { is: { name: { not: NON_SECRETARY_TYPE } } },
    },
    select: { id: true, fullName: true, email: true, dateOfBirth: true },
  });
  const birthdays = candidates.filter((person) => {
    const dob = person.dateOfBirth!;
    const birthday = new Date(Date.UTC(birthdayYear, dob.getUTCMonth(), dob.getUTCDate()));
    return sameUtcDate(birthday, today);
  });
  if (dryRun || birthdays.length === 0) return { date: today.toISOString().slice(0, 10), candidates: birthdays.length, sent: 0, skipped: 0, failed: 0, dryRun };

  const smtp = smtpConfig();
  const transporter = nodemailer.createTransport({ host: smtp.host, port: smtp.port, secure: smtp.secure, auth: smtp.auth });
  let sent = 0; let skipped = 0; let failed = 0;
  for (const person of birthdays) {
    const recipient = person.email!;
    const claimed = await prisma.birthdayEmailLog.createMany({
      data: [{ secretaryId: person.id, birthdayYear, recipient, status: 'SENDING' }],
      skipDuplicates: true,
    });
    if (claimed.count === 0) { skipped += 1; continue; }
    try {
      await transporter.sendMail({
        from: smtp.from,
        to: recipient,
        subject: `Chúc mừng sinh nhật ${person.fullName}`,
        html: birthdayCardHtml(person.fullName),
      });
      await prisma.birthdayEmailLog.update({ where: { secretaryId_birthdayYear: { secretaryId: person.id, birthdayYear } }, data: { status: 'SENT', sentAt: new Date() } });
      sent += 1;
    } catch (error) {
      failed += 1;
      await prisma.birthdayEmailLog.update({
        where: { secretaryId_birthdayYear: { secretaryId: person.id, birthdayYear } },
        data: { status: 'FAILED', errorMessage: error instanceof Error ? error.message.slice(0, 2000) : 'Unknown SMTP error' },
      });
    }
  }
  return { date: today.toISOString().slice(0, 10), candidates: birthdays.length, sent, skipped, failed, dryRun };
}
