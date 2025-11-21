# HƯỚNG DẪN CÀI ĐẶT NHANH

## Bước 1: Cài đặt PostgreSQL

### macOS
```bash
brew install postgresql@16
brew services start postgresql@16
```

### Windows
- Download: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
- Cài đặt với mật khẩu mặc định cho user `postgres`

### Linux
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

## Bước 2: Tạo Database

```bash
# Truy cập PostgreSQL (macOS/Linux)
psql postgres

# Windows: Mở "SQL Shell (psql)" từ Start Menu

# Tạo database
CREATE DATABASE report_db;

# Tạo user (optional)
CREATE USER report_user WITH PASSWORD 'report_password';
GRANT ALL PRIVILEGES ON DATABASE report_db TO report_user;

# Thoát
\q
```

## Bước 3: Cấu hình file .env

Copy file `.env.example` thành `.env` và chỉnh sửa:

```bash
cp .env.example .env
```

Sửa file `.env`:

```env
# Windows hoặc user mặc định
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/report_db?schema=public"

# Hoặc nếu bạn tạo user riêng
# DATABASE_URL="postgresql://report_user:report_password@localhost:5432/report_db?schema=public"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="paste-secret-key-vao-day"

UPLOAD_DIR="./public/uploads"
```

Tạo NEXTAUTH_SECRET:
```bash
# macOS/Linux
openssl rand -base64 32

# Windows (PowerShell)
# Tạo random string bất kỳ dài 32 ký tự
```

## Bước 4: Cài đặt dependencies

```bash
npm install
```

## Bước 5: Khởi tạo Database

```bash
# Generate Prisma Client
npm run db:generate

# Tạo tables
npm run db:push
```

## Bước 6: (Optional) Tạo dữ liệu mẫu

Tạo file `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash('123456', 12);

  const user = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash,
      name: 'Admin',
    },
  });

  await Promise.all([
    prisma.department.create({
      data: {
        name: 'Phòng Kế hoạch Tổng hợp',
        description: 'Quản lý kế hoạch'
      }
    }),
    prisma.department.create({
      data: {
        name: 'Phòng Điều dưỡng',
        description: 'Quản lý điều dưỡng'
      }
    }),
    prisma.department.create({
      data: {
        name: 'Phòng KHĐT',
        description: 'Khoa học đào tạo'
      }
    }),
    prisma.department.create({
      data: {
        name: 'Phòng QLCL BV',
        description: 'Quản lý chất lượng bệnh viện'
      }
    }),
  ]);

  console.log('✓ Seed completed!');
  console.log('Email: admin@example.com');
  console.log('Password: 123456');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Cài ts-node và chạy seed:
```bash
npm install -D ts-node
npx prisma db seed
```

## Bước 7: Chạy ứng dụng

```bash
npm run dev
```

Mở browser: http://localhost:3000

## Sử dụng lần đầu

1. **Đăng ký tài khoản**
   - Truy cập http://localhost:3000
   - Click "Đăng ký ngay"
   - Nhập email, password (min 6 ký tự)
   - Hoặc dùng tài khoản seed: `admin@example.com` / `123456`

2. **Thêm phòng ban**
   - Vào menu "Quản lý Phòng"
   - Click "+ Thêm phòng"
   - Nhập tên phòng
   - Lưu

3. **Tạo báo cáo tuần đầu tiên**
   - Vào "Tổng quan"
   - Click "+ Tạo báo cáo mới"
   - Chọn ngày trong tuần
   - Chọn phòng và nhập nhiệm vụ
   - Lưu

## Xem database

```bash
npm run db:studio
```

Truy cập: http://localhost:5555

## Các lệnh thường dùng

```bash
# Chạy development
npm run dev

# Build production
npm run build
npm run start

# Prisma commands
npm run db:generate    # Generate Prisma Client
npm run db:push       # Push schema changes to DB
npm run db:migrate    # Create migration
npm run db:studio     # Open Prisma Studio

# Lint
npm run lint
```

## Troubleshooting

### Lỗi: "Can't reach database server"
- Kiểm tra PostgreSQL đã chạy:
  ```bash
  # macOS
  brew services list

  # Linux
  sudo systemctl status postgresql

  # Windows: Check Services app
  ```
- Kiểm tra `DATABASE_URL` trong `.env`

### Lỗi: "Invalid `prisma.xxx()` invocation"
```bash
npm run db:generate
```

### Lỗi upload file
```bash
mkdir -p public/uploads
```

### Port 3000 đã được sử dụng
```bash
# Chạy trên port khác
PORT=3001 npm run dev
```

## Cấu trúc project đã tạo

```
report-app/
├── app/
│   ├── api/              # API endpoints
│   ├── auth/             # Đăng nhập/Đăng ký
│   ├── dashboard/        # Trang dashboard
│   │   ├── page.tsx      # Tổng quan tuần
│   │   ├── departments/  # Quản lý phòng
│   │   └── weeks/        # Tạo/xem báo cáo
│   ├── layout.tsx
│   └── page.tsx
├── components/           # Components
├── lib/                  # Utils
├── prisma/
│   └── schema.prisma     # Database schema
├── public/
│   └── uploads/          # File uploads
├── .env                  # Config
└── README.md            # Tài liệu đầy đủ
```

## Tính năng đã hoàn thành

✅ Đăng ký/Đăng nhập
✅ Tổng quan các tuần (grid cards)
✅ Tạo báo cáo tuần mới
✅ Chọn tuần/năm tự động
✅ Upload file biên bản
✅ Nhập nhiều phòng & nhiệm vụ
✅ Đánh dấu nhiệm vụ quan trọng (⭐)
✅ Lưu nháp / Hoàn thành
✅ Xem chi tiết báo cáo
✅ Expand/collapse phòng
✅ Highlight nhiệm vụ quan trọng
✅ Quản lý phòng ban (CRUD)
✅ Tìm kiếm & filter

## Hỗ trợ

Nếu gặp vấn đề:
1. Đọc README.md (hướng dẫn đầy đủ)
2. Check console logs
3. Xem Prisma Studio để debug database
4. Google error message

Good luck! 🚀
