# HƯỚNG DẪN TRIỂN KHAI & SỬ DỤNG

## 🎯 Tổng quan

Hệ thống quản lý báo cáo tuần với Master Tasks - cho phép theo dõi tiến độ công việc của các phòng ban qua từng tuần.

## 🚀 Cài đặt & Chạy

### 1. Cài đặt dependencies

```bash
cd report-app
npm install
```

### 2. Cấu hình database

Tạo file `.env` từ `.env.example`:

```bash
cp .env.example .env
```

Cập nhật DATABASE_URL trong `.env`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/report_db"
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Setup database

```bash
chmod +x setup-db.sh
./setup-db.sh
```

Hoặc chạy thủ công:

```bash
npx prisma db push
npx prisma generate
npx prisma db seed
```

### 4. Chạy app

```bash
npm run dev
```

Mở trình duyệt: http://localhost:3000

### 5. Đăng nhập

**Tài khoản mặc định:**
- Email: `admin@example.com`
- Password: `123456`

---

## 📖 Hướng dẫn sử dụng

### Bước 1: Quản lý Phòng ban

1. Vào **Quản lý Phòng ban** từ menu
2. Click "Thêm phòng" để tạo phòng mới
3. Nhập tên và mô tả phòng
4. Lưu lại

### Bước 2: Tạo Master Tasks (Nhiệm vụ chính)

1. Vào **Quản lý Nhiệm vụ** từ menu
2. Click "Thêm nhiệm vụ"
3. Chọn phòng ban
4. Nhập:
   - Tên nhiệm vụ
   - Mô tả (optional)
   - Thời gian dự kiến (số tuần)
5. Lưu lại

**Lưu ý:** Master Tasks là nhiệm vụ lâu dài của phòng, sẽ được cập nhật tiến độ mỗi tuần.

### Bước 3: Tạo Báo cáo Tuần

1. Vào **Dashboard** → Click "Tạo báo cáo tuần mới"
2. Chọn ngày trong tuần (hệ thống tự động tính tuần)
3. Upload file biên bản (optional)
4. Chọn phòng ban
5. Chọn nhiệm vụ từ dropdown (các Master Tasks của phòng)
6. Nhập cho mỗi nhiệm vụ:
   - **Kết quả thực hiện:** Kết quả đạt được trong tuần
   - **Thời gian:** VD: "Tuần 40-42"
   - **Tiến độ (%):** 0-100%
   - **Kế hoạch tuần sau:** Kế hoạch cho tuần tiếp theo
7. Click "Hoàn thành & Lưu"

**Tips:**
- Hệ thống hiển thị tiến độ tuần trước để tham khảo
- Khi tiến độ đạt 100%, nhiệm vụ tự động đánh dấu hoàn thành
- Có thể đánh dấu nhiệm vụ quan trọng bằng ⭐

### Bước 4: Xem & Sửa Báo cáo

**Xem chi tiết:**
1. Vào Dashboard → Click vào card báo cáo tuần
2. Xem thông tin tổng quan
3. Click "Xem tất cả" để expand từng phòng

**Sửa báo cáo:**
1. Click nút "Sửa" trên card hoặc trang chi tiết
2. Cập nhật thông tin
3. Lưu lại

### Bước 5: Theo dõi Dashboard

Dashboard tổng quan hiển thị:
- **Số liệu tổng quan:** Tổng phòng, nhiệm vụ, progress
- **Nhiệm vụ đang thực hiện:** Top 5 nhiệm vụ đang làm
- **Báo cáo tuần gần đây:** 6 tuần gần nhất
- **Thao tác nhanh:** Quick access buttons

### Bước 6: Sử dụng Báo cáo & Phân tích

Hệ thống cung cấp 3 trang phân tích chuyên sâu:

**1. Tổng hợp Nhiệm vụ** (`/dashboard/tasks/overview`)
- Xem tất cả Master Tasks với lịch sử tiến độ đầy đủ
- Nhóm theo nhiệm vụ hoặc phòng ban
- Lọc theo phòng ban
- Xem chi tiết tiến độ từng tuần (có thể expand/collapse)
- Thống kê nhanh: Tổng, đang làm, hoàn thành, chưa bắt đầu

**2. Timeline (Gantt Chart)** (`/dashboard/reports/timeline`)
- Visualize tiến độ nhiệm vụ theo thời gian
- Trục ngang: Các tuần trong năm
- Trục dọc: Nhiệm vụ (nhóm theo phòng ban)
- Màu sắc theo % tiến độ (đỏ→cam→vàng→xanh dương→xanh lá)
- 2 chế độ xem: Theo quý (mỗi 4 tuần) hoặc tất cả tuần
- Hover để xem chi tiết kết quả từng tuần
- Thống kê theo quý

**3. Báo cáo Số liệu** (`/dashboard/reports/metrics`)
- Tổng quan năm: 8 chỉ số quan trọng
- Bảng chi tiết theo phòng ban với tất cả metrics
- Phân tích theo tháng: hoạt động và tiến độ
- Top 5 phòng ban xuất sắc (theo tỉ lệ hoàn thành)
- Top 5 nhiệm vụ có tiến độ cao nhất
- Lọc theo năm và phòng ban

---

## 🗂️ Cấu trúc Dự án

```
report-app/
├── app/
│   ├── api/
│   │   ├── auth/              # NextAuth endpoints
│   │   ├── departments/       # API phòng ban
│   │   ├── master-tasks/      # API nhiệm vụ chính
│   │   ├── weeks/             # API báo cáo tuần
│   │   └── upload/            # API upload files
│   ├── auth/                  # Login/Register pages
│   └── dashboard/
│       ├── page.tsx           # Dashboard tổng quan
│       ├── departments/       # Quản lý phòng ban
│       ├── tasks/             # Quản lý Master Tasks
│       │   ├── page.tsx       # Danh sách nhiệm vụ
│       │   └── overview/      # Tổng hợp nhiệm vụ
│       ├── weeks/             # Quản lý báo cáo tuần
│       │   ├── page.tsx       # Danh sách weeks
│       │   ├── new/           # Tạo báo cáo mới
│       │   └── [id]/          # Chi tiết & Edit
│       ├── reports/           # Báo cáo & Phân tích
│       │   ├── timeline/      # Timeline (Gantt)
│       │   └── metrics/       # Báo cáo số liệu
│       └── settings/          # Cài đặt
├── components/                # Shared components
│   └── Navbar.tsx            # Navigation với dropdown menu
├── lib/                       # Utilities
└── prisma/                    # Database schema & seed
```

---

## 🔧 Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** NextAuth.js
- **Styling:** Tailwind CSS v3
- **Language:** TypeScript

---

## 📊 Database Schema

### Các Models chính:

1. **User** - Tài khoản người dùng
2. **Department** - Phòng ban
3. **MasterTask** - Nhiệm vụ chính của phòng (lâu dài)
4. **Week** - Báo cáo tuần
5. **WeekTaskProgress** - Tiến độ nhiệm vụ từng tuần

### Quan hệ:

```
Department (1) → (n) MasterTask
MasterTask (1) → (n) WeekTaskProgress
Week (1) → (n) WeekTaskProgress
```

**Lưu ý:** Model `Task` cũ vẫn tồn tại để backward compatible.

---

## 🛠️ Các Lệnh Hữu Ích

```bash
# Chạy development
npm run dev

# Build production
npm run build

# Start production
npm start

# Xem database qua Prisma Studio
npx prisma studio

# Reset database (cẩn thận!)
npx prisma db push --force-reset
npx prisma db seed

# Generate Prisma Client (sau khi sửa schema)
npx prisma generate
```

---

## 🐛 Troubleshooting

### Lỗi database connection

Kiểm tra:
1. PostgreSQL đã chạy chưa?
2. DATABASE_URL trong `.env` đúng chưa?
3. Database đã tạo chưa?

### Lỗi "Module not found"

```bash
rm -rf node_modules package-lock.json
npm install
```

### Lỗi Prisma

```bash
npx prisma generate
npx prisma db push
```

---

## 📝 Notes

### Workflow khuyến nghị:

1. **Đầu tiên:** Tạo phòng ban
2. **Sau đó:** Tạo Master Tasks cho từng phòng
3. **Cuối cùng:** Tạo báo cáo tuần và chọn tasks để cập nhật

### Best Practices:

- Đặt tên Master Task rõ ràng, dễ hiểu
- Cập nhật tiến độ thường xuyên (mỗi tuần)
- Sử dụng mô tả để ghi chú chi tiết
- Đánh dấu ⭐ cho nhiệm vụ quan trọng/cấp bách

### Backup Data:

```bash
# Export database
pg_dump -U username -d report_db > backup.sql

# Import database
psql -U username -d report_db < backup.sql
```

---

## 🎓 Tài liệu tham khảo

- Next.js: https://nextjs.org/docs
- Prisma: https://www.prisma.io/docs
- NextAuth: https://next-auth.js.org
- Tailwind CSS: https://tailwindcss.com/docs

---

Cập nhật: 2025-10-19
Version: 2.0 (Master Tasks)
