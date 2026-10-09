import type { PrismaClient } from '@prisma/client';
import { createSmtpTransporter, getSmtpConfig } from './smtp';
import { renderCrmFollowUpBriefingHtml, type CrmFollowUpGuestItem } from './templates/crm-followup';

/**
 * Lấy khoảng thời gian của ngày mai theo múi giờ Việt Nam (UTC+7).
 */
export function getTomorrowRange(baseDate = new Date()) {
  const vnNow = new Date(baseDate.getTime() + 7 * 3600 * 1000);
  const vnTomorrow = new Date(vnNow);
  vnTomorrow.setUTCDate(vnTomorrow.getUTCDate() + 1);

  const year = vnTomorrow.getUTCFullYear();
  const month = vnTomorrow.getUTCMonth();
  const date = vnTomorrow.getUTCDate();

  // UTC start and end for Vietnam day
  const startUtc = new Date(Date.UTC(year, month, date, 0, 0, 0) - 7 * 3600 * 1000);
  const endUtc = new Date(Date.UTC(year, month, date, 23, 59, 59, 999) - 7 * 3600 * 1000);

  const formattedDate = `${String(date).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;

  return { startUtc, endUtc, formattedDate };
}

/**
 * Truy vấn danh sách khách VIP có lịch hẹn tái khám / Chụp MRI / CLS vào ngày mai.
 */
export async function getTomorrowFollowUpGuests(db: PrismaClient, baseDate = new Date()): Promise<{ guests: CrmFollowUpGuestItem[]; tomorrowDateStr: string }> {
  const { startUtc, endUtc, formattedDate } = getTomorrowRange(baseDate);

  const interactions = await db.crmInteraction.findMany({
    where: {
      followUpDate: {
        gte: startUtc,
        lte: endUtc,
      },
    },
    include: {
      contact: {
        select: {
          id: true,
          fullName: true,
          academicTitle: true,
          tier: true,
          phone: true,
        },
      },
      organization: {
        select: {
          name: true,
        },
      },
      doctors: {
        include: {
          contact: {
            select: {
              fullName: true,
              academicTitle: true,
            },
          },
        },
      },
    },
    orderBy: {
      occurredAt: 'desc',
    },
  });

  const guests: CrmFollowUpGuestItem[] = interactions.map((ix) => {
    const doctorNames = ix.doctors
      .map((d) => (d.contact ? `${d.contact.academicTitle ? `${d.contact.academicTitle} ` : ''}${d.contact.fullName}` : ''))
      .filter(Boolean);

    return {
      id: ix.id,
      fullName: ix.contact?.fullName || ix.patientName || 'Khách chưa có tên',
      academicTitle: ix.contact?.academicTitle,
      tier: ix.contact?.tier || 'VIP',
      organizationName: ix.organization?.name,
      phone: ix.contact?.phone,
      followUpNote: ix.followUp || 'Tái khám / kiểm tra theo hẹn',
      destination: ix.destination,
      doctors: doctorNames,
      services: ix.services,
      staffName: ix.staffName,
      companions: ix.companions,
    };
  });

  return { guests, tomorrowDateStr: formattedDate };
}

/**
 * Gửi email thông báo nội bộ cho nhân viên Phòng Hành chính về các khách VIP ngày mai.
 */
export async function sendTomorrowFollowUpBriefing(
  db: PrismaClient,
  appUrl: string,
  recipientEmails?: string[]
): Promise<{ sent: boolean; guestCount: number; recipients: string[]; error?: string }> {
  const smtp = getSmtpConfig();
  if (!smtp) {
    throw new Error('Chưa cấu hình SMTP trên máy chủ.');
  }

  const { guests, tomorrowDateStr } = await getTomorrowFollowUpGuests(db);
  if (guests.length === 0) {
    return { sent: false, guestCount: 0, recipients: [] };
  }

  // Danh sách email nhận: mặc định gửi tới email Phòng Hành chính và các email được truyền vào
  const toList = recipientEmails && recipientEmails.length > 0 ? recipientEmails : ['hanhchinh@umc.edu.vn'];

  const { subject, html } = renderCrmFollowUpBriefingHtml({
    tomorrowDateStr,
    guests,
    appUrl,
  });

  const transporter = createSmtpTransporter();
  await transporter.sendMail({
    from: smtp.from,
    to: toList.join(', '),
    subject,
    html,
  });

  return { sent: true, guestCount: guests.length, recipients: toList };
}
