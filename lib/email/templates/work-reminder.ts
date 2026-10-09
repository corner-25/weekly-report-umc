/**
 * Mẫu email đôn đốc tiến độ công việc dành cho Thư ký / Đầu mối đơn vị.
 * Tuân thủ quy định hành chính Bệnh viện Đại học Y Dược TP.HCM:
 * - Hướng dẫn chuẩn về cách nhập nội dung báo cáo kết quả trên UMC-Office (tránh chỉ bấm hoàn thành suông).
 * - Thông tin liên hệ: Phường Chợ Lớn, TP.HCM · hanhchinh@umc.edu.vn · ĐT: 5421 & 5324.
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

  const subject = `[UMC-Office] Đôn đốc tiến độ ${items.length} công việc của ${safeDept} cần cập nhật báo cáo`;

  const itemRowsHtml = items
    .map((item, idx) => {
      const safeTitle = escapeHtml(item.title);
      const safeStatus = escapeHtml(item.status);
      const safeDue = item.dueDate ? item.dueDate.split('-').reverse().join('/') : 'Chưa có hạn';
      const link = `${appUrl}/dashboard/work/items/${item.id}`;
      const statusColor = item.isOverdue ? '#dc2626' : '#b45309';

      return `
        <tr>
          <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13.5px; vertical-align: top; width: 30px; text-align: center; color: #64748b; font-weight: 600;">
            ${idx + 1}
          </td>
          <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13.5px; vertical-align: top;">
            <a href="${link}" style="color: #0891b2; text-decoration: none; font-weight: 700; font-size: 14px; line-height: 1.4; display: block;">
              ${safeTitle}
            </a>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
              Trạng thái: <strong>${safeStatus}</strong> · Hạn chót: <strong>${safeDue}</strong>
            </div>
          </td>
          <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; font-size: 12.5px; vertical-align: top; text-align: right; white-space: nowrap;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; font-weight: 600; background: ${item.isOverdue ? '#fef2f2' : '#fffbeb'}; color: ${statusColor}; border: 1px solid ${item.isOverdue ? '#fecaca' : '#fde68a'};">
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
<body style="margin: 0; padding: 20px 10px; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.6;">
  <div style="max-width: 660px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #cbd5e1; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);">
    
    <!-- Header chuẩn UMC -->
    <div style="background: linear-gradient(135deg, #0891b2, #0e7490); padding: 22px 28px; color: #ffffff;">
      <div style="font-size: 12px; font-weight: 700; letter-spacing: 1px; opacity: 0.9; text-transform: uppercase;">
        BỆNH VIỆN ĐẠI HỌC Y DƯỢC TP. HỒ CHÍ MINH
      </div>
      <div style="font-size: 18px; font-weight: 800; margin-top: 4px; letter-spacing: 0.3px;">
        PHÒNG HÀNH CHÍNH · HỆ THỐNG QUẢN LÝ CÔNG VIỆC UMC-OFFICE
      </div>
    </div>

    <!-- Nội dung chính -->
    <div style="padding: 26px 28px;">
      <div style="font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 12px;">
        Kính gửi: Anh/Chị ${safeName} (Đầu mối phụ trách · ${safeDept}),
      </div>

      <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">
        Phòng Hành chính xin thông báo và đôn đốc tiến độ <strong>${items.length} công việc chỉ đạo</strong> của đơn vị hiện đang sắp đến hạn, quá hạn hoặc cần cập nhật tiến độ định kỳ:
      </p>

      <!-- Bảng danh sách công việc -->
      <table style="width: 100%; border-collapse: collapse; margin: 18px 0; background: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
        <thead>
          <tr style="background: #e2e8f0; color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
            <th style="padding: 10px 14px; text-align: center; width: 30px;">STT</th>
            <th style="padding: 10px 14px; text-align: left;">Nội dung công việc</th>
            <th style="padding: 10px 14px; text-align: right;">Tình trạng hạn</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHtml}
        </tbody>
      </table>

      <!-- KHUNG HƯỚNG DẪN CÁCH NHẬP BÁO CÁO KẾT QUẢ QUAN TRỌNG -->
      <div style="background: #f0fdf4; border: 1px solid #86efac; border-left: 5px solid #16a34a; border-radius: 8px; padding: 18px 20px; margin: 24px 0;">
        <div style="font-size: 14px; font-weight: 700; color: #166534; display: flex; align-items: center; margin-bottom: 8px;">
          📋 HƯỚNG DẪN BẮT BUỘC VỀ NỘI DUNG NHẬP BÁO CÁO TRÊN UMC-OFFICE:
        </div>
        <p style="font-size: 13px; color: #15803d; margin: 0 0 8px 0; font-style: italic;">
          (Để đảm bảo dữ liệu báo cáo có giá trị nghiệm thu phục vụ công tác điều hành của Ban Giám đốc, vui lòng lưu ý cách nhập báo cáo):
        </p>
        <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; color: #1e293b; line-height: 1.6;">
          <li style="margin-bottom: 6px;">
            <strong>1. Nêu rõ kết quả/sản phẩm cụ thể:</strong> Trình bày chi tiết công việc cụ thể đã giải quyết đến thời điểm hiện tại. <em>Tuyệt đối không để trống hoặc chỉ ghi chung chung "đang thực hiện", "đã làm".</em>
          </li>
          <li style="margin-bottom: 6px;">
            <strong>2. Cung cấp số liệu & văn bản minh chứng:</strong> Ghi rõ số/ký hiệu văn bản ban hành, tỷ lệ % tiến độ định lượng, kết luận cuộc họp hoặc đính kèm tệp văn bản/biên bản nghiệm thu liên quan.
          </li>
          <li style="margin-bottom: 6px;">
            <strong>3. Quy tắc chuyển trạng thái:</strong> <em>TUYỆT ĐỐI KHÔNG bấm chuyển trạng thái sang "Hoàn thành" nếu chưa có nội dung báo cáo kết quả cụ thể.</em> Việc bấm hoàn thành mà không có diễn giải kết quả sẽ bị coi là chưa hoàn tất báo cáo.
          </li>
        </ul>
      </div>

      <!-- Nút mở phần mềm -->
      <div style="text-align: center; margin: 26px 0 16px 0;">
        <a href="${appUrl}/dashboard/work/items" style="display: inline-block; background: #0891b2; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 4px rgba(8, 145, 178, 0.3);">
          🔗 Mở phân hệ Quản lý công việc trên UMC-Office
        </a>
      </div>

      <p style="font-size: 13px; color: #64748b; margin-top: 20px; font-style: italic; text-align: center;">
        Trân trọng cảm ơn sự phối hợp kịp thời của Anh/Chị và đơn vị.
      </p>
    </div>

    <!-- Chân trang liên hệ chuẩn mực theo yêu cầu -->
    <div style="background: #f8fafc; padding: 18px 28px; font-size: 12.5px; color: #475569; border-top: 1px solid #e2e8f0; line-height: 1.6;">
      <strong style="color: #0f172a; text-transform: uppercase;">Phòng Hành chính · Bệnh viện Đại học Y Dược TP. Hồ Chí Minh</strong><br>
      • Địa chỉ: <strong>Phường Chợ Lớn, TP. Hồ Chí Minh</strong><br>
      • Email tiếp nhận: <a href="mailto:hanhchinh@umc.edu.vn" style="color: #0891b2; text-decoration: none; font-weight: 600;">hanhchinh@umc.edu.vn</a><br>
      • Điện thoại nội bộ: <strong>5421</strong> (Phụ trách Quản lý Công việc) hoặc <strong>5324</strong> (Thư ký Phòng)
    </div>

  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}

