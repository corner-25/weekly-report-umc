/**
 * Mẫu email NỘI BỘ gửi cho nhân viên Phòng Hành chính / Tiếp đón VIP.
 * Thông báo danh sách khách VIP có lịch hẹn tái khám / Chụp MRI / Cận lâm sàng vào ngày mai (N+1)
 * để nhân viên chủ động chuẩn bị, liên hệ trước và phối hợp khoa phòng, tránh bị bỏ sót thông tin.
 *
 * Tiêu chuẩn:
 * - Chuẩn nhận diện hành chính Bệnh viện Đại học Y Dược TP.HCM.
 * - Tuyệt đối không dùng emoji nhí nhố.
 * - Cấu trúc table-based với bgcolor dự phòng tương thích 100% với Outlook / Office 365 (không bị mất màu header).
 * - Địa chỉ chuẩn: 215 Hồng Bàng, Phường Chợ Lớn, TP. Hồ Chí Minh.
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
        <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-left: 4px solid #004b87; border-radius: 6px; padding: 16px 18px; margin-bottom: 14px;">
          <!-- Header card: dùng table để tương thích 100% với Outlook (tránh lỗi flexbox vỡ giao diện) -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
            <tr>
              <td align="left" style="vertical-align: middle;">
                <span style="display: inline-block; background-color: #0f172a; color: #fde047; font-weight: 700; font-size: 11px; padding: 2px 7px; border-radius: 3px; margin-right: 6px; letter-spacing: 0.5px;">
                  ${escapeHtml(g.tier || 'VIP')}
                </span>
                <strong style="font-size: 15px; color: #0f172a;">${escapeHtml(guestName)}</strong>
                ${g.organizationName ? `<span style="font-size: 13px; color: #475569;"> &middot; ${escapeHtml(g.organizationName)}</span>` : ''}
              </td>
              <td align="right" style="vertical-align: middle; white-space: nowrap;">
                <span style="font-size: 11.5px; font-weight: 700; color: #004b87; background-color: #e0f2fe; padding: 3px 8px; border-radius: 4px; display: inline-block;">
                  Khách #${idx + 1}
                </span>
              </td>
            </tr>
          </table>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; font-size: 13px; color: #334155;">
            <tr>
              <td style="width: 145px; padding: 5px 0; color: #64748b; font-weight: 600; vertical-align: top;">Nội dung hẹn / Dặn dò:</td>
              <td style="padding: 5px 0; color: #b91c1c; font-weight: 700; vertical-align: top;">
                ${escapeHtml(g.followUpNote || 'Tái khám theo hẹn')}
              </td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b; font-weight: 600; vertical-align: top;">Khoa phòng / Nơi đến:</td>
              <td style="padding: 5px 0; color: #0f172a; vertical-align: top;">
                ${escapeHtml(g.destination || 'Phòng khám / Phòng MRI')} &middot; Bác sĩ: <strong>${escapeHtml(doctorList)}</strong>
              </td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b; font-weight: 600; vertical-align: top;">Dịch vụ hỗ trợ:</td>
              <td style="padding: 5px 0; color: #0f172a; vertical-align: top;">
                ${escapeHtml(serviceList)}
              </td>
            </tr>
            <tr>
              <td style="padding: 5px 0; color: #64748b; font-weight: 600; vertical-align: top;">Nhân viên đón tiếp:</td>
              <td style="padding: 5px 0; color: #0369a1; font-weight: 700; vertical-align: top;">
                ${escapeHtml(staffList)}
              </td>
            </tr>
            ${
              g.phone
                ? `
            <tr>
              <td style="padding: 5px 0; color: #64748b; font-weight: 600; vertical-align: top;">Số điện thoại khách:</td>
              <td style="padding: 5px 0; color: #0f172a; font-weight: 600; vertical-align: top;">
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
<body style="margin: 0; padding: 24px 10px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center">
        <!-- Khung chứa email chuẩn 660px -->
        <table role="presentation" width="660" cellpadding="0" cellspacing="0" border="0" style="max-width: 660px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
          
          <!-- Header chuẩn nhận diện UMC (Table-based, chống lỗi mất màu trên Outlook/Office 365) -->
          <tr>
            <td bgcolor="#004b87" style="background-color: #004b87; padding: 24px 28px; color: #ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left">
                    <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.2px; color: #bae6fd; text-transform: uppercase;">
                      BỆNH VIỆN ĐẠI HỌC Y DƯỢC TP. HỒ CHÍ MINH
                    </div>
                    <div style="font-size: 17px; font-weight: 700; color: #ffffff; margin-top: 4px; letter-spacing: 0.3px; line-height: 1.35;">
                      PHÒNG HÀNH CHÍNH &middot; BỘ PHẬN TIẾP ĐÓN KHÁCH VIP
                    </div>
                    <div style="font-size: 12.5px; color: #e0f2fe; margin-top: 4px;">
                      Thông báo nội bộ: Lịch hẹn tái khám &middot; Chụp MRI &middot; Cận lâm sàng ngày mai (${escapeHtml(tomorrowDateStr)})
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Thân email -->
          <tr>
            <td style="padding: 26px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 13.5px; color: #334155; line-height: 1.6;">
                Kính gửi các Anh/Chị nhân viên phụ trách đón tiếp khách VIP (Phòng Hành chính),<br>
                Hệ thống CRM tự động tổng hợp danh sách khách có lịch hẹn tái khám, chụp MRI và làm cận lâm sàng vào <strong>ngày mai (${escapeHtml(tomorrowDateStr)})</strong>:
              </p>

              <!-- Danh sách thẻ khách -->
              <div style="margin: 20px 0;">
                ${guestCardsHtml}
              </div>

              <!-- Khung yêu cầu công việc chuẩn bị trước -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; margin: 24px 0;">
                <tr>
                  <td bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #004b87; padding: 18px 20px; border-radius: 4px;">
                    <div style="font-size: 13px; font-weight: 700; color: #004b87; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                      YÊU CẦU CÔNG TÁC PHỐI HỢP &amp; ĐÓN TIẾP:
                    </div>
                    
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; color: #1e293b; line-height: 1.6;">
                      <tr>
                        <td style="padding: 4px 0; vertical-align: top; width: 22px; font-weight: 700; color: #004b87;">1.</td>
                        <td style="padding: 4px 0; vertical-align: top;">
                          <strong>Liên hệ xác nhận trước với khách:</strong> Nhân viên phụ trách chủ động liên hệ với khách trước trong hôm nay để xác nhận khung giờ đến khám, địa điểm hẹn và lưu ý y khoa cần thiết (nhịn ăn xét nghiệm, mang theo hồ sơ cũ...).
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; vertical-align: top; width: 22px; font-weight: 700; color: #004b87;">2.</td>
                        <td style="padding: 4px 0; vertical-align: top;">
                          <strong>Phối hợp trước với Khoa / Phòng chức năng:</strong> Thông tin trước với Thư ký Khoa/Phòng khám hoặc Kỹ thuật viên Phòng chụp MRI / Cận lâm sàng để chuẩn bị thủ tục tiếp nhận ưu tiên theo quy trình tiếp đón khách VIP.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; vertical-align: top; width: 22px; font-weight: 700; color: #004b87;">3.</td>
                        <td style="padding: 4px 0; vertical-align: top;">
                          <strong>Đón tiếp trực tiếp:</strong> Có mặt tại Sảnh A hoặc Quầy tiếp đón VIP trước giờ hẹn ít nhất 15 phút để đón tiếp và hỗ trợ khách chu đáo, đúng tác phong.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Nút liên kết mở hệ thống CRM -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0 16px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td bgcolor="#004b87" style="background-color: #004b87; border-radius: 6px; padding: 12px 28px;">
                          <a href="${appUrl}/dashboard/crm" style="color: #ffffff !important; text-decoration: none; font-size: 13.5px; font-weight: 700; display: inline-block;">
                            Truy cập phân hệ CRM để xem chi tiết hồ sơ khách
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Chân trang liên hệ hành chính chuẩn mực -->
          <tr>
            <td bgcolor="#f8fafc" style="background-color: #f8fafc; padding: 20px 28px; font-size: 12px; color: #475569; border-top: 1px solid #e2e8f0; line-height: 1.65;">
              <strong style="color: #0f172a; text-transform: uppercase;">Phòng Hành chính &middot; Bệnh viện Đại học Y Dược TP. Hồ Chí Minh</strong><br>
              &bull; Địa chỉ: <strong>215 Hồng Bàng, Phường Chợ Lớn, TP. Hồ Chí Minh</strong><br>
              &bull; Email tiếp nhận: <a href="mailto:hanhchinh@umc.edu.vn" style="color: #004b87; text-decoration: none; font-weight: 600;">hanhchinh@umc.edu.vn</a><br>
              &bull; Điện thoại nội bộ: <strong>5421</strong> (Phụ trách Quản lý Công việc) hoặc <strong>5324</strong> (Thư ký Phòng)
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, html };
}
