/**
 * Mẫu email đôn đốc tiến độ công việc dành cho Thư ký / Đầu mối đơn vị.
 * Tuân thủ quy định hành chính Bệnh viện Đại học Y Dược TP.HCM:
 * - Không sử dụng emoji biểu cảm không trang trọng.
 * - Tiêu chí báo cáo tiến độ chuẩn mực, rõ ràng, bắt buộc minh chứng kết quả.
 * - Tương thích 100% với Outlook / Office 365 (table-based, bgcolor dự phòng, không dùng gradient).
 * - Thông tin liên hệ: 215 Hồng Bàng, Phường Chợ Lớn, TP.HCM · hanhchinh@umc.edu.vn · ĐT: 5421 & 5324.
 */

export interface WorkReminderItemData {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  reasonText: string;
  isOverdue?: boolean;
}

export interface WorkReminderEmailProps {
  recipientName: string;
  department: string;
  items: WorkReminderItemData[];
  appUrl: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
}

export function renderWorkReminderHtml({
  recipientName,
  department,
  items,
  appUrl,
}: WorkReminderEmailProps): { subject: string; html: string } {
  const safeDept = escapeHtml(department);
  const safeName = escapeHtml(recipientName);

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

          <!-- Thân email -->
          <tr>
            <td style="padding: 26px 28px;">
              
              <div style="font-size: 14.5px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">
                Kính gửi: Anh/Chị ${safeName} (Đầu mối phụ trách &middot; ${safeDept}),
              </div>

              <p style="margin: 0 0 16px 0; font-size: 13.5px; color: #334155; line-height: 1.6;">
                Phòng Hành chính xin thông báo danh sách <strong>${items.length} nhiệm vụ</strong> của đơn vị hiện đang sắp đến hạn hoặc cần cập nhật tiến độ định kỳ theo chỉ đạo của Lãnh đạo Bệnh viện:
              </p>

              <!-- Bảng danh sách công việc -->
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

              <!-- KHUNG QUY ĐỊNH BẮT BUỘC KHI CẬP NHẬT BÁO CÁO -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; margin: 24px 0;">
                <tr>
                  <td bgcolor="#f8fafc" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-left: 4px solid #004b87; padding: 18px 20px; border-radius: 4px;">
                    <div style="font-size: 13px; font-weight: 700; color: #004b87; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                      TIÊU CHÍ BẮT BUỘC KHI CẬP NHẬT BÁO CÁO TRÊN UMC-OFFICE:
                    </div>
                    <div style="font-size: 12px; color: #475569; margin-bottom: 12px; font-style: italic;">
                      (Nhằm bảo đảm chất lượng dữ liệu phục vụ điều hành và tổng hợp báo cáo định kỳ cho Ban Giám đốc, đề nghị thực hiện nghiêm túc các tiêu chí sau):
                    </div>
                    
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; color: #1e293b; line-height: 1.6;">
                      <tr>
                        <td style="padding: 4px 0; vertical-align: top; width: 22px; font-weight: 700; color: #004b87;">1.</td>
                        <td style="padding: 4px 0; vertical-align: top;">
                          <strong>Nội dung kết quả cụ thể:</strong> Trình bày chi tiết các phần việc đã hoàn thành hoặc đang xử lý đến ngày báo cáo. Tuyệt đối không để trống nội dung hoặc chỉ ghi chú chung chung (như: <em>"đang thực hiện"</em>, <em>"đã làm"</em>, <em>"tiếp tục theo dõi"</em>).
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; vertical-align: top; width: 22px; font-weight: 700; color: #004b87;">2.</td>
                        <td style="padding: 4px 0; vertical-align: top;">
                          <strong>Số liệu định lượng &amp; Minh chứng:</strong> Nêu rõ tỷ lệ % hoàn thành, số lượng hồ sơ / văn bản / ca bệnh / hạng mục đã xử lý; đính kèm hoặc trích dẫn số, ký hiệu văn bản ban hành, biên bản làm việc để phục vụ nghiệm thu.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; vertical-align: top; width: 22px; font-weight: 700; color: #004b87;">3.</td>
                        <td style="padding: 4px 0; vertical-align: top;">
                          <strong>Tiến độ &amp; Khó khăn vướng mắc:</strong> Nếu có nguy cơ chậm tiến độ, phải ghi rõ nguyên nhân, các đơn vị phối hợp chưa hoàn tất và đề xuất cụ thể hướng xử lý với Lãnh đạo Phòng/Ban Giám đốc.
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; vertical-align: top; width: 22px; font-weight: 700; color: #004b87;">4.</td>
                        <td style="padding: 4px 0; vertical-align: top;">
                          <strong>Quy định chuyển trạng thái "Hoàn thành":</strong> Chỉ chuyển trạng thái sang "Hoàn thành" khi đã cập nhật đầy đủ báo cáo kết quả và có sản phẩm hoàn tất. Hệ thống và Phòng Hành chính <strong>không công nhận hoàn thành</strong> đối với nhiệm vụ chỉ bấm thay đổi trạng thái mà không có nội dung báo cáo giải trình.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Nút liên kết mở hệ thống -->
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
                Trân trọng cảm ơn sự phối hợp kịp thời của Anh/Chị và đơn vị.
              </p>
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
