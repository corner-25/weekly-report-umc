import { NextResponse } from 'next/server';
import { handle, HttpError, requireSession } from '@/lib/crm/server';
import { createSmtpTransporter, getSmtpConfig } from '@/lib/email/smtp';
import { renderWorkReminderHtml } from '@/lib/email/templates/work-reminder';
import { renderCrmFollowUpBriefingHtml } from '@/lib/email/templates/crm-followup';

function appUrl(request: Request): string {
  return process.env.NEXTAUTH_URL ?? new URL(request.url).origin;
}

export const GET = handle(async (request: Request) => {
  await requireSession();
  const url = appUrl(request);
  const smtp = getSmtpConfig();

  // Dữ liệu mẫu chuẩn UMC để xem trước trên Settings
  const sampleWorkReminder = renderWorkReminderHtml({
    recipientName: 'Thư ký Nguyễn Văn An',
    department: 'Khoa Ngoại Tiêu hoá',
    items: [
      {
        id: 'sample-1',
        title: 'Triển khai kỹ thuật phẫu thuật nội soi 3D ít xâm lấn và hoàn tất quy trình chuẩn',
        status: 'Đang thực hiện',
        dueDate: '2026-10-15',
        reasonText: 'Sắp đến hạn (còn 6 ngày)',
        isOverdue: false,
      },
      {
        id: 'sample-2',
        title: 'Báo cáo nghiệm thu đề tài cấp cơ sở về hiệu quả hồi phục sớm sau phẫu thuật (ERAS)',
        status: 'Đang thực hiện',
        dueDate: '2026-10-01',
        reasonText: 'Đã quá hạn 8 ngày',
        isOverdue: true,
      },
    ],
    appUrl: url,
  });

  const sampleCrmBriefing = renderCrmFollowUpBriefingHtml({
    tomorrowDateStr: '10/10/2026',
    guests: [
      {
        id: 'vip-1',
        fullName: 'Trần Văn Minh',
        academicTitle: 'Ông',
        tier: 'VIP',
        organizationName: 'Tập đoàn Dược phẩm Quốc tế',
        phone: '0908 123 456',
        followUpNote: 'Hẹn chụp MRI sọ não 3.0 Tesla lúc 08:30 và đọc kết quả với PGS.TS Nguyễn Hoàng Bắc',
        destination: 'Phòng MRI 3.0T (Khu C) & Phòng khám VIP',
        doctors: ['PGS.TS.BS. Nguyễn Hoàng Bắc'],
        services: ['Khám bệnh', 'Chẩn đoán hình ảnh (MRI)', 'Xét nghiệm'],
        staffName: 'Nguyễn Lương Bảo Châu',
        companions: ['Nguyễn Thị Thảo Trang'],
      },
      {
        id: 'vip-2',
        fullName: 'Lê Thị Thu Cúc',
        academicTitle: 'Bà',
        tier: 'A',
        organizationName: 'Đại học Quốc gia TP.HCM',
        phone: '0913 987 654',
        followUpNote: 'Tái khám Tim mạch theo hẹn, làm siêu âm tim và lấy thuốc định kỳ',
        destination: 'Khoa Khám bệnh - Phòng Tim mạch VIP',
        doctors: ['TS.BS. Trương Quang Bình'],
        services: ['Khám bệnh', 'Thăm dò chức năng', 'Nhận thuốc'],
        staffName: 'Vũ Thị Bích Thảo',
        companions: [],
      },
    ],
    appUrl: url,
  });

  return NextResponse.json({
    smtpConfig: {
      isConfigured: smtp !== null,
      host: smtp?.host ? `${smtp.host.slice(0, 3)}***` : 'Chưa cấu hình',
      port: smtp?.port || 587,
      user: smtp?.auth?.user || 'Chưa cấu hình',
      from: smtp?.from || 'hanhchinh@umc.edu.vn',
      secure: smtp?.secure || false,
    },
    contactInfo: {
      address: '215 Hồng Bàng, Phường Chợ Lớn, TP. Hồ Chí Minh',
      email: 'hanhchinh@umc.edu.vn',
      phones: ['5421 (Phụ trách Quản lý Công việc)', '5324 (Thư ký Phòng)'],
    },
    previews: {
      workReminder: sampleWorkReminder,
      crmBriefing: sampleCrmBriefing,
    },
  });
});

/**
 * Gửi email test kết nối SMTP.
 */
export const POST = handle(async (request: Request) => {
  const session = await requireSession();
  const url = appUrl(request);
  const smtp = getSmtpConfig();
  if (!smtp) {
    throw new HttpError(400, 'Chưa cấu hình SMTP trên máy chủ (SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM)');
  }

  const body = await request.json();
  const targetEmail = body.toEmail || session.user.email;
  const templateType = body.templateType || 'workReminder';

  if (!targetEmail) {
    throw new HttpError(400, 'Cần chỉ định địa chỉ email nhận');
  }

  const transporter = createSmtpTransporter();

  let subject = '[UMC Test] Thử nghiệm gửi email hệ thống';
  let html = '<p>Thử nghiệm kết nối SMTP thành công từ máy chủ UMC.</p>';

  if (templateType === 'workReminder') {
    const rendered = renderWorkReminderHtml({
      recipientName: session.user.name || 'Người dùng quản trị',
      department: 'Phòng Hành chính (Thử nghiệm)',
      items: [
        {
          id: 'test-1',
          title: 'Công việc thử nghiệm mẫu thông báo đôn đốc UMC-Office',
          status: 'Đang thực hiện',
          dueDate: new Date().toISOString().slice(0, 10),
          reasonText: 'Mẫu thử nghiệm',
          isOverdue: false,
        },
      ],
      appUrl: url,
    });
    subject = `[THỬ NGHIỆM] ${rendered.subject}`;
    html = rendered.html;
  } else if (templateType === 'crmBriefing') {
    const rendered = renderCrmFollowUpBriefingHtml({
      tomorrowDateStr: new Date(Date.now() + 86400000).toLocaleDateString('vi-VN'),
      guests: [
        {
          id: 'test-vip',
          fullName: 'Nguyễn Văn Mẫu (Khách thử nghiệm)',
          academicTitle: 'Ông',
          tier: 'VIP',
          organizationName: 'Đơn vị thử nghiệm UMC',
          phone: '0900 000 000',
          followUpNote: 'Thử nghiệm gửi email nhắc tiếp đón VIP ngày mai',
          destination: 'Phòng tiếp đón VIP',
          doctors: ['Bác sĩ Trưởng khoa'],
          services: ['Khám bệnh', 'Chẩn đoán hình ảnh'],
          staffName: 'Nhân viên Phòng HC',
          companions: [],
        },
      ],
      appUrl: url,
    });
    subject = `[THỬ NGHIỆM] ${rendered.subject}`;
    html = rendered.html;
  }

  await transporter.sendMail({
    from: smtp.from,
    to: targetEmail,
    subject,
    html,
  });

  return NextResponse.json({ success: true, to: targetEmail, subject });
});

