# TIẾN ĐỘ DỰ ÁN - Hệ thống Quản lý Báo cáo Tuần

## ✅ ĐÃ HOÀN THÀNH

### 1. Infrastructure & Setup
- ✅ Next.js 15 + TypeScript + Tailwind CSS v3
- ✅ PostgreSQL + Prisma ORM
- ✅ NextAuth.js authentication
- ✅ Database schema (đã redesign với MasterTask + WeekTaskProgress)
- ✅ Seed data mẫu (admin@example.com / 123456)

### 2. Authentication
- ✅ Trang đăng ký
- ✅ Trang đăng nhập
- ✅ Đổi mật khẩu (Settings page)
- ✅ Session management

### 3. Quản lý Phòng ban
- ✅ CRUD phòng ban (Modal UI)
- ✅ Tìm kiếm phòng
- ✅ Soft delete (kiểm tra có nhiệm vụ liên kết)
- ✅ Validation tên phòng unique

### 4. Quản lý Báo cáo Tuần (OLD - cần migrate)
- ✅ Tổng quan tuần (Grid cards)
- ✅ Filter theo năm, tìm kiếm
- ✅ Tạo báo cáo tuần mới
  - Week picker tự động
  - Upload file biên bản
  - Xóa file đã upload
  - Chọn nhiều phòng
  - Quick Add phòng mới
  - Dynamic tasks với confirm delete
- ✅ Sửa báo cáo tuần
- ✅ Xem chi tiết báo cáo
  - Accordion/collapse
  - Highlight important tasks
  - Progress bars

### 5. Master Tasks API
- ✅ GET /api/master-tasks (list + filter by department)
- ✅ POST /api/master-tasks (create)
- ✅ GET /api/master-tasks/[id] (detail + history)
- ✅ PUT /api/master-tasks/[id] (update)
- ✅ DELETE /api/master-tasks/[id] (with validation)

---

## 🚧 ĐANG LÀM (IN PROGRESS)

Không có gì đang làm - tất cả tính năng chính đã hoàn thành!

---

## 📋 CẦN LÀM TIẾP (TODO)

### 1. ✅ HOÀN THÀNH - Trang Master Tasks
File: `/app/dashboard/tasks/page.tsx`
- ✅ UI danh sách với bảng
- ✅ Modal Add/Edit Master Task
- ✅ Modal xem History (list các tuần đã làm + progress)
- ✅ Delete với confirmation
- ✅ Filter & Search

### 2. ✅ HOÀN THÀNH - API cho Week Reports mới
- ✅ Cập nhật `/api/weeks/route.ts` để dùng WeekTaskProgress
- ✅ Cập nhật `/api/weeks/[id]/route.ts`
- ✅ GET/POST/PUT/DELETE hoạt động với WeekTaskProgress

### 3. ✅ HOÀN THÀNH - Trang Tạo Báo cáo
File: `/app/dashboard/weeks/new/page.tsx`
- ✅ Thay form nhập tay → Dropdown chọn Master Task
- ✅ Load Master Tasks theo phòng
- ✅ Chỉ nhập: result, timePeriod, progress, nextWeekPlan
- ✅ Auto complete task khi progress = 100%
- ✅ Hiển thị tiến độ tuần trước (latestProgress)

### 4. ✅ HOÀN THÀNH - Trang Sửa Báo cáo
File: `/app/dashboard/weeks/[id]/edit/page.tsx`
- ✅ Load Master Tasks theo phòng
- ✅ Dropdown chọn task thay vì nhập tay
- ✅ Load existing WeekTaskProgress
- ✅ Update với taskProgress API

### 5. ✅ HOÀN THÀNH - Trang Xem Chi tiết
File: `/app/dashboard/weeks/[id]/page.tsx`
- ✅ Hiển thị từ WeekTaskProgress
- ✅ Hiển thị tên task từ Master Task
- ✅ Backward compatible với Task cũ
- ✅ Accordion/collapse cho từng phòng

### 6. ✅ HOÀN THÀNH - Trang Dashboard Tổng quan
File: `/app/dashboard/page.tsx`

Chức năng đã có:
- ✅ **Tổng quan số liệu:**
  - Tổng số phòng
  - Tổng số nhiệm vụ (Master Tasks)
  - Nhiệm vụ đang thực hiện
  - Nhiệm vụ đã hoàn thành

- ✅ **Danh sách nổi bật:**
  - Top 5 nhiệm vụ đang thực hiện (sorted by progress)
  - Báo cáo tuần gần đây (6 tuần)
  - Quick actions buttons

- ✅ **Progress bars:**
  - Progress bar cho từng task
  - Tổng progress hoàn thành

### 7. Trang Danh sách Weeks
File: `/app/dashboard/weeks/page.tsx`
- ✅ Danh sách đầy đủ báo cáo tuần
- ✅ Filter theo năm, tìm kiếm
- ✅ Grid cards với thông tin summary

---

## ⚠️ CẦN LÀM SAU (OPTIONAL)

### 1. Migration Data (nếu có data cũ)
File: `prisma/migrate-to-new-schema.ts`
- [ ] Script chuyển data từ Task → MasterTask + WeekTaskProgress
- [ ] Chạy migration
- [ ] Xóa model Task cũ (sau khi confirm)

### 2. Enhancements (tính năng mở rộng)
- [ ] Biểu đồ visualization (charts)
- [ ] Export báo cáo ra Excel/PDF
- [ ] Email notifications
- [ ] Timeline view cho nhiệm vụ
- [ ] Dashboard analytics nâng cao

---

## 🗂️ CẤU TRÚC DATABASE MỚI

```prisma
// Nhiệm vụ chung của phòng (Master)
MasterTask {
  id, departmentId, name, description
  estimatedDuration // Số tuần dự kiến
  weekProgress[] // History tiến độ
}

// Tiến độ từng tuần
WeekTaskProgress {
  id, masterTaskId, weekId
  orderNumber, result, timePeriod
  progress (0-100), nextWeekPlan
  isImportant, completedAt

  @@unique([masterTaskId, weekId]) // 1 task chỉ xuất hiện 1 lần/tuần
}
```

---

## 🔧 LỆNH QUAN TRỌNG

```bash
# Chạy app
npm run dev

# Xem database
npx prisma studio

# Push schema changes
npx prisma db push

# Generate Prisma Client
npx prisma generate

# Seed data
npx prisma db seed
```

---

## 📁 CẤU TRÚC PROJECT

```
app/
├── api/
│   ├── auth/
│   ├── departments/
│   ├── master-tasks/      ← MỚI
│   ├── weeks/             ← CẦN CẬP NHẬT
│   └── upload/
├── auth/
├── dashboard/
│   ├── page.tsx           ← Tổng quan tuần (hoặc → overview)
│   ├── departments/
│   ├── tasks/             ← MỚI - Quản lý Master Tasks
│   ├── weeks/
│   │   ├── new/           ← CẦN CẬP NHẬT
│   │   └── [id]/
│   │       ├── page.tsx   ← CẦN CẬP NHẬT
│   │       └── edit/      ← CẦN CẬP NHẬT
│   └── settings/
components/
├── Navbar.tsx             ← ĐÃ CẬP NHẬT
└── QuickAddDepartment.tsx
lib/
prisma/
```

---

## 💡 NOTES

1. **Luồng mới:**
   - Admin tạo Master Tasks cho từng phòng
   - Khi tạo báo cáo tuần → Chọn task từ danh sách
   - Mỗi tuần cập nhật tiến độ, không tạo task mới
   - Task tự động đánh dấu hoàn thành khi progress = 100%

2. **Backward Compatible:**
   - Model Task cũ vẫn giữ để tránh break
   - Sau khi migrate hết data → Có thể xóa

3. **UI/UX cần chú ý:**
   - Khi chọn task từ dropdown → Hiển thị tiến độ tuần trước
   - Highlight tasks sắp deadline
   - Notify khi task đạt 100%

---

## 🎯 PRIORITY

1. **HIGH:** Trang Master Tasks UI (đang làm)
2. **HIGH:** Cập nhật trang tạo/sửa báo cáo
3. **MEDIUM:** Trang Dashboard
4. **LOW:** Migration data cũ
5. **LOW:** Delete model Task

---

Cập nhật lần cuối: 2025-10-18
