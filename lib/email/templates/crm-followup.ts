/**
 * Mẫu email NỘI BỘ gửi cho nhân viên Phòng Hành chính / Tiếp đón VIP.
 * Thông báo danh sách khách VIP có lịch hẹn tái khám / Chụp MRI / Cận lâm sàng vào ngày mai (N+1)
 * theo phong cách Apple Minimalist (Tối giản tinh tế, chuẩn mực, đồng bộ với UMC-Office).
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
  const subject = `[CRM] Danh sách ${guests.length} khách VIP có lịch hẹn tái khám / Chụp MRI ngày mai (${tomorrowDateStr})`;

  const safeTomorrow = escapeHtml(tomorrowDateStr);
  const totalGuests = guests.length;
  const withNotesCount = guests.filter((g) => g.followUpNote && g.followUpNote.trim().length > 0).length;
  const uniqueDoctors = new Set(guests.flatMap((g) => g.doctors).filter(Boolean));

  const guestCardsHtml = guests
    .map((g, idx) => {
      const titlePrefix = g.academicTitle ? `${g.academicTitle} ` : '';
      const guestName = `${titlePrefix}${g.fullName}`;
      const staffList = [g.staffName, ...g.companions].filter(Boolean).join(', ') || 'Chưa phân công';
      const doctorList = g.doctors.length > 0 ? g.doctors.join(', ') : 'Chưa ghi nhận';
      const serviceList = g.services.length > 0 ? g.services.join(', ') : 'Dẫn khám thông thường';

      return `
        <div style="padding: 18px 0; border-bottom: 1px solid #f4f4f5;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="top" style="vertical-align: top;">
                <div style="margin-bottom: 6px;">
                  <span style="display: inline-block; background-color: #09090b; color: #fef08a; font-weight: 700; font-size: 10.5px; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px; margin-right: 6px;">
                    ${escapeHtml(g.tier || 'VIP')}
                  </span>
                  <span style="font-size: 11px; font-weight: 700; color: #a1a1aa; letter-spacing: 0.5px;">
                    KHÁCH 0${idx + 1}
                  </span>
                </div>
                <div style="font-size: 15.5px; font-weight: 600; color: #09090b; line-height: 1.4;">
                  ${escapeHtml(guestName)}
                  ${g.organizationName ? `<span style="font-size: 13px; font-weight: 400; color: #71717a;"> &middot; ${escapeHtml(g.organizationName)}</span>` : ''}
                </div>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 10px; font-size: 13px; color: #3f3f46; line-height: 1.6;">
                  <tr>
                    <td style="width: 140px; padding: 3px 0; color: #71717a; font-weight: 500; vertical-align: top;">Nội dung hẹn / Dặn dò:</td>
                    <td style="padding: 3px 0; color: #b91c1c; font-weight: 600; vertical-align: top;">
                      ${escapeHtml(g.followUpNote || 'Tái khám theo hẹn')}
                    </td>
                  </tr>
                  <tr>
                    <td style="width: 140px; padding: 3px 0; color: #71717a; font-weight: 500; vertical-align: top;">Khoa phòng / Nơi đến:</td>
                    <td style="padding: 3px 0; color: #18181b; vertical-align: top;">
                      ${escapeHtml(g.destination || 'Phòng khám / Phòng MRI')} &middot; Bác sĩ: <strong style="color: #09090b;">${escapeHtml(doctorList)}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style="width: 140px; padding: 3px 0; color: #71717a; font-weight: 500; vertical-align: top;">Dịch vụ hỗ trợ:</td>
                    <td style="padding: 3px 0; color: #18181b; vertical-align: top;">
                      ${escapeHtml(serviceList)}
                    </td>
                  </tr>
                  <tr>
                    <td style="width: 140px; padding: 3px 0; color: #71717a; font-weight: 500; vertical-align: top;">Nhân viên đón tiếp:</td>
                    <td style="padding: 3px 0; color: #0284c7; font-weight: 600; vertical-align: top;">
                      ${escapeHtml(staffList)}
                    </td>
                  </tr>
                  ${
                    g.phone
                      ? `
                  <tr>
                    <td style="width: 140px; padding: 3px 0; color: #71717a; font-weight: 500; vertical-align: top;">Số điện thoại khách:</td>
                    <td style="padding: 3px 0; color: #18181b; font-weight: 500; vertical-align: top;">
                      <a href="tel:${escapeHtml(g.phone)}" style="color: #0284c7; text-decoration: none;">${escapeHtml(g.phone)}</a>
                    </td>
                  </tr>`
                      : ''
                  }
                </table>
              </td>
            </tr>
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
<body style="margin: 0; padding: 32px 10px; background-color: #f5f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="max-width: 620px; width: 100%; background-color: #ffffff; border-radius: 12px; border: 1px solid #e4e4e7; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05); padding: 36px 36px;">
          
          <!-- Header tối giản kiểu Apple: Hàng 1 CRM UMC, Hàng 2 Bệnh viện Đại học Y Dược TP. Hồ Chí Minh -->
          <tr>
            <td style="padding-bottom: 22px; border-bottom: 1px solid #f4f4f5;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left">
                    <span style="font-size: 11.5px; font-weight: 800; letter-spacing: 0.8px; color: #0284c7; background-color: #f0f9ff; border: 1px solid #bae6fd; padding: 3.5px 9px; border-radius: 6px; display: inline-block;">
                      CRM &middot; UMC
                    </span>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; font-weight: 600; color: #71717a; background-color: #f4f4f5; padding: 3.5px 9px; border-radius: 6px; white-space: nowrap; display: inline-block;">
                      Lịch hẹn ${safeTomorrow}
                    </span>
                  </td>
                </tr>
              </table>
              <div style="font-size: 12.5px; font-weight: 500; color: #71717a; margin-top: 8px; letter-spacing: 0.1px;">
                Bệnh viện Đại học Y Dược TP. Hồ Chí Minh
              </div>
              <div style="font-size: 22px; font-weight: 700; color: #09090b; margin-top: 16px; letter-spacing: -0.3px;">
                Danh sách tiếp đón khách VIP ngày mai
              </div>
              <div style="font-size: 13.5px; color: #71717a; margin-top: 4px;">
                Đơn vị phụ trách: <strong style="color: #18181b;">Bộ phận Tiếp đón VIP &middot; Phòng Hành chính</strong>
              </div>
            </td>
          </tr>

          <!-- Nội dung -->
          <tr>
            <td style="padding-top: 24px;">
              <p style="margin: 0 0 14px 0; font-size: 14px; color: #3f3f46;">
                Kính gửi <strong>Bộ phận Tiếp đón VIP &middot; Phòng Hành chính</strong>,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 13.5px; color: #71717a; line-height: 1.65;">
                Hệ thống CRM tự động tổng hợp danh sách <strong>${totalGuests} khách VIP</strong> có lịch hẹn tái khám, chụp MRI và làm cận lâm sàng vào <strong>ngày mai (${safeTomorrow})</strong> để nhân sự chủ động điều phối:
              </p>

              <!-- KPI Strip tóm tắt chỉ số kiểu Apple -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px; border-bottom: 1px solid #f4f4f5; padding-bottom: 18px;">
                <tr>
                  <td width="33%" style="padding: 0 10px 0 0;">
                    <div style="font-size: 11px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px;">Tổng khách VIP</div>
                    <div style="font-size: 24px; font-weight: 700; color: #18181b; margin-top: 2px;">${totalGuests}</div>
                  </td>
                  <td width="33%" style="padding: 0 10px;">
                    <div style="font-size: 11px; font-weight: 600; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px;">Có dặn dò / MRI</div>
                    <div style="font-size: 24px; font-weight: 700; color: #0284c7; margin-top: 2px;">${withNotesCount}</div>
                  </td>
                  <td width="34%" style="padding: 0 0 0 10px;">
                    <div style="font-size: 11px; font-weight: 600; color: #059669; text-transform: uppercase; letter-spacing: 0.5px;">Bác sĩ chuyên khoa</div>
                    <div style="font-size: 24px; font-weight: 700; color: #059669; margin-top: 2px;">${uniqueDoctors.size}</div>
                  </td>
                </tr>
              </table>

              <!-- Danh sách khách phẳng kiểu Apple -->
              <div style="margin-bottom: 24px;">
                ${guestCardsHtml}
              </div>

              <!-- Hộp lưu ý phối hợp đón tiếp kiểu Apple -->
              <div style="background-color: #fafafa; border: 1px solid #f4f4f5; border-radius: 8px; padding: 18px 20px; margin-bottom: 28px;">
                <div style="font-size: 13px; font-weight: 600; color: #18181b; margin-bottom: 8px;">
                  Gợi ý công tác phối hợp &amp; đón tiếp:
                </div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; color: #52525b; line-height: 1.65;">
                  <tr>
                    <td width="16" valign="top" style="color: #a1a1aa; padding: 3px 0;">&bull;</td>
                    <td style="padding: 3px 0;"><strong>Liên hệ xác nhận trước:</strong> Nhân viên phụ trách chủ động liên hệ với khách trước hôm nay để xác nhận khung giờ đến khám, địa điểm hẹn và các lưu ý y khoa (nhịn ăn, hồ sơ cũ...).</td>
                  </tr>
                  <tr>
                    <td width="16" valign="top" style="color: #a1a1aa; padding: 3px 0;">&bull;</td>
                    <td style="padding: 3px 0;"><strong>Phối hợp khoa phòng:</strong> Thông tin trước với Thư ký Khoa/Phòng khám hoặc Kỹ thuật viên Phòng chụp MRI để chuẩn bị thủ tục tiếp nhận chu đáo.</td>
                  </tr>
                  <tr>
                    <td width="16" valign="top" style="color: #a1a1aa; padding: 3px 0;">&bull;</td>
                    <td style="padding: 3px 0;"><strong>Đón tiếp trực tiếp:</strong> Có mặt tại Quầy tiếp đón VIP trước giờ hẹn ít nhất 15 phút để hỗ trợ khách theo đúng tác phong bệnh viện.</td>
                  </tr>
                </table>
              </div>

              <!-- Nút CTA đen tuyền tối giản -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td bgcolor="#09090b" style="background-color: #09090b; border-radius: 6px; padding: 11px 24px;">
                          <a href="${appUrl}/dashboard/crm" style="color: #fafafa !important; text-decoration: none; font-size: 13px; font-weight: 600; display: inline-block;">
                            Mở CRM xem chi tiết tiếp đón &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Chân trang tối giản -->
              <div style="padding-top: 20px; border-top: 1px solid #f4f4f5; font-size: 11.5px; color: #a1a1aa; line-height: 1.6;">
                Phòng Hành chính &middot; Bệnh viện Đại học Y Dược TP.HCM &middot; 215 Hồng Bàng, Phường Chợ Lớn, TP.HCM<br>
                Bộ phận Tiếp đón VIP &middot; ĐT nội bộ 5421 &middot; hanhchinh@umc.edu.vn
              </div>
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
