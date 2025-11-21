# 🚀 Hướng dẫn Push Database Schema lên Railway

## Cách 1: Sử dụng Railway CLI (Khuyến nghị)

### Bước 1: Mở Terminal và vào thư mục project

```bash
cd /Users/quang/Desktop/report-bgd/report-app
```

### Bước 2: Link với Railway project

```bash
railway link
```

Chọn:
- Workspace: **corner-25's Projects**
- Project: **weekly-report-umc**
- Environment: **production**

### Bước 3: Chạy script setup tự động

```bash
bash railway-setup.sh
```

Hoặc chạy từng lệnh thủ công:

```bash
# 1. Kiểm tra environment variables
railway variables

# 2. Generate Prisma Client
railway run npx prisma generate

# 3. Push database schema
railway run npx prisma db push

# 4. Deploy migrations
railway run npx prisma migrate deploy

# 5. Seed dữ liệu mẫu
railway run npx prisma db seed
```

---

## Cách 2: Qua Railway Dashboard (Nếu CLI không hoạt động)

### Bước 1: Vào Railway Dashboard

Truy cập: https://railway.com/project/82127d1a-930c-4574-bcc7-3ce41364ac8d

### Bước 2: Mở Console của PostgreSQL service

1. Click vào **PostgreSQL** service (không phải Next.js service)
2. Chọn tab **"Data"** hoặc **"Query"**
3. Bạn có thể xem tables ở đây

### Bước 3: Trigger Redeploy với migrate

1. Vào **Next.js service** (weekly-report-umc)
2. Tab **"Settings"**
3. Scroll xuống **"Deploy"**
4. Trong **"Start Command"**, đảm bảo có:
   ```
   npx prisma migrate deploy && npm start
   ```
5. Tab **"Deployments"**
6. Nhấn **"Redeploy"** → **"Use Latest Build"**

Migrations sẽ tự động chạy khi deploy.

---

## Cách 3: Sử dụng DATABASE_URL trực tiếp

### Bước 1: Lấy DATABASE_URL từ Railway

1. Vào PostgreSQL service
2. Tab **"Variables"** hoặc **"Connect"**
3. Copy **DATABASE_URL** (dạng: `postgresql://postgres:password@host:port/railway`)

### Bước 2: Chạy migrate từ local

```bash
# Export DATABASE_URL
export DATABASE_URL="postgresql://postgres:xxx@xxx.railway.app:5432/railway"

# Generate Prisma Client
npx prisma generate

# Push schema
npx prisma db push

# Seed data
npx prisma db seed
```

**⚠️ LƯU Ý:** Thay `postgresql://...` bằng URL thực tế từ Railway.

---

## Cách 4: Build Command trong Railway

### Cập nhật Build Command trong Railway Settings:

1. Vào Next.js service
2. Tab **"Settings"**
3. Scroll đến **"Build"** section
4. **Build Command:**
   ```
   npm install && npx prisma generate && npx prisma db push --accept-data-loss && npm run build
   ```

5. **Start Command:**
   ```
   npx prisma db seed && npm start
   ```

6. **Save** và **Redeploy**

---

## Verify Database đã setup thành công

### Qua Railway CLI:

```bash
# Mở Prisma Studio để xem data
railway run npx prisma studio
```

Browser sẽ mở http://localhost:5555 với database trên Railway.

### Qua Railway Dashboard:

1. Vào PostgreSQL service
2. Tab **"Data"**
3. Kiểm tra các tables:
   - ✅ User (có admin@example.com)
   - ✅ Department (có 10 phòng ban)
   - ✅ MasterTask
   - ✅ Week
   - ✅ Metric
   - ✅ WeekMetricValue

---

## Thông tin đăng nhập sau khi seed

Sau khi seed thành công, bạn có thể đăng nhập với:

```
📧 Email: admin@example.com
🔑 Password: 123456
```

**Truy cập:** https://weekly-report-umc.up.railway.app/auth/signin

---

## Troubleshooting

### Lỗi: "Environment variable not found: DATABASE_URL"

**Giải pháp:**
1. Vào PostgreSQL service → Tab "Variables"
2. Copy DATABASE_URL
3. Vào Next.js service → Tab "Variables"
4. Add variable:
   - Name: `DATABASE_URL`
   - Value: paste URL vừa copy
5. Hoặc: Click "New Variable" → "Add Reference" → Chọn Postgres.DATABASE_URL

### Lỗi: "Cannot find module 'ts-node'"

**Giải pháp:**
```bash
npm install --save-dev ts-node
```

Hoặc update seed command trong package.json:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

### Lỗi: "SSL connection required"

DATABASE_URL cần có `?sslmode=require` ở cuối:
```
postgresql://user:pass@host:port/db?sslmode=require
```

Railway thường tự động thêm, nhưng nếu không có, thêm thủ công.

---

## Kiểm tra logs

```bash
# Xem logs real-time
railway logs

# Xem logs của lần deploy gần nhất
railway logs --deployment
```

Hoặc vào Railway Dashboard → Tab "Deployments" → Chọn deployment → Xem logs.

---

## Next Steps

Sau khi database đã setup:

1. ✅ Truy cập app: https://weekly-report-umc.up.railway.app
2. ✅ Đăng nhập với admin@example.com / 123456
3. ✅ Tạo departments, master tasks
4. ✅ Bắt đầu tạo báo cáo tuần đầu tiên!

---

**Nếu gặp vấn đề, check Railway logs hoặc liên hệ!** 🚀
