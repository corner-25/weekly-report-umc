import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:YYEGqWdLqchHITKHhtQFwrwSHMBeYYBE@caboose.proxy.rlwy.net:46621/railway?sslmode=require',
    },
  },
});

async function main() {
  console.log('🚀 Seeding Week 9/2026...');

  // Delete existing week 9 if exists
  const existing = await prisma.week.findUnique({
    where: { weekNumber_year: { weekNumber: 9, year: 2026 } },
  });
  if (existing) {
    await prisma.weekTaskProgress.deleteMany({ where: { weekId: existing.id } });
    await prisma.weekMetricValue.deleteMany({ where: { weekId: existing.id } });
    await prisma.week.delete({ where: { id: existing.id } });
    console.log('🗑️  Deleted existing week 9');
  }

  // Create Week 9
  const week = await prisma.week.create({
    data: {
      weekNumber: 9,
      year: 2026,
      startDate: new Date('2026-02-23'),
      endDate: new Date('2026-02-27'),
      status: 'DRAFT',
      createdById: 'cmhbqsybz0000kv2mgb1yvh0w',
    },
  });
  console.log('✅ Created week:', week.id);

  // ========== TASK PROGRESS ==========
  const taskProgressData: Array<{
    masterTaskId: string;
    orderNumber: number;
    result: string;
    timePeriod: string;
    progress: number | null;
    nextWeekPlan: string;
    isImportant: boolean;
  }> = [
    // === PHÒNG KẾ HOẠCH TỔNG HỢP ===
    {
      masterTaskId: 'cmknneb43000fugip8554g0m7', // Xây dựng tiêu chuẩn CLLS
      orderNumber: 1,
      result: 'Đăng điều hành tác nghiệp ngày 05/4/2025; Các khoa đã đăng ký xây dựng tiêu chuẩn chất lượng lâm sàng.\nPhòng KHTH đã gửi công văn đến Bộ Y tế đăng ký xây dựng tiêu chuẩn CLLS gồm:\n1. Tiêu chuẩn CLLS chẩn đoán và điều trị Hội chứng vành cấp - chuyên khoa Tim mạch\n2. Tiêu chuẩn CLLS chẩn đoán và điều trị Ung thư dạ dày - chuyên khoa Ngoại Tiêu hóa\n3. Tiêu chuẩn CLLS chẩn đoán và điều trị bệnh Parkinson - chuyên khoa Thần kinh\nSau khi Bộ Y tế ban hành biểu mẫu, phòng KHTH sẽ họp với 3 khoa để triển khai xây dựng',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnec6m000lugippg1grskg', // Phân quyền PT-TT
      orderNumber: 2,
      result: 'Ngày 13/2/2026, Bệnh viện đã ban hành Quyết định phân quyền PT-TT cho BS',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: 100,
      nextWeekPlan: 'Đã hoàn thành',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnecln000pugipy8fimoo0', // Hỗ trợ chuyên môn, hợp đồng
      orderNumber: 3,
      result: 'Hỗ trợ chuyên môn Bệnh viện: Thực hiện khi có văn bản mời hỗ trợ\nChương trình Ngoại kiểm 2025: Thực hiện hồ sơ thanh lý',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnedej000xugip7g3gt5he', // Danh mục kỹ thuật
      orderNumber: 4,
      result: '- Ngày 20/12/2023, Bộ Y tế đã phê duyệt bổ sung 250 DMKT trong TT 43-21. 96 DMKT ngoài TT43-21 chưa nhận phản hồi.\n- Ngày 18/10/2024, Bộ Y tế ban hành TT 23/2024/TT-BYT, TT 43-21 hết hiệu lực.\n- Ngày 24/10/2024, Phòng KHTH yêu cầu các khoa rà soát và đề xuất 755 DMKT.\n- Ngày 20/2/2025 hoàn tất Bộ hồ sơ, gửi Bộ Y tế 22/02/2025.\n- Ngày 26/2/2025 BYT phản hồi cần thực hiện theo NĐ 96.\n- Ngày 12/4/2025 họp lại với các CK, hạn 15/5/2025. Tổng hợp 389 DMKT.\n- Ngày 26/09/2025 trình ký BGĐ 699 DMKT.\n- Ngày 30/09/2025 gửi hồ sơ trình BYT.\n- Ngày 04/10/2025, nhận Phiếu trả hồ sơ từ Cục QL KCB - chưa đủ tài liệu minh chứng.',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: true,
    },
    {
      masterTaskId: 'cmknnedqh0011ugipw0gmwg8r', // Quy trình kỹ thuật
      orderNumber: 5,
      result: 'Soát xét QTKT khoa Ngoại Thần kinh, Phụ sản, Tai Mũi Họng, Giải phẫu bệnh, TMCT, Nội tim mạch…\nRà soát và phối hợp Khoa điều chỉnh theo góp ý trước khi trình Hội đồng Khoa học',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnee270015ugipm2cuve62', // Phác đồ điều trị
      orderNumber: 6,
      result: 'Soát xét và Trình hướng dẫn chẩn đoán và điều trị: Đang soát xét 300 HDCĐ ĐT các khoa gửi về phòng KHTH',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknneedx0019ugipbtomvq8m', // Biểu mẫu
      orderNumber: 7,
      result: 'Triển khai các biểu mẫu trong Thông tư 32/2023/TT-BYT:\n- Rà soát, so sánh các biểu mẫu của BYT ban hành và Bệnh viện\n- Format, gửi các ĐV liên quan và/hoặc ban hành toàn viện: Bản tóm tắt HSBA, Đơn đề nghị cung cấp thông tin HSBA, Giấy cam kết chấp thuận điều trị bằng hóa trị - xạ trị, xạ trị, Giấy cam kết từ chối sử dụng DVKCB\n- Rà soát, nghiên cứu, chỉnh sửa và đề nghị phòng CNTT xây dựng/điều chỉnh 13 biểu mẫu\nRà soát các biểu mẫu, quy trình ký số giấy tờ ngoại trú: Đang thực hiện',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknneeq1001dugipufwl7g9q', // Chủ trì/họp với các đơn vị
      orderNumber: 8,
      result: 'Họp lần 2 về công tác Tự đánh giá chất lượng bệnh viện theo tiêu chuẩn chất lượng quốc tế JCI - Chương 7',
      timePeriod: '26/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnef1v001hugipzju1e9qr', // Công tác khác (KHTH)
      orderNumber: 9,
      result: 'Soát xét và trình ký định mức lao động trực tiếp và định mức VTYT chi tiết của tất cả các DVKT toàn viện (4300)\nNghiên cứu "Đánh giá tai biến biến chứng sau phẫu thuật/thủ thuật theo Clavien Dindo – CCI tại Bệnh viện Đại học Y Dược TP. HCM": Đã trình Hội đồng đề cương nghiên cứu, đang tóm tắt tổng quan tài liệu, y văn',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },

    // === PHÒNG ĐIỀU DƯỠNG ===
    {
      masterTaskId: 'cmknnefdg001lugipdg107g91', // Xây dựng QTKT, quy định
      orderNumber: 1,
      result: '- Soát xét và gửi HĐĐD xét duyệt 01 hướng dẫn qua email: Phòng Điều dưỡng\n- Soát xét, hiệu chỉnh 01 tài liệu chuẩn bị xét duyệt: QTKT Khoa Tai Mũi Họng\n- Soát xét, hiệu chỉnh 02 tài liệu sau xét duyệt: 03 QTKT Khoa Phụ sản, Đơn nguyên GMHS SPK, Hóa trị\n- Kế hoạch triển khai tập huấn QT-QĐ chuyên môn chăm sóc NB năm 2026: Theo dõi tiến độ và tổng hợp phản hồi từ các Đơn vị',
      timePeriod: '23-27/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmlyjer5u0003ugu5ai3ocvn8', // Hoạt động chuyên môn ĐD
      orderNumber: 2,
      result: '* Giám sát quy trình kỹ thuật ĐD:\n- Số khoa/đơn vị giám sát: 23\n- Số lượt giám sát: 393\n- Số Điều dưỡng giám sát: 264\n- Quy trình cơ bản: 17\n- Quy trình chuyên khoa: 16\n- Tỷ lệ tuân thủ nhận dạng người bệnh: 100%\n- Tỷ lệ tuân thủ quy trình trung bình: 99,83%\n* Giám sát chỉ số chăm sóc:\n- Số khoa/đơn vị giám sát: 04\n- Số lượt giám sát: 96\n- Chỉ số chăm sóc: 10\n- Tỷ lệ tuân thủ trung bình: 100%\n* Giám sát tuân thủ thực hiện chương trình PRIME:\n- Số khoa/đơn vị giám sát: 16\n- Số lượt giám sát: 235\n- Tỷ lệ đạt 98,96%',
      timePeriod: '21/02/2026 - 27/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnefpf001pugipjfydslxn', // Bệnh án điện tử
      orderNumber: 3,
      result: '- Giám sát chưa tuân thủ ký số các biểu mẫu ghi chép của Điều dưỡng (12/02 - 25/02/2026): 438 biểu mẫu chưa ký số, 54 biểu mẫu chưa hoàn tất ký số tại thời điểm NB xuất viện. 3 loại phiếu tồn đọng nhiều nhất: công khai đơn thuốc ngoại trú (9), theo dõi chức năng sống (8), bàn giao phiên trực (8). 13 Khoa/ĐN còn tồn tại biểu mẫu chưa ký số: Cấp cứu (28 phiếu), Ngoại Thần kinh (9 phiếu)\n- Góp ý dự thảo chính sách dữ liệu bệnh viện\n- Phối hợp IT test tính năng người hướng dẫn thực hành\n- Họp Ban BAĐT về việc hoàn thuốc',
      timePeriod: '23-27/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknneg1f001tugipwleb14ut', // Đào tạo (ĐD)
      orderNumber: 4,
      result: '- Kế hoạch đánh giá và phân cấp năng lực khối ĐD/HS/KTY 2025-2026: Xếp lịch và chuẩn bị tổ chức thẩm định kết quả đánh giá phân cấp năng lực (Giai đoạn 3)\n- Chương trình thực hành lâm sàng ĐD khóa 5/2025: Lập bảng chi thù lao giảng dạy khóa 3, 4, đợt 1 khóa 5 (90%)\n- Hội thảo mở rộng "Bệnh án điện tử Điều dưỡng: Bắt đầu từ cơ bản": Truyền thông giới thiệu chương trình lần 1\n- Soát xét hồ sơ đào tạo: 01 lượt/02 hồ sơ CT đào tạo/hội thảo; 03 lượt/01 hồ sơ cử viên chức đi thi/đi học\n- Tiếp nhận 64 sinh viên CNĐD khóa 20, Trường ĐH Yersin Đà Lạt: Xây dựng bộ câu hỏi khảo sát sự hài lòng (50%)',
      timePeriod: '23-27/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnegph0021ugip2h09tz6g', // Vật tư (ĐD)
      orderNumber: 5,
      result: 'I. Theo dõi tỷ lệ sử dụng 14 QĐ mua sắm còn hiệu lực (88%, 84%, 39%, 90%, 31%, 18%, 100%, 28%, 54%, 43%, 13%, 13%, 11%, 3%)\nII. Rà soát/điều chỉnh đề xuất: Triển khai tổng hợp gói bổ sung 217 danh mục; Rà soát báo giá gói thầu bổ sung 2026 lần 1; Tổng hợp đề xuất tùy chọn mua thêm lần 1/2026\nIII. Trình HĐMS: Không có\nIV. Tham gia đánh giá gói thầu VTYT tiêu hao 2025 lần 16 (141 phần)\nV. Sự cố sản phẩm trúng thầu: không có\nVI. Tiếp nhận: 7 công văn NCC; 267 phiếu yêu cầu cấp hàng (12% điều chỉnh); Soát xét gói định mức; Theo dõi lưu kho cơ số; 30 BB xác nhận sử dụng VTYT nhiều kích cỡ; Thiết kế dashboard Power BI',
      timePeriod: '21/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknneh0w0025ugip012w71qf', // Quản lý nhân sự khối ĐD
      orderNumber: 6,
      result: '- Điều phối nhân sự ĐD - Hộ lý hỗ trợ các đơn vị: GMHS, CTCH, Hồi sức Ngoại TK, Ngoại TK, Lão - CSGN, HSTC và ekip ngoại trú\n- Phỏng vấn nghỉ việc cho 01 ĐD và 01 hộ lý có nguyện vọng nghỉ việc tháng 3, tháng 4/2026\n- Tiếp tục triển khai xây dựng KPIs khối Điều dưỡng',
      timePeriod: '31/01/2026 - 06/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnehom002dugipeyw7ax8v', // Đề án cải tiến (ĐD)
      orderNumber: 7,
      result: '- Xây dựng và hoàn thành hồ sơ đăng ký đề án cải tiến: "Hoàn thiện hệ thống quản lý sử dụng thuốc và chuẩn hóa tuân thủ thời gian thực hiện trên BAĐT tại các Khoa Lâm sàng"\n- Xây dựng và hoàn thành hồ sơ đăng ký đề án cải tiến: "Cải thiện trải nghiệm và mức độ hài lòng của NB nữ đối với dịch vụ đo điện tim tại phòng khám ngoại trú thông qua áp dụng quy trình sử dụng miếng dán ngực (Nipple covers)"\n- Thực hiện 05 Báo cáo kết quả đề án CTCL năm 2025 nộp Phòng QLCLBV\n- Xây dựng thuyết minh đề án CTCL năm 2026',
      timePeriod: '31/01/2026 - 06/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnei0r002hugipgctft3hi', // Quản lý dữ liệu (ĐD)
      orderNumber: 8,
      result: '- Cập nhật dashboard Power BI: Giám sát QTKT, Đánh giá HSBA, Tư vấn GDSK, Truyền máu, Giao nhận chế phẩm máu, Hồ sơ chưa ký số, Catheter TMNB, Sử dụng thuốc, Phiếu nhận định - bàn giao\n- Hỗ trợ phần mềm giám sát: QTKT, Chỉ số chăm sóc, HSBA, Tư vấn GDSK, PRIME duy trì, Báo cáo thiết bị, NB phân cấp chăm sóc, KSNK, Chỉ số loét - té ngã\n- Xuất dữ liệu thống kê khen thưởng khối ĐD/HS/KTY chuẩn bị Quốc tế Điều dưỡng\n- Tiếp tục xây dựng công cụ nhập và dashboard phân cấp năng lực',
      timePeriod: '23/02 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },

    // === PHÒNG KHOA HỌC VÀ ĐÀO TẠO ===
    {
      masterTaskId: 'cmlkdpt4y0001ugeqvhhndi8a', // Đào tạo (KHĐT)
      orderNumber: 1,
      result: '1.1. Sinh viên, học viên đang thực hành tại BV: 1.069 người\n- SV, HV Đại học Y Dược TP.HCM: 705\n- SV, HV từ các cơ sở y tế, trường ĐH khác: 31\n- HV thực hành để đủ ĐK xin cấp GPHNH KCB: 333\n1.2. Gửi đi đào tạo chuyên môn trong nước: 127 người\n1.3. Các lớp học đang tổ chức tại BV: 13 lớp / 189 học viên',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmlkdptu20005ugeq6th3tm28', // Chuyển giao kỹ thuật
      orderNumber: 2,
      result: 'Bệnh viện Âu Cơ: Chuyển giao kỹ thuật Phẫu thuật Tạo hình - Thẩm mỹ',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmlkdpu6j0009ugeq3yfwg8v3', // Nghiên cứu khoa học
      orderNumber: 3,
      result: '3.1. Đề tài NCKH đang thực hiện:\n- Cấp tỉnh (Sở KHCN TPHCM): 05 đề tài\n- Cấp cơ sở: 174 đề tài\n- Thử thuốc trên lâm sàng: 37 đề tài\n3.2. Cung cấp số liệu NCKH: 217 đề tài (58 TS, 68 ThS, 07 BS CKII, 39 BSNT, 45 SV-khác)',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmlkdpuj5000dugeqvpdxr2qh', // Hợp tác quốc tế
      orderNumber: 4,
      result: '- Báo cáo viên nước ngoài tham dự sự kiện: 0 lượt\n- Đi đào tạo nước ngoài (>= 10 ngày): 0 lượt\n- Đi đào tạo nước ngoài (< 10 ngày): 0 lượt\n- Tiếp khách nước ngoài đến làm việc tại BV: 1 đoàn\n- Ký kết hợp tác: 0\n- Tiếp nhận sinh viên nước ngoài: 02 lượt',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmlkdpuvp000hugeqrmrzcrml', // Sự kiện
      orderNumber: 5,
      result: 'Tổ chức: 01 Hội nghị / Hội thảo',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },

    // === PHÒNG QUẢN LÝ CHẤT LƯỢNG BỆNH VIỆN ===
    {
      masterTaskId: 'cmknneick002lugipbcy6loak', // Chuyên môn
      orderNumber: 1,
      result: 'Thực hiện kế hoạch giám sát QTKT chuyên môn khối Bác sĩ năm 2026\n- Xây dựng kế hoạch thực hiện\n- Thời gian giám sát: 03-11/2025',
      timePeriod: '31/12/2026',
      progress: 13,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknneio0002pugipjx59u8hg', // Dịch vụ hỗ trợ chuyên môn
      orderNumber: 2,
      result: 'Duy trì Bộ tiêu chí CLBV (phiên bản 2.0) và Thông tư 35/2024/TT-BYT:\n- Thành lập 02 Đoàn kiểm tra, đánh giá CLNB (Đoàn 1: 12 tổ; Đoàn 2: 04 tổ đánh giá tại 8 khoa LS, 4 CLS)\n- Lập bảng, giản đồ Gantt theo dõi tiến độ khắc phục\nISO 9001:2015: Duy trì chứng nhận cho 22 đơn vị (đánh giá duy trì 04/03/2025 hoàn thành; Khắc phục tồn tại; Họp Xem xét lãnh đạo 12/02/2026; Chuẩn bị đánh giá duy trì 02/2026) - 98%\nĐề án CTCL: Triển khai đề án 2026; Đánh giá hiệu quả 6 tháng đề án 2024; Hồ sơ khen thưởng đề án 2024\nJCI: Đề án khảo sát, đánh giá hiện trạng; Phân công chuyên viên phụ trách từng chương\nXây dựng KH giám sát ATVTTB năm 2026\nXây dựng KH giám sát, đánh giá 5S năm 2026',
      timePeriod: '31/12/2026',
      progress: 13,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: true,
    },
    {
      masterTaskId: 'cmknneizx002tugipkzq6wcpl', // An toàn người bệnh
      orderNumber: 3,
      result: 'Bộ chỉ số ATNB năm 2026: Thu thập số liệu định kỳ hàng tháng\nHoạt động giám sát ATNB: Xây dựng KH giám sát tuân thủ 6 ưu tiên ATNB năm 2026\nGiám sát 06 QTKT ĐD: Xây dựng KH giám sát QTKT chuyên khoa ĐD\nTổ chức xác minh: 02 trường hợp sự cố ngoài y khoa (liên quan thái độ giao tiếp) tại Khoa DDTC và khoa HMTT',
      timePeriod: '31/12/2026',
      progress: 13,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnejcp002xugipn2hnp4go', // Công tác khác (QLCL)
      orderNumber: 4,
      result: 'Thực hiện nội dung OGSM; Tầm nhìn - Sứ mạng - Giá trị cốt lõi của phòng theo chỉ đạo của BGĐ',
      timePeriod: 'Đang thực hiện',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },

    // === PHÒNG HÀNH CHÍNH ===
    {
      masterTaskId: 'cmknnejpm0031ugipva310d2z', // Công tác văn thư lưu trữ
      orderNumber: 1,
      result: 'Quản lý văn bản đi, đến:\n- Phát hành: 87 văn bản đi; 20 quyết định; 27 hợp đồng\n- Tiếp nhận 265 văn bản đến, xử lý đúng hạn 265/265 (100%)\n- Theo dõi tiến độ xử lý VB tuần: tổng 318 VB (Hoàn thành: 221; Đang xử lý: 48; Chưa xử lý: 49)\nQuản lý lưu trữ:\n- Xây dựng bảng mô tả công việc cho nhân viên số hóa\n- Lập dự án quản lý công việc cho nhân viên số hóa\nUMC Office: Điều chỉnh tính năng Tra cứu VB (tự động load dữ liệu năm 2026); Điều chỉnh màn hình Theo dõi VB',
      timePeriod: '28/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnek720035ugipal1ark62', // Công tác hành chính
      orderNumber: 2,
      result: 'Tổ chức sự kiện:\n- Tổ chức chương trình Gặp mặt đầu Xuân Bính Ngọ năm 2026\n- Tổ chức lễ kỷ niệm 71 năm ngày Thầy Thuốc Việt Nam 27/2 (27/02/1955 - 27/02/2026)\nLễ tân, tiếp đón:\n- Tiếp/đón khách VIP: 17 lượt\n- Tiếp 15 Đơn vị đến chúc mừng Ngày Thầy thuốc VN 27/02\nTổng đài:\n- Tiếp nhận 1.091 cuộc gọi đến; Nhỡ do từ chối: 71; Nhỡ do không bắt máy: 396; Đường dây nóng: 0\nTổ xe: 233 chuyến; Doanh thu: 106.030.000đ\nBãi xe: Doanh thu: 50.410.000đ',
      timePeriod: '28/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnekj50039ugipytc4pn8n', // Công tác tổng hợp
      orderNumber: 3,
      result: 'Tổng hợp báo cáo: BC hoạt động BV tháng 02/2026\nLập kế hoạch: Tổng hợp KH hoạt động năm 2026 các Khoa (bản điều chỉnh)\nCông tác giao ban: Thanh toán chi phí giao ban hành chính CS1 tháng 1/2026\nBộ chỉ số hoạt động BV: Kiểm tra, rà soát toàn bộ chỉ số; Kiểm thử, góp ý phòng CNTT\nQuy trình, quy định: Dự thảo Quy định tiếp nhận, xử lý phản ánh, kiến nghị, khiếu nại, tố cáo (70%)\nMua sắm: Gói thầu "Cung cấp quà tặng BV" năm 2026\nThuê kho lưu trữ: Đề nghị Phòng VTTB có ý kiến về gia hạn HĐ thuê kho Bình Chánh',
      timePeriod: '28/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },

    // === PHÒNG TỔ CHỨC CÁN BỘ ===
    {
      masterTaskId: 'cmlkdpwgp000zugeqr1pnavmx', // Công tác đào tạo
      orderNumber: 1,
      result: '- Hồ sơ cử viên chức tham gia đào tạo, tập huấn: Trong nước: 02 VC; Ngoài nước: 00 VC\n- Kế hoạch đào tạo tổ chức Chương trình đào tạo kỹ năng giao tiếp, thái độ phục vụ NB cho khối ngoại trú',
      timePeriod: '07/02/2026 - 13/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmlkdpwth0013ugeqhalaehre', // Tuyển dụng
      orderNumber: 2,
      result: 'Tổng hợp hồ sơ nhân sự nhận việc 01/3/2026 (60%)\nTổng hợp phỏng vấn 05 ứng viên',
      timePeriod: '09/02/2026 - 03/03/2026',
      progress: 60,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnel7n003hugipq7t7xmym', // Công tác chính sách
      orderNumber: 3,
      result: '- Khai báo danh sách tăng/giảm, điều chỉnh lương tham gia BHXH trong tháng\n- Lập hồ sơ đề nghị hưởng chế độ hưu trí, tử tuất và chế độ ốm đau/thai sản/dưỡng sức\n- Tổ chức đấu thầu mua sắm Bảo hiểm tai nạn con người năm 2026: Đã hoàn thành Tờ trình - QĐ - TB phê duyệt KQLCNT, Thư chấp thuận, BB hoàn thiện HĐ, Tờ trình phê duyệt dự thảo HĐ, HĐ mua BH',
      timePeriod: 'Thường xuyên',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnellu003lugipac4wlsko', // Công tác thi đua khen thưởng
      orderNumber: 4,
      result: 'Tổng ý kiến góp ý Hội đồng thẩm định về 02 quy chế: Quy chế Xét tặng danh hiệu bác sĩ tiêu biểu năm và trọn đời; Quy chế Xét tặng danh hiệu điều dưỡng, hộ sinh, kỹ thuật y tiêu biểu năm và trọn đời\nTrình hồ sơ khen thưởng đề án cải tiến chất lượng năm 2024',
      timePeriod: '07/02/2026 - 13/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmlyjerh30005ugu5q3f2z18m', // Công tác khác (TCCB) → Kiểm soát tuân thủ pháp luật
      orderNumber: 5,
      result: 'Kiểm soát tuân thủ pháp luật:\n1.1 Soát xét pháp lý hồ sơ trình ký: 22 hồ sơ (KHTH: 02, KHĐT: 04, VTTB: 03, CTXH: 01, KSKTYC: 12)\n1.2 Kiểm tra hồ sơ thanh toán: 352 hồ sơ\n1.3 Kiểm tra hồ sơ trình ký Ban Giám đốc: 211 hồ sơ',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnem43003pugip9c0pmq8i', // Tư vấn pháp lý
      orderNumber: 6,
      result: '- Xây dựng dự thảo Quy định tiếp nhận, hướng dẫn thực hành đối với người có văn bằng bác sỹ y khoa, bác sỹ YHCT, bác sỹ RHM\n- Góp ý dự thảo TT hướng dẫn Khung đạo đức trí tuệ nhân tạo quốc gia\n- Góp ý dự thảo Nghị định quy định về quyết toán vốn đầu tư dự án\n- Hệ thống hoá các văn bản pháp luật liên quan đến hoạt động BV (xây dựng pháp điển)\n- Góp ý hồ sơ thanh toán',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnemmc003tugipxnfpcr0s', // Phổ biến pháp luật
      orderNumber: 7,
      result: 'Luật Bảo vệ dữ liệu cá nhân và Nghị định hướng dẫn số 356/2025/NĐ-CP',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnemzp003xugiptopucblp', // Kiểm toán nội bộ
      orderNumber: 8,
      result: 'Thực hiện phân tích dữ liệu theo kế hoạch kiểm toán dịch vụ kỹ thuật',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },

    // === PHÒNG VẬT TƯ THIẾT BỊ ===
    {
      masterTaskId: 'cmlkdpzax001vugeq0x29uwdl', // Công tác cung ứng (VTTB)
      orderNumber: 1,
      result: 'Kho hóa chất sát khuẩn: Tồn kho 621.806.855đ (Nhập: 0đ; Xuất: 83.248.893đ)\nKho Vật tư thông dụng: Tồn kho 382.726.900đ (Nhập: 210.113.850đ; Xuất: 213.582.355đ)\nKho linh kiện phụ kiện: Tồn kho 1.209.876.489đ (Nhập: 1.663.200đ; Xuất: 60.631.190đ)\nKho VTYT tiêu hao: Tồn kho 8.546.366.346đ (Nhập: 6.007.804.861đ; Xuất: 5.556.192.688đ)\nKho hoá chất xét nghiệm: Tồn kho 17.555.715.332đ (Nhập: 1.155.861.652đ; Xuất: 4.595.461.885đ)',
      timePeriod: '13/02/2026 - 26/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmlkdpzng001zugeqqtz52365', // Công tác sửa chữa bảo trì bảo dưỡng TBYT
      orderNumber: 2,
      result: '- Tổng số công việc tiếp nhận: 96\n- Đã hoàn thành: 96\n- Công việc chưa xử lý: 0\n- Giá trị sửa chữa, bảo trì: 0 VND',
      timePeriod: '13/02/2026 - 26/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmlkdpzzz0023ugeq7i2bn9xj', // Thanh lý tài sản
      orderNumber: 3,
      result: '- Tổng số đề nghị và công văn: 6 (Đã giải quyết: 2; Tồn đọng: 5; Luỹ kế từ đầu năm: 195)\n- Công việc thực hiện: 8 (Đã giải quyết: 5; Tồn đọng: 8; Luỹ kế từ đầu năm: 239)',
      timePeriod: '13/02/2026 - 26/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },

    // === PHÒNG CÔNG NGHỆ THÔNG TIN ===
    {
      masterTaskId: 'cmknnenv80045ugipcw6b4q48', // HỆ THỐNG PHẦN MỀM
      orderNumber: 1,
      result: 'PM BHYT: Hỗ trợ video hướng dẫn đăng ký BH trên UMC Care; Thiết kế mẫu bảo lãnh DBV\nPM Tiếp nhận ngoại trú: Cảnh báo/chặn khi chọn BHYT/BH bảo lãnh không thỏa ĐK; Cung cấp số liệu UMC Care\nPM Tiểu phẫu: Xuất kho và hủy xuất kho VTYT theo luồng mới\nPM LCD hiển thị thứ tự CLS: Xử lý phát số phòng khám xương khớp\nPM HN/HT: Bổ sung thông tin cơ quan vào xuất excel\nPM Hội chẩn SPK: Bổ sung DS phiếu chỉ định nội trú\nPM Kết quả VS/KS/MD LS: Điều chỉnh thống kê đàm AFB\nPM Hội chẩn K Giáp: Hiển thị kết quả hội chẩn viêm ruột mạn, K vú trên EMR\nPM Hội chẩn U gan: Hiển thị nhiều kết luận CTscan cùng ngày\nPM Suất ăn: Bổ sung suất ăn trực tết\nWebsite Nội bộ: Điều chỉnh mẫu BC trực Lễ/Tết\nWebsite Đăng ký nghỉ phép: Cập nhật ngày BC trực Tết 2026\nDashboard PowerBI: Thời gian chờ KKB chốt 2026\nPM Thu ngân: Cảnh báo/chặn BHYT + tự động đồng bộ hoàn tiền UMC Care\nPM Hoá đơn: Xuất HĐ tự động nội trú cuối ngày (50%)\nPM Nội trú (EMR): Bổ sung chẩn đoán tuyến trước (20%); Chuyển địa chỉ mới (90%/60%); Kết quả CLS tab hội chẩn K vú, viêm ruột mạn (90%); Nhập xuất chuyển viện điều chỉnh\nPM TCKT: Chứng từ khấu trừ thuế TNCN vãng lai (40%)\nPM VP điện tử: Phân quyền cập nhật VB; Bổ sung ngày hiệu lực phụ lục HĐ\nUMC EMR (mobile): Xác nhận thuốc uống/tiêm (20%); Đăng nhập sinh trắc học (60%)\nUMC Home (mobile): Tra cứu VB load hết năm; Nâng cấp package Google 16KB\nUMC Care (mobile): Đăng ký BHYT khi đặt khám; Giao diện Thanh toán viện phí; Thông báo giá CLS; Mã QR hồ sơ NB; Nâng cấp package Google',
      timePeriod: '13-26/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmlkdpylw001nugeqhvh2z45b', // Hỗ trợ người dùng
      orderNumber: 2,
      result: 'Tổng: 384 lượt\n- Hỗ trợ máy tính, máy tính bảng: 61\n- Hỗ trợ máy in: 43\n- Hỗ trợ mạng: 0\n- Hỗ trợ máy scan: 4\n- Hỗ trợ về server: 0\n- Hỗ trợ tivi, máy chiếu: 1\n- Hỗ trợ phần mềm: 242\n- Hỗ trợ HN/HT, CME, họp trực tuyến: 4\n- Hỗ trợ khám sức khỏe ngoại viện: 0\n- Hỗ trợ chữ ký số: 11\n- Hỗ trợ email: 0\n- Hỗ trợ thống kê số liệu chuyên môn: 18',
      timePeriod: '13-26/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },

    // === PHÒNG CÔNG TÁC XÃ HỘI ===
    {
      masterTaskId: 'cmknneoa00049ugip000yn91a', // CTXH - Hỗ trợ NB
      orderNumber: 1,
      result: 'Tiếp cận, đánh giá, can thiệp tâm lý xã hội cho NB có nhu cầu tại các khoa: Lão-CSGN, PTTM, LTMM, Hô Hấp, Tiêu Hóa, ĐN HS Sau ghép, Ngoại Gan-Mật-Tụy, TMH, Nội thận-Thận nhân tạo, Nội tim mạch, Cấp cứu\nKết nối linh mục hỗ trợ tâm linh cho 22 người bệnh có nhu cầu\nĐánh giá tâm lý xã hội, hỗ trợ 04 bệnh nhi có hoàn cảnh khó khăn tại khoa PTTM thực hiện hồ sơ xin tài trợ phẫu thuật tim',
      timePeriod: '23/02 - 28/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmlkjcjv30001ugxycls0so53', // Công tác vận động tài trợ
      orderNumber: 2,
      result: 'Vận động tài trợ 111.000.000 đồng hỗ trợ NB khó khăn\nTổ chức Buổi tiếp nhận tài trợ 02 thùng bảo quản tạng từ Tập đoàn Apollo (27/02/2026)\nHoàn thiện bộ ấn phẩm Chăm sóc MTQ trực tiếp (Sổ ghi nhận, Brochure, khung thư cảm ơn)',
      timePeriod: '23/02 - 07/03/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnep5c004hugipy80c78c6', // Đào tạo, tập huấn (CTXH)
      orderNumber: 3,
      result: 'Tiếp nhận 01 sinh viên năm 4, ngành CTXH thực tập tốt nghiệp từ 23/02/2026 đến 30/05/2026\nTiếp 02 giảng viên, 13 sinh viên trường ĐH Y tế Phúc lợi Takasaki (Nhật Bản) tìm hiểu về hoạt động CTXH trong BV',
      timePeriod: '23/02 - 27/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },

    // === PHÒNG QUẢN TRỊ TÒA NHÀ ===
    {
      masterTaskId: 'cmlkjck8l0003ugxy9dmsoimn', // Quản lý cơ sở hạ tầng
      orderNumber: 1,
      result: '- Sửa chữa gạch bộp: lầu 3 (4 viên), lầu 9 (13 viên), lầu 13 (15 viên)\n- Thay thế tấm trần: lầu 12 (1223 tấm), tầng trệt khu B (97 tấm)\n- Sơn tường: tầng trệt khu B (24 m²), lầu 1 khu B (16 m²), lầu 2 khu B (14 m²)\n- Ốp tường tấm compact: lầu 12 (16 m²), lầu 13 (5 m²)\n- Chà ron nhà vệ sinh: lầu 7 (5 phòng), lầu 8 (11 phòng)\n- Hàn: băng ghế inox (3 cái), ghế xếp inox (8 cái)\n- Giám sát nhà thầu vệ sinh máy lạnh: miệng gió (54), AHU (2), máy lạnh treo tường (15), quạt hút (12)\n- Giám sát cài đặt carrier hệ chuyển mẫu chân không\n- Kiểm tra xử lý lỗi BMS\n- Lắp đặt đèn Exit trục thang bộ: 43 bộ\n- Sửa điện, mạng, ĐT phòng thẩm mỹ da lầu 8\n- Thay CB chống rò cho tủ DĐC: 8 cái',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmlkjckf00005ugxy14o0fn8p', // Quản lý môi trường BV
      orderNumber: 2,
      result: '- Giám sát hệ thống xử lý nước thải; vệ sinh môi trường; rà soát khối lượng chất thải\n- Nhập liệu phần mềm quản lý môi trường\n- Thực hiện hồ sơ thanh toán nhà thầu: Làm sạch, chất thải nguy hại, tái chế, sinh hoạt, côn trùng\n- Chăm sóc cây xanh\n- Khối lượng rác: Lây nhiễm 5.131kg; Nguy hại 425kg; Giấy 253kg; Nhựa 476kg; Sinh hoạt 24.750kg',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmlkjckll0007ugxymol07jdk', // An ninh trật tự
      orderNumber: 3,
      result: '- Kiểm soát tài sản ra vào cổng: 14 trường hợp\n- Hỗ trợ an ninh cho BGĐ và Lãnh đạo chúc xuân NB, NV 23/02/2026\n- Hỗ trợ an ninh đoàn: Bộ Y tế (25/02); Chủ tịch UBND TPHCM + các cơ quan ban ngành (27/02)\n- Hỗ trợ Đoàn TN tháo dỡ tiểu cảnh Tết tầng trệt + lầu 4\n- Bảo vệ cổng số 2 điều tiết xe\n- Phối hợp Công an Phường Chợ Lớn: tuần tra, dẹp hàng rong, phân luồng',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmlkjcks20009ugxylqu2zmbh', // Phòng cháy chữa cháy
      orderNumber: 4,
      result: '- Kiểm tra nhắc nhở hút thuốc lá: 16 trường hợp\n- Kiểm tra an toàn PCCC bếp lầu 3, lầu 4\n- Kiểm tra an toàn cầu thang bộ thoát hiểm\n- Phối hợp nhà thầu lập hồ sơ nghiệm thu PCCC cải tạo hầm 1 thành phòng hóa trị\n- Phối hợp lập hồ sơ xin phép cải tạo hầm 1, lầu 4 khu A\n- Lập quy chế hoạt động ban chỉ huy PCCC và đội PCCC\n- Kiện toàn thành viên Đội PCCC cơ sở',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmlkjckyk000bugxy1ce32pbh', // Mua sắm (QTTN)
      orderNumber: 5,
      result: 'Hồ sơ đấu thầu: Đang thực hiện 31 bộ',
      timePeriod: '23/02/2026 - 31/12/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmlkjcl53000dugxylbh8f6j0', // Khác (QTTN)
      orderNumber: 6,
      result: '- Sửa chữa tiếp nhận qua điện thoại: 192 công việc\n- Đề nghị của các Khoa/Phòng: Tiếp nhận 09 ĐN; Hoàn thành 05 ĐN',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },

    // === PHÒNG TÀI CHÍNH KẾ TOÁN ===
    {
      masterTaskId: 'cmknnepih004lugip58ktchld', // Tổ chức và thực hiện công tác kế toán
      orderNumber: 1,
      result: 'Thực hiện các công việc chuyên môn kế toán, đảm bảo an toàn kho quỹ, trực 24/7\nBáo cáo số dư ngân hàng, tiền mặt tuần 9 gửi Giám đốc\nThực hiện QĐ và Tờ trình phê duyệt phân phối các quỹ sau BCTC 2025 (80%)\nĐối chiếu công nợ với ĐH Y Dược TPHCM và các cơ sở thời điểm 31/12/2025',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnepxc004pugipk8depfxj', // Công tác cung ứng (TCKT - tài chính)
      orderNumber: 2,
      result: 'Điều chỉnh lại phương án tài chính mua sắm DSA, mua máy siêu âm Khoa Thần kinh\nChuẩn hóa báo cáo phân tích – quản trị – tham mưu giải pháp tài chính',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknneq8o004tugipg575403p', // Công tác Thuế
      orderNumber: 3,
      result: 'Tập hợp dữ liệu để phục vụ việc quyết toán thuế TNCN trước ngày 31/3/2026',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknneqvu0051ugipiqz3odpe', // Công tác xây dựng giá thành và DVKT
      orderNumber: 4,
      result: 'Tính toán, xây dựng giá dịch vụ theo yêu cầu của các đơn vị\nHồ sơ trình BYT phê duyệt giá BHYT các dịch vụ CĐHA sử dụng hệ thống PACS (không in phim)\nTheo dõi việc thực hiện xác nhận gói định mức thuốc, VTYT giữa thực tế sử dụng và đã xây dựng của các chuyên khoa PTTT đã triển khai',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknner7b0055ugip5flb5d6e', // Công tác khác (TCKT)
      orderNumber: 5,
      result: 'Tập hợp số liệu để thực hiện báo cáo Khảo sát số liệu về chi phí quản lý của dịch vụ KCB theo yêu cầu của Bộ Y tế',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },

    // === PHÒNG BẢO HIỂM Y TẾ ===
    {
      masterTaskId: 'cmknnerk50059ugips067i7dy', // Hành chính quản trị về bảo hiểm
      orderNumber: 1,
      result: 'Phối hợp với các đơn vị triển khai quy trình KCB đối với người có công, nhân sĩ, trí thức, cán bộ và một số đối tượng tiêu biểu khác trên địa bàn TP.HCM (50%)\nGiải đáp phản ánh NB Đào Vũ Tố Uyên từ Hotline SYT',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: 50,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmlkjclbh000fugxyrk0i8623', // Quản lý thanh toán bảo hiểm
      orderNumber: 2,
      result: 'Ngoại trú: 3.160 lượt KCB BHYT (tăng 159% so với tuần 08); Chi phí: 6.023.058.394đ (tăng 162%)\nNội trú: 902 lượt KCB BHYT (tăng 9%); Chi phí: 10.827.672.749đ (giảm 12%)',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnerxs005dugipta1mser3', // Giám định chi phí KCB BHYT
      orderNumber: 3,
      result: 'Thống nhất biên bản Giám định quý 3/2025\nThống nhất biên bản Giám định quý 4/2025 (80%)\nTriển khai Thông tư 12/2026/TT-BTC về trình tự, thủ tục giám định CP KCB BHYT (10%)',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnesb8005hugipgonyhigr', // Truyền dữ liệu
      orderNumber: 4,
      result: 'Tỷ lệ truyền dữ liệu XML hồ sơ KCB BHYT lên cổng tiếp nhận giám định BHYT: 100%',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnesnm005lugips8evv35r', // Quản lý DM Thuốc thanh toán BHYT
      orderNumber: 5,
      result: 'Báo cáo thống kê thuốc thanh toán BHYT quý IV năm 2025 (50%)',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: 50,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknneszm005pugipddmf9upa', // Quản lý DM VTYT thanh toán BHYT
      orderNumber: 6,
      result: 'Báo cáo thống kê VTYT thanh toán BHYT quý IV 2025 (80%)\nThông báo rà soát DVKT cho VTYT thanh toán BHYT\nThanh toán BHYT VTYT trúng thầu theo QĐ 140/QĐ-BVĐHYD, 167/QĐ-BVĐHYD',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: 80,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnete6005tugip077mt47c', // Quản lý DM DVKT thanh toán BHYT
      orderNumber: 7,
      result: 'Xem xét tạm ẩn/mở mã DVKCB Khoa CĐHA\nĐiều chỉnh tên DVKCB theo TT 23 - Khoa CĐHA\nMở mã DV xét nghiệm gửi đến Cty LABone\nXem xét bảng định mức VTYT Chụp nong ĐMV bằng bóng\nĐịnh mức VTYT, thuốc hóa chất Khoa Nội soi\nĐịnh mức VTYT Chụp nong ĐMV - ĐV CTNM\nTạm ngưng XN PIVKA\nĐiều chỉnh giá DV XN chuyển gửi BV TMHH',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnetpv005xugipyqwnabxe', // Bảo hiểm thương mại
      orderNumber: 8,
      result: 'Ngoại trú: 157 lượt; Tổng viện phí: 269.458.416đ (tăng 272%); Bảo lãnh: 193.340.140đ (tăng 264%); CP quản lý: 18.283.021đ (tăng 270%)\nNội trú: 4 lượt; Tổng viện phí: 104.920.281đ (tăng 771%); Bảo lãnh: 88.403.011đ (tăng 916%); CP quản lý: 1.050.000đ (tăng 250%)',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknneu1d0061ugipjboqivxj', // Công tác khác (BHYT)
      orderNumber: 9,
      result: 'Họp mặt đầu xuân 2026 "Mã đáo khai xuân"\nHội nghị NQ 79-NQ/TW\nHội nghị trực tuyến toàn quốc triển khai TT 12/2026/TT-BTC\nLễ kỷ niệm 71 năm ngày Thầy thuốc VN 2026\nHội thảo chuyên đề "Cập nhật kiến thức Sơ cứu tâm lý"',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: 100,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },

    // === TRUNG TÂM TRUYỀN THÔNG ===
    {
      masterTaskId: 'cmknneuda0065ugipmiwsptck', // TT - Marketing bên ngoài
      orderNumber: 1,
      result: '- Báo/Đài đăng tin: 97 tin bài\n- Báo/Đài phỏng vấn, ghi hình: 6 chủ đề (5 Báo, 1 Đài)\n- 03 bài viết sự kiện: Trái tim từ Bắc vào Nam hồi sinh bệnh nhi; Kỷ niệm 71 năm Ngày Thầy Thuốc VN; Họp mặt đầu Xuân Bính Ngọ 2026',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknneupf0069ugipglg18py1', // TT - Marketing nội bộ
      orderNumber: 2,
      result: '12 nội dung nội bộ: Giữ trọn tinh thần người thầy thuốc; Chúc mừng 71 năm Ngày Thầy Thuốc VN; TTND GS TS BS Trương Quang Bình; Kỷ niệm 71 năm; PGS hồi sinh trái tim; Chia đôi lá gan cứu hai sinh mạng; BV ĐHYD TP.HCM: vang bóng di sản; 18 dấu ấn 2025; Thủ Tướng phát biểu; Trái tim từ Bắc vào Nam; Họp mặt đầu Xuân; UMC 2026 khởi động',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnev0s006dugiptwgwcjzh', // Truyền thông kỹ thuật số
      orderNumber: 3,
      result: 'Facebook: 176 tin nhắn; 13 bài đăng; 267.861 followers (+1.596); 845.726 lượt xem; 14.967 tương tác\nWebsite: 16 bài; 37.118.030 lượt truy cập (+28.079)\nZalo: 13 bài; 11.063 người quan tâm (+7)\nYoutube: 6 video; 31.263.746 lượt xem (+31.316); 199.904 subscribers (+78)\nTikTok: 8.789 followers; 19 likes; 2.100 views; 2 videos\nEmail Marketing: 01 nội dung',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnevcf006hugipcckvntjn', // Khác (TTTT)
      orderNumber: 4,
      result: 'Chụp hình: 15 sự kiện\nKiểm tra định kỳ hoạt động LCD và standee điện tử\nTrực truyền thông: Tình hình ổn',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },

    // === ĐƠN VỊ QUẢN LÝ ĐẤU THẦU ===
    {
      masterTaskId: 'cmknnevzt006lugiptslbcpeb', // Công tác quản lý đấu thầu
      orderNumber: 1,
      result: 'I. Tổng số hồ sơ mua sắm đang thực hiện: 58 hồ sơ, tổng giá trị dự toán ~2.316 tỉ đồng\n- Đang xây dựng KHLCNT và YCKT: 08 hồ sơ\n- Đang LCNT: 50 gói thầu\nTổng số gói thầu BV đã thực hiện từ tháng 1/2025: 92 gói (~2.633 tỉ), 34 hoàn thành, 58 đang thực hiện\nII. Mua sắm do BV tự QĐ từ tháng 1/2026:\n- Từ 20-50 triệu đồng: 17 hồ sơ, tổng giá trị: 767.887.624 VND\n- Các nội dung khác: 00',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
    {
      masterTaskId: 'cmknnewe8006pugipnmsytlel', // Công tác nghiệp vụ
      orderNumber: 2,
      result: 'Rà soát hồ sơ:\n- Theo dõi tiến độ, xây dựng tiến độ các gói thầu\n- Hỗ trợ đơn vị: 46 gói thầu có nhân sự tham gia TCG, TTĐ\n- Soát xét hồ sơ (Tờ trình, QĐ, HĐ): 45 hồ sơ\n- Rà soát trình Hội đồng: HĐMS (00 gói thầu); HĐTĐT (03 hồ sơ mua sắm tại nhà thuốc CS3, 789 danh mục)\nĐăng tải thông tin: TBMCG: 05; KHLCNT: 02; TBMT: 09; KQLCNT: 04; HĐ điện tử: 00',
      timePeriod: '23/02/2026 - 27/02/2026',
      progress: null,
      nextWeekPlan: 'Tiếp tục thực hiện',
      isImportant: false,
    },
  ];

  // ========== METRIC VALUES ==========
  const metricData: Array<{ metricId: string; value: number; note?: string }> = [
    // PHÒNG KẾ HOẠCH TỔNG HỢP
    { metricId: 'cmknnex7c006xugipr9tj7fex', value: 1, note: 'Tính đến 26/02/2026: lũy kế 108 ca' }, // Ghép gan
    { metricId: 'cmknnexuu0071ugip8zow89oe', value: 2, note: 'Tính đến 26/02/2026: lũy kế 97 ca' }, // Ghép thận
    { metricId: 'cmknney6j0075ugipa17q4275', value: 2, note: 'Tính đến 26/02/2026: lũy kế 09 ca' }, // Ghép tim
    { metricId: 'cmknneyk70079ugipmpro73tf', value: 1832 }, // Kiểm tra, tiếp nhận HSBA
    { metricId: 'cmknnez27007dugip6le2tf00', value: 1583 }, // In mã lưu trữ
    { metricId: 'cmknnezhj007hugip8ngovmum', value: 34 }, // VB đến ngoại viện
    { metricId: 'cmknnezva007lugipxl3zgjdc', value: 1 }, // VB đi ngoại viện
    { metricId: 'cmknnf074007pugip7axkckob', value: 10 }, // VB nội bộ

    // PHÒNG ĐIỀU DƯỠNG
    { metricId: 'cmknnf0kf007tugipfkpv6jxc', value: 23 }, // Số đơn vị được giám sát
    { metricId: 'cmknnf0yv007xugip3xjjp1iw', value: 393 }, // Số lượt được giám sát
    { metricId: 'cmknnf1dr0081ugip50ml9o91', value: 264 }, // Số ĐD được giám sát
    { metricId: 'cmknnf1s30085ugipqd22gdgu', value: 17 }, // QT cơ bản
    { metricId: 'cmknnf2470089ugiphrv8xwo3', value: 16 }, // QT chuyên khoa
    { metricId: 'cmknnf2gv008dugipi44xaepr', value: 100 }, // Tỷ lệ tuân thủ nhận dạng NB
    { metricId: 'cmknnf2s5008hugip5x4uph7h', value: 99.83 }, // Tỷ lệ tuân thủ QT trung bình
    { metricId: 'cmknnf3ic008pugip5j52z2w8', value: 10 }, // Chỉ số chăm sóc
    { metricId: 'cmknnf3ww008tugip0qt2orby', value: 100 }, // Tỷ lệ tuân thủ trung bình (CS)
    { metricId: 'cmknnf4q00091ugipljrvu9ie', value: 98.96 }, // Tỷ lệ đạt (PRIME)

    // PHÒNG KHOA HỌC VÀ ĐÀO TẠO
    { metricId: 'cmknnf8d200a5ugipqhfpck8t', value: 333 }, // HV thực hành hành nghề
    { metricId: 'cmknnf8ox00a9ugipwicsr10h', value: 31 }, // HV, SV từ cơ sở khác
    { metricId: 'cmknnf90c00adugipjydnngse', value: 127 }, // Gửi đi đào tạo trong nước
    { metricId: 'cmknnf9c100ahugipa1v5mm4r', value: 5 }, // Đề tài NCKH cấp tỉnh
    { metricId: 'cmknnf9n900alugipitnxeiq2', value: 174 }, // Đề tài NCKH cấp cơ sở
    { metricId: 'cmknnf9zb00apugipbla1s11b', value: 37 }, // Đề tài thử thuốc
    { metricId: 'cmknnfaaz00atugipzqv1lptr', value: 58 }, // Số liệu NCKH TS
    { metricId: 'cmknnfan600axugippnfimdzs', value: 68 }, // Số liệu NCKH ThS
    { metricId: 'cmknnfb1d00b1ugip52i9wzrj', value: 7 }, // Số liệu NCKH CK2
    { metricId: 'cmknnfbgu00b5ugiph0pta4e2', value: 39 }, // Số liệu NCKH BSNT
    { metricId: 'cmknnfbv100b9ugipipttl2l0', value: 45 }, // Số liệu NCKH SV/khác
    { metricId: 'cmknnfcai00bdugipdijq19j4', value: 0 }, // BCV nước ngoài
    { metricId: 'cmknnfcxa00bhugipblmgngpx', value: 0 }, // ĐT nước ngoài >= 10
    { metricId: 'cmknnfdae00blugipi95hiqwr', value: 0 }, // ĐT nước ngoài < 10
    { metricId: 'cmknnfdlo00bpugipxaqg8zef', value: 1 }, // Tiếp khách nước ngoài
    { metricId: 'cmknnfdwx00btugipjvm4rm1d', value: 0 }, // Ký kết MOU
    { metricId: 'cmknnfe8s00bxugipw2o3l0q4', value: 2 }, // Tiếp nhận SV nước ngoài
    { metricId: 'cmknnfek800c1ugipm7cjkptt', value: 13 }, // Tổ chức lớp học
    { metricId: 'cmknnfevt00c5ugipkz7ht9ec', value: 1 }, // Tổ chức HN/HT

    // PHÒNG HÀNH CHÍNH
    { metricId: 'cmknnff7k00c9ugipu95yy90g', value: 87 }, // VB đi
    { metricId: 'cmknnffkr00cdugipklt2g7nh', value: 20 }, // QĐ
    { metricId: 'cmknnffwy00chugip37nrvwfg', value: 27 }, // HĐ
    { metricId: 'cmknnfg8r00clugip4y4th87w', value: 265 }, // VB đến
    { metricId: 'cmknnfgkf00cpugiptf0s36sw', value: 265 }, // VB đến xử lý đúng hạn
    { metricId: 'cmknnfgw500ctugipn6ychfhx', value: 17 }, // Tiếp đón VIP
    { metricId: 'cmknnfh8j00cxugippyk4c8mc', value: 1091 }, // Cuộc gọi đến
    { metricId: 'cmknnfhkm00d1ugip6hu4ansg', value: 71 }, // Nhỡ do từ chối
    { metricId: 'cmknnfhwd00d5ugiplbzri4bs', value: 396 }, // Nhỡ do không bắt máy
    { metricId: 'cmknnfi8t00d9ugip4jfx3w6n', value: 0 }, // Đường dây nóng
    { metricId: 'cmknnfikd00ddugip5w0g3z6a', value: 233 }, // Số chuyến xe
    { metricId: 'cmknnfiwn00dhugipauu2pgdg', value: 106030000 }, // DT tổ xe
    { metricId: 'cmknnfj8e00dlugip6vw10s03', value: 50410000 }, // DT bãi xe

    // PHÒNG TỔ CHỨC CÁN BỘ
    { metricId: 'cmknnfjqd00dpugipmbf4ku8f', value: 2 }, // ĐT trong nước
    { metricId: 'cmknnfk2500dtugipo7fft2h3', value: 0 }, // ĐT ngoài nước
    { metricId: 'cmknnfl1e00e5ugipcbrm1qby', value: 5 }, // Ứng viên phỏng vấn
    { metricId: 'cmknnflcw00e9ugiprjms3rfi', value: 2 }, // Soát xét KHTH
    { metricId: 'cmknnfoc400f5ugiptze9lv72', value: 4 }, // Soát xét KHĐT
    { metricId: 'cmknnfoo000f9ugipv0qci6ad', value: 3 }, // Soát xét VTTB
    { metricId: 'cmknnfm0a00ehugip1qg1bimg', value: 1 }, // Soát xét CTXH
    { metricId: 'cmknnfpne00flugipzsop454x', value: 12 }, // Soát xét KSKTYC
    { metricId: 'cmknnfqxs00g1ugipgke48wo4', value: 352 }, // Kiểm tra hồ sơ thanh toán
    { metricId: 'cmknnfral00g5ugipybn3ovzw', value: 211 }, // Kiểm tra hồ sơ trình ký BGĐ

    // PHÒNG VẬT TƯ THIẾT BỊ
    { metricId: 'cmknnfrmg00g9ugipyy1ghdjs', value: 0 }, // Nhập kho HC sát khuẩn
    { metricId: 'cmknnfry800gdugip5jn0we3j', value: 83248893 }, // Xuất kho HC sát khuẩn
    { metricId: 'cmknnfsa000ghugip2d31adur', value: 210113850 }, // Nhập kho VT thông dụng
    { metricId: 'cmknnfslw00glugipyx5el3fg', value: 213582355 }, // Xuất kho VT thông dụng
    { metricId: 'cmknnfsxq00gpugip2huhv69v', value: 1663200 }, // Nhập kho linh kiện
    { metricId: 'cmknnft9300gtugipjvhx361w', value: 60631190 }, // Xuất kho linh kiện
    { metricId: 'cmknnftkt00gxugip788igqn5', value: 6007804861 }, // Nhập kho VTYT tiêu hao
    { metricId: 'cmknnftwn00h1ugiprk17drt7', value: 5556192688 }, // Xuất kho VTYT tiêu hao
    { metricId: 'cmknnfu8f00h5ugip2vrrtedz', value: 1155861652 }, // Nhập kho HC xét nghiệm
    { metricId: 'cmknnfujq00h9ugipw4018yyg', value: 4595461885 }, // Xuất kho HC xét nghiệm
    { metricId: 'cmknnfuv600hdugip3lw7g7te', value: 96 }, // BT bảo dưỡng phát sinh
    { metricId: 'cmknnfvca00hhugipsa2asf7n', value: 96 }, // BT bảo dưỡng hoàn thành
    { metricId: 'cmknnfvox00hlugipt7yn9vk6', value: 0 }, // Giá trị sửa chữa
    { metricId: 'cmknnfw1400hpugipo0kh9dy7', value: 6 }, // ĐN, CV thanh lý nhận được
    { metricId: 'cmknnfwd500htugipnllweacu', value: 2 }, // ĐN, CV thanh lý đã hoàn thành
    { metricId: 'cmknnfwrj00hxugipccrzy62p', value: 8 }, // CV thanh lý nhận được
    { metricId: 'cmknnfx6u00i1ugipfc02n4n7', value: 5 }, // CV thanh lý đã hoàn thành

    // PHÒNG BẢO HIỂM Y TẾ
    { metricId: 'cmknnfxio00i5ugip8v6jm8nk', value: 3160 }, // Lượt KCB ngoại trú BHYT
    { metricId: 'cmknnfy0000i9ugips2qm4ps4', value: 6023058394 }, // Chi phí KCB ngoại trú BHYT
    { metricId: 'cmknnfygf00idugipewteu7ob', value: 902 }, // Lượt KCB nội trú BHYT
    { metricId: 'cmknnfyt200ihugipttz5nwvw', value: 10827672749 }, // Chi phí KCB nội trú BHYT
    { metricId: 'cmknnfz4p00ilugip7n6iba2r', value: 100 }, // Tỷ lệ truyền dữ liệu
    { metricId: 'cmknnfzg200ipugipsk5l0oez', value: 157 }, // Lượt KCB ngoại trú BHTM
    { metricId: 'cmknnfzrx00itugip45d840iw', value: 269458416 }, // Chi phí KCB ngoại trú BHTM
    { metricId: 'cmknng03h00ixugiplnjwsz83', value: 193340140 }, // Bảo lãnh ngoại trú
    { metricId: 'cmknng0fw00j1ugipowtjopda', value: 18283021 }, // CP quản lý ngoại trú
    { metricId: 'cmknng0re00j5ugipmvprq662', value: 4 }, // Lượt KCB nội trú BHTM
    { metricId: 'cmknng13o00j9ugipthsfq9e8', value: 104920281 }, // Chi phí KCB nội trú BHTM
    { metricId: 'cmknng1ey00jdugip01qeged2', value: 88403011 }, // Bảo lãnh nội trú
    { metricId: 'cmknng1qf00jhugipc2k5qedj', value: 1050000 }, // CP quản lý nội trú

    // TRUNG TÂM TRUYỀN THÔNG
    { metricId: 'cmknng21t00jlugip6z4ibdoh', value: 97 }, // Báo đài đăng tin
    { metricId: 'cmknng2d600jpugipjl0z2g1s', value: 6 }, // Báo đài PV
    { metricId: 'cmknng2qa00jtugip3ocw205l', value: 12 }, // Nội dung nội bộ
    { metricId: 'cmknng32a00jxugipz66qff1b', value: 13 }, // Số tin đăng FB
    { metricId: 'cmknng3eg00k1ugip7yf0cao7', value: 267861 }, // Followers FB
    { metricId: 'cmknng3q200k5ugipj5uf77rm', value: 845726 }, // Lượt xem FB
    { metricId: 'cmknng41k00k9ugipcdzug4pe', value: 14967 }, // Tương tác FB
    { metricId: 'cmknng4cz00kdugipfozp0czq', value: 16 }, // Số tin đăng Website
    { metricId: 'cmknng4ol00khugipfzforsgx', value: 37118030 }, // Lượt truy cập Website
    { metricId: 'cmknng50f00klugip5g0rw5iz', value: 13 }, // Số tin đăng Zalo
    { metricId: 'cmknng5bw00kpugipbtwdvo7w', value: 11063 }, // Lượt quan tâm Zalo
    { metricId: 'cmknng5np00ktugip7ico99wg', value: 6 }, // Số video Youtube
    { metricId: 'cmknng5z500kxugip60hye9ea', value: 199904 }, // Subscribers Youtube
    { metricId: 'cmknng6ar00l1ugipqrswpu06', value: 31263746 }, // Lượt xem Youtube
    { metricId: 'cmknng6m900l5ugip48lws355', value: 8789 }, // Followers Tiktok
    { metricId: 'cmknng76d00l9ugipb94byh7a', value: 2100 }, // Lượt xem Tiktok
    { metricId: 'cmknng7jx00ldugipdlsqa3st', value: 19 }, // Lượt thích Tiktok
  ];

  // Insert task progress using createMany (batch)
  await prisma.weekTaskProgress.createMany({
    data: taskProgressData.map((tp) => ({
      weekId: week.id,
      masterTaskId: tp.masterTaskId,
      orderNumber: tp.orderNumber,
      result: tp.result,
      timePeriod: tp.timePeriod,
      progress: tp.progress,
      nextWeekPlan: tp.nextWeekPlan,
      isImportant: tp.isImportant,
      completedAt: tp.progress === 100 ? new Date() : null,
    })),
  });
  console.log(`✅ Created ${taskProgressData.length} task progress entries`);

  // Insert metric values using createMany (batch)
  await prisma.weekMetricValue.createMany({
    data: metricData.map((mv) => ({
      weekId: week.id,
      metricId: mv.metricId,
      value: mv.value,
      note: mv.note || null,
    })),
  });
  console.log(`✅ Created ${metricData.length} metric value entries`);

  console.log('\n🎉 Week 9/2026 seeded successfully!');
  console.log(`   Tasks: ${taskProgressData.length}`);
  console.log(`   Metrics: ${metricData.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
