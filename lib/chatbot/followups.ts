// Gợi ý câu hỏi tiếp theo dưới mỗi câu trả lời.
//
// Chọn theo view vừa tra thay vì nhờ model sinh: không tốn thêm một lượt gọi
// AI, không làm chậm câu trả lời, và mọi câu gợi ý đều là câu hệ thống đã biết
// trả lời được.

const FOLLOWUPS_BY_VIEW: Record<string, string[]> = {
  v_chatbot_vehicles: ['Xe nào sắp hết hạn bảo hiểm?', 'Xe nào lâu chưa bảo dưỡng?', 'Xe nào chạy nhiều chuyến nhất?'],
  v_chatbot_maintenance: ['Chi phí bảo dưỡng theo từng xe', 'Xe nào có số km bảo dưỡng bất thường?', 'Xe nào sắp hết hạn đăng kiểm?'],
  v_chatbot_fleet_summary: ['Doanh thu tổ xe các tuần gần đây', 'Xe nào chạy nhiều km nhất tháng này?', 'Nhiên liệu tiêu thụ theo từng xe'],
  v_chatbot_metrics: ['Chỉ số nào giảm mạnh so với tuần trước?', 'Số liệu nào đang có cờ cần rà soát?', 'So sánh với cùng kỳ tháng trước'],
  v_chatbot_tasks: ['Việc nào đang chậm tiến độ?', 'Tóm tắt kế hoạch tuần tới của các phòng', 'Phòng nào hoàn thành nhiều việc nhất tuần này?'],
  v_chatbot_hc_metrics: ['Tổng đài tuần qua nhỡ bao nhiêu cuộc?', 'Văn bản đến xử lý trễ hạn bao nhiêu?', 'Doanh thu bãi giữ xe các tuần gần đây'],
  v_chatbot_mou: ['Điều khoản MOU nào đang bị trễ?', 'Hoạt động hợp tác nào đang thực hiện?', 'MOU nào đã hết hạn?'],
  v_chatbot_mou_details: ['MOU nào sắp hết hạn trong 90 ngày?', 'Điều khoản nào sắp đến hạn?'],
  v_chatbot_licenses: ['Giấy phép nào vừa được gia hạn?', 'Giấy phép xe nào sắp hết hạn?', 'Giấy phép nào đã hết hạn?'],
  v_chatbot_license_renewals: ['Giấy phép nào sắp hết hạn?', 'Tháng này gia hạn bao nhiêu giấy phép?'],
  v_chatbot_events: ['Sự kiện nào còn checklist chưa hoàn thành?', 'Sự kiện nào chưa xác nhận?', 'Phòng họp nào còn trống cho 30 người?'],
  v_chatbot_event_checklists: ['Sự kiện nào diễn ra trong 7 ngày tới?', 'Checklist nào quá hạn?'],
  v_chatbot_meeting_rooms: ['Phòng họp nào có máy chiếu?', 'Sự kiện nào diễn ra trong 7 ngày tới?'],
  v_chatbot_vip_summary: ['Đơn vị nào đến thăm nhiều nhất?', 'So sánh lượt khách VIP các tháng'],
  v_chatbot_secretaries: ['Mỗi phòng có bao nhiêu chứng chỉ thư ký?', 'Tháng này điều chuyển bao nhiêu thư ký?'],
  v_chatbot_secretary_qualifications: ['Có bao nhiêu thư ký đang hoạt động?', 'Tháng này điều chuyển bao nhiêu thư ký?'],
  v_chatbot_secretary_transfers: ['Có bao nhiêu thư ký đang hoạt động?', 'Mỗi phòng có bao nhiêu chứng chỉ thư ký?'],
  v_chatbot_recruitment_summary: ['Có bao nhiêu thư ký đang hoạt động?', 'Vị trí nào có nhiều ứng viên nhất?'],
  v_chatbot_sync_health: ['Nguồn dữ liệu nào đang lỗi đồng bộ?', 'Tuần nào còn chờ duyệt nhập liệu?'],
  v_chatbot_import_health: ['Nguồn dữ liệu nào đang lỗi đồng bộ?', 'Chất lượng trích xuất AI tuần gần nhất thế nào?'],
  v_chatbot_extraction_quality: ['Tuần nào còn chờ duyệt nhập liệu?', 'Số liệu nào đang có cờ cần rà soát?'],
};

const MAX_FOLLOWUPS = 2;

/**
 * Gợi ý câu tiếp theo cho câu SQL vừa chạy.
 *
 * Bỏ câu trùng với câu vừa hỏi (không phân biệt hoa thường, dấu cách) để khỏi
 * gợi ý lại đúng câu người dùng vừa gõ.
 */
export function followupsFor(sql: string, question: string): string[] {
  const norm = (s: string) => s.toLowerCase().replace(/[?\s]+/g, ' ').trim();
  const asked = norm(question);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const [view, items] of Object.entries(FOLLOWUPS_BY_VIEW)) {
    if (!new RegExp(`\\b${view}\\b`, 'i').test(sql)) continue;
    for (const item of items) {
      const key = norm(item);
      if (key === asked || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= MAX_FOLLOWUPS) return out;
    }
  }
  return out;
}
