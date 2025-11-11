# Hướng dẫn Deploy lên Railway

## Bước 1: Chuẩn bị

1. Đăng nhập vào [Railway](https://railway.app)
2. Kết nối tài khoản GitHub của bạn với Railway

## Bước 2: Tạo Project mới

1. Nhấn "New Project"
2. Chọn "Deploy from GitHub repo"
3. Chọn repository: `corner-25/weekly-report-umc`
4. Railway sẽ tự động detect và deploy

## Bước 3: Thêm PostgreSQL Database

1. Trong project vừa tạo, nhấn "New"
2. Chọn "Database" → "Add PostgreSQL"
3. Railway sẽ tự động tạo database và add biến `DATABASE_URL`

## Bước 4: Cấu hình Environment Variables

Vào tab "Variables" của service và thêm các biến sau:

```bash
# Database (đã tự động có từ PostgreSQL service)
DATABASE_URL=postgresql://...

# NextAuth
NEXTAUTH_SECRET=<generate-a-random-secret>
NEXTAUTH_URL=https://your-app-name.up.railway.app

# Optional: File uploads
UPLOAD_DIR=/app/public/uploads
```

**Tạo NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

## Bước 5: Deploy

1. Railway sẽ tự động build và deploy
2. Đợi build hoàn tất (khoảng 3-5 phút)
3. Nhấn vào domain để xem app

## Bước 6: Run Database Migrations

Sau lần deploy đầu tiên, migrations sẽ tự động chạy nhờ startCommand trong `railway.json`:

```
npx prisma migrate deploy && npm start
```

## Bước 7: Tạo Admin User đầu tiên

1. Vào app qua domain Railway cung cấp
2. Nhấn "Đăng ký" để tạo tài khoản admin đầu tiên
3. Đăng nhập và bắt đầu sử dụng

## Kiểm tra logs

- Vào tab "Deployments" để xem deployment history
- Nhấn vào deployment để xem logs chi tiết
- Nếu có lỗi, kiểm tra:
  - Environment variables đã đúng chưa
  - Database đã connect được chưa
  - Migrations đã chạy thành công chưa

## Cập nhật code

Mỗi khi push code mới lên GitHub, Railway sẽ tự động:
1. Pull code mới
2. Build lại
3. Run migrations
4. Deploy

## Troubleshooting

### Lỗi "Failed to connect to database"
- Kiểm tra biến `DATABASE_URL` trong Variables
- Đảm bảo PostgreSQL service đang chạy

### Lỗi "NEXTAUTH_URL is not defined"
- Thêm biến `NEXTAUTH_URL` với domain Railway của bạn
- Format: `https://your-app-name.up.railway.app`

### Lỗi build
- Kiểm tra logs trong tab Deployments
- Thường do thiếu dependencies hoặc TypeScript errors

### Migration errors
- Vào Railway CLI: `railway run npx prisma migrate deploy`
- Hoặc reset database: `railway run npx prisma migrate reset`

## Railway CLI (Optional)

Cài đặt Railway CLI để quản lý từ terminal:

```bash
npm i -g @railway/cli
railway login
railway link
railway logs
railway run npx prisma studio
```

## Chi phí

- **Free tier**: $5 credit/month (đủ cho development)
- **Hobby plan**: $5/month cho unlimited usage
- PostgreSQL database: Free tier 500MB, sau đó ~$5/month

## Monitoring

- Dashboard: Xem CPU, Memory, Network usage
- Logs: Real-time logs trong tab Deployments
- Metrics: Theo dõi performance

---

**Chúc bạn deploy thành công!** 🚀
