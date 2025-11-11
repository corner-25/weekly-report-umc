# Hệ thống Quản lý Báo cáo Tuần

Hệ thống quản lý báo cáo tuần cho các phòng ban, được xây dựng bằng Next.js, TypeScript, Prisma và PostgreSQL.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template)

## 🚀 Quick Deploy

**Deploy lên Railway trong 5 phút:** Xem hướng dẫn chi tiết tại [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md)

**GitHub Repository:** [corner-25/weekly-report-umc](https://github.com/corner-25/weekly-report-umc)

## Tính năng chính

### Module 1: Đăng nhập & Đăng ký
- ✅ Đăng ký tài khoản mới
- ✅ Đăng nhập với email/password
- ✅ Xác thực với NextAuth.js
- ✅ **Đổi mật khẩu trong Settings**

### Module 2: Trang tổng quan các tuần
- ✅ Hiển thị danh sách báo cáo tuần dạng grid cards
- ✅ Lọc theo năm
- ✅ Tìm kiếm theo số tuần
- ✅ Xem số phòng, số nhiệm vụ, trạng thái từng tuần
- ✅ Nút tạo mới, xem, sửa báo cáo

### Module 3: Tạo/Sửa báo cáo tuần
- ✅ **Trang tạo mới và trang chỉnh sửa hoàn chỉnh**
- ✅ Chọn tuần/năm với week picker (tự động tính từ ngày/đến ngày)
- ✅ Upload file biên bản (PDF, Excel, Word)
- ✅ **Xóa file đã upload**
- ✅ Chọn nhiều phòng ban
- ✅ **Quick Add phòng mới ngay trong trang (không cần rời khỏi form)**
- ✅ Nhập nhiệm vụ động cho mỗi phòng:
  - STT tự động tăng, Tên nhiệm vụ, Kết quả, Thời gian, Tiến độ %, Kế hoạch tuần sau
  - Đánh dấu nhiệm vụ quan trọng (⭐)
  - Thêm/xóa nhiệm vụ
  - **Confirm dialog khi xóa nhiệm vụ/phòng**
- ✅ Lưu nháp hoặc hoàn thành

### Module 4: Trang chi tiết tuần
- ✅ Xem file biên bản (Preview + Download)
- ✅ Tổng quan: Số phòng, số nhiệm vụ, ngày tạo
- ✅ Danh sách phòng (accordion/collapse)
- ✅ Hiển thị thông tin quan trọng (nhiệm vụ có ⭐) khi collapsed
- ✅ Expand/collapse xem tất cả nhiệm vụ
- ✅ Highlight nhiệm vụ quan trọng (background vàng nhạt)
- ✅ Progress bar cho từng nhiệm vụ

### Module 5: Quản lý phòng ban
- ✅ Danh sách phòng ban (bảng)
- ✅ Thêm/sửa/xóa phòng (Modal)
- ✅ Tìm kiếm phòng theo tên
- ✅ Soft delete (không xóa nếu có nhiệm vụ liên kết)
- ✅ Validation tên phòng không trùng

### Module 6: Settings
- ✅ Xem thông tin tài khoản
- ✅ Đổi mật khẩu
- ✅ Validation mật khẩu mới

## Công nghệ sử dụng

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS
- **Form validation**: Zod
- **Date handling**: date-fns
- **Password hashing**: bcryptjs

## Cấu trúc Database

### User
- id, email (unique), passwordHash, name, createdAt

### Week (Báo cáo tuần)
- id, weekNumber, year, startDate, endDate
- reportFileUrl (file biên bản)
- status (DRAFT | COMPLETED)
- createdById → User

### Department (Phòng ban)
- id, name (unique), description
- deletedAt (soft delete)

### Task (Nhiệm vụ)
- id, weekId, departmentId, orderNumber
- taskName, result, timePeriod, progress (0-100)
- nextWeekPlan, isImportant
- createdAt, updatedAt

## Hướng dẫn cài đặt

### 1. Cài đặt PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Windows:**
- Download từ: https://www.postgresql.org/download/windows/
- Cài đặt và khởi động PostgreSQL

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Tạo Database

```bash
# Truy cập PostgreSQL console
psql postgres

# Tạo database mới
CREATE DATABASE report_db;

# Tạo user (nếu cần)
CREATE USER your_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE report_db TO your_user;

# Thoát
\q
```

### 3. Cấu hình môi trường

Tạo file `.env` trong thư mục gốc (đã có file `.env.example` mẫu):

```env
# Database - Thay đổi theo cấu hình của bạn
DATABASE_URL="postgresql://your_user:your_password@localhost:5432/report_db?schema=public"

# Hoặc nếu dùng user mặc định (macOS/Linux)
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/report_db?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-change-this-in-production"

# File Upload
UPLOAD_DIR="./public/uploads"
```

**Tạo NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 4. Cài đặt dependencies

```bash
npm install
```

### 5. Khởi tạo Database

```bash
# Generate Prisma Client
npm run db:generate

# Tạo tables trong database
npm run db:push

# Hoặc dùng migrations (khuyến nghị cho production)
npm run db:migrate
```

### 6. (Optional) Seed dữ liệu mẫu

Tạo file `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Tạo user mẫu
  const passwordHash = await hash('123456', 12);

  const user = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash,
      name: 'Admin',
    },
  });

  // Tạo các phòng ban mẫu
  const departments = await Promise.all([
    prisma.department.create({ data: { name: 'Phòng Kế hoạch Tổng hợp', description: 'Quản lý kế hoạch' } }),
    prisma.department.create({ data: { name: 'Phòng Điều dưỡng', description: 'Quản lý điều dưỡng' } }),
    prisma.department.create({ data: { name: 'Phòng KHĐT', description: 'Khoa học đào tạo' } }),
  ]);

  console.log('Seed completed!');
  console.log('User email: admin@example.com');
  console.log('Password: 123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Thêm vào `package.json`:
```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

Chạy seed:
```bash
npm install -D ts-node
npx prisma db seed
```

### 7. Chạy ứng dụng

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

Truy cập: http://localhost:3000

## Sử dụng

### Đăng ký tài khoản đầu tiên
1. Truy cập http://localhost:3000
2. Tự động redirect đến trang đăng nhập
3. Click "Đăng ký ngay"
4. Nhập email, mật khẩu (tối thiểu 6 ký tự)
5. Sau khi đăng ký thành công, đăng nhập

### Thêm phòng ban
1. Vào "Quản lý Phòng"
2. Click "+ Thêm phòng"
3. Nhập tên phòng và mô tả
4. Lưu

### Tạo báo cáo tuần
1. Vào "Tổng quan"
2. Click "+ Tạo báo cáo mới"
3. Chọn ngày trong tuần (tự động tính tuần số)
4. Upload file biên bản (optional)
5. Chọn phòng từ dropdown và click "Thêm phòng"
6. Nhập các nhiệm vụ:
   - Điền đầy đủ thông tin
   - Click ⭐ để đánh dấu quan trọng
   - Click "+ Thêm nhiệm vụ" để thêm nhiệm vụ mới
7. Thêm phòng khác nếu cần
8. Click "Lưu nháp" hoặc "Hoàn thành & Lưu"

### Xem báo cáo
1. Vào "Tổng quan"
2. Click "Xem" trên card báo cáo
3. Xem tổng quan, file biên bản
4. Click "Xem tất cả X nhiệm vụ" để expand phòng
5. Click "Thu gọn" để collapse

## Database Management

### Xem database với Prisma Studio
```bash
npm run db:studio
```
Truy cập: http://localhost:5555

### Backup database
```bash
pg_dump -U your_user report_db > backup.sql
```

### Restore database
```bash
psql -U your_user report_db < backup.sql
```

## Troubleshooting

### Lỗi kết nối database
- Kiểm tra PostgreSQL đã chạy: `brew services list` (macOS) hoặc `sudo systemctl status postgresql` (Linux)
- Kiểm tra DATABASE_URL trong `.env` đúng chưa
- Kiểm tra user/password có quyền truy cập database

### Lỗi Prisma Client
```bash
npm run db:generate
```

### Lỗi upload file
- Tạo thư mục `public/uploads`:
```bash
mkdir -p public/uploads
```

## Cấu trúc thư mục

```
report-app/
├── app/
│   ├── api/              # API Routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── departments/  # Department CRUD
│   │   ├── weeks/        # Week report CRUD
│   │   └── upload/       # File upload
│   ├── auth/             # Auth pages (signin, signup)
│   ├── dashboard/        # Dashboard pages
│   │   ├── departments/  # Department management
│   │   └── weeks/        # Week reports
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── providers.tsx
├── components/           # Reusable components
│   └── Navbar.tsx
├── lib/                  # Utilities
│   ├── prisma.ts
│   └── auth.ts
├── prisma/
│   └── schema.prisma     # Database schema
├── public/
│   └── uploads/          # Uploaded files
├── types/
│   └── next-auth.d.ts
├── .env                  # Environment variables
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Tính năng có thể mở rộng

- [ ] Export báo cáo ra Excel/PDF
- [ ] Dashboard analytics với charts
- [ ] Email notifications
- [ ] Roles & Permissions
- [ ] Audit log
- [ ] Advanced search & filters
- [ ] Collaborative editing
- [ ] Mobile app

## License

MIT

## Liên hệ

Nếu có vấn đề, tạo issue hoặc liên hệ qua email.
