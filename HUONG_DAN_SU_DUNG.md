# Hướng dẫn sử dụng Hệ thống Báo cáo Tuần

## Workflow hoàn chỉnh

### Bước 1: Thiết lập ban đầu

#### 1.1. Quản lý Phòng ban
- Truy cập: **Sidebar → Phòng ban**
- Thêm các phòng ban trong bệnh viện
- Ví dụ:
  - Phòng Kế hoạch Tổng hợp
  - Phòng Điều dưỡng
  - Phòng KHĐT
  - Phòng QLCL BV
  - ...

#### 1.2. Tạo Nhiệm vụ Thường kỳ (Master Tasks)
- Truy cập: **Sidebar → NV Thường kỳ** (hoặc `/dashboard/tasks`)
- Click "**+ Thêm nhiệm vụ thường kỳ**"
- Điền thông tin:
  - **Phòng ban**: Chọn phòng
  - **Tên nhiệm vụ**: VD: "Xây dựng tiêu chuẩn chất lượng lâm sàng"
  - **Mô tả**: Chi tiết về nhiệm vụ
  - **Thời gian dự kiến**: Số tuần (VD: 12 tuần)
- Lưu lại

> **Lưu ý**: Nhiệm vụ thường kỳ là các công việc định kỳ, lặp lại hàng tuần. Chỉ cần tạo 1 lần, sau đó mỗi tuần sẽ chọn từ danh sách này để cập nhật tiến độ.

---

### Bước 2: Tạo Báo cáo Tuần

#### 2.1. Tạo báo cáo mới
- Truy cập: **Sidebar → Báo cáo tuần** → Click "**+ Tạo báo cáo tuần mới**"
- Chọn ngày trong tuần → Hệ thống tự động tính tuần số

#### 2.2. Thêm Phòng ban vào báo cáo
- Chọn phòng từ dropdown
- Click "**+ Thêm phòng**"

#### 2.3. Cập nhật Nhiệm vụ Thường kỳ
Sau khi thêm phòng, bạn sẽ thấy 2 phần:

**🔄 NHIỆM VỤ THƯỜNG KỲ** (Màu xanh dương)
- Click dropdown "**Chọn nhiệm vụ thường kỳ từ danh sách**"
- Chọn nhiệm vụ từ danh sách Master Tasks của phòng đó
- Hệ thống hiển thị tiến độ tuần trước (nếu có)
- Cập nhật:
  - **Kết quả thực hiện tuần này**: Đã làm được gì
  - **Thời gian**: VD: "Tuần 40-42"
  - **Tiến độ (%)**: 0-100%
  - **Kế hoạch tuần sau**: Dự định làm gì
  - **⭐ Đánh dấu quan trọng**: Nếu cần

#### 2.4. Thêm Nhiệm vụ Phát sinh (nếu có)

**⚡ NHIỆM VỤ PHÁT SINH** (Màu xanh lá)
- Click "**+ Thêm nhiệm vụ phát sinh**"
- Điền thông tin:
  - **Tên nhiệm vụ**: VD: "Họp đánh giá tháng 10"
  - **Kết quả**: Mô tả kết quả
  - **Thời gian**: VD: "15-19/10"
  - **Tiến độ (%)**: 0-100%
  - **Kế hoạch tuần sau**: Ghi chú
  - **⭐ Đánh dấu quan trọng**: Nếu cần

> **Lưu ý**: Nhiệm vụ phát sinh là công việc đột xuất, KHÔNG lặp lại. Chỉ tồn tại trong tuần này, không xuất hiện ở tuần sau.

#### 2.5. Upload File biên bản (Tùy chọn)
- Hỗ trợ: PDF, Excel, Word
- Kéo thả hoặc click để chọn file

#### 2.6. Lưu báo cáo
- **Lưu nháp**: Chưa hoàn thành, có thể chỉnh sửa sau
- **Hoàn thành & Lưu**: Hoàn tất báo cáo tuần

---

## Sự khác biệt giữa 2 loại nhiệm vụ

| Tiêu chí | 🔄 Nhiệm vụ Thường kỳ | ⚡ Nhiệm vụ Phát sinh |
|----------|----------------------|---------------------|
| **Định nghĩa** | Công việc định kỳ, lặp lại | Công việc đột xuất, không lặp lại |
| **Tạo ở đâu** | Trang "NV Thường kỳ" (tạo 1 lần) | Trong báo cáo tuần (tạo mỗi tuần) |
| **Quản lý** | Tập trung, có lịch sử | Chỉ trong tuần hiện tại |
| **Tiến độ** | Theo dõi qua nhiều tuần | Chỉ trong 1 tuần |
| **Ví dụ** | "Xây dựng quy trình ISO" | "Họp khẩn cấp về COVID" |
| **Màu UI** | Xanh dương | Xanh lá |

---

## Ví dụ thực tế

### Phòng QLCL BV - Báo cáo Tuần 42/2024

#### 🔄 Nhiệm vụ Thường kỳ:
1. **Xây dựng tiêu chuẩn chất lượng lâm sàng**
   - Kết quả tuần này: Đã hoàn thành 3 tiêu chuẩn khoa Nội
   - Tiến độ: 45% (tăng từ 30% tuần trước)
   - Kế hoạch tuần sau: Triển khai tiêu chuẩn khoa Ngoại

2. **Kiểm tra định kỳ hồ sơ bệnh án**
   - Kết quả tuần này: Kiểm tra 120 hồ sơ
   - Tiến độ: 100% (hoàn thành)
   - Kế hoạch tuần sau: Tiếp tục đợt kiểm tra mới

#### ⚡ Nhiệm vụ Phát sinh:
1. **Họp đột xuất về sự cố y khoa**
   - Kết quả: Đã họp với 5 khoa liên quan, xác định nguyên nhân
   - Tiến độ: 100%
   - Kế hoạch: Báo cáo lên lãnh đạo BV

---

## Các tính năng khác

### Dashboard Tổng quan
- Xem thống kê tổng thể
- Nhiệm vụ đang thực hiện
- Nhiệm vụ đã hoàn thành
- Báo cáo tuần gần đây

### Báo cáo & Phân tích
- **Tổng hợp NV**: Xem tất cả nhiệm vụ theo phòng
- **Timeline**: Xem tiến độ theo thời gian
- **Số liệu**: Biểu đồ và thống kê

---

## Câu hỏi thường gặp

**Q: Làm sao biết nhiệm vụ nào nên là "Thường kỳ" hay "Phát sinh"?**
A:
- Thường kỳ: Nếu công việc lặp lại hàng tuần → Tạo Master Task
- Phát sinh: Nếu chỉ làm 1 lần trong tuần này → Thêm trực tiếp vào báo cáo

**Q: Nhiệm vụ thường kỳ đã hoàn thành (100%) có cần báo cáo nữa không?**
A: Có thể đánh dấu hoàn thành trong danh sách Master Tasks. Tuần sau không cần chọn nữa.

**Q: Upload file biên bản có bắt buộc không?**
A: Không, đây là tùy chọn.

**Q: Có thể sửa báo cáo tuần đã lưu không?**
A: Có, click vào báo cáo → Click "Chỉnh sửa"
