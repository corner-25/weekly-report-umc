// Mirror of scripts/dept-hints.ts so the Next.js API route can import it.
// Keep these two files in sync until we migrate to a single shared location.

const GLOBAL_GROUPING_RULE = `
**QUY TẮC CHUNG (áp dụng MỌI phòng)**:
1. Mỗi masterTaskId chỉ xuất hiện TỐI ĐA 1 LẦN trong mảng "tasks". KHÔNG được tạo nhiều task entry cùng masterTaskId.
2. Nếu trong text có nhiều đoạn / nhiều dòng / nhiều subsection nói về cùng 1 master task → GỘP TẤT CẢ vào MỘT entry. Trường "result" = nối các dòng bằng "\\n".
3. Số task trả về <= số master task trong danh sách. KHÔNG được vượt.
4. Trước khi quyết định một số liệu là "không có metric riêng", PHẢI scan TOÀN BỘ danh sách metric. Đối chiếu tên viết tắt với tên đầy đủ.

5. **TASK MỚI (chưa có trong DB)**: nếu trong text có nhiệm vụ KHÔNG match được với BẤT KỲ master task nào → cho vào "newTasks": {taskName, result, suggestedMasterTaskName}. KHÔNG ép vào task gần đúng.

6. **TASK CŨ KHÔNG XUẤT HIỆN TUẦN NÀY**: master task không được nhắc tới → liệt kê masterTaskId vào "dormantTasks".

7. **METRIC MỚI**: số liệu định lượng không match metric nào → "newMetrics": {metricName, value, unit, context}.

8. Schema output đầy đủ: {tasks, metrics, newTasks, dormantTasks, newMetrics, unmatched}.
`;

export const DEPT_HINTS: Record<string, string> = {
  'kế hoạch tổng hợp': `
**HINT cho Phòng Kế hoạch Tổng hợp**:
- Metric "Ghép gan / Ghép thận / Ghép tim" là TÍCH LŨY — lấy số "lũy kế N ca" hoặc "ca thứ N" (CAO NHẤT).
- "Kiểm tra, tiếp nhận HSBA: 3.946" → metric tương ứng = 3946.
- "In mã lưu trữ: 1.532 HSBA" → 1532.
- 3 metric văn bản đến/đi/nội bộ riêng biệt.`,
  'điều dưỡng': `
**HINT cho Phòng Điều dưỡng**:
Task "Hoạt động chuyên môn điều dưỡng" có 3 section nested:
  - "* Giám sát quy trình kỹ thuật ĐD": Số đơn vị/lượt/ĐD giám sát, Quy trình cơ bản, chuyên khoa, tỷ lệ tuân thủ nhận dạng + quy trình trung bình.
  - "* Giám sát chỉ số chăm sóc": Chỉ số chăm sóc, Tỷ lệ tuân thủ trung bình.
  - "* Giám sát PRIME": Tỷ lệ đạt.
Chỉ lấy section #1 cho 3 metric đầu (Số đơn vị/lượt/ĐD giám sát).
"99,49%" → 99.49.`,
  'khoa học và đào tạo': `
**HINT cho Phòng Khoa học và Đào tạo**:
- Sinh viên/học viên chia theo loại (BSNT, ThS, NCS, Y, YTCC, DD-KTY, Dược, học viên thực hành, từ cơ sở khác).
- Đề tài NCKH: cấp tỉnh, cấp cơ sở, thử thuốc.
- "Cung cấp số liệu cho 230 đề tài (58 TS, 90 ThS, 12 CKII, 44 BSNT, 26 SV-khác)" → 5 metric riêng.`,
  'quản lý chất lượng': `
**HINT cho Phòng QLCL**: DB 4 master task. GỘP chi tiết vào 1 entry mỗi task. Số task <= 4.`,
  'hành chính': `
**HINT cho Phòng Hành chính**:
- Số tiền "94.650.495 đ" → 94650495.
- "Tổ xe" KHÁC "Bãi xe".
- "Đón tiếp khách VIP" = "Tiếp đón khách VIP".
- DB 3 master task. Số task <= 3.`,
  'tổ chức cán bộ': `
**HINT cho Phòng TCCB**:
Task "Kiểm soát tuân thủ pháp luật":
- "Phòng X: N" → metric "Soát xét pháp lý hồ sơ trình ký từ Phòng X". Tên viết tắt: HC=Hành chính, KH&ĐT=KHĐT, QTTN=Quản trị Tòa nhà, KSKTYC=Khoa Khám sức khỏe theo yêu cầu, CS2/CS3=Cơ sở 2/3, TT=Trung tâm Truyền thông, QLCL=Quản lý Chất lượng, CTXH=Công tác Xã hội.
- Đơn vị không có metric riêng → "Các đơn vị khác" (TỔNG).
- "1.2 Kiểm tra hồ sơ thanh toán" / "1.3 Kiểm tra hồ sơ trình ký BGĐ" → 2 metric.
- Đào tạo trong nước/ngoài nước, đi tham quan trong/ngoài nước, phỏng vấn ứng viên — đều có metric riêng.`,
  'công nghệ thông tin': `
**HINT cho Phòng CNTT**: DB 3 master task. Gộp chi tiết vào 1 entry. Số task <= 3.`,
  'công tác xã hội': `
**HINT cho CTXH**: DB 5 master task. Gộp. "Chương trình CSSK" = master "Công tác CSSK cộng đồng". Số task <= 5.`,
  'quản trị tòa nhà': `
**HINT cho QTTN**: DB 6 master task. GỘP TẤT CẢ chi tiết "-" "+" của cùng master vào 1 entry. KHÔNG split. Số task <= 6.`,
  'tài chính kế toán': `**HINT cho TCKT**: Số task <= 7.`,
  'bảo hiểm y tế': `
**HINT cho Phòng BHYT**:
- "Ngoại trú: Số lượt KCB BHYT là 4.427" → "Lượt KCB ngoại trú BHYT" = 4427.
- "Chi phí 6.706.664.377 đồng" (Ngoại trú) → "Chi phí KCB ngoại trú BHYT" = 6706664377.
- Tương tự nội trú.
- "Tỷ lệ truyền dữ liệu 100%" → 100.
- Bảo hiểm thương mại: 8 metric cho 2 nhóm ngoại/nội trú (lượt, chi phí, kinh phí bảo lãnh, chi phí quản lý).`,
  'truyền thông': `
**HINT cho Trung tâm Truyền thông**:
Theo nền tảng: Facebook, Website, Zalo, Youtube, Tiktok. Số "31.718.385" → 31718385. Bỏ "tăng/giảm so với tuần trước".`,
  'đấu thầu': `**HINT cho Đấu thầu**: DB 3 master task. Gộp. Số task <= 3.`,
};

export function getDeptHint(deptName: string): string {
  const lower = deptName.toLowerCase();
  let hint = GLOBAL_GROUPING_RULE;
  for (const [key, h] of Object.entries(DEPT_HINTS)) {
    if (lower.includes(key)) {
      hint += '\n' + h;
      break;
    }
  }
  return hint;
}
