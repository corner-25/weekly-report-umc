/**
 * Bộ "bài kiểm tra" chatbot về hai năng lực:
 *  - Phân biệt nguồn: hỏi đúng phân hệ nào thì trả lời từ phân hệ đó (báo cáo tuần, sổ tiếp đoàn, MOU, công việc chỉ đạo).
 *  - Liên kết theo phòng ban / đối tác: gom thông tin của cùng một phòng, cùng một đơn vị từ nhiều phân hệ.
 * Đáp án lấy từ dữ liệu thật ngày 06/10/2026 — dữ liệu đổi thì sửa đáp án.
 * Chạy: npx tsx prisma/chatbot-knowledge-eval.ts
 */
export type SourceKind = 'weekly_report' | 'weekly_summary' | 'crm' | 'mou' | 'work' | 'org' | 'department';

export interface KnowledgeEvalCase {
  id: string;
  group: 'Phân biệt nguồn' | 'Theo phòng ban' | 'Liên kết chéo' | 'Câu mới (chưa từng chỉnh theo)';
  question: string;
  /** Câu trả lời phải dùng ít nhất một (any) hoặc tất cả (all) các nguồn này. */
  sources: { any?: SourceKind[]; all?: SourceKind[] };
  /** Mỗi phần tử là một nhóm "một trong các cách viết" — câu trả lời phải có đủ các nhóm (so không dấu). */
  mustMention: string[][];
  mustNotMention?: string[];
}

export const KNOWLEDGE_EVAL_CASES: KnowledgeEvalCase[] = [
  {
    id: 'src-weekly-ctxh-quy',
    group: 'Phân biệt nguồn',
    question: 'Theo báo cáo tuần, Phòng Công tác Xã hội đã làm gì với Quỹ Chạm Yêu Thương?',
    sources: { any: ['weekly_report'] },
    mustMention: [['Tường Vy', 'Lê Thị Mỹ Tâm', 'ghép tim']],
  },
  {
    id: 'src-crm-nd1-count',
    group: 'Phân biệt nguồn',
    question: 'Sổ tiếp đoàn ghi Bệnh viện Nhi Đồng 1 đến bệnh viện mình mấy lần?',
    sources: { any: ['crm'] },
    mustMention: [['2 lần', '2 lượt', 'hai lần', 'hai lượt', '**2**'], ['Chúc Tết']],
    mustNotMention: ['Nhi Đồng 2'],
  },
  {
    id: 'src-mou-quy-content',
    group: 'Phân biệt nguồn',
    question: 'MOU với Quỹ Chạm Yêu Thương ký những nội dung gì?',
    sources: { any: ['mou'] },
    mustMention: [['Chạm Yêu Thương']],
  },
  {
    id: 'src-work-hc',
    group: 'Phân biệt nguồn',
    question: 'Ban Giám đốc đang giao cho Phòng Hành chính những việc gì chưa xong?',
    sources: { any: ['work'] },
    mustMention: [['Hành chính']],
  },
  {
    id: 'dept-khdt-mou-count',
    group: 'Theo phòng ban',
    question: 'Phòng Khoa học và Đào tạo đang làm đầu mối bao nhiêu MOU còn hiệu lực?',
    sources: { any: ['mou'] },
    mustMention: [['30']],
  },
  {
    id: 'dept-ctxh-mou-list',
    group: 'Theo phòng ban',
    question: 'Phòng Công tác Xã hội phụ trách những MOU nào?',
    sources: { any: ['mou'] },
    mustMention: [['Chạm Yêu Thương'], ['Apollo'], ['Horus']],
  },
  {
    id: 'dept-khth-delegations',
    group: 'Theo phòng ban',
    question: 'Năm 2026 Phòng Kế hoạch Tổng hợp chủ trì tiếp bao nhiêu đoàn?',
    sources: { any: ['crm'] },
    mustMention: [['9']],
  },
  {
    id: 'dept-ctxh-week39',
    group: 'Theo phòng ban',
    question: 'Tuần 39 năm 2026 Phòng Công tác Xã hội báo cáo những việc gì?',
    sources: { any: ['weekly_report'] },
    mustMention: [['39'], ['hội thảo', 'Điểm chạm', 'Tây Ninh', 'tài trợ', 'Chạm Yêu Thương']],
    mustNotMention: ['Phòng Công nghệ Thông tin', 'Phòng Bảo hiểm Y tế'],
  },
  {
    id: 'dept-most-mou',
    group: 'Theo phòng ban',
    question: 'Phòng nào đang giữ nhiều MOU nhất?',
    sources: { any: ['mou'] },
    mustMention: [['Khoa học và Đào tạo', 'KHĐT']],
  },
  {
    id: 'dept-profile-ctxh',
    group: 'Theo phòng ban',
    question: 'Tóm tắt giúp tôi Phòng Công tác Xã hội đang phụ trách những gì: MOU, việc được giao, báo cáo gần đây.',
    sources: { any: ['department'] },
    mustMention: [['Chạm Yêu Thương'], ['tuần']],
  },
  {
    id: 'link-nd1-all',
    group: 'Liên kết chéo',
    question: 'Bệnh viện Nhi đồng 1 có những hoạt động gì với bệnh viện mình?',
    sources: { all: ['mou', 'crm'] },
    mustMention: [['MOU', 'ghi nhớ', 'hợp tác'], ['Chúc Tết'], ['ghép']],
    mustNotMention: ['Nhi đồng 2'],
  },
  {
    id: 'link-quy-all',
    group: 'Liên kết chéo',
    question: 'Quỹ Chạm Yêu Thương hợp tác với bệnh viện ra sao?',
    sources: { all: ['mou', 'weekly_report'] },
    mustMention: [['MOU', 'ghi nhớ', 'ký'], ['Tường Vy', 'ghép tim', 'Mỹ Tâm']],
  },
  {
    id: 'link-person-signer',
    group: 'Liên kết chéo',
    question: 'Ông Trương Quang Định là ai, liên quan gì tới bệnh viện mình?',
    sources: { any: ['org', 'mou', 'crm'] },
    mustMention: [['Nhi Đồng Thành phố', 'Nhi đồng Thành phố']],
  },
  {
    id: 'link-focal-vinmec',
    group: 'Liên kết chéo',
    question: 'Đầu mối liên hệ bên Vinmec Central Park là ai?',
    sources: { any: ['org', 'mou'] },
    mustMention: [['Trần Nguyên']],
  },
  {
    id: 'link-khth-mou-crm',
    group: 'Liên kết chéo',
    question: 'Phòng Kế hoạch Tổng hợp đang theo dõi MOU nào và gần đây chủ trì tiếp đoàn nào?',
    // Hồ sơ phòng ban đã gom MOU của phòng — dùng hồ sơ hay view MOU đều đúng nguồn.
    sources: { any: ['mou', 'department'] },
    mustMention: [['Nhi đồng', 'Nhi Đồng'], ['tiếp', 'đoàn']],
  },
  // ── Câu mới: viết sau khi đã sửa chatbot, không chỉnh chatbot theo các câu này — đo xem cải tiến có tổng quát không ──
  {
    id: 'new-tttt-mou',
    group: 'Câu mới (chưa từng chỉnh theo)',
    question: 'Trung tâm Truyền thông đang theo dõi những MOU nào?',
    sources: { any: ['mou', 'department'] },
    mustMention: [['Red Communications'], ['MCV'], ['HTV']],
  },
  {
    id: 'new-bv304-visits',
    group: 'Câu mới (chưa từng chỉnh theo)',
    question: 'Bệnh viện 30-4 đã đến bệnh viện mình những lần nào?',
    sources: { any: ['crm', 'org'] },
    mustMention: [['2025'], ['2026'], ['Chúc Tết']],
  },
  {
    id: 'new-hc-sep-delegations',
    group: 'Câu mới (chưa từng chỉnh theo)',
    question: 'Tháng 9/2026 Phòng Hành chính chủ trì tiếp những đoàn nào?',
    sources: { any: ['crm', 'department'] },
    mustMention: [['Nam A', 'Nam Á'], ['Mặt Trời'], ['Lạc Việt']],
  },
  {
    id: 'new-ueh-focal',
    group: 'Câu mới (chưa từng chỉnh theo)',
    question: 'Đầu mối bên Đại học Kinh tế TP.HCM (UEH) là ai?',
    sources: { any: ['org', 'mou'] },
    mustMention: [['Trương Minh Kiệt']],
  },
  {
    id: 'new-cntt-week40',
    group: 'Câu mới (chưa từng chỉnh theo)',
    question: 'Theo báo cáo tuần 40, Phòng Công nghệ Thông tin làm những gì?',
    sources: { any: ['weekly_report'] },
    mustMention: [['40'], ['phần mềm', 'chữ ký số', 'Giải phẫu bệnh', 'kiểm toán']],
    mustNotMention: ['Phòng Bảo hiểm Y tế'],
  },
];
