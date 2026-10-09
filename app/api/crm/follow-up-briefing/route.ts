import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handle, HttpError, requireSession } from '@/lib/crm/server';
import { getTomorrowFollowUpGuests, sendTomorrowFollowUpBriefing } from '@/lib/email/crm-followup';
import { renderCrmFollowUpBriefingHtml } from '@/lib/email/templates/crm-followup';
import { getSmtpConfig } from '@/lib/email/smtp';

function appUrl(request: Request): string {
  return process.env.NEXTAUTH_URL ?? new URL(request.url).origin;
}

/**
 * Xem trước danh sách khách VIP tái khám ngày mai và nội dung email nội bộ.
 */
export const GET = handle(async (request: Request) => {
  await requireSession();
  const url = appUrl(request);
  const { guests, tomorrowDateStr } = await getTomorrowFollowUpGuests(prisma);
  const { subject, html } = renderCrmFollowUpBriefingHtml({
    tomorrowDateStr,
    guests,
    appUrl: url,
  });

  return NextResponse.json({
    tomorrowDateStr,
    guestCount: guests.length,
    guests,
    canSend: getSmtpConfig() !== null,
    preview: {
      subject,
      html,
    },
  });
});

/**
 * Kích hoạt gửi email thông báo nội bộ cho nhân viên phòng HC / CSKH ngay.
 */
export const POST = handle(async (request: Request) => {
  const session = await requireSession();
  if (session.user.role !== 'ADMIN') {
    throw new HttpError(403, 'Chỉ quản trị viên được kích hoạt gửi thông báo nội bộ');
  }

  const url = appUrl(request);
  let recipientEmails: string[] | undefined;

  try {
    const body = await request.json();
    if (body && Array.isArray(body.recipientEmails)) {
      recipientEmails = body.recipientEmails;
    }
  } catch {
    // dùng mặc định
  }

  const result = await sendTomorrowFollowUpBriefing(prisma, url, recipientEmails);
  return NextResponse.json(result);
});

