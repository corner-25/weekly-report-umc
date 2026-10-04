import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handle, HttpError, requireSession } from '@/lib/crm/server';
import { buildWorkReminders, canSendReminders, reminderEmail, sendWorkReminders } from '@/lib/work/reminders';

function appUrl(request: Request): string {
  return process.env.NEXTAUTH_URL ?? new URL(request.url).origin;
}

/** Xem trước email nhắc việc: ai sẽ nhận, gồm những việc nào. Không gửi gì. */
export const GET = handle(async (request: Request) => {
  await requireSession();
  const plan = await buildWorkReminders(prisma);
  const url = appUrl(request);
  return NextResponse.json({
    canSend: canSendReminders(),
    recipients: plan.recipients.map((r) => ({ ...r, subject: reminderEmail(r, url).subject })),
    departmentsWithoutEmail: plan.departmentsWithoutEmail,
    unassignedCount: plan.unassignedCount,
  });
});

/** Gửi email nhắc thật — chỉ quản trị viên, và chỉ khi đã cấu hình SMTP. */
export const POST = handle(async (request: Request) => {
  const session = await requireSession();
  if (session.user.role !== 'ADMIN') throw new HttpError(403, 'Chỉ quản trị viên được gửi email nhắc việc');
  if (!canSendReminders()) throw new HttpError(400, 'Chưa cấu hình SMTP nên chưa gửi được email');
  return NextResponse.json(await sendWorkReminders(prisma, appUrl(request)));
});
