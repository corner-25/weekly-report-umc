/**
 * Model Z.AI cho từng việc — đổi qua biến môi trường, không phải sửa code.
 *
 * Đo ngày 05/10/2026 trên 16 việc của Phòng Bảo hiểm Y tế (so với glm-5.2):
 *   glm-4.5-air   khớp loại 13/16, tình trạng 12/16 · ~10,7k token · 36 giây
 *   glm-5.3-flash khớp loại 11/16, tình trạng 14/16 · ~21,8k token (suy luận) · 164 giây
 * glm-4.5-air rẻ hơn glm-5.2 nhiều lần mà chất lượng gần tương đương cho việc
 * phân loại → dùng cho các bước chạy hàng loạt. Trích số liệu chuẩn (ít token,
 * ảnh hưởng thẳng tới số chatbot trả lời) giữ glm-5.2.
 */
export const AI_MODELS = {
  /** Trích số liệu từ báo cáo tuần theo danh mục chỉ số. */
  extraction: process.env.ZAI_MODEL_EXTRACTION || 'glm-5.2',
  /** Theo dõi nhiệm vụ: xét luồng, đánh giá tình trạng từng việc. */
  tracking: process.env.ZAI_MODEL_TRACKING || 'glm-4.5-air',
  /** Quản lý công việc: gợi ý các bước, đánh giá tiến độ. */
  work: process.env.ZAI_MODEL_WORK || 'glm-4.5-air',
} as const;
