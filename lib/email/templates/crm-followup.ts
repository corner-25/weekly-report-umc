/**
 * Mẫu email NỘI BỘ gửi cho nhân viên Phòng Hành chính / Tiếp đón VIP.
 * Thông báo danh sách khách VIP có lịch hẹn tái khám / Chụp MRI / Cận lâm sàng vào ngày mai (N+1)
 * để nhân viên chủ động chuẩn bị, liên hệ trước và phối hợp khoa phòng, tránh bị miss thông tin.
 */

export interface CrmFollowUpGuestItem {
  id: string;
  fullName: string;
  academicTitle?: string | null;
  tier: string;
  organizationName?: string | null;
  phone?: string | null;
  followUpNote: string;
  destination?: string | null;
  doctors: string[];
  services: string[];
  staffName: string;
  companions: string[];
}

export interface CrmFollowUpBriefingProps {
  tomorrowDateStr: string; // VD: 10/10/2026
  guests: CrmFollowUpGuestItem[];
  appUrl: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
}

export function renderCrmFollowUpBriefingHtml({
  tomorrowDateStr,
  guests,
  appUrl,
}: CrmFollowUpBriefingProps): { subject: string; html: string } {
  const subject = `[NỘI BỘ - CRM] Danh sách ${guests.length} khách VIP có lịch hẹn tái khám / Chụp MRI ngày mai (${tomorrowDateStr})`;

  const guestCardsHtml = guests
    .map((g, idx) => {
      const titlePrefix = g.academicTitle ? `${g.academicTitle} ` : '';
      const guestName = `${titlePrefix}${g.fullName}`;
      const staffList = [g.staffName, ...g.companions].filter(Boolean).join(', ') || 'Chưa phân công';
      const doctorList = g.doctors.length > 0 ? g.doctors.join(', ') : 'Chưa ghi nhận';
      const serviceList = g.services.length > 0 ? g.services.join(', ') : 'Dẫn khám thông thường';

      return `
        <div style="background: #ffffff; border: 1px solid #cbd5e1; border-left: 4px solid #059669; border-radius: 8px; padding: 16px 18px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <span style="display: inline-block; background: #0f172a; color: #fde047; font-weight: 700; font-size: 11px; padding: 2px 7px; border-radius: 4px; margin-right: 6px;">
                ${escapeHtml(g.tier || 'VIP')}
              </span>
              <strong style="font-size: 15px; color: #0f172a;">${escapeHtml(guestName)}</strong>
              ${g.organizationName ? `<span style="font-size: 13px; color: #475569;"> · ${escapeHtml(g.organizationName)}</span>` : ''}
            </div>
            <span style="font-size: 12px; font-weight: 700; color: #047857; background: #dcfce7; padding: 2px 8px; border-radius: 4px;">
              Khách #${idx + 1}
            </span>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #334155;">
            <tr>
              <td style="width: 140px; padding: 4px 0; color: #64748b; font-weight: 600;">Nội dung hẹn / Dặn dò:</td>
              <td style="padding: 4px 0; color: #b91c1c; font-weight: 700;">
                ${escapeHtml(g.followUpNote || 'Tái khám theo hẹn')}
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Khoa phòng / Nơi đến:</td>
              <td style="padding: 4px 0; color: #0f172a;">
                ${escapeHtml(g.destination || 'Phòng khám / Phòng MRI')} · Bác sĩ: <strong>${escapeHtml(doctorList)}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Dịch vụ hỗ trợ:</td>
              <td style="padding: 4px 0; color: #0f172a;">
                ${escapeHtml(serviceList)}
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Nhân viên dẫn phụ trách:</td>
              <td style="padding: 4px 0; color: #0369a1; font-weight: 700;">
                ${escapeHtml(staffList)}
              </td>
            </tr>
            ${
              g.phone
                ? `
            <tr>
              <td style="padding: 4px 0; color: #64748b; font-weight: 600;">Số điện thoại khách:</td>
              <td style="padding: 4px 0; color: #0f172a; font-weight: 600;">
                <a href="tel:${escapeHtml(g.phone)}" style="color: #0369a1; text-decoration: none;">${escapeHtml(g.phone)}</a>
              </td>
            </tr>`
                : ''
            }
          </table>
        </div>
      `;
    })
    .join('');

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 20px 10px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <div style="max-width: 660px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);">
    
    <!-- Header chuẩn UMC Tiếp đón VIP -->
    <div style="background: linear-gradient(135deg, #047857, #065f46); padding: 22px 28px; color: #ffffff;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 1px; opacity: 0.9; text-transform: uppercase;">
        BỆNH VIỆN ĐẠI HỌC Y DƯỢC TP. HỒ CHÍ MINH
      </div>
      <div style="font-size: 18px; font-weight: 800; margin-top: 4px; letter-spacing: 0.3px;">
        THÔNG BÁO NỘI BỘ · TIẾP ĐÓN KHÁCH VIP TÁI KHÁM / CLS
      </div>
      <div style="font-size: 13px; margin-top: 4px; opacity: 0.95;">
        Lịch hẹn ngày mai: <strong>${escapeHtml(tomorrowDateStr)}</strong> · Tổng cộng: <strong>${guests.length} khách</strong>
      </div>
    </div>

    <!-- Nội dung chính -->
    <div style="padding: 26px 28px;">
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">
        Kính gửi các Anh/Chị nhân viên phụ trách đón tiếp khách VIP (Phòng Hành chính),<br>
        Hệ thống tự động thông báo danh sách khách có lịch hẹn tái khám, chụp MRI và làm cận lâm sàng vào <strong>ngày mai (${escapeHtml(tomorrowDateStr)})</strong>:
      </p>

      <!-- Danh sách card khách -->
      <div style="margin: 20px 0;">
        ${guestCardsHtml}
      </div>

      <!-- Khung nhiệm vụ nhắc nhở nhân viên đón tiếp -->
      <div style="background: #fffbeb; border: 1px solid #fcd34d; border-left: 5px solid #d97706; border-radius: 8px; padding: 16px 18px; margin: 24px 0; font-size: 13px; color: #92400e;">
        <strong style="font-size: 13.5px; display: block; margin-bottom: 6px;">⚡ NHIỆM VỤ CẦN THỰC HIỆN TRƯỚC:</strong>
        <ul style="margin: 0; padding-left: 18px; line-height: 1.5;">
          <li>Nhân viên được phân công chủ động <strong>liên hệ khách trước trong hôm nay</strong> để xác nhận khung giờ đến khám và dặn dò chuẩn bị (nhịn ăn, mang hồ sơ...).</li>
          <li>Liên hệ trước với Thư ký Khoa/Phòng khám hoặc KTV Phòng chụp MRI / Cận lâm sàng để phối hợp ưu tiên tiếp nhận.</li>
          <li>Chủ động có mặt tại <strong>Sảnh A hoặc Quầy VIP</strong> trước giờ hẹn để đón khách chu đáo.</li>
        </ul>
      </div>

      <!-- Nút mở CRM -->
      <div style="text-align: center; margin: 24px 0 16px 0;">
        <a href="${appUrl}/dashboard/crm" style="display: inline-block; background: #047857; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 4px rgba(4, 120, 87, 0.3);">
          🏥 Mở phân hệ CRM để xem chi tiết hồ sơ khách
        </a>
      </div>
    </div>

    <!-- Chân trang liên hệ nội bộ -->
    <div style="background: #f8fafc; padding: 18px 28px; font-size: 12.5px; color: #475569; border-top: 1px solid #e2e8f0; line-height: 1.6;">
      <strong style="color: #0f172a; text-transform: uppercase;">Phòng Hành chính · Bệnh viện Đại học Y Dược TP. Hồ Chí Minh</strong><br>
      • Địa chỉ: <strong>Phường Chợ Lớn, TP. Hồ Chí Minh</strong><br>
      • Email: <a href="mailto:hanhchinh@umc.edu.vn" style="color: #047857; text-decoration: none; font-weight: 600;">hanhchinh@umc.edu.vn</a><br>
      • Điện thoại nội bộ: <strong>5421</strong> hoặc <strong>5324</strong>
    </div>

  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}

