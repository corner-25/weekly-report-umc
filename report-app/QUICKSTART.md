# 🚀 CHẠY NHANH (5 PHÚT)

## Yêu cầu
- Node.js 18+ đã cài đặt
- PostgreSQL đã cài đặt và chạy

## Các bước

### 1. Cài PostgreSQL (nếu chưa có)

**macOS:**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Windows:** Download từ https://www.postgresql.org/download/windows/

**Linux:**
```bash
sudo apt install postgresql
sudo systemctl start postgresql
```

### 2. Tạo Database

```bash
# Mở PostgreSQL console
psql postgres

# Trong psql, chạy:
CREATE DATABASE report_db;
\q
```

### 3. Cấu hình .env

```bash
# Copy file mẫu
cp .env.example .env

# Sửa DATABASE_URL trong .env
# Mặc định (user postgres, không password):
DATABASE_URL="postgresql://postgres:@localhost:5432/report_db?schema=public"
```

Tạo NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```
Copy kết quả vào `.env` dòng `NEXTAUTH_SECRET=`

### 4. Cài đặt & Chạy

```bash
# Cài dependencies
npm install

# Setup database
npm run db:generate
npm run db:push

# Seed dữ liệu mẫu (optional nhưng khuyến nghị)
npx prisma db seed

# Chạy app
npm run dev
```

### 5. Truy cập

Mở browser: **http://localhost:3000**

**Đăng nhập với:**
- Email: `admin@example.com`
- Password: `123456`

## Bạn đã xong! 🎉

### Làm gì tiếp theo?

1. **Thêm phòng ban:**
   - Menu → "Quản lý Phòng" → "+ Thêm phòng"

2. **Tạo báo cáo tuần:**
   - Menu → "Tổng quan" → "+ Tạo báo cáo mới"
   - Chọn ngày → Chọn phòng → Nhập nhiệm vụ → Lưu

3. **Xem báo cáo:**
   - Click "Xem" trên bất kỳ card báo cáo nào

## Các lệnh hữu ích

```bash
npm run dev           # Chạy development server
npm run db:studio     # Mở Prisma Studio (xem database)
npm run build         # Build production
npm run start         # Chạy production server
```

## Gặp lỗi?

### "Can't reach database server"
- Check PostgreSQL đang chạy: `brew services list` (macOS)
- Check DATABASE_URL trong `.env`

### "Prisma Client not found"
```bash
npm run db:generate
```

### Port 3000 đã dùng
```bash
PORT=3001 npm run dev
```

## Cần thêm giúp đỡ?

Đọc file **README.md** để biết hướng dẫn chi tiết.
