/**
 * Mẫu email đôn đốc tiến độ công việc dành cho Thư ký / Đầu mối đơn vị.
 * Tuân thủ quy định hành chính Bệnh viện Đại học Y Dược TP.HCM:
 * - Đa dạng phong cách thiết kế để lãnh đạo/người dùng lựa chọn duyệt.
 * - Tương thích 100% với Outlook / Office 365, Gmail, Apple Mail, di động.
 * - Thông tin liên hệ chuẩn mực: 215 Hồng Bàng, Phường Chợ Lớn, TP.HCM · hanhchinh@umc.edu.vn · ĐT: 5421 & 5324.
 */

export interface WorkReminderItemData {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  reasonText: string;
  isOverdue?: boolean;
}

export type WorkReminderStyle = 'modern' | 'minimal' | 'formal' | 'classic';

export interface WorkReminderEmailProps {
  recipientName?: string | null;
  department: string;
  items: WorkReminderItemData[];
  appUrl: string;
  style?: WorkReminderStyle;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
}

// ============================================================================
// MẪU 1: EXECUTIVE MEDICAL (Y TẾ HIỆN ĐẠI & SANG TRỌNG - KHUYÊN DÙNG)
// ============================================================================
export function renderModernWorkReminder({
  recipientName,
  department,
  items,
  appUrl,
}: WorkReminderEmailProps): { subject: string; html: string } {
  const safeDept = escapeHtml(department);
  const safeName = recipientName ? escapeHtml(recipientName.trim()) : '';
  const subject = `[UMC-Office] Đôn đốc tiến độ ${items.length} nhiệm vụ của ${safeDept} cần cập nhật báo cáo`;

  const overdueCount = items.filter((i) => i.isOverdue).length;
  const otherCount = items.length - overdueCount;

  const cardsHtml = items
    .map((item, idx) => {
      const safeTitle = escapeHtml(item.title);
      const safeStatus = escapeHtml(item.status);
      const safeDue = item.dueDate ? item.dueDate.split('-').reverse().join('/') : 'Chưa xác định';
      const link = `${appUrl}/dashboard/work/items/${item.id}`;
      const borderColor = item.isOverdue ? '#e11d48' : '#0284c7';
      const badgeBg = item.isOverdue ? '#fff1f2' : '#f0f9ff';
      const badgeColor = item.isOverdue ? '#be123c' : '#0369a1';
      const badgeBorder = item.isOverdue ? '#fecdd3' : '#bae6fd';

      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 12px; background-color: #ffffff; border: 1px solid #e2e8f0; border-left: 5px solid ${borderColor}; border-radius: 8px; box-shadow: 0 1px 3px rgba(15,23,42,0.04);">
          <tr>
            <td style="padding: 16px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="26" valign="top" style="vertical-align: top; padding-right: 10px;">
                    <div style="background-color: #f1f5f9; color: #475569; font-size: 11px; font-weight: 700; width: 26px; height: 26px; line-height: 26px; border-radius: 50%; text-align: center;">
                      ${idx + 1}
                    </div>
                  </td>
                  <td valign="top" style="vertical-align: top;">
                    <a href="${link}" style="font-size: 14.5px; font-weight: 700; color: #0369a1; text-decoration: none; line-height: 1.45; display: block;">
                      ${safeTitle}
                    </a>
                    <div style="margin-top: 8px;">
                      <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; padding: 3px 10px; border-radius: 12px; font-size: 11.5px; font-weight: 700;">
                        ${escapeHtml(item.reasonText)}
                      </span>
                      <span style="font-size: 12px; color: #64748b; margin-left: 8px;">
                        &bull; Hạn: <strong style="color: #0f172a;">${safeDue}</strong> &bull; Trạng thái: <strong style="color: #334155;">${safeStatus}</strong>
                      </span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
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
        <table role="presentation" width="660" cellpadding="0" cellspacing="0" border="0" style="max-width: 660px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);">
          
          <!-- Header chuẩn nhận diện UMC Hiện đại -->
          <tr>
            <td bgcolor="#004b87" style="background-color: #004b87; padding: 26px 30px; color: #ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td bgcolor="#ffffff" style="background-color: #ffffff; padding: 5px 12px; border-radius: 6px; font-weight: 900; font-size: 13px; color: #004b87; letter-spacing: 1px;">
                          UMC
                        </td>
                        <td style="padding-left: 12px;">
                          <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.2px; color: #bae6fd; text-transform: uppercase;">
                            BỆNH VIỆN ĐẠI HỌC Y DƯỢC TP. HỒ CHÍ MINH
                          </div>
                          <div style="font-size: 12px; color: #e0f2fe; margin-top: 2px;">
                            PHÒNG HÀNH CHÍNH &middot; HỆ THỐNG ĐIỀU HÀNH UMC-OFFICE
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.15);">
                <span style="display: inline-block; background-color: rgba(255,255,255,0.18); color: #ffffff; font-size: 10.5px; font-weight: 700; padding: 3px 10px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">
                  VĂN BẢN ĐÔN ĐỐC TIẾN ĐỘ
                </span>
                <div style="font-size: 20px; font-weight: 800; color: #ffffff; line-height: 1.3; letter-spacing: -0.2px;">
                  Thông Báo Đôn Đốc Thực Hiện Nhiệm Vụ
                </div>
              </div>
            </td>
          </tr>

          <!-- Thân email -->
          <tr>
            <td style="padding: 28px 30px;">
              <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">
                ${safeName ? `Kính gửi: Anh/Chị ${safeName} (Đầu mối phụ trách &middot; ${safeDept}),` : `Kính gửi: Đầu mối phụ trách công việc &middot; ${safeDept},`}
              </div>

              <p style="margin: 0 0 20px 0; font-size: 13.5px; color: #475569; line-height: 1.6;">
                Phòng Hành chính trân trọng gửi thông báo danh sách <strong>${items.length} nhiệm vụ</strong> được giao của đơn vị hiện đang cần cập nhật tiến độ hoặc sắp đến hạn xử lý theo chỉ đạo của Ban Giám đốc Bệnh viện:
              </p>

              <!-- KPI Strip tóm tắt chỉ số -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 22px;">
                <tr>
                  <td width="32%" bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Tổng nhiệm vụ</div>
                    <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 2px;">${items.length}</div>
                  </td>
                  <td width="2%">&nbsp;</td>
                  <td width="32%" bgcolor="#fff1f2" style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 12px 14px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 700; color: #9f1239; text-transform: uppercase; letter-spacing: 0.5px;">Quá hạn xử lý</div>
                    <div style="font-size: 22px; font-weight: 800; color: #be123c; margin-top: 2px;">${overdueCount}</div>
                  </td>
                  <td width="2%">&nbsp;</td>
                  <td width="32%" bgcolor="#f0f9ff" style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px 14px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px;">Chờ cập nhật / Hạn tới</div>
                    <div style="font-size: 22px; font-weight: 800; color: #0284c7; margin-top: 2px;">${otherCount}</div>
                  </td>
                </tr>
              </table>

              <!-- Danh sách Thẻ Nhiệm Vụ -->
              ${cardsHtml}

              <!-- Khung 3 Tiêu chí Báo cáo Tinh gọn -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 22px 0; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 18px 20px;">
                    <div style="font-size: 12.5px; font-weight: 800; color: #004b87; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                      📌 3 TIÊU CHÍ BẮT BUỘC KHI CẬP NHẬT BÁO CÁO TIẾN ĐỘ:
                    </div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 12.5px; color: #334155; line-height: 1.6;">
                      <tr>
                        <td width="20" valign="top" style="color: #004b87; font-weight: 700; padding: 3px 0;">1.</td>
                        <td style="padding: 3px 0;"><strong>Kết quả cụ thể:</strong> Nêu rõ công việc đã hoàn thành hoặc đang xử lý; không ghi chú chung chung.</td>
                      </tr>
                      <tr>
                        <td width="20" valign="top" style="color: #004b87; font-weight: 700; padding: 3px 0;">2.</td>
                        <td style="padding: 3px 0;"><strong>Số liệu &amp; Minh chứng:</strong> Nêu rõ tỷ lệ %, số lượng hồ sơ/văn bản kèm số ký hiệu văn bản ban hành.</td>
                      </tr>
                      <tr>
                        <td width="20" valign="top" style="color: #004b87; font-weight: 700; padding: 3px 0;">3.</td>
                        <td style="padding: 3px 0;"><strong>Nghiệm thu hoàn thành:</strong> Hệ thống không công nhận hoàn thành nếu không có nội dung giải trình.</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Nút CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0 12px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td bgcolor="#004b87" style="background-color: #004b87; border-radius: 8px; padding: 13px 32px; box-shadow: 0 4px 6px -1px rgba(0, 75, 135, 0.3);">
                          <a href="${appUrl}/dashboard/work/items" style="color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; display: inline-block; letter-spacing: 0.3px;">
                            Truy cập UMC-Office để cập nhật tiến độ &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12.5px; color: #64748b; margin-top: 20px; font-style: italic; text-align: center;">
                ${safeName ? 'Trân trọng cảm ơn sự phối hợp kịp thời của Anh/Chị và đơn vị.' : 'Trân trọng cảm ơn sự phối hợp kịp thời của Quý đơn vị.'}
              </p>
            </td>
          </tr>

          <!-- Chân trang -->
          <tr>
            <td bgcolor="#f8fafc" style="background-color: #f8fafc; padding: 20px 30px; font-size: 12px; color: #475569; border-top: 1px solid #e2e8f0; line-height: 1.65;">
              <strong style="color: #0f172a; text-transform: uppercase;">Phòng Hành chính &middot; Bệnh viện Đại học Y Dược TP. Hồ Chí Minh</strong><br>
              &bull; Trụ sở: <strong>215 Hồng Bàng, Phường Chợ Lớn, TP. Hồ Chí Minh</strong><br>
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

// ============================================================================
// MẪU 2: CLEAN MINIMALIST (TỐI GIẢN TINH TẾ - PHONG CÁCH APPLE / LINEAR)
// ============================================================================
export function renderMinimalWorkReminder({
  recipientName,
  department,
  items,
  appUrl,
}: WorkReminderEmailProps): { subject: string; html: string } {
  const safeDept = escapeHtml(department);
  const safeName = recipientName ? escapeHtml(recipientName.trim()) : '';
  const subject = `[Đôn đốc tiến độ] ${items.length} nhiệm vụ của ${safeDept} cần cập nhật báo cáo`;

  const itemRowsHtml = items
    .map((item, idx) => {
      const safeTitle = escapeHtml(item.title);
      const safeStatus = escapeHtml(item.status);
      const safeDue = item.dueDate ? item.dueDate.split('-').reverse().join('/') : 'Chưa xác định';
      const link = `${appUrl}/dashboard/work/items/${item.id}`;
      const badgeBg = item.isOverdue ? '#fee2e2' : '#f1f5f9';
      const badgeColor = item.isOverdue ? '#991b1b' : '#334155';

      return `
        <div style="padding: 16px 0; border-bottom: 1px solid #f1f5f9;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="top" style="vertical-align: top;">
                <div style="font-size: 11px; font-weight: 600; color: #94a3b8; margin-bottom: 3px;">
                  NHIỆM VỤ 0${idx + 1}
                </div>
                <a href="${link}" style="font-size: 14.5px; font-weight: 600; color: #0f172a; text-decoration: none; line-height: 1.45; display: block;">
                  ${safeTitle}
                </a>
                <div style="margin-top: 8px; font-size: 12px; color: #64748b;">
                  <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">
                    ${escapeHtml(item.reasonText)}
                  </span>
                  <span style="margin-left: 8px;">Hạn: <strong>${safeDue}</strong></span>
                  <span style="margin-left: 8px; color: #94a3b8;">&bull;</span>
                  <span style="margin-left: 8px;">Trạng thái: ${safeStatus}</span>
                </div>
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
<body style="margin: 0; padding: 32px 10px; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="max-width: 620px; width: 100%; background-color: #ffffff; border-radius: 8px; border: 1px solid #e4e4e7; padding: 36px 36px;">
          
          <!-- Header tối giản -->
          <tr>
            <td style="padding-bottom: 24px; border-bottom: 1px solid #f4f4f5;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="font-size: 13px; font-weight: 800; letter-spacing: 1px; color: #0284c7;">
                      UMC-OFFICE
                    </span>
                    <span style="font-size: 12px; color: #a1a1aa; margin-left: 8px;">
                      Bệnh viện Đại học Y Dược TP.HCM
                    </span>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; font-weight: 600; color: #71717a; background-color: #f4f4f5; padding: 3px 8px; border-radius: 4px;">
                      Đôn đốc tiến độ
                    </span>
                  </td>
                </tr>
              </table>
              <div style="font-size: 22px; font-weight: 700; color: #09090b; margin-top: 18px; letter-spacing: -0.3px;">
                Cập nhật tiến độ nhiệm vụ được giao
              </div>
              <div style="font-size: 13.5px; color: #71717a; margin-top: 4px;">
                Đơn vị phụ trách: <strong style="color: #18181b;">${safeDept}</strong>
              </div>
            </td>
          </tr>

          <!-- Nội dung -->
          <tr>
            <td style="padding-top: 24px;">
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #3f3f46;">
                ${safeName ? `Kính gửi Anh/Chị <strong>${safeName}</strong>,` : 'Kính gửi <strong>Đầu mối phụ trách đơn vị</strong>,'}
              </p>
              <p style="margin: 0 0 20px 0; font-size: 13.5px; color: #71717a;">
                Hệ thống ghi nhận đơn vị hiện có <strong>${items.length} nhiệm vụ</strong> sắp đến hạn hoặc chưa có cập nhật tiến độ định kỳ. Đề nghị đơn vị rà soát và cập nhật kết quả:
              </p>

              <!-- Danh sách nhiệm vụ phẳng -->
              <div style="border-top: 1px solid #f4f4f5; margin-bottom: 24px;">
                ${itemRowsHtml}
              </div>

              <!-- Hộp lưu ý tối giản -->
              <div style="background-color: #fafafa; border: 1px solid #e4e4e7; border-left: 3px solid #0284c7; padding: 14px 16px; border-radius: 6px; font-size: 12.5px; color: #52525b; line-height: 1.6; margin-bottom: 28px;">
                <strong>Lưu ý khi báo cáo kết quả:</strong> Nêu rõ sản phẩm đầu ra, tỷ lệ % hoàn thành và văn bản nghiệm thu đính kèm. Không bấm hoàn thành khi chưa có kết quả bàn giao.
              </div>

              <!-- Nút CTA đen tuyền tối giản -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td>
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td bgcolor="#09090b" style="background-color: #09090b; border-radius: 6px; padding: 11px 24px;">
                          <a href="${appUrl}/dashboard/work/items" style="color: #fafafa !important; text-decoration: none; font-size: 13px; font-weight: 600; display: inline-block;">
                            Mở UMC-Office cập nhật báo cáo &rarr;
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
                Hỗ trợ kỹ thuật &amp; quản lý công việc: ĐT nội bộ 5421 &middot; hanhchinh@umc.edu.vn
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

// ============================================================================
// MẪU 3: FORMAL ADMINISTRATION (HÀNH CHÍNH TRANG TRỌNG - THỂ THỨC BỆNH VIỆN)
// ============================================================================
export function renderFormalWorkReminder({
  recipientName,
  department,
  items,
  appUrl,
}: WorkReminderEmailProps): { subject: string; html: string } {
  const safeDept = escapeHtml(department);
  const safeName = recipientName ? escapeHtml(recipientName.trim()) : '';
  const subject = `[THÔNG BÁO ĐÔN ĐỐC] Tiến độ thực hiện nhiệm vụ được giao đối với ${safeDept}`;

  const tableRowsHtml = items
    .map((item, idx) => {
      const safeTitle = escapeHtml(item.title);
      const safeStatus = escapeHtml(item.status);
      const safeDue = item.dueDate ? item.dueDate.split('-').reverse().join('/') : 'Chưa xác định';
      const link = `${appUrl}/dashboard/work/items/${item.id}`;
      const statusColor = item.isOverdue ? '#991b1b' : '#0369a1';
      const statusBg = item.isOverdue ? '#fef2f2' : '#f0fdf4';

      return `
        <tr>
          <td align="center" style="padding: 10px 8px; border: 1px solid #cbd5e1; font-size: 12.5px; color: #475569; font-weight: 600;">
            ${idx + 1}
          </td>
          <td style="padding: 10px 12px; border: 1px solid #cbd5e1; font-size: 13px;">
            <a href="${link}" style="color: #004b87; font-weight: 700; text-decoration: none;">
              ${safeTitle}
            </a>
          </td>
          <td align="center" style="padding: 10px 8px; border: 1px solid #cbd5e1; font-size: 12.5px; white-space: nowrap; color: #0f172a; font-weight: 600;">
            ${safeDue}
          </td>
          <td align="center" style="padding: 10px 8px; border: 1px solid #cbd5e1; font-size: 12px; white-space: nowrap; color: #334155;">
            ${safeStatus}
          </td>
          <td align="center" style="padding: 10px 8px; border: 1px solid #cbd5e1; font-size: 12px; white-space: nowrap; background-color: ${statusBg}; color: ${statusColor}; font-weight: 700;">
            ${escapeHtml(item.reasonText)}
          </td>
        </tr>
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
<body style="margin: 0; padding: 24px 10px; background-color: #e2e8f0; font-family: 'Times New Roman', Times, serif, -apple-system; color: #0f172a; line-height: 1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <table role="presentation" width="670" cellpadding="0" cellspacing="0" border="0" style="max-width: 670px; width: 100%; background-color: #ffffff; border: 1px solid #94a3b8; box-shadow: 0 4px 10px rgba(0,0,0,0.06); padding: 36px 36px;">
          
          <!-- Thể thức cơ quan ban hành -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="55%" align="center" valign="top" style="vertical-align: top; font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; line-height: 1.35;">
                    <div>ĐẠI HỌC Y DƯỢC TP. HỒ CHÍ MINH</div>
                    <div style="font-weight: 700; color: #004b87;">BỆNH VIỆN ĐẠI HỌC Y DƯỢC</div>
                    <div style="font-weight: 700; margin-top: 1px;">PHÒNG HÀNH CHÍNH</div>
                    <div style="width: 100px; height: 1px; background-color: #004b87; margin: 4px auto 0 auto;"></div>
                  </td>
                  <td width="45%" align="center" valign="top" style="vertical-align: top; font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; line-height: 1.35;">
                    <div style="font-weight: 700;">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                    <div style="font-weight: 700; font-size: 11.5px;">Độc lập - Tự do - Hạnh phúc</div>
                    <div style="width: 120px; height: 1px; background-color: #334155; margin: 4px auto 0 auto;"></div>
                  </td>
                </tr>
              </table>

              <!-- Tiêu đề văn bản -->
              <div style="text-align: center; margin: 26px 0 16px 0; font-family: Arial, sans-serif;">
                <div style="font-size: 16px; font-weight: 800; color: #004b87; text-transform: uppercase; letter-spacing: 0.5px;">
                  THÔNG BÁO ĐÔN ĐỐC TIẾN ĐỘ THỰC HIỆN NHIỆM VỤ
                </div>
                <div style="font-size: 12.5px; font-style: italic; color: #64748b; margin-top: 3px;">
                  (Trích xuất từ Hệ thống Quản lý công việc UMC-Office)
                </div>
              </div>

              <!-- Kính gửi -->
              <div style="font-family: Arial, sans-serif; font-size: 13.5px; margin-bottom: 16px; line-height: 1.6;">
                <strong>Kính gửi:</strong> ${safeName ? `Anh/Chị ${safeName} &middot; Đầu mối phụ trách ${safeDept}` : `Đầu mối phụ trách công việc &middot; ${safeDept}`},
              </div>

              <p style="font-family: Arial, sans-serif; font-size: 13px; color: #334155; margin: 0 0 16px 0; line-height: 1.6; text-align: justify;">
                Căn cứ chỉ đạo của Ban Giám đốc Bệnh viện về việc theo dõi và đôn đốc tiến độ thực hiện các nhiệm vụ được phân công; Phòng Hành chính thông báo danh mục <strong>${items.length} nhiệm vụ</strong> của đơn vị hiện đang đến hạn hoặc quá hạn cần cập nhật báo cáo:
              </p>

              <!-- Bảng danh mục công việc -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-family: Arial, sans-serif;">
                <thead>
                  <tr bgcolor="#f1f5f9" style="background-color: #f1f5f9; font-size: 11.5px; font-weight: 700; color: #1e293b; text-transform: uppercase;">
                    <th style="padding: 9px 8px; border: 1px solid #cbd5e1; width: 34px;">STT</th>
                    <th style="padding: 9px 12px; border: 1px solid #cbd5e1; text-align: left;">Nội dung nhiệm vụ</th>
                    <th style="padding: 9px 8px; border: 1px solid #cbd5e1; width: 85px;">Hạn hoàn thành</th>
                    <th style="padding: 9px 8px; border: 1px solid #cbd5e1; width: 95px;">Tiến độ</th>
                    <th style="padding: 9px 8px; border: 1px solid #cbd5e1; width: 110px;">Tình trạng đôn đốc</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRowsHtml}
                </tbody>
              </table>

              <!-- Quy chế thực hiện -->
              <div style="font-family: Arial, sans-serif; font-size: 12.5px; color: #334155; line-height: 1.6; margin-bottom: 24px; padding: 12px 16px; background-color: #f8fafc; border: 1px solid #e2e8f0;">
                <strong>YÊU CẦU ĐỐI VỚI ĐƠN VỊ:</strong><br>
                1. Đăng nhập hệ thống UMC-Office và cập nhật báo cáo kết quả cụ thể kèm văn bản nghiệm thu trước 17h00 ngày hôm nay.<br>
                2. Trường hợp vướng mắc tiến độ, phải nêu rõ nguyên nhân và đơn vị phối hợp để Phòng Hành chính tổng hợp báo cáo Ban Giám đốc.
              </div>

              <!-- Nút liên kết -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td bgcolor="#004b87" style="background-color: #004b87; border-radius: 4px; padding: 11px 26px;">
                          <a href="${appUrl}/dashboard/work/items" style="color: #ffffff !important; text-decoration: none; font-size: 13px; font-weight: 700; font-family: Arial, sans-serif;">
                            TRUY CẬP HỆ THỐNG UMC-OFFICE &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Ký tên ban hành -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, sans-serif; margin-top: 20px;">
                <tr>
                  <td width="50%">&nbsp;</td>
                  <td width="50%" align="center">
                    <div style="font-size: 12.5px; font-weight: 700; color: #004b87; text-transform: uppercase;">
                      PHÒNG HÀNH CHÍNH
                    </div>
                    <div style="font-size: 11.5px; font-style: italic; color: #64748b; margin-top: 3px;">
                      (Ký số &amp; Ban hành qua UMC-Office)
                    </div>
                  </td>
                </tr>
              </table>

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

// ============================================================================
// MẪU 4: CLASSIC TABLE (MẪU BẢNG BAN ĐẦU - ĐỂ SO SÁNH)
// ============================================================================
export function renderClassicWorkReminder({
  recipientName,
  department,
  items,
  appUrl,
}: WorkReminderEmailProps): { subject: string; html: string } {
  const safeDept = escapeHtml(department);
  const safeName = recipientName ? escapeHtml(recipientName.trim()) : '';
  const subject = `[UMC-Office] Đôn đốc tiến độ ${items.length} nhiệm vụ của ${safeDept} cần cập nhật báo cáo`;

  const itemRowsHtml = items
    .map((item, idx) => {
      const safeTitle = escapeHtml(item.title);
      const safeStatus = escapeHtml(item.status);
      const safeDue = item.dueDate ? item.dueDate.split('-').reverse().join('/') : 'Chưa xác định';
      const link = `${appUrl}/dashboard/work/items/${item.id}`;
      const statusColor = item.isOverdue ? '#b91c1c' : '#b45309';
      const statusBg = item.isOverdue ? '#fef2f2' : '#fffbeb';
      const statusBorder = item.isOverdue ? '#fecaca' : '#fde68a';

      return `
        <tr>
          <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; vertical-align: top; width: 36px; text-align: center; color: #64748b; font-weight: 600;">
            ${idx + 1}
          </td>
          <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; vertical-align: top;">
            <a href="${link}" style="color: #0369a1; text-decoration: none; font-weight: 700; font-size: 14px; line-height: 1.45; display: block;">
              ${safeTitle}
            </a>
            <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
              Trạng thái: <span style="color: #334155; font-weight: 600;">${safeStatus}</span> &middot; Hạn xử lý: <span style="color: #0f172a; font-weight: 600;">${safeDue}</span>
            </div>
          </td>
          <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 12px; vertical-align: top; text-align: right; white-space: nowrap;">
            <span style="display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: 600; background-color: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder};">
              ${escapeHtml(item.reasonText)}
            </span>
          </td>
        </tr>
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
        <table role="presentation" width="660" cellpadding="0" cellspacing="0" border="0" style="max-width: 660px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);">
          
          <tr>
            <td bgcolor="#004b87" style="background-color: #004b87; padding: 24px 28px; color: #ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left">
                    <div style="font-size: 11px; font-weight: 700; letter-spacing: 1.2px; color: #bae6fd; text-transform: uppercase;">
                      BỆNH VIỆN ĐẠI HỌC Y DƯỢC TP. HỒ CHÍ MINH
                    </div>
                    <div style="font-size: 17px; font-weight: 700; color: #ffffff; margin-top: 4px; letter-spacing: 0.3px; line-height: 1.35;">
                      PHÒNG HÀNH CHÍNH &middot; HỆ THỐNG QUẢN LÝ CÔNG VIỆC UMC-OFFICE
                    </div>
                    <div style="font-size: 12.5px; color: #e0f2fe; margin-top: 4px;">
                      Thông báo đôn đốc tiến độ thực hiện nhiệm vụ được giao
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 26px 28px;">
              <div style="font-size: 14.5px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">
                ${safeName ? `Kính gửi: Anh/Chị ${safeName} (Đầu mối phụ trách &middot; ${safeDept}),` : `Kính gửi: Đầu mối phụ trách công việc &middot; ${safeDept},`}
              </div>

              <p style="margin: 0 0 16px 0; font-size: 13.5px; color: #334155; line-height: 1.6;">
                Phòng Hành chính xin thông báo danh sách <strong>${items.length} nhiệm vụ</strong> của đơn vị hiện đang sắp đến hạn hoặc cần cập nhật tiến độ định kỳ theo chỉ đạo của Lãnh đạo Bệnh viện:
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; margin: 18px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
                <thead>
                  <tr bgcolor="#e2e8f0" style="background-color: #e2e8f0; color: #475569; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px;">
                    <th style="padding: 10px 14px; text-align: center; width: 36px; font-weight: 700;">STT</th>
                    <th style="padding: 10px 14px; text-align: left; font-weight: 700;">Nội dung nhiệm vụ</th>
                    <th style="padding: 10px 14px; text-align: right; font-weight: 700;">Tình trạng hạn</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRowsHtml}
                </tbody>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
                <tr>
                  <td bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #004b87; padding: 18px 20px; border-radius: 4px;">
                    <div style="font-size: 13px; font-weight: 700; color: #004b87; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                      TIÊU CHÍ BẮT BUỘC KHI CẬP NHẬT BÁO CÁO TRÊN UMC-OFFICE:
                    </div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; color: #1e293b; line-height: 1.6;">
                      <tr>
                        <td style="padding: 4px 0; vertical-align: top; width: 22px; font-weight: 700; color: #004b87;">1.</td>
                        <td style="padding: 4px 0; vertical-align: top;">
                          <strong>Nội dung kết quả cụ thể:</strong> Trình bày chi tiết các phần việc đã hoàn thành hoặc đang xử lý.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; vertical-align: top; width: 22px; font-weight: 700; color: #004b87;">2.</td>
                        <td style="padding: 4px 0; vertical-align: top;">
                          <strong>Số liệu định lượng &amp; Minh chứng:</strong> Nêu rõ tỷ lệ %, số lượng hồ sơ/văn bản.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; vertical-align: top; width: 22px; font-weight: 700; color: #004b87;">3.</td>
                        <td style="padding: 4px 0; vertical-align: top;">
                          <strong>Quy định hoàn thành:</strong> Không công nhận hoàn thành đối với nhiệm vụ không có báo cáo giải trình.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0 16px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td bgcolor="#004b87" style="background-color: #004b87; border-radius: 6px; padding: 12px 28px;">
                          <a href="${appUrl}/dashboard/work/items" style="color: #ffffff !important; text-decoration: none; font-size: 13.5px; font-weight: 700; display: inline-block;">
                            Truy cập phân hệ Quản lý công việc (UMC-Office)
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12.5px; color: #64748b; margin-top: 20px; font-style: italic; text-align: center;">
                ${safeName ? 'Trân trọng cảm ơn sự phối hợp kịp thời của Anh/Chị và đơn vị.' : 'Trân trọng cảm ơn sự phối hợp kịp thời của Quý đơn vị.'}
              </p>
            </td>
          </tr>

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

// Hàm chính điều phối mẫu theo tuỳ chọn (Mặc định: 'modern')
export function renderWorkReminderHtml(
  props: WorkReminderEmailProps,
  style: WorkReminderStyle = props.style || 'modern'
): { subject: string; html: string } {
  switch (style) {
    case 'minimal':
      return renderMinimalWorkReminder(props);
    case 'formal':
      return renderFormalWorkReminder(props);
    case 'classic':
      return renderClassicWorkReminder(props);
    case 'modern':
    default:
      return renderModernWorkReminder(props);
  }
}
